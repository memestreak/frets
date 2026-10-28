/**
 * The keys the Tab page's editor takes (`docs/specs/2026-10-25-tab-editing-design.md`): on the drawn
 * tab, on the staff's own cursor (issue #136), and off the tab on the playback line. Each handler
 * reads the editor as it is and changes it through the callbacks it is given.
 */
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';
import { isRest, type Clip } from './clip';
import { clearNote, columnAt, columnCount, deleteColumns, indexOf, insertColumn, MAX_FRET, moveColumn, noteAt, placeOf, removeEmptyBar, selectedRange, setFret, type Cursor, type Selection, type Target } from './editing';
import { makeRest, stepDuration } from './noteEdits';
import type { WordHit } from './layoutText';
import type { MarkHit } from './marks';
import type { Notice } from './notice';
import { movedPitch, moveNotes, moveToString, notesToMove, pitchOf, stepPitch, stringAtPitch, toggleStaffNote } from './staffEntry';
import { applyCyclingKey, applyTupletKey, toolForKey, type ToolId } from './tools';

/** How long after one digit a second one joins it into a two-digit fret. */
const SECOND_DIGIT_MS = 1000;

/** The digit just typed, so a second one soon after on the same spot makes a two-digit fret. */
export type LastDigit = { spot: string; digit: number; at: number } | null;

/** The editor as a key finds it, and how a key changes it. */
export interface EditorKeys {
  clip: Clip;
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
  /** Records an edit as one undo step and moves the cursor (by default it and the selection stay). */
  commit: (next: Clip, cursor?: Cursor, selection?: Selection | null) => void;
  /** The cursor on the column at a pitch, the staff cursor on that pitch. */
  toPitch: (next: Clip, at: Cursor, pitch: number, selection: Selection | null) => void;
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
  if (editor.staffPitch !== null && staffKeyDown(e, editor, editor.staffPitch)) {
    handled();
    return;
  }
  if (moveKeyDown(e, editor)) {
    handled();
    return;
  }
  if (e.ctrlKey || e.metaKey) {
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
    const spot = `${cursor.bar}:${cursor.column}:${cursor.string}`;
    const before = lastDigit.current;
    const joined = before && before.spot === spot && e.timeStamp - before.at < SECOND_DIGIT_MS ? before.digit * 10 + digit : null;
    if (joined !== null && joined <= MAX_FRET) {
      lastDigit.current = null;
      commit(setFret(clip, cursor, joined));
    } else {
      lastDigit.current = { spot, digit, at: e.timeStamp };
      commit(setFret(clip, cursor, digit));
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
      const moved = moveColumn(clip, cursor, step, false).cursor;
      const anchor = selection?.anchor ?? indexOf(clip, cursor.bar, cursor.column);
      commit(clip, moved, { anchor, focus: indexOf(clip, moved.bar, moved.column) });
      editor.startRegion();
    } else {
      const moved = moveColumn(clip, cursor, step);
      commit(moved.clip, moved.cursor, null);
    }
    return;
  }
  if (key === 'Backspace' || key === 'Delete') {
    handled();
    const column = columnAt(clip, cursor);
    if (selection) {
      const cut = deleteColumns(clip, selectedRange(selection));
      commit(cut.clip, { ...cursor, ...cut.cursor }, null);
    } else if (!columnOnly && noteAt(clip, cursor)) {
      commit(clearNote(clip, cursor));
    } else if (column && !isRest(column)) {
      // On an empty string of a column with notes: the column becomes a rest first (Jeremy, 2026-10-27).
      commit(makeRest(clip, { cursor, selection: null }));
    } else if (column) {
      const i = indexOf(clip, cursor.bar, cursor.column);
      const cut = deleteColumns(clip, [i, i]);
      commit(cut.clip, { ...cursor, ...cut.cursor }, null);
    } else {
      // An empty bar: Delete takes the bar itself away.
      const cut = removeEmptyBar(clip, cursor.bar);
      commit(cut.clip, { ...cursor, ...cut.cursor }, null);
    }
    return;
  }
  if (key === '+' || key === '-') {
    handled();
    commit(stepDuration(clip, target, key === '+' ? 1 : -1));
    return;
  }
  if (key === 'Insert') {
    handled();
    commit(insertColumn(clip, cursor), cursor, null);
    return;
  }
  if (key === 'Escape') {
    handled();
    // A selection goes, the cursor on its last column (Jeremy, 2026-10-28), and the tab lets the keys
    // go, so nothing stays drawn (Jeremy, 2026-10-28: no box round the column).
    if (selection) {
      const end = placeOf(clip, selectedRange(selection)[1]);
      commit(clip, { ...cursor, bar: end.bar, column: end.column }, null);
      editor.dropLine();
      editor.leave();
      return;
    }
    editor.dropLine();
    // On a string, Esc first drops the string and keeps the column (Jeremy, 2026-10-27); then it leaves the tab.
    if (!columnOnly && columnAt(clip, cursor)) editor.setColumnOnly(true);
    else editor.leave();
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
    const edit = toggleStaffNote(clip, cursor, pitch);
    toPitch(edit.clip, cursor, pitch, editor.selection);
    if (edit.string !== null) editor.hearNote({ ...cursor, string: edit.string });
    if (edit.problem) editor.onNotice({ tone: 'error', lines: [edit.problem] });
    return true;
  }
  return false;
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
  count: number;
  /** The column gap the playback line is at, or null. */
  line: number | null;
  selection: Selection | null;
  select: (selection: Selection | null) => void;
  /** Puts the playback line at a gap, or takes it away. */
  placeLine: (index: number | null) => void;
}

/**
 * Off the tab (no string picked), the arrow keys work on the playback line, the footer shown or
 * not (Jeremy, 2026-10-27): ← → move it a column, Shift+← → select from it (or grow the selection
 * made so), and Esc drops both. On the tab, in a field or a dialog, the keys do what they did.
 */
export function lineKeyDown(e: KeyboardEvent, { count, line, selection, select, placeLine }: LineKeys) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const target = e.target as Element | null;
  if (target?.closest?.('input, select, textarea, dialog, [role="dialog"], [role="menu"], [role="slider"], .tab-editor')) return;
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
function placeOfLast(clip: Clip): { bar: number; column: number } {
  for (let b = clip.bars.length - 1; b >= 0; b--) {
    if (clip.bars[b].columns.length > 0) return { bar: b, column: clip.bars[b].columns.length - 1 };
  }
  return { bar: 0, column: 0 };
}
