/**
 * The keys the Tab page's editor takes (`docs/specs/2026-10-25-tab-editing-design.md`): on the drawn
 * tab, on the staff's own cursor (issue #136), and off the tab on the playback line. Each handler
 * reads the editor as it is and changes it through the callbacks it is given.
 */
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';
import { isRest, type Duration, type Part } from './clip';
import { clearNote, columnAt, columnCount, deleteColumns, fillBar, indexOf, insertColumn, MAX_FRET, moveColumn, noteAt, placeOf, removeEmptyBar, selectedRange, setFret, type Cursor, type Selection, type Target } from './editing';
import { makeRest, stepDuration } from './noteEdits';
import type { WordHit } from './layoutText';
import type { MarkHit } from './marks';
import type { Notice } from './notice';
import { movedPitch, moveNotes, moveToString, notesToMove, pitchOf, stepPitch, stringAtPitch, toggleStaffNote } from './staffEntry';
import { applyCyclingKey, applyTupletKey, toolForKey, type ToolId } from './tools';
import { jumpCursor, jumpFocus, jumpForKey, type Lines } from './jumps';
import { setValue } from './noteEdits';
import { lengthOf, stepLength } from './inputLength';
import { digitOfCode, nextInChord, pitchAt, selectedNotes, stepFrets, valueForDigit } from './normalMode';

/** How long after one digit a second one joins it into a two-digit fret. */
const SECOND_DIGIT_MS = 1000;

/** The digit just typed, so a second one soon after on the same spot makes a two-digit fret. */
export type LastDigit = { spot: string; digit: number; at: number } | null;

/** The editor as a key finds it, and how a key changes it. */
export interface EditorKeys {
  clip: Part;
  cursor: Cursor;
  selection: Selection | null;
  /** What the tools change: the selection, else the cursor's note, or its whole column with no string picked. */
  target: Target;
  /** No string is picked: the cursor is on its column only. */
  columnOnly: boolean;
  picked: WordHit | MarkHit | null;
  /** The staff cursor's pitch while it has the keys, else null. */
  staffPitch: number | null;
  /** The notation staff is drawn (Staff or Both), so Alt+↑ ↓ on a selection move its notes' pitch. */
  staffShown: boolean;
  lastDigit: RefObject<LastDigit>;
  /** Each drawn line of tab's first and last column, for Shift+Home / End (worked out only when asked). */
  lines: () => Lines;
  /** Settings' "Fill short bars with rests": → and ← complete a short bar they leave. */
  fillBars: boolean;
  /**
   * Note input (issue #238): the cursor types, as the tab always did. Off, normal mode: what the
   * cursor is on is selected, and MuseScore's keys change it.
   */
  inputMode: boolean;
  setInputMode: (on: boolean) => void;
  /** Note input's length (`inputLength.ts`): the next note entered on a rest takes it. */
  inputLength: Duration;
  setInputLength: (length: Duration) => void;
  /** Alt+← →: picks the next or last note, rest, mark or word (`elements.ts`). */
  stepElement: (step: 1 | -1) => void;
  /** Records an edit as one undo step and moves the cursor (by default it and the selection stay). */
  commit: (next: Part, cursor?: Cursor, selection?: Selection | null) => void;
  /** The cursor on the column at a pitch, the staff cursor on that pitch. */
  toPitch: (next: Part, at: Cursor, pitch: number, selection: Selection | null) => void;
  setColumnOnly: (columnOnly: boolean) => void;
  /** A selection starts: the string and the staff's cursor let go. */
  startRegion: () => void;
  setPicked: (picked: null) => void;
  deletePicked: (hit: WordHit | MarkHit) => void;
  editPicked: (hit: WordHit) => void;
  addBar: (where: 'before' | 'after') => void;
  onTool: (id: ToolId) => void;
  /** Sounds a note just entered (when the reader asked for it). */
  hearNote: (at: Cursor) => void;
  onNotice: (notice: Notice) => void;
  /** Takes the playback line away. */
  dropLine: () => void;
  /** The tab lets the keys go. */
  leave: () => void;
}

/** A key on the drawn tab. */
export function editorKeyDown(e: ReactKeyboardEvent<HTMLDivElement>, editor: EditorKeys) {
  const { clip, cursor, selection, target, columnOnly, picked, lastDigit, commit } = editor;
  const { key } = e;
  const count = columnCount(clip);
  // A modifier on its own does nothing: holding Alt (or Shift) to step leaves a picked mark or word picked.
  if (key === 'Alt' || key === 'Shift' || key === 'Control' || key === 'Meta') return;
  // Alt+← → step through notes, rests, marks and words, as MuseScore's do (issue #238), from a picked one too.
  if ((key === 'ArrowLeft' || key === 'ArrowRight') && e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    editor.stepElement(key === 'ArrowRight' ? 1 : -1);
    return;
  }
  // A picked mark: Delete takes it away (the note stays), Esc lets it go; any other key lets it go and does what it does.
  if (picked?.kind === 'mark') {
    if (key === 'Delete' || key === 'Backspace') {
      e.preventDefault();
      editor.deletePicked(picked);
      return;
    }
    editor.setPicked(null);
    if (key === 'Escape') {
      e.preventDefault();
      return;
    }
  }
  // A picked word: Delete takes it away, Enter edits it, Esc lets it go; any other key lets it go and does what it does.
  if (picked && picked.kind !== 'mark') {
    if (key === 'Delete' || key === 'Backspace') {
      e.preventDefault();
      editor.deletePicked(picked);
      return;
    }
    if (key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      editor.editPicked(picked);
      return;
    }
    editor.setPicked(null);
    if (key === 'Escape') {
      e.preventDefault();
      return;
    }
  }
  if (key === ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    // Space on the tab never types or scrolls; while the footer shows, the page-wide key plays.
    e.preventDefault();
    return;
  }
  const handled = () => e.preventDefault();
  const plain = !e.ctrlKey && !e.metaKey && !e.altKey;
  // N goes into note input and back out (issue #238), as in MuseScore; Esc leaves it too.
  if (key === 'n' && plain) {
    handled();
    editor.setInputMode(!editor.inputMode);
    return;
  }
  if (key === 'Escape' && editor.inputMode) {
    handled();
    editor.setInputMode(false);
    return;
  }
  // Shift and a digit's key set the length on the tab (MuseScore's tab keys): Shift+5 a quarter. In note
  // input that is the next note's length; in normal mode, the selected notes'.
  const shiftedDigit = e.shiftKey && plain && editor.staffPitch === null ? digitOfCode(e.code) : null;
  if (shiftedDigit !== null) {
    handled();
    const value = valueForDigit(shiftedDigit);
    if (value && editor.inputMode) editor.setInputLength(lengthOf(value));
    else if (value) commit(setValue(clip, target, value));
    return;
  }
  if (!editor.inputMode) {
    if (normalKeyDown(e, editor)) handled();
    if (e.defaultPrevented) return;
  } else {
    // On the staff in note input a digit is the next note's length, as in MuseScore: 5 a quarter, 3 a
    // sixteenth (8, 9 and 0 are none). It never types a fret there.
    if (editor.staffPitch !== null && /^[0-9]$/.test(key) && plain) {
      handled();
      const value = valueForDigit(Number(key));
      if (value) editor.setInputLength(lengthOf(value));
      return;
    }
    if (editor.staffPitch !== null && staffKeyDown(e, editor, editor.staffPitch)) {
      handled();
      return;
    }
    if (moveKeyDown(e, editor)) {
      handled();
      return;
    }
  }
  if (jumpKeyDown(e, editor)) {
    handled();
    return;
  }
  // Ctrl/⌘+Delete goes on to Delete below, which takes the time away with it.
  if ((e.ctrlKey || e.metaKey) && key !== 'Delete' && key !== 'Backspace') {
    if (key === 'Enter') {
      e.preventDefault();
      editor.addBar(e.shiftKey ? 'before' : 'after');
    }
    if (key.toLowerCase() === 'a' && count > 0) {
      e.preventDefault();
      const last = placeOfLast(clip);
      commit(clip, { ...cursor, ...last }, { anchor: 0, focus: count - 1 });
      editor.startRegion();
    }
    // Copy, cut and paste arrive as clipboard events; undo is the page's.
    return;
  }
  // With Alt, a digit is a tuplet (Alt+3 a triplet), not a fret.
  if (/^[0-9]$/.test(key) && !e.altKey) {
    handled();
    // A fret goes on a string; with none picked, ↑ ↓ or a press picks one first.
    if (columnOnly) return;
    const digit = Number(key);
    // A fret typed on a rest in note input makes a note of note input's length.
    const length = editor.inputMode ? editor.inputLength : undefined;
    const spot = `${cursor.bar}:${cursor.column}:${cursor.string}`;
    const before = lastDigit.current;
    const joined = before && before.spot === spot && e.timeStamp - before.at < SECOND_DIGIT_MS ? before.digit * 10 + digit : null;
    if (joined !== null && joined <= MAX_FRET) {
      lastDigit.current = null;
      commit(setFret(clip, cursor, joined, length));
    } else {
      lastDigit.current = { spot, digit, at: e.timeStamp };
      commit(setFret(clip, cursor, digit, length));
    }
    editor.hearNote(cursor);
    return;
  }
  lastDigit.current = null;
  if (key === 'ArrowUp' || key === 'ArrowDown') {
    handled();
    // With no string picked, ↑ ↓ pick back the string the cursor was last on.
    const string = columnOnly ? cursor.string : Math.min(5, Math.max(0, cursor.string + (key === 'ArrowUp' ? -1 : 1)));
    // Moving the cursor lets any selection go (Jeremy, 2026-10-28).
    commit(clip, { ...cursor, string }, null);
    editor.setColumnOnly(false);
    return;
  }
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    handled();
    const step = key === 'ArrowLeft' ? -1 : 1;
    if (e.shiftKey) {
      if (!columnAt(clip, cursor)) return;
      const moved = moveColumn(clip, cursor, step, { grow: false }).cursor;
      const anchor = selection?.anchor ?? indexOf(clip, cursor.bar, cursor.column);
      commit(clip, moved, { anchor, focus: indexOf(clip, moved.bar, moved.column) });
      editor.startRegion();
    } else {
      const moved = moveColumn(clip, cursor, step, { fillBars: editor.fillBars });
      commit(moved.clip, moved.cursor, null);
    }
    return;
  }
  if (key === 'Backspace' || key === 'Delete') {
    handled();
    const column = columnAt(clip, cursor);
    // In normal mode nothing stays selected after a delete (Jeremy's rule; 2026-10-31 a staff head stayed lit
    // over its rest): the tab lets go, as Esc does, so nothing is left drawn. Note input keeps the cursor
    // where it is, to type on.
    const leave = (next: Part, at: Cursor) => {
      commit(next, at, null);
      if (editor.inputMode) return;
      editor.startRegion();
      editor.dropLine();
      editor.leave();
    };
    // Bars stay full (issue #238, as MuseScore): Delete leaves rests; Ctrl/⌘+Delete takes the time away too.
    if (e.ctrlKey || e.metaKey) {
      if (selection) {
        const cut = deleteColumns(clip, selectedRange(selection));
        leave(cut.clip, { ...cursor, ...cut.cursor });
      } else if (column) {
        const i = indexOf(clip, cursor.bar, cursor.column);
        const cut = deleteColumns(clip, [i, i]);
        leave(cut.clip, { ...cursor, ...cut.cursor });
      } else {
        // An empty bar: the bar itself goes.
        const cut = removeEmptyBar(clip, cursor.bar);
        leave(cut.clip, { ...cursor, ...cut.cursor });
      }
    } else if (selection) {
      leave(makeRest(clip, target), cursor);
    } else if (!columnOnly && noteAt(clip, cursor)) {
      leave(clearNote(clip, cursor), cursor);
    } else if (column && !isRest(column)) {
      // On an empty string of a column with notes: the column becomes a rest (Jeremy, 2026-10-27).
      leave(makeRest(clip, { cursor, selection: null }), cursor);
    }
    // A rest, or an empty bar, stays: only Ctrl/⌘+Delete takes time away.
    return;
  }
  // W and Q are MuseScore's longer and shorter (issue #238), beside + and −.
  const longer = key === '+' || key === 'w';
  if (longer || key === '-' || key === 'q') {
    handled();
    // In note input they change the next note's length; in normal mode, the selected notes'.
    if (editor.inputMode) editor.setInputLength(stepLength(editor.inputLength, longer ? 1 : -1));
    else commit(stepDuration(clip, target, longer ? 1 : -1));
    return;
  }
  if (key === 'Insert') {
    handled();
    commit(insertColumn(clip, cursor), cursor, null);
    return;
  }
  if (key === 'Escape') {
    handled();
    // Esc leaves the tab, so nothing stays drawn: no box round the note or its column (Jeremy, 2026-10-28).
    // A selection goes first, the cursor on its last column.
    if (selection) {
      const end = placeOf(clip, selectedRange(selection)[1]);
      commit(clip, { ...cursor, bar: end.bar, column: end.column }, null);
    }
    editor.dropLine();
    editor.leave();
    return;
  }
  // B (the bend's shape) and / (the slide's kind) step one string's note; with none picked they do nothing.
  const cycled = columnOnly && (key === 'B' || key === '/') ? null : applyCyclingKey(clip, target, key);
  if (cycled) {
    handled();
    commit(cycled);
    return;
  }
  const tupleted = e.altKey ? applyTupletKey(clip, target, e.code) : null;
  if (tupleted) {
    handled();
    commit(tupleted);
    return;
  }
  const tool = toolForKey(key, e.altKey);
  if (tool) {
    handled();
    editor.onTool(tool);
  }
}

/**
 * Normal mode's keys (issue #238, as MuseScore's): on a selected staff note a digit sets its length (5 a
 * quarter) and ↑ ↓ move it a semitone, Alt+Shift+↑ ↓ a step in the key, Ctrl/⌘+↑ ↓ an octave; on a
 * selected tab note ↑ ↓ change its fret by one and Ctrl/⌘+↑ ↓ move it to the next string at the same
 * pitch; with a selection every selected note goes. Alt+↑ ↓ select the next note up or down in the
 * chord. ← → select the next or last column, on the same string when it has a note there, and add
 * nothing. A digit on a tab note still types its fret (Jeremy, 2026-10-30). True when the key was one of them.
 */
function normalKeyDown(e: ReactKeyboardEvent<HTMLDivElement>, editor: EditorKeys): boolean {
  const { clip, cursor, selection, target, columnOnly, staffPitch, commit } = editor;
  const { key } = e;
  const chord = e.ctrlKey || e.metaKey;
  const onStaff = staffPitch !== null;
  if (onStaff && /^[0-9]$/.test(key) && !chord && !e.altKey) {
    const value = valueForDigit(Number(key));
    if (value) commit(setValue(clip, target, value));
    return true;
  }
  if (key === 'ArrowUp' || key === 'ArrowDown') {
    const up = key === 'ArrowUp';
    // The next note up or down the chord, by pitch.
    if (e.altKey && !e.shiftKey && !chord) {
      const from = onStaff ? staffPitch : columnOnly ? null : pitchAt(clip, cursor);
      const string = nextInChord(clip, cursor, from, up);
      if (string === null) return true;
      const at = { ...cursor, string };
      if (onStaff) editor.toPitch(clip, at, pitchAt(clip, at)!, null);
      else {
        commit(clip, at, null);
        editor.setColumnOnly(false);
      }
      return true;
    }
    if (onStaff) {
      // ↑ ↓ a semitone, Alt+Shift a step in the key, Ctrl/⌘ an octave; Shift alone (a range across staves in MuseScore) nothing yet.
      if (e.shiftKey && !e.altKey) return true;
      const sign = up ? 1 : -1;
      const move = e.altKey ? { steps: sign, semitones: false } : chord ? { steps: 12 * sign, semitones: true } : { steps: sign, semitones: true };
      const places = notesToMove(clip, cursor, staffPitch, selection, false);
      if (!places.length) return true;
      const edit = moveNotes(clip, places, move);
      if (edit.problem) {
        editor.onNotice({ tone: 'error', lines: [edit.problem] });
        return true;
      }
      const moved = movedPitch(clip, cursor.bar, staffPitch, move);
      editor.toPitch(edit.clip, cursor, moved, selection);
      const string = stringAtPitch(edit.clip, cursor, moved);
      if (string !== null && !selection) editor.hearNote({ ...cursor, string });
      return true;
    }
    if (e.altKey || e.shiftKey) return true;
    if (chord) {
      // The note to the next string up or down that plays its pitch.
      const pitch = columnOnly || selection ? null : pitchAt(clip, cursor);
      if (pitch === null) return true;
      const moved = moveToString(clip, cursor, pitch, up ? -1 : 1);
      if (moved.string !== null) commit(moved.clip, { ...cursor, string: moved.string });
      return true;
    }
    const places = selectedNotes(clip, cursor, target.selection);
    const next = stepFrets(clip, places, up ? 1 : -1);
    if (next !== clip) {
      commit(next);
      if (places.length === 1) editor.hearNote(places[0]);
    }
    return true;
  }
  if ((key === 'ArrowLeft' || key === 'ArrowRight') && !e.shiftKey && !chord && !e.altKey) {
    // The next column is selected; normal mode adds no rests to step onto.
    const moved = moveColumn(clip, cursor, key === 'ArrowLeft' ? -1 : 1, { grow: false }).cursor;
    const pitch = pitchAt(clip, moved);
    if (pitch === null) {
      commit(clip, moved, null);
      editor.startRegion();
    } else if (onStaff) editor.toPitch(clip, moved, pitch, null);
    else {
      commit(clip, moved, null);
      editor.setColumnOnly(false);
    }
    return true;
  }
  return false;
}

/**
 * The keys the staff cursor takes (issue #136, #174): ↑ ↓ a line or space in the key, Shift+↑ ↓ (or #
 * and b) a semitone; Enter adds or takes away the note at its pitch; Alt+↑ ↓ move that note a line or
 * space, with Shift a semitone, with ⌘ (Ctrl) its whole chord, and the cursor goes with it. True when
 * the key was one of them.
 */
function staffKeyDown(e: ReactKeyboardEvent<HTMLDivElement>, editor: EditorKeys, pitch: number): boolean {
  const { clip, cursor, toPitch } = editor;
  const { key } = e;
  const chord = e.ctrlKey || e.metaKey;
  if (key === 'ArrowUp' || key === 'ArrowDown') {
    const up = key === 'ArrowUp';
    if (e.altKey) {
      const move = { steps: up ? 1 : -1, semitones: e.shiftKey };
      const edit = moveNotes(clip, notesToMove(clip, cursor, pitch, null, chord), move);
      if (edit.problem) {
        editor.onNotice({ tone: 'error', lines: [edit.problem] });
        return true;
      }
      if (!edit.moved.length) return true;
      const moved = movedPitch(clip, cursor.bar, pitch, move);
      toPitch(edit.clip, cursor, moved, null);
      const string = stringAtPitch(edit.clip, cursor, moved);
      if (string !== null) editor.hearNote({ ...cursor, string });
      return true;
    }
    if (chord) return false;
    // Moving the cursor lets any selection go (Jeremy, 2026-10-28).
    toPitch(clip, cursor, e.shiftKey ? pitch + (up ? 1 : -1) : stepPitch(clip, cursor.bar, pitch, up ? 1 : -1), null);
    return true;
  }
  if (chord) return false;
  if ((key === '#' || key === 'b') && !e.altKey) {
    toPitch(clip, cursor, pitch + (key === '#' ? 1 : -1), null);
    return true;
  }
  if (key === 'Enter' && !e.altKey && !e.shiftKey) {
    const edit = toggleStaffNote(clip, cursor, pitch, editor.inputLength);
    toPitch(edit.clip, cursor, pitch, editor.selection);
    if (edit.string !== null) editor.hearNote({ ...cursor, string: edit.string });
    if (edit.problem) editor.onNotice({ tone: 'error', lines: [edit.problem] });
    return true;
  }
  return false;
}

/**
 * The keys that jump by more than a column (issue #238, `jumps.ts`): Ctrl/⌘+← → a bar and
 * Ctrl/⌘+Home / End the clip's ends move the cursor; with Shift they grow the selection that way,
 * as Shift+Home / End grow it to the ends of the line. Moving lets any selection go, and leaving a
 * short bar fills it when Settings says to, as ← → do. True when the key was one of them.
 */
function jumpKeyDown(e: ReactKeyboardEvent<HTMLDivElement>, editor: EditorKeys): boolean {
  if (e.altKey) return false;
  const jump = jumpForKey(e.key, e.ctrlKey || e.metaKey, e.shiftKey);
  if (!jump) return false;
  const { clip, cursor, selection, commit } = editor;
  if (e.shiftKey) {
    if (!columnAt(clip, cursor)) return true;
    const anchor = selection?.anchor ?? indexOf(clip, cursor.bar, cursor.column);
    const focus = jumpFocus(clip, selection?.focus ?? anchor, jump, jump === 'lineStart' || jump === 'lineEnd' ? editor.lines() : []);
    commit(clip, { ...cursor, ...placeOf(clip, focus) }, { anchor, focus });
    editor.startRegion();
    return true;
  }
  const to = jumpCursor(clip, cursor, jump);
  const left = editor.fillBars && to.bar !== cursor.bar ? fillBar(clip, cursor.bar) : clip;
  commit(left, to, null);
  return true;
}

/**
 * Alt+↑ ↓ off the staff cursor (issue #174): on a selection, with the staff drawn, every selected note
 * moves a line or space (with Shift a semitone) and the selection stays; on the tab's note, the note
 * moves to the next string up or down that plays the same pitch. True when the key was one of them.
 */
function moveKeyDown(e: ReactKeyboardEvent<HTMLDivElement>, editor: EditorKeys): boolean {
  const { clip, cursor, selection, columnOnly, commit } = editor;
  if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return false;
  const up = e.key === 'ArrowUp';
  if (selection) {
    if (!editor.staffShown) return true;
    const edit = moveNotes(clip, notesToMove(clip, cursor, 0, selection, false), { steps: up ? 1 : -1, semitones: e.shiftKey });
    if (edit.problem) editor.onNotice({ tone: 'error', lines: [edit.problem] });
    else commit(edit.clip);
    return true;
  }
  const note = columnOnly ? null : noteAt(clip, cursor);
  if (!note || note.fret === null || e.shiftKey || e.ctrlKey || e.metaKey) return true;
  const moved = moveToString(clip, cursor, pitchOf(clip, cursor.string, note.fret), up ? -1 : 1);
  if (moved.string !== null) commit(moved.clip, { ...cursor, string: moved.string });
  return true;
}

/** The playback line as the keys off the tab find it, and how they move it. */
export interface LineKeys {
  clip: Part;
  count: number;
  /** The column gap the playback line is at, or null. */
  line: number | null;
  selection: Selection | null;
  select: (selection: Selection | null) => void;
  /** Puts the playback line at a gap, or takes it away. */
  placeLine: (index: number | null) => void;
  /** Records an edit as one undo step, lets any selection go and puts the playback line at a gap. */
  editAtLine: (next: Part, line: number) => void;
}

/**
 * Delete or Backspace off the tab (Jeremy, 2026-10-29), as on a column with no string picked, and
 * bars stay full (issue #238): a selection becomes rests, the line staying where it is; else the
 * column just before the line becomes a rest if it holds notes. With `removeTime` (Ctrl/⌘) the
 * selection goes, the line where it began, or the column before the line goes and the line steps
 * back over it. Null when there is nothing to take: no line, the line at the clip's start, or a rest
 * without Ctrl/⌘.
 */
export function deleteAtLine(clip: Part, line: number | null, selection: Selection | null, removeTime = false): { clip: Part; line: number } | null {
  if (selection) {
    const range = selectedRange(selection);
    if (removeTime) return { clip: deleteColumns(clip, range).clip, line: range[0] };
    const start = placeOf(clip, range[0]);
    return { clip: makeRest(clip, { cursor: { ...start, string: 0 }, selection }), line: line ?? range[0] };
  }
  if (line === null || line <= 0) return null;
  const before = Math.min(line, columnCount(clip)) - 1;
  if (before < 0) return null;
  const { bar, column } = placeOf(clip, before);
  if (removeTime) return { clip: deleteColumns(clip, [before, before]).clip, line: before };
  if (isRest(clip.bars[bar].columns[column])) return null;
  return { clip: makeRest(clip, { cursor: { bar, column, string: 0 }, selection: null }), line: before + 1 };
}

/**
 * Off the tab (no string picked), the arrow keys work on the playback line, the footer shown or
 * not (Jeremy, 2026-10-27): ← → move it a column, Shift+← → select from it (or grow the selection
 * made so), Delete and Backspace take what is before it (`deleteAtLine`), and Esc drops both. On the tab, in a field or a dialog, the keys do what they did.
 */
export function lineKeyDown(e: KeyboardEvent, { clip, count, line, selection, select, placeLine, editAtLine }: LineKeys) {
  const remove = e.key === 'Delete' || e.key === 'Backspace';
  // Ctrl/⌘ only with Delete, which then takes the time away (issue #238).
  if (e.altKey || ((e.ctrlKey || e.metaKey) && !remove)) return;
  const target = e.target as Element | null;
  if (target?.closest?.('input, select, textarea, dialog, [role="dialog"], [role="menu"], [role="slider"], .tab-editor')) return;
  if (remove) {
    const cut = deleteAtLine(clip, line, selection, e.ctrlKey || e.metaKey);
    if (!cut) return;
    editAtLine(cut.clip, cut.line);
    e.preventDefault();
    return;
  }
  if (e.key === 'Escape') {
    if (line === null && !selection) return;
    // A selection goes first, leaving the line after its last column (Jeremy, 2026-10-28); then the line goes.
    if (selection) {
      select(null);
      placeLine(selectedRange(selection)[1] + 1);
    } else placeLine(null);
    e.preventDefault();
    return;
  }
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const step = e.key === 'ArrowRight' ? 1 : -1;
  const within = (i: number) => Math.min(count, Math.max(0, i));
  if (e.shiftKey && line !== null && !selection) {
    // The first step from the line takes the one column beside it.
    const one = step > 0 ? line : line - 1;
    if (one >= 0 && one < count) select({ anchor: one, focus: one });
    e.preventDefault();
    return;
  }
  if (e.shiftKey) {
    const anchor = line ?? selection?.anchor;
    const from = selection ? selection.focus : line;
    if (anchor === undefined || anchor === null || from === null) return;
    select({ anchor, focus: within(from + step) });
  } else {
    const from = line ?? selection?.focus;
    if (from === undefined) return;
    select(null);
    placeLine(within(from + step));
  }
  e.preventDefault();
}

/** The last column of the clip, for Ctrl+A. */
function placeOfLast(clip: Part): { bar: number; column: number } {
  for (let b = clip.bars.length - 1; b >= 0; b--) {
    if (clip.bars[b].columns.length > 0) return { bar: b, column: clip.bars[b].columns.length - 1 };
  }
  return { bar: 0, column: 0 };
}
