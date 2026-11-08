/**
 * The keys the Tab page's editor takes (`docs/specs/2026-10-25-tab-editing-design.md`): on the drawn
 * tab, on the staff's own cursor (issue #136), and off the tab on the playback line. Each handler
 * reads the editor as it is and changes it through the callbacks it is given.
 */
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';
import { barTicks, isRest, ticks, timeAt, type Column, type Duration, type Part } from './clip';
import { placeAtTime, SPLITS_TUPLET, timeOf, writeSpan } from './timeline';
import { durationOf } from './sounding';
import { addGrace, enterGrace, groupAt, isProblem, lengthInTuplet, removeGrace, startTuplet, tupletSpanTicks, typeInTuplet } from './tuplets';
import { clampCursor, clearNote, columnAt, columnCount, cursorTime, deleteColumns, emptyColumn, indexOf, insertTime, MAX_FRET, moveColumn, noteAt, placeOf, removeEmptyBar, selectedRange, setFret, type Cursor, type MoveOptions, type Selection, type Target } from './editing';
import { chainPlaces, chainStart, chainTicks } from './ties';
import { clearToRests, stepDuration } from './noteEdits';
import type { WordHit } from './layoutText';
import type { MarkHit } from './marks';
import { isSpan } from './spans';
import type { Notice } from './notice';
import { enterOnStaff, movedPitch, moveNotes, moveToString, notesToMove, pitchAtStep, pitchOf, pitchOfLetter, stepPitch, stringAtPitch, type TypedAccidental } from './staffEntry';
import { STAFF_LINES } from './notation';
import { applyCyclingKey, toolForKey, type ToolId } from './tools';
import { jumpCursor, jumpFocus, jumpForKey, type Lines } from './jumps';
import { setValue } from './noteEdits';
import { lengthOf, stepLength } from './inputLength';
import { advance, lastStop, splitRestAt, stepInRest } from './grid';
import { digitOfCode, nextInChord, pitchAt, selectedNotes, stepFrets, valueForDigit } from './normalMode';

/** How long after one digit a second one joins it into a two-digit fret. */
const SECOND_DIGIT_MS = 1000;

/** What takes Esc before note input does: an open panel, menu or dialog closes first, as in Dorico and MuseScore. */
const POPUPS = '[role="dialog"], [role="menu"], dialog[open]';

/** Whether a panel, menu or dialog is open, or the key came from inside one: its Esc closes it, not note input. */
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
   * Note input (issue #238): the cursor types, as the tab always did. Off, normal mode: what the
   * cursor is on is selected, and MuseScore's keys change it.
   */
  inputMode: boolean;
  setInputMode: (on: boolean) => void;
  /** Note input's length (`inputLength.ts`): the next note entered on a rest takes it. */
  inputLength: Duration;
  setInputLength: (length: Duration) => void;
  /** Note input's grid (`grid.ts`, issue #293), in ticks: where ← → stop inside a rest. */
  gridStep: number;
  /** How far into the cursor's rest note input's cursor is, in ticks: 0 at its start, and anywhere but a rest. */
  cursorAt: number;
  /** Puts note input's cursor that far into the rest at `at` (after a commit, which sets it back to 0). */
  setCursorAt: (at: Cursor, ticks: number) => void;
  /** Tuplet entry's tuplet in note input, or null (`docs/specs/2026-11-04-tab-tuplets-grace-rest-design.md`). */
  tupletEntry: number | null;
  /** Grace entry in note input: typed frets go in as grace notes. */
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

/** A key on the drawn tab. */
export function editorKeyDown(e: ReactKeyboardEvent<HTMLDivElement>, editor: EditorKeys) {
  const { clip, cursor, selection, target, columnOnly, picked, lastDigit, commit } = editor;
  const { key } = e;
  // A sign typed for the next letter lasts only until that letter: any other key lets it go (Jeremy, 2026-11-07).
  if (!/^([a-g]|-|=|0|Shift|Alt|Control|Meta)$/.test(key)) editor.accidental.current = null;
  const count = columnCount(clip);
  // A modifier on its own does nothing: holding Alt (or Shift) to step leaves a picked mark or word picked.
  if (key === 'Alt' || key === 'Shift' || key === 'Control' || key === 'Meta') return;
  // Alt+← → step through notes, rests, marks and words, as MuseScore's do (issue #238), from a picked one too.
  if ((key === 'ArrowLeft' || key === 'ArrowRight') && e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    editor.stepElement(key === 'ArrowRight' ? 1 : -1);
    return;
  }
  // Alt+1–4 make that Voice active, or move the picked or selected notes into it (step 9, Q8); read by the
  // key's place, as Alt types another character on a Mac.
  const voiceDigit = e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey ? /^Digit([1-4])$/.exec(e.code) : null;
  if (voiceDigit) {
    e.preventDefault();
    editor.voiceKey(Number(voiceDigit[1]) - 1);
    return;
  }
  // A picked mark: Delete takes it away (the note stays), Esc lets it go; any other key lets it go and does what it does.
  if (picked?.kind === 'mark') {
    // A picked tie arc: `=` takes it away too, as the lit Tie tool does (step 5).
    if (key === 'Delete' || key === 'Backspace' || (key === 't' && picked.mark === 'tie')) {
      e.preventDefault();
      editor.deletePicked(picked);
      return;
    }
    // A picked Span: Alt+Shift+→ / ← move its end a column, as Dorico's Shift+Alt+→ / ← (step 8, Q9).
    if ((key === 'ArrowLeft' || key === 'ArrowRight') && e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && isSpan(picked.mark)) {
      e.preventDefault();
      editor.moveSpanEnd(key === 'ArrowRight' ? 1 : -1);
      return;
    }
    // A picked tuplet's number: Enter opens the Tuplet panel, as its menu's Edit does (step 8).
    if (key === 'Enter' && picked.mark === 'tuplet' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      editor.editPicked(picked);
      return;
    }
    editor.setPicked(null);
    if (key === 'Escape') {
      e.preventDefault();
      // Esc always leaves note input (Jeremy, 2026-11-03), a picked mark or word let go with it.
      if (editor.inputMode) editor.setInputMode(false);
      // A Span's run, selected for the tools while it was picked, goes with it, and so does the column a
      // Mark over the whole column put the cursor on (step 8).
      if (selection) commit(clip, cursor, null);
      editor.setColumnOnly(false);
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
      if (editor.inputMode) editor.setInputMode(false);
      return;
    }
  }
  // Shift+Space in note input moves the cursor on by the next note's length, over notes and rests, as
  // Dorico's Space does; Space itself still plays (Jeremy, 2026-11-01).
  if (key === ' ' && e.shiftKey && editor.inputMode && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    lastDigit.current = null;
    const moved = advance(clip, cursor, editor.cursorAt, ticks(editor.inputLength));
    commit(moved.clip, moved.cursor, null);
    editor.setCursorAt(moved.cursor, moved.at);
    return;
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
  // A panel open over the tab with the keys still here (a bar's time signature) takes Esc itself, and closes.
  if (key === 'Escape' && popupTakesEscape(e)) return;
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
    else if (value && !(target.selection && editor.everyVoice((part, run) => setValue(part, { ...target, selection: run }, value)))) commit(setValue(clip, target, value));
    return;
  }
  if (!editor.inputMode) {
    if (normalKeyDown(e, editor)) handled();
    if (e.defaultPrevented) return;
  } else {
    if (editor.staffPitch !== null && letterKeyDown(e, editor, editor.staffPitch)) {
      handled();
      return;
    }
    // On the staff in note input a digit is the next note's length, as in MuseScore: 5 a quarter, 3 a
    // sixteenth (8 and 9 are none; 0 is a natural, above). It never types a fret there.
    if (editor.staffPitch !== null && /^[0-9]$/.test(key) && plain) {
      handled();
      const value = valueForDigit(Number(key));
      if (value) editor.setInputLength(lengthOf(value));
      return;
    }
    if (staffOrTabKeyDown(e, editor)) {
      handled();
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
  // With Alt, a digit is not a fret.
  if (/^[0-9]$/.test(key) && !e.altKey) {
    handled();
    // A fret goes on a string; with none picked, ↑ ↓ or a press picks one first.
    if (columnOnly) return;
    const digit = Number(key);
    if (editor.inputMode && typeEntered(e, editor, digit)) return;
    // A fret typed on a rest in note input makes a note of note input's length, where the cursor is in the rest.
    const length = editor.inputMode ? editor.inputLength : undefined;
    // A Tie chain is one note: a fret typed on any of it goes on its first note, and the rest follow (step 5).
    const typedOn = noteAt(clip, cursor)?.tie ? chainStart(clip, cursor) : cursor;
    const here = splitRestAt(clip, typedOn, editor.cursorAt);
    const spot = `${here.cursor.bar}:${here.cursor.column}:${here.cursor.string}`;
    const before = lastDigit.current;
    const joined = before && before.spot === spot && e.timeStamp - before.at < SECOND_DIGIT_MS ? before.digit * 10 + digit : null;
    if (joined !== null && joined <= MAX_FRET) {
      lastDigit.current = null;
      commit(setFret(here.clip, here.cursor, joined, length), here.cursor);
    } else {
      lastDigit.current = { spot, digit, at: e.timeStamp };
      commit(setFret(here.clip, here.cursor, digit, length), here.cursor);
    }
    editor.hearNote(here.cursor);
    return;
  }
  lastDigit.current = null;
  if (key === 'ArrowUp' || key === 'ArrowDown') {
    handled();
    // ↑ off the top string goes up to the staff, when it is drawn (Jeremy, 2026-11-07, issue #396).
    if (key === 'ArrowUp' && !columnOnly && cursor.string === 0 && editor.staffShown) {
      toStaff(editor);
      return;
    }
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
      // In note input the cursor stops at each grid line inside a rest, and once on a note (issue #293).
      const inside = editor.inputMode ? stepInRest(clip, cursor, editor.cursorAt, step, editor.gridStep) : null;
      if (inside !== null) {
        commit(clip, cursor, null);
        editor.setCursorAt(cursor, inside);
        return;
      }
      const moved = overTiedOn(moveColumn(clip, cursor, step), step);
      commit(moved.clip, moved.cursor, null);
      // Coming back into a rest, ← lands on its last grid line.
      const went = moved.cursor.bar !== cursor.bar || moved.cursor.column !== cursor.column;
      if (editor.inputMode && step === -1 && went) editor.setCursorAt(moved.cursor, lastStop(moved.clip, moved.cursor, editor.gridStep));
    }
    return;
  }
  if (key === 'Backspace' || key === 'Delete') {
    handled();
    deleteAtCursor(editor, e.ctrlKey || e.metaKey);
    return;
  }
  // = and − are Dorico's longer and shorter, W and Q MuseScore's (issue #238); + (Shift+= on many keyboards) is = too.
  const longer = key === '=' || key === '+' || key === 'w';
  if (longer || key === '-' || key === 'q') {
    handled();
    // In note input they change the next note's length; in normal mode, the selected notes'.
    if (editor.inputMode) editor.setInputLength(stepLength(editor.inputLength, longer ? 1 : -1));
    else if (!(target.selection && editor.everyVoice((part, run) => stepDuration(part, { ...target, selection: run }, longer ? 1 : -1)))) commit(stepDuration(clip, target, longer ? 1 : -1));
    return;
  }
  if (key === 'Insert') {
    handled();
    // A Gap pushing the music on (spec Q21): note input's length where the cursor is, else the picked
    // note's or rest's length, or the selection's whole time.
    const column = columnAt(clip, cursor);
    let at = cursorTime(clip, cursor) + (editor.inputMode ? editor.cursorAt : 0);
    let length = column && !column.grace ? ticks(column.duration) : barTicks(timeAt(clip, cursor.bar));
    // A picked note of a Tie chain: a Gap as long as the whole chain, before it (step 5).
    if (!editor.inputMode && !selection && !columnOnly && noteAt(clip, cursor) && chainPlaces(clip, cursor).length > 1) {
      const start = chainStart(clip, cursor);
      at = cursorTime(clip, start);
      length = chainTicks(clip, cursor);
    }
    if (editor.inputMode) length = ticks(editor.inputLength);
    else if (selection) {
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
    if (!editor.inputMode) editor.startRegion();
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
 * Delete (or `,` in normal mode, step 6 Q13) at the cursor: with `removeTime` (Ctrl/⌘+Delete) the time goes
 * too. Bars stay full (issue #238, as MuseScore): Delete leaves rests, and a grace note goes leaving no Gap.
 */
export function deleteAtCursor(editor: EditorKeys, removeTime: boolean) {
  const { clip, cursor, selection, columnOnly, commit } = editor;
  const column = columnAt(clip, cursor);
  // In normal mode what is left is selected, as in MuseScore: the column the note was in (its rest, or the
  // chord's other notes), lit, with no note or staff head kept picked (Jeremy, 2026-10-31). It is the column
  // picked by itself, as a press on a rest picks one, so it lights with no box round it (Jeremy, 2026-11-01).
  // Note input keeps the cursor where it is, to type on.
  const leave = (next: Part, at: Cursor) => {
    commit(next, at, null);
    if (!editor.inputMode && columnAt(next, at)) editor.startRegion();
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

/** The cursor `step` ticks on from time `t`, in the Part as edited: note input's cursor after `,`. */
function cursorAfter(editor: EditorKeys, next: Part, t: number, step: number) {
  const place = placeAtTime(next, t);
  const from = { ...editor.cursor, ...place };
  const moved = advance(next, from, Math.max(0, t - timeOf(next, place.bar, place.column)), step);
  editor.commit(moved.clip, moved.cursor, null);
  editor.setCursorAt(moved.cursor, moved.at);
}

/**
 * The Chords panel's Insert in note input (issue #251): its column at the Input length, written at the cursor
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
 * `,` (the Rest tool, step 6 Q12–Q13). In note input: a Gap of the Input length at the cursor, over any notes
 * there, the cursor moved on by it; inside a tuplet, the Input length in the tuplet's ratio; with Tuplet
 * entry on, one tuplet note on, the tuplet made when its first note is typed; with Grace entry on, nothing.
 * In normal mode, what Delete does.
 */
export function restKey(editor: EditorKeys) {
  const { clip, cursor, inputLength } = editor;
  if (!editor.inputMode) {
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
 * `/` (the Grace tool, step 6 Q8 and Q11). In note input it turns Grace entry on and off (the page's); in
 * normal mode it adds a grace note before the picked note, at its fret, the cursor on the new grace note.
 */
export function graceKey(editor: EditorKeys) {
  const added = addGrace(editor.clip, editor.cursor, editor.columnOnly);
  if (added) editor.commit(added.clip, added.cursor, null);
}

/**
 * A fret typed in note input with Grace entry or Tuplet entry on, or in a tuplet (step 6, Q6, Q7 and Q11).
 * True when it was one of them; otherwise the fret goes in as it always did.
 */
function typeEntered(e: ReactKeyboardEvent<HTMLDivElement>, editor: EditorKeys, digit: number): boolean {
  const { clip, cursor, lastDigit, commit, inputLength } = editor;
  const before = lastDigit.current;
  const soon = (spot: string) => before && before.spot === spot && e.timeStamp - before.at < SECOND_DIGIT_MS;
  if (editor.graceEntry) {
    // Each fret a grace note before the time at the cursor, after any already there; two digits join on it.
    const here = splitRestAt(clip, cursor, editor.cursorAt);
    const spot = `grace:${here.cursor.bar}:${here.cursor.column}:${here.cursor.string}`;
    const joined = soon(spot) ? before!.digit * 10 + digit : null;
    if (joined !== null && joined <= MAX_FRET) {
      lastDigit.current = null;
      const grace = { ...here.cursor, column: here.cursor.column - 1 };
      commit(setFret(here.clip, grace, joined), here.cursor);
      editor.hearNote(grace);
      return true;
    }
    const entered = enterGrace(here.clip, here.cursor, digit);
    lastDigit.current = { spot: `grace:${entered.cursor.bar}:${entered.cursor.column}:${entered.cursor.string}`, digit, at: e.timeStamp };
    commit(entered.clip, entered.cursor);
    editor.hearNote({ ...entered.cursor, column: entered.cursor.column - 1 });
    return true;
  }
  const column = columnAt(clip, cursor);
  const spot = `${cursor.bar}:${cursor.column}:${cursor.string}`;
  // A second digit joins the first on the note it typed, as anywhere.
  if (soon(spot) && before!.digit * 10 + digit <= MAX_FRET) return false;
  const group = column && !column.grace ? groupAt(clip, cursor) : null;
  if (group && !column!.notes.some(Boolean)) {
    // In a tuplet's Gap: a tuplet note of the Input length in its ratio, when it fits.
    const typed = typeInTuplet(clip, cursor, editor.cursorAt, digit, inputLength);
    if (typed) {
      lastDigit.current = { spot: `${typed.cursor.bar}:${typed.cursor.column}:${typed.cursor.string}`, digit, at: e.timeStamp };
      commit(typed.clip, typed.cursor);
      editor.hearNote(typed.cursor);
    }
    return true;
  }
  if (group) {
    // On a tuplet note: its fret, and its length the Input length in the tuplet's ratio when that fits.
    const fretted = setFret(clip, cursor, digit);
    const lengthened = column!.duration.value === inputLength.value && column!.duration.dots === inputLength.dots
      ? fretted
      : lengthInTuplet(fretted, cursor, inputLength);
    lastDigit.current = { spot, digit, at: e.timeStamp };
    commit(lengthened, cursor);
    editor.hearNote(cursor);
    return true;
  }
  const n = editor.tupletEntry;
  if (n === null) return false;
  // Tuplet entry: a new tuplet from where its first rest began, or from the cursor.
  const t = cursorTime(clip, cursor) + editor.cursorAt;
  const span = tupletSpanTicks(n, inputLength);
  const unit = span / n;
  const from = editor.tupletFrom;
  const start = from !== null && t >= from && t < from + span && Number.isInteger((t - from) / unit) ? from : t;
  const made = startTuplet(clip, start, Math.round((t - start) / unit), n, inputLength, cursor.string, digit);
  if (isProblem(made)) {
    editor.onNotice({ tone: 'error', lines: [made.problem] });
    return true;
  }
  editor.setTupletFrom(null);
  const at = { ...cursor, ...placeAtTime(made, t) };
  lastDigit.current = { spot: `${at.bar}:${at.column}:${at.string}`, digit, at: e.timeStamp };
  commit(made, at, null);
  editor.hearNote(at);
  return true;
}

/**
 * Normal mode's keys (issue #238, as MuseScore's): on a selected staff note or rest a digit sets its length (5 a
 * quarter) and ↑ ↓ move it a semitone, Alt+Shift+↑ ↓ a step in the key, Ctrl/⌘+↑ ↓ an octave; on a
 * selected tab note ↑ ↓ change its fret by one and Ctrl/⌘+↑ ↓ move it to the next string at the same
 * pitch; with a selection every selected note goes. Alt+↑ ↓ select the next note up or down in the
 * chord. ← → select the next or last column, on the same string when it has a note there, and add
 * nothing. A digit never types a fret here, on the tab either: frets are typed in note input, as in Dorico
 * (Jeremy, 2026-11-07, issue #396). True when the key was one of them.
 */
function normalKeyDown(e: ReactKeyboardEvent<HTMLDivElement>, editor: EditorKeys): boolean {
  const { clip, cursor, selection, target, columnOnly, staffPitch, commit } = editor;
  const { key } = e;
  const chord = e.ctrlKey || e.metaKey;
  const onStaff = staffPitch !== null;
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

/** ⌘/Ctrl+↑ ↓ in note input: the caret up to the staff or back down to the tab. True when it was one. */
function staffOrTabKeyDown(e: ReactKeyboardEvent<HTMLDivElement>, editor: EditorKeys): boolean {
  // In note input with the staff and the tab both drawn (never to a part not drawn), ⌘/Ctrl+↑ takes the caret up to the staff and
  // ⌘/Ctrl+↓ back down to the tab, so the keys alone go between them (Jeremy, 2026-11-06, issue #396).
  if ((e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || !editor.staffShown || !editor.tabShown) return false;
  const { staffPitch } = editor;
  if (e.key === 'ArrowUp') {
    if (staffPitch === null) toStaff(editor);
    return true;
  }
  if (staffPitch !== null) toTab(editor);
  return true;
}

/**
 * Up from the tab to the staff (issue #396): at the cursor's note, else the column's lowest note, else the
 * staff's lowest line.
 */
function toStaff(editor: EditorKeys) {
  const { clip, cursor } = editor;
  const at = editor.columnOnly ? null : pitchAt(clip, cursor);
  const lowest = nextInChord(clip, cursor, null, false);
  const pitch = at ?? (lowest !== null ? pitchAt(clip, { ...cursor, string: lowest }) : null);
  editor.toPitch(clip, lowest !== null && at === null ? { ...cursor, string: lowest } : cursor, pitch ?? pitchAtStep(clip, cursor.bar, STAFF_LINES[0]), null);
}

/** Down from the staff to the tab (issue #396): on the string of the note the staff's caret was on, else the string it was last on. */
function toTab(editor: EditorKeys) {
  editor.commit(editor.clip, editor.cursor, null);
  editor.setStaffPitch(null);
  editor.setColumnOnly(false);
}

/**
 * The keys the staff caret takes in note input (issue #136, #174, #396): ↓ back down to the tab; # and b
 * the ghost a semitone; Enter adds or takes away the note at its pitch; Alt+↑ ↓ move that note a line or
 * space (no note there: the ghost), with Shift a semitone, with ⌘ (Ctrl) its whole chord, and the caret
 * goes with it. True when the key was one of them.
 */
function staffKeyDown(e: ReactKeyboardEvent<HTMLDivElement>, editor: EditorKeys, pitch: number): boolean {
  const { clip, cursor, toPitch } = editor;
  const { key } = e;
  const chord = e.ctrlKey || e.metaKey;
  if (key === 'ArrowUp' || key === 'ArrowDown') {
    const up = key === 'ArrowUp';
    if (e.altKey) {
      const move = { steps: up ? 1 : -1, semitones: e.shiftKey };
      const places = notesToMove(clip, cursor, pitch, null, chord);
      if (!places.length) {
        // No note at the caret's pitch: Alt moves its ghost instead, a line or space (with Shift a
        // semitone), for want of Dorico's letter keys (Jeremy, 2026-11-07, issue #396).
        if (!chord) toPitch(clip, cursor, e.shiftKey ? pitch + (up ? 1 : -1) : stepPitch(clip, cursor.bar, pitch, up ? 1 : -1), null);
        return true;
      }
      const edit = moveNotes(clip, places, move);
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
    // ↑ ↓ go between the staff and the tab, as Dorico's go between staves: ↓ back down to the tab, ↑ nowhere
    // above it (Jeremy, 2026-11-07, issue #396; they moved the ghost before).
    if (!up && !e.shiftKey && editor.tabShown) toTab(editor);
    return true;
  }
  if (chord) return false;
  if (key === 'Enter' && !e.altKey && !e.shiftKey) {
    // Inside a rest, the note goes where the cursor is in it (issue #293).
    enterAtCaret(editor, pitch, true);
    return true;
  }
  return false;
}

/**
 * A–G on the staff in note input enter that note, as Dorico's do (Jeremy, 2026-11-07, issue #396): the
 * letter nearest the caret's pitch, in the key, or flat, sharp or natural when -, = or 0 came just before.
 * True when the key was one of them.
 */
function letterKeyDown(e: ReactKeyboardEvent<HTMLDivElement>, editor: EditorKeys, pitch: number): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  const sign = ({ '-': -1, '=': 1, '0': 0 } as const)[e.key as '-' | '=' | '0'];
  if (sign !== undefined && !e.shiftKey) {
    editor.accidental.current = sign;
    return true;
  }
  if (!/^[a-g]$/.test(e.key)) return false;
  const typed = editor.accidental.current;
  editor.accidental.current = null;
  enterAtCaret(editor, pitchOfLetter(editor.clip, editor.cursor.bar, e.key, pitch, typed), false);
  return true;
}

/** A note entered on the staff at the caret, which goes on past it by its length (Jeremy, 2026-11-07, issue #396). */
function enterAtCaret(editor: EditorKeys, pitch: number, toggle: boolean) {
  const edit = enterOnStaff(editor.clip, editor.cursor, editor.cursorAt, pitch, editor.inputLength, toggle);
  editor.toPitch(edit.clip, edit.cursor, pitch, null);
  editor.setCursorAt(edit.cursor, edit.at);
  if (edit.note) editor.hearNote(edit.note);
  if (edit.problem) editor.onNotice({ tone: 'error', lines: [edit.problem] });
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

/**
 * A move on past Columns that hold only tied-on notes, so a Tie chain is one stop (step 4 in note input,
 * step 5 in normal mode). It stops where it can go no further.
 */
function overTiedOn(moved: { clip: Part; cursor: Cursor }, step: 1 | -1, options: MoveOptions = {}): { clip: Part; cursor: Cursor } {
  let out = moved;
  while (onlyTiedOn(out.clip, out.cursor)) {
    const next = moveColumn(out.clip, out.cursor, step, options);
    if (next.cursor.bar === out.cursor.bar && next.cursor.column === out.cursor.column) break;
    out = next;
  }
  return out;
}

/** Whether the cursor's Column holds only notes tied on from the Column before. */
function onlyTiedOn(clip: Part, cursor: Cursor): boolean {
  const notes = (columnAt(clip, cursor)?.notes ?? []).filter(note => note !== null);
  return notes.length > 0 && notes.every(note => note.tie);
}
