/**
 * The keys only note input mode takes (issue #238, #293, #396): frets typed on the tab, letters and Enter on
 * the staff caret, the next note's length, the caret between the staff and the tab, ← → through a rest's grid
 * lines, Shift+Space and Insert at the Input length. `editorKeyDown` (`editorKeys.ts`) tries them after the keys
 * every mode shares at its top, and the keys it takes after them in both modes (Space, N, the jumps, Ctrl/⌘
 * keys, Shift+← →, Delete, `;` and the tools) are never taken here.
 */
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { ticks } from './clip';
import { placeAtTime, SPLITS_TUPLET } from './timeline';
import { enterGrace, groupAt, isProblem, lengthInTuplet, startTuplet, tupletSpanTicks, typeInTuplet } from './tuplets';
import { columnAt, cursorTime, insertTime, MAX_FRET, moveColumn, noteAt, setFret } from './editing';
import { chainStart, overTiedOn } from './ties';
import { enterOnStaff, moveNotes, moveToString, movedPitch, notesToMove, pitchAtStep, pitchOf, pitchOfLetter, stepPitch, stringAtPitch } from './staffEntry';
import { STAFF_LINES } from './notation';
import { lengthOf, stepLength } from './inputLength';
import { advance, lastStop, splitRestAt, stepInRest } from './grid';
import { digitOfCode, nextInChord, pitchAt, valueForDigit } from './normalMode';
import type { EditorKeys } from './editorKeys';

/** How long after one digit a second one joins it into a two-digit fret. */
const SECOND_DIGIT_MS = 1000;

/** A key in note input mode. True when it was one of note input's own; the caller prevents its default. */
export function noteInputKeyDown(e: ReactKeyboardEvent<HTMLDivElement>, editor: EditorKeys): boolean {
  const { clip, cursor, columnOnly, lastDigit, commit, staffPitch } = editor;
  const { key } = e;
  const chord = e.ctrlKey || e.metaKey;
  const plain = !chord && !e.altKey;
  // Shift+Space moves the cursor on by the next note's length, over notes and rests, as Dorico's Space does;
  // Space itself still plays (Jeremy, 2026-11-01).
  if (key === ' ' && e.shiftKey && plain) {
    lastDigit.current = null;
    const moved = advance(clip, cursor, editor.cursorAt, ticks(editor.inputLength));
    commit(moved.clip, moved.cursor, null);
    editor.setCursorAt(moved.cursor, moved.at);
    return true;
  }
  // Esc always leaves note input mode (Jeremy, 2026-11-03); an open panel took it before this.
  if (key === 'Escape') {
    editor.setInputMode(false);
    return true;
  }
  // Shift and a digit's key set the next note's length on the tab (MuseScore's tab keys): Shift+5 a quarter.
  const shiftedDigit = e.shiftKey && plain && staffPitch === null ? digitOfCode(e.code) : null;
  if (shiftedDigit !== null) {
    const value = valueForDigit(shiftedDigit);
    if (value) editor.setInputLength(lengthOf(value));
    return true;
  }
  if (staffPitch !== null && letterKeyDown(e, editor, staffPitch)) return true;
  // On the staff a digit is the next note's length, as in MuseScore: 5 a quarter, 3 a sixteenth (8 and 9 are
  // none; 0 is a natural, above). It never types a fret there.
  if (staffPitch !== null && /^[0-9]$/.test(key) && plain) {
    const value = valueForDigit(Number(key));
    if (value) editor.setInputLength(lengthOf(value));
    return true;
  }
  if (staffOrTabKeyDown(e, editor)) return true;
  if (staffPitch !== null && staffKeyDown(e, editor, staffPitch)) return true;
  if (moveKeyDown(e, editor)) return true;
  // Ctrl/⌘ keys go on to the jumps and the keys every mode shares.
  if (chord) return false;
  // With Alt, a digit is not a fret.
  if (/^[0-9]$/.test(key) && !e.altKey) {
    // A fret goes on a string; with none picked, ↑ ↓ or a press picks one first.
    if (!columnOnly) fretKey(e, editor, Number(key));
    return true;
  }
  if (key === 'ArrowUp' || key === 'ArrowDown') {
    lastDigit.current = null;
    // ↑ off the top string goes up to the staff, when it is drawn (Jeremy, 2026-11-07, issue #396).
    if (key === 'ArrowUp' && !columnOnly && cursor.string === 0 && editor.staffShown) {
      toStaff(editor);
      return true;
    }
    // With no string picked, ↑ ↓ pick back the string the cursor was last on.
    const string = columnOnly ? cursor.string : Math.min(5, Math.max(0, cursor.string + (key === 'ArrowUp' ? -1 : 1)));
    // Moving the cursor lets any selection go (Jeremy, 2026-10-28).
    commit(clip, { ...cursor, string }, null);
    editor.setColumnOnly(false);
    return true;
  }
  if ((key === 'ArrowLeft' || key === 'ArrowRight') && !e.shiftKey) {
    lastDigit.current = null;
    const step = key === 'ArrowLeft' ? -1 : 1;
    // The cursor stops at each grid line inside a rest, and once on a note (issue #293).
    const inside = stepInRest(clip, cursor, editor.cursorAt, step, editor.gridStep);
    if (inside !== null) {
      commit(clip, cursor, null);
      editor.setCursorAt(cursor, inside);
      return true;
    }
    const moved = overTiedOn(moveColumn(clip, cursor, step), step);
    commit(moved.clip, moved.cursor, null);
    // Coming back into a rest, ← lands on its last grid line.
    const went = moved.cursor.bar !== cursor.bar || moved.cursor.column !== cursor.column;
    if (step === -1 && went) editor.setCursorAt(moved.cursor, lastStop(moved.clip, moved.cursor, editor.gridStep));
    return true;
  }
  // = and − are Dorico's longer and shorter, W and Q MuseScore's (issue #238); + (Shift+= on many keyboards) is
  // = too. Here they change the next note's length.
  const longer = key === '=' || key === '+' || key === 'w';
  if (longer || key === '-' || key === 'q') {
    lastDigit.current = null;
    editor.setInputLength(stepLength(editor.inputLength, longer ? 1 : -1));
    return true;
  }
  // Insert: a Gap of the Input length where the cursor is, pushing the music on (spec Q21).
  if (key === 'Insert') {
    lastDigit.current = null;
    const inserted = insertTime(clip, cursorTime(clip, cursor) + editor.cursorAt, ticks(editor.inputLength), cursor);
    if (!inserted) editor.onNotice({ tone: 'error', lines: [SPLITS_TUPLET] });
    else commit(inserted.clip, inserted.cursor, null);
    return true;
  }
  return false;
}

/**
 * A fret typed on the tab: with Grace entry or Tuplet entry on, or in a tuplet, as `typeEntered` says;
 * otherwise on a rest a note of the Input length where the cursor is in the rest, and a second digit soon after
 * on the same spot makes a two-digit fret.
 */
function fretKey(e: ReactKeyboardEvent<HTMLDivElement>, editor: EditorKeys, digit: number) {
  const { clip, cursor, lastDigit, commit } = editor;
  if (typeEntered(e, editor, digit)) return;
  // A Tie chain is one note: a fret typed on any of it goes on its first note, and the rest follow (step 5).
  const typedOn = noteAt(clip, cursor)?.tie ? chainStart(clip, cursor) : cursor;
  const here = splitRestAt(clip, typedOn, editor.cursorAt);
  const spot = `${here.cursor.bar}:${here.cursor.column}:${here.cursor.string}`;
  const before = lastDigit.current;
  const joined = before && before.spot === spot && e.timeStamp - before.at < SECOND_DIGIT_MS ? before.digit * 10 + digit : null;
  if (joined !== null && joined <= MAX_FRET) {
    lastDigit.current = null;
    commit(setFret(here.clip, here.cursor, joined, editor.inputLength), here.cursor);
  } else {
    lastDigit.current = { spot, digit, at: e.timeStamp };
    commit(setFret(here.clip, here.cursor, digit, editor.inputLength), here.cursor);
  }
  editor.hearNote(here.cursor);
}

/**
 * A fret typed with Grace entry or Tuplet entry on, or in a tuplet (step 6, Q6, Q7 and Q11). True when it was
 * one of them; otherwise the fret goes in as it always did.
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

/** ⌘/Ctrl+↑ ↓: the caret up to the staff or back down to the tab. True when it was one. */
function staffOrTabKeyDown(e: ReactKeyboardEvent<HTMLDivElement>, editor: EditorKeys): boolean {
  // With the staff and the tab both drawn (never to a part not drawn), ⌘/Ctrl+↑ takes the caret up to the staff and
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
 * staff's lowest line. Normal mode's ↑ off the top string takes it too.
 */
export function toStaff(editor: EditorKeys) {
  const { clip, cursor } = editor;
  const at = editor.columnOnly ? null : pitchAt(clip, cursor);
  const lowest = nextInChord(clip, cursor, null, false);
  const pitch = at ?? (lowest !== null ? pitchAt(clip, { ...cursor, string: lowest }) : null);
  editor.toPitch(clip, lowest !== null && at === null ? { ...cursor, string: lowest } : cursor, pitch ?? pitchAtStep(clip, cursor.bar, STAFF_LINES[0]), null);
}

/**
 * Down from the staff to the tab (issue #396): on the string of the note the staff's caret was on, else the
 * string it was last on. Normal mode's ↓ off the staff's lowest note takes it too.
 */
export function toTab(editor: EditorKeys) {
  editor.commit(editor.clip, editor.cursor, null);
  editor.setStaffPitch(null);
  editor.setColumnOnly(false);
}

/**
 * The keys the staff caret takes (issue #136, #174, #396): ↓ back down to the tab; # and b the ghost a
 * semitone; Enter adds or takes away the note at its pitch; Alt+↑ ↓ move that note a line or space (no note
 * there: the ghost), with Shift a semitone, with ⌘ (Ctrl) its whole chord, and the caret goes with it. True
 * when the key was one of them.
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
 * A–G on the staff enter that note, as Dorico's do (Jeremy, 2026-11-07, issue #396): the letter nearest the
 * caret's pitch, in the key, or flat, sharp or natural when -, = or 0 came just before. True when the key was
 * one of them.
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
 * Alt+↑ ↓ off the staff caret (issue #174): on a selection, with the staff drawn, every selected note moves a
 * line or space (with Shift a semitone) and the selection stays; on the tab's note, the note moves to the next
 * string up or down that plays the same pitch. True when the key was one of them.
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
