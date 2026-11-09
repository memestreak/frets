/**
 * The keys the Tab page's editor takes (`docs/specs/2026-10-25-tab-editing-design.md`): on the drawn
 * tab, on the staff's own cursor (issue #136), and off the tab on the playback line. Each handler
 * reads the editor as it is and changes it through the callbacks it is given. Note input mode's own
 * keys are in `noteInputModeKeys.ts`.
 */
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';
import { barTicks, isRest, ticks, timeAt, type Column, type Duration, type Part } from './clip';
import { placeAtTime, SPLITS_TUPLET, timeOf, writeSpan } from './timeline';
import { durationOf } from './sounding';
import { addGrace, groupAt, removeGrace, tupletSpanTicks, typeInTuplet } from './tuplets';
import { clampCursor, clearNote, columnAt, columnCount, cursorTime, deleteColumns, emptyColumn, indexOf, insertTime, moveColumn, noteAt, placeOf, removeEmptyBar, selectedRange, type Cursor, type Selection, type Target } from './editing';
import { chainPlaces, chainStart, chainTicks, overTiedOn } from './ties';
import { clearToRests, setValue, stepDuration } from './noteEdits';
import type { WordHit } from './layoutText';
import type { MarkHit } from './marks';
import { isSpan } from './spans';
import type { Notice } from './notice';
import { movedPitch, moveNotes, moveToString, notesToMove, stringAtPitch, type TypedAccidental } from './staffEntry';
import { applyCyclingKey, toolForKey, type ToolId } from './tools';
import { jumpCursor, jumpFocus, jumpForKey, type Lines } from './jumps';
import { advance } from './grid';
import { digitOfCode, nextInChord, pitchAt, selectedNotes, stepFrets, valueForDigit } from './normalMode';
import { noteInputModeKeyDown, toStaff, toTab } from './noteInputModeKeys';

/** What takes Esc before note input mode does: an open panel, menu or dialog closes first, as in Dorico and MuseScore. */
const POPUPS = '[role="dialog"], [role="menu"], dialog[open]';

/** Whether a panel, menu or dialog is open, or the key came from inside one: its Esc closes it, not note input mode. */
export function popupTakesEscape(e: { target: EventTarget | null }): boolean {
  const target = e.target as Element | null;
  return Boolean(target?.closest?.(POPUPS)) || document.querySelector(POPUPS) !== null;
}

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
  /** The tab is drawn (not the staff alone): ↓ off the staff's lowest note goes down to it. */
  tabShown: boolean;
  lastDigit: RefObject<LastDigit>;
  /** A sign typed on the staff for the next letter (-, = or 0), or null. */
  accidental: RefObject<TypedAccidental | null>;
  /** Each drawn line of tab's first and last column, for Shift+Home / End (worked out only when asked). */
  lines: () => Lines;
  /**
   * Note input mode (issue #238): the cursor types, as the tab always did. Off, normal mode: what the
   * cursor is on is selected, and MuseScore's keys change it.
   */
  noteInputMode: boolean;
  setNoteInputMode: (on: boolean) => void;
  /** Note input mode's length (`inputLength.ts`): the next note entered on a rest takes it. */
  inputLength: Duration;
  setInputLength: (length: Duration) => void;
  /** Note input mode's grid (`grid.ts`, issue #293), in ticks: where ← → stop inside a rest. */
  gridStep: number;
  /** How far into the cursor's rest note input mode's cursor is, in ticks: 0 at its start, and anywhere but a rest. */
  cursorAt: number;
  /** Puts note input mode's cursor that far into the rest at `at` (after a commit, which sets it back to 0). */
  setCursorAt: (at: Cursor, ticks: number) => void;
  /** Tuplet entry's tuplet in note input mode, or null (`docs/specs/2026-11-04-tab-tuplets-grace-rest-design.md`). */
  tupletEntry: number | null;
  /** Grace entry in note input mode: typed frets go in as grace notes. */
  graceEntry: boolean;
  /** Where a tuplet Tuplet entry began with `,` starts, until its first note makes it. */
  tupletFrom: number | null;
  setTupletFrom: (at: number | null) => void;
  /** `;`: the Tuplet panel at the cursor. */
  openTuplets: () => void;
  /** Alt+1–4 (step 9, Q8): Voice `voice` (from 0) made active, or the picked or selected notes moved into it. */
  voiceKey: (voice: number) => void;
  /**
   * An edit of the selection on every Voice in its time, as one undo step (step 9, Q19); false when the
   * selection holds only the Active voice's notes, and the key makes the edit itself.
   */
  everyVoice: (edit: (part: Part, selection: Selection) => Part) => boolean;
  /** Alt+← →: picks the next or last note, rest, mark or word (`elements.ts`). */
  stepElement: (step: 1 | -1) => void;
  /** A picked Span's end a column later (1) or earlier (−1): Alt+Shift+→ / ← (step 8). */
  moveSpanEnd: (step: 1 | -1) => void;
  /** Records an edit as one undo step and moves the cursor (by default it and the selection stay). */
  commit: (next: Part, cursor?: Cursor, selection?: Selection | null) => void;
  /** The cursor on the column at a pitch, the staff cursor on that pitch. */
  toPitch: (next: Part, at: Cursor, pitch: number, selection: Selection | null) => void;
  setColumnOnly: (columnOnly: boolean) => void;
  /** Gives the keys to the staff at a pitch, or with null back to the tab. */
  setStaffPitch: (pitch: number | null) => void;
  /** A selection starts: the string and the staff's cursor let go. */
  startRegion: () => void;
  setPicked: (picked: null) => void;
  deletePicked: (hit: WordHit | MarkHit) => void;
  editPicked: (hit: WordHit | MarkHit) => void;
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

/**
 * A key on the drawn tab. It tries, in turn: the keys every mode takes first (Alt+← →, Alt+1–4, a picked mark
 * or word, an open panel's Esc); the mode's own keys (`noteInputModeKeyDown` in `noteInputModeKeys.ts`, or
 * `normalKeyDown`), with Space and N; then the keys every mode shares (`sharedKeyDown`).
 */
export function editorKeyDown(e: ReactKeyboardEvent<HTMLDivElement>, editor: EditorKeys) {
  const { key } = e;
  // A sign typed for the next letter lasts only until that letter: any other key lets it go (Jeremy, 2026-11-07).
  if (!/^([a-g]|-|=|0|Shift|Alt|Control|Meta)$/.test(key)) editor.accidental.current = null;
  // A modifier on its own does nothing: holding Alt (or Shift) to step leaves a picked mark or word picked.
  if (key === 'Alt' || key === 'Shift' || key === 'Control' || key === 'Meta') return;
  if (stepOrVoiceKeyDown(e, editor)) {
    e.preventDefault();
    return;
  }
  if (pickedKeyDown(e, editor)) return;
  // A panel open over the tab with the keys still here (a bar's time signature) takes Esc itself, and closes.
  if (key === 'Escape' && popupTakesEscape(e)) return;
  if (editor.noteInputMode && noteInputModeKeyDown(e, editor)) {
    e.preventDefault();
    return;
  }
  if (spaceOrNKeyDown(e, editor)) {
    e.preventDefault();
    return;
  }
  if (!editor.noteInputMode) {
    if (normalKeyDown(e, editor)) e.preventDefault();
    if (e.defaultPrevented) return;
  }
  sharedKeyDown(e, editor);
}

/**
 * Alt+← → step through notes, rests, marks and words, as MuseScore's do (issue #238), from a picked one too;
 * Alt+1–4 make that Voice active, or move the picked or selected notes into it (step 9, Q8). True when the key
 * was one of them.
 */
function stepOrVoiceKeyDown(e: ReactKeyboardEvent<HTMLDivElement>, editor: EditorKeys): boolean {
  const { key } = e;
  if ((key === 'ArrowLeft' || key === 'ArrowRight') && e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
    editor.stepElement(key === 'ArrowRight' ? 1 : -1);
    return true;
  }
  // Read by the key's place, as Alt types another character on a Mac.
  const voiceDigit = e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey ? /^Digit([1-4])$/.exec(e.code) : null;
  if (voiceDigit) {
    editor.voiceKey(Number(voiceDigit[1]) - 1);
    return true;
  }
  return false;
}

/**
 * A picked mark or word: Delete takes it away, Esc lets it go (and leaves note input mode), Enter edits a
 * word or a tuplet's number; any other key lets it go and goes on to do what it does. True when the key was
 * used up here.
 */
function pickedKeyDown(e: ReactKeyboardEvent<HTMLDivElement>, editor: EditorKeys): boolean {
  const { clip, cursor, selection, picked, commit } = editor;
  const { key } = e;
  if (!picked) return false;
  if (picked.kind === 'mark') {
    // A picked tie arc: `=` takes it away too, as the lit Tie tool does (step 5).
    if (key === 'Delete' || key === 'Backspace' || (key === 't' && picked.mark === 'tie')) {
      e.preventDefault();
      editor.deletePicked(picked);
      return true;
    }
    // A picked Span: Alt+Shift+→ / ← move its end a column, as Dorico's Shift+Alt+→ / ← (step 8, Q9).
    if ((key === 'ArrowLeft' || key === 'ArrowRight') && e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && isSpan(picked.mark)) {
      e.preventDefault();
      editor.moveSpanEnd(key === 'ArrowRight' ? 1 : -1);
      return true;
    }
    // A picked tuplet's number: Enter opens the Tuplet panel, as its menu's Edit does (step 8); a dynamic's, its field.
    if (key === 'Enter' && (picked.mark === 'tuplet' || picked.mark === 'dynamic') && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      editor.editPicked(picked);
      return true;
    }
    editor.setPicked(null);
    if (key === 'Escape') {
      e.preventDefault();
      // Esc always leaves note input mode (Jeremy, 2026-11-03), a picked mark or word let go with it.
      if (editor.noteInputMode) editor.setNoteInputMode(false);
      // A Span's run, selected for the tools while it was picked, goes with it, and so does the column a
      // Mark over the whole column put the cursor on (step 8).
      if (selection) commit(clip, cursor, null);
      editor.setColumnOnly(false);
      return true;
    }
    return false;
  }
  // A picked word.
  if (key === 'Delete' || key === 'Backspace') {
    e.preventDefault();
    editor.deletePicked(picked);
    return true;
  }
  if (key === 'Enter' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    editor.editPicked(picked);
    return true;
  }
  editor.setPicked(null);
  if (key === 'Escape') {
    e.preventDefault();
    if (editor.noteInputMode) editor.setNoteInputMode(false);
    return true;
  }
  return false;
}

/**
 * Space on the tab never types or scrolls (while the footer shows, the page-wide key plays); N goes into note
 * input mode and back out (issue #238), as in MuseScore. True when the key was one of them.
 */
function spaceOrNKeyDown(e: ReactKeyboardEvent<HTMLDivElement>, editor: EditorKeys): boolean {
  const plain = !e.ctrlKey && !e.metaKey && !e.altKey;
  if (e.key === ' ' && plain) return true;
  if (e.key === 'n' && plain) {
    editor.setNoteInputMode(!editor.noteInputMode);
    return true;
  }
  return false;
}

/**
 * The keys every mode shares, after the mode's own: the jumps, Ctrl/⌘ keys, Shift+← →, Delete, Esc off the
 * tab, `;`, the cycling keys and the tools. Normal mode's longer and shorter and its Insert are here too, as
 * note input mode took its own.
 */
function sharedKeyDown(e: ReactKeyboardEvent<HTMLDivElement>, editor: EditorKeys) {
  const { clip, cursor, selection, target, columnOnly, lastDigit, commit } = editor;
  const { key } = e;
  const handled = () => e.preventDefault();
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
    const count = columnCount(clip);
    if (key.toLowerCase() === 'a' && count > 0) {
      e.preventDefault();
      const last = placeOfLast(clip);
      commit(clip, { ...cursor, ...last }, { anchor: 0, focus: count - 1 });
      editor.startRegion();
    }
    // Copy, cut and paste arrive as clipboard events; undo is the page's.
    return;
  }
  lastDigit.current = null;
  if ((key === 'ArrowLeft' || key === 'ArrowRight') && e.shiftKey) {
    handled();
    if (!columnAt(clip, cursor)) return;
    const step = key === 'ArrowLeft' ? -1 : 1;
    const moved = moveColumn(clip, cursor, step, { grow: false }).cursor;
    const anchor = selection?.anchor ?? indexOf(clip, cursor.bar, cursor.column);
    commit(clip, moved, { anchor, focus: indexOf(clip, moved.bar, moved.column) });
    editor.startRegion();
    return;
  }
  if (key === 'Backspace' || key === 'Delete') {
    handled();
    deleteAtCursor(editor, e.ctrlKey || e.metaKey);
    return;
  }
  // = and − are Dorico's longer and shorter, W and Q MuseScore's (issue #238); + (Shift+= on many keyboards) is
  // = too. Here they change the selected notes' length.
  const longer = key === '=' || key === '+' || key === 'w';
  if (longer || key === '-' || key === 'q') {
    handled();
    if (!(target.selection && editor.everyVoice((part, run) => stepDuration(part, { ...target, selection: run }, longer ? 1 : -1)))) commit(stepDuration(clip, target, longer ? 1 : -1));
    return;
  }
  if (key === 'Insert') {
    handled();
    insertGap(editor);
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
  // `;` opens the Tuplet panel at the cursor, as Dorico's `;` opens its tuplets popover (step 6, Q16).
  if (key === ';' && !e.altKey) {
    handled();
    editor.openTuplets();
    return;
  }
  // Alt+/ steps the slide from the note before through its kinds, read by the key's place as Alt types
  // another character on a Mac (step 6, Q17); `/` itself is the Grace tool's.
  const slideKey = e.altKey && e.code === 'Slash' ? '/' : null;
  const cycleKey = slideKey ?? (key === '/' ? null : key);
  // B (the bend's shape) and Alt+/ (the slide's kind) step one string's note; with none picked they do nothing.
  const cycled = cycleKey === null || (columnOnly && (cycleKey === 'B' || cycleKey === '/')) ? null : applyCyclingKey(clip, target, cycleKey);
  if (cycled) {
    handled();
    commit(cycled);
    return;
  }
  if (slideKey) {
    handled();
    return;
  }
  const tool = toolForKey(key, e.altKey, e.code);
  if (tool) {
    handled();
    editor.onTool(tool);
  }
}

/**
 * Insert in normal mode: a Gap pushing the music on (spec Q21), the picked note's or rest's length, or the
 * selection's whole time, before it; the Gap is then selected.
 */
function insertGap(editor: EditorKeys) {
  const { clip, cursor, selection, columnOnly, commit } = editor;
  const column = columnAt(clip, cursor);
  let at = cursorTime(clip, cursor);
  let length = column && !column.grace ? ticks(column.duration) : barTicks(timeAt(clip, cursor.bar));
  // A picked note of a Tie chain: a Gap as long as the whole chain, before it (step 5).
  if (!selection && !columnOnly && noteAt(clip, cursor) && chainPlaces(clip, cursor).length > 1) {
    const start = chainStart(clip, cursor);
    at = cursorTime(clip, start);
    length = chainTicks(clip, cursor);
  }
  if (selection) {
    const [from, to] = selectedRange(selection);
    const first = placeOf(clip, from);
    const last = placeOf(clip, to);
    at = cursorTime(clip, { ...first, string: 0 });
    const lastColumn = clip.bars[last.bar].columns[last.column];
    length = cursorTime(clip, { ...last, string: 0 }) + (lastColumn.grace ? 0 : ticks(lastColumn.duration)) - at;
  }
  if (length <= 0) return;
  const inserted = insertTime(clip, at, length, cursor);
  if (!inserted) {
    editor.onNotice({ tone: 'error', lines: [SPLITS_TUPLET] });
    return;
  }
  commit(inserted.clip, inserted.cursor, null);
  editor.startRegion();
}

/**
 * Delete (or `,` in normal mode, step 6 Q13) at the cursor: with `removeTime` (Ctrl/⌘+Delete) the time goes
 * too. Bars stay full (issue #238, as MuseScore): Delete leaves rests, and a grace note goes leaving no Gap.
 */
export function deleteAtCursor(editor: EditorKeys, removeTime: boolean) {
  const { clip, cursor, selection, columnOnly, commit } = editor;
  const column = columnAt(clip, cursor);
  // In normal mode what is left is selected, as in MuseScore: the column the note was in (its rest, or the
  // chord's other notes), lit, with no note or staff head kept picked (Jeremy, 2026-10-31). It is the column
  // picked by itself, as a press on a rest picks one, so it lights with no box round it (Jeremy, 2026-11-01).
  // Note input mode keeps the cursor where it is, to type on.
  const leave = (next: Part, at: Cursor) => {
    commit(next, at, null);
    if (!editor.noteInputMode && columnAt(next, at)) editor.startRegion();
  };
  if (removeTime) {
    if (selection) {
      const cut = deleteColumns(clip, selectedRange(selection));
      leave(cut.clip, { ...cursor, ...cut.cursor });
    } else if (column) {
      // A picked note takes its whole Tie chain's time (step 5).
      const places = !columnOnly && noteAt(clip, cursor) ? chainPlaces(clip, cursor) : [cursor];
      const last = places[places.length - 1];
      const cut = deleteColumns(clip, [indexOf(clip, places[0].bar, places[0].column), indexOf(clip, last.bar, last.column)]);
      leave(cut.clip, { ...cursor, ...cut.cursor });
    } else {
      // An empty bar: the bar itself goes.
      const cut = removeEmptyBar(clip, cursor.bar);
      leave(cut.clip, { ...cursor, ...cut.cursor });
    }
  } else if (selection) {
    // The selection's notes become rests, and a bar it covers whole starts again as one rest (issue #290), in every Voice (step 9, Q19).
    if (editor.everyVoice((part, run) => clearToRests(part, run).clip)) return;
    const cleared = clearToRests(clip, selection);
    commit(cleared.clip, clampCursor(cleared.clip, cursor), cleared.selection);
  } else if (column?.grace) {
    // A grace note goes whole, and the cursor lands on the note it was before (step 6, Q10).
    leave(removeGrace(clip, cursor), cursor);
  } else if (!columnOnly && noteAt(clip, cursor)) {
    leave(clearNote(clip, cursor), cursor);
  } else if (column && !isRest(column)) {
    // On an empty string of a column with notes: the column's notes go, their Tie chains whole (Jeremy, 2026-10-27; step 5).
    const i = indexOf(clip, cursor.bar, cursor.column);
    leave(clearToRests(clip, { anchor: i, focus: i }).clip, cursor);
  }
  // A rest, or an empty bar, stays: only Ctrl/⌘+Delete takes time away.
}

/** The cursor `step` ticks on from time `t`, in the Part as edited: note input mode's cursor after `,`. */
function cursorAfter(editor: EditorKeys, next: Part, t: number, step: number) {
  const place = placeAtTime(next, t);
  const from = { ...editor.cursor, ...place };
  const moved = advance(next, from, Math.max(0, t - timeOf(next, place.bar, place.column)), step);
  editor.commit(moved.clip, moved.cursor, null);
  editor.setCursorAt(moved.cursor, moved.at);
}

/**
 * The Chords panel's Insert in note input mode (issue #251): its column at the Input length, written at the cursor
 * over what is there as a fret typed on a rest is, and the cursor moved on by it, as entering a note does.
 * `part` is the clip with any definition Insert adds.
 */
export function writeAtInput(editor: EditorKeys, part: Part, column: Column) {
  const t = cursorTime(part, editor.cursor) + editor.cursorAt;
  const length = ticks(editor.inputLength);
  const written = writeSpan(part, t, { ...column, duration: { ...editor.inputLength } }, length);
  if (!written) {
    editor.onNotice({ tone: 'error', lines: [SPLITS_TUPLET] });
    return;
  }
  cursorAfter(editor, written, t, length);
}

/**
 * `,` (the Rest tool, step 6 Q12–Q13). In note input mode: a Gap of the Input length at the cursor, over any notes
 * there, the cursor moved on by it; inside a tuplet, the Input length in the tuplet's ratio; with Tuplet
 * entry on, one tuplet note on, the tuplet made when its first note is typed; with Grace entry on, nothing.
 * In normal mode, what Delete does.
 */
export function restKey(editor: EditorKeys) {
  const { clip, cursor, inputLength } = editor;
  if (!editor.noteInputMode) {
    deleteAtCursor(editor, false);
    return;
  }
  if (editor.graceEntry) return;
  editor.lastDigit.current = null;
  const t = cursorTime(clip, cursor) + editor.cursorAt;
  const group = columnAt(clip, cursor)?.grace ? null : groupAt(clip, cursor);
  if (group) {
    const typed = typeInTuplet(clip, cursor, editor.cursorAt, null, inputLength);
    const length = ticks({ ...inputLength, tuplet: group.duration.tuplet, tupletSpan: group.duration.tupletSpan });
    if (typed) cursorAfter(editor, typed.clip, t, length);
    return;
  }
  const n = editor.tupletEntry;
  if (n !== null) {
    // Tuplet entry: the tuplet's whole time is a Gap from where its first rest began; the cursor steps a tuplet note.
    const span = tupletSpanTicks(n, inputLength);
    const start = editor.tupletFrom !== null && t > editor.tupletFrom && t < editor.tupletFrom + span ? editor.tupletFrom : t;
    let next = clip;
    if (start === t) {
      const whole = durationOf(span);
      const written = whole ? writeSpan(clip, t, emptyColumn(whole), span) : null;
      if (!written) {
        editor.onNotice({ tone: 'error', lines: [SPLITS_TUPLET] });
        return;
      }
      next = written;
    }
    const unit = span / n;
    editor.setTupletFrom(t + unit < start + span ? start : null);
    cursorAfter(editor, next, t, unit);
    return;
  }
  const length = ticks(inputLength);
  const written = writeSpan(clip, t, emptyColumn(inputLength), length);
  if (!written) {
    editor.onNotice({ tone: 'error', lines: [SPLITS_TUPLET] });
    return;
  }
  cursorAfter(editor, written, t, length);
}

/**
 * `/` (the Grace tool, step 6 Q8 and Q11). In note input mode it turns Grace entry on and off (the page's); in
 * normal mode it adds a grace note before the picked note, at its fret, the cursor on the new grace note.
 */
export function graceKey(editor: EditorKeys) {
  const added = addGrace(editor.clip, editor.cursor, editor.columnOnly);
  if (added) editor.commit(added.clip, added.cursor, null);
}

/**
 * Normal mode's keys (issue #238, as MuseScore's): on a selected staff note or rest a digit sets its length (5 a
 * quarter) and ↑ ↓ move it a semitone, Alt+Shift+↑ ↓ a step in the key, Ctrl/⌘+↑ ↓ an octave; on a
 * selected tab note ↑ ↓ change its fret by one and Ctrl/⌘+↑ ↓ move it to the next string at the same
 * pitch; with a selection every selected note goes. Alt+↑ ↓ select the next note up or down in the
 * chord. ← → select the next or last column, on the same string when it has a note there, and add
 * nothing. A digit never types a fret here, on the tab either: frets are typed in note input mode, as in Dorico
 * (Jeremy, 2026-11-07, issue #396); Shift and a digit's key on the tab set the length too. True when the key
 * was one of them.
 */
function normalKeyDown(e: ReactKeyboardEvent<HTMLDivElement>, editor: EditorKeys): boolean {
  const { clip, cursor, selection, target, columnOnly, staffPitch, commit } = editor;
  const { key } = e;
  const chord = e.ctrlKey || e.metaKey;
  const onStaff = staffPitch !== null;
  // Shift and a digit's key set the selected notes' length on the tab (MuseScore's tab keys): Shift+5 a quarter.
  const shiftedDigit = e.shiftKey && !chord && !e.altKey && !onStaff ? digitOfCode(e.code) : null;
  if (shiftedDigit !== null) {
    const value = valueForDigit(shiftedDigit);
    if (value && !(target.selection && editor.everyVoice((part, run) => setValue(part, { ...target, selection: run }, value)))) commit(setValue(clip, target, value));
    return true;
  }
  // A digit sets the length of what is picked, a note on the staff or the tab, a rest or a stem (issue #290),
  // as Dorico's duration keys do on a selection; it never types a fret (Jeremy, 2026-11-07, issue #396).
  if (/^[0-9]$/.test(key) && !chord && !e.altKey) {
    const value = valueForDigit(Number(key));
    if (value && (selection || columnAt(clip, cursor))) commit(setValue(clip, target, value));
    return true;
  }
  if (key === 'ArrowUp' || key === 'ArrowDown') {
    const up = key === 'ArrowUp';
    const sign = up ? 1 : -1;
    // ↑ ↓ go between the notes, as Dorico's arrows go between the notes and staves: on the tab string by string
    // and off the top string up to the staff, on the staff note by note and off the lowest down to the tab.
    // Alt with them changes what is picked, as Dorico's Alt+arrows do (Jeremy, 2026-11-07, issue #396).
    if (onStaff) {
      if (e.altKey || chord) {
        // Alt a step in the key, Alt+Shift a semitone, Ctrl/⌘ an octave.
        const move = chord ? { steps: 12 * sign, semitones: true } : { steps: sign, semitones: e.shiftKey };
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
      if (e.shiftKey) return true;
      const string = nextInChord(clip, cursor, staffPitch, up);
      if (string !== null) {
        const at = { ...cursor, string };
        editor.toPitch(clip, at, pitchAt(clip, at)!, null);
      } else if (!up && editor.tabShown) toTab(editor);
      return true;
    }
    if (e.shiftKey && !e.altKey) return true;
    if (chord && !e.altKey) {
      // The note to the next string up or down that plays its pitch.
      const pitch = columnOnly || selection ? null : pitchAt(clip, cursor);
      if (pitch === null) return true;
      const moved = moveToString(clip, cursor, pitch, up ? -1 : 1);
      if (moved.string !== null) commit(moved.clip, { ...cursor, string: moved.string });
      return true;
    }
    if (e.altKey) {
      // Alt+↑ ↓ a fret higher or lower, every selected note.
      if (chord || e.shiftKey) return true;
      const places = selectedNotes(clip, cursor, target.selection);
      const next = stepFrets(clip, places, sign);
      if (next !== clip) {
        commit(next);
        if (places.length === 1) editor.hearNote(places[0]);
      }
      return true;
    }
    // A string at a time; with none picked (a rest), ↓ picks the top string. Off the top, up to the staff.
    if (up && (columnOnly || cursor.string === 0)) {
      if (editor.staffShown) toStaff(editor);
      return true;
    }
    const string = columnOnly ? 0 : Math.min(5, cursor.string + 1 - (up ? 2 : 0));
    commit(clip, { ...cursor, string }, null);
    editor.setColumnOnly(false);
    return true;
  }
  if ((key === 'ArrowLeft' || key === 'ArrowRight') && !e.shiftKey && !chord && !e.altKey) {
    // The next column is selected; normal mode adds no rests to step onto. A Tie chain is one stop (step 5).
    const step = key === 'ArrowLeft' ? -1 : 1;
    const moved = overTiedOn(moveColumn(clip, cursor, step, { grow: false }), step, { grow: false }).cursor;
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
 * The keys that jump by more than a column (issue #238, `jumps.ts`): Ctrl/⌘+← → a bar and
 * Ctrl/⌘+Home / End the clip's ends move the cursor; with Shift they grow the selection that way,
 * as Shift+Home / End grow it to the ends of the line. Moving lets any selection go. True when the key
 * was one of them.
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
  commit(clip, jumpCursor(clip, cursor, jump), null);
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
    return { clip: clearToRests(clip, selection).clip, line: line ?? range[0] };
  }
  if (line === null || line <= 0) return null;
  const before = Math.min(line, columnCount(clip)) - 1;
  if (before < 0) return null;
  const { bar, column } = placeOf(clip, before);
  if (removeTime) {
    const cut = deleteColumns(clip, [before, before]).clip;
    // The clip's last bar ends in a Gap: taking a rest from its end changes nothing, and the line stays.
    if (JSON.stringify(cut.bars) === JSON.stringify(clip.bars)) return null;
    return { clip: cut, line: before };
  }
  if (isRest(clip.bars[bar].columns[column])) return null;
  return { clip: clearToRests(clip, { anchor: before, focus: before }).clip, line: before + 1 };
}

/**
 * Off the tab (no string picked), the arrow keys work on the playback line, the footer shown or
 * not (Jeremy, 2026-10-27): ← → move it a column, Shift+← → select from it (or grow the selection
 * made so), Delete and Backspace take what is before it (`deleteAtLine`), and Esc drops both. On the tab, in a field or a dialog, the keys do what they did.
 */
export function lineKeyDown(e: KeyboardEvent, { clip, count, line, selection, select, placeLine, editAtLine }: LineKeys) {
  // A key something on the page has handled already (a picked title's Esc) is not the line's.
  if (e.defaultPrevented) return;
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
