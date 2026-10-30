/**
 * The edits and moves of normal mode (issue #238, `docs/specs/2026-10-30-tab-note-input-mode-design.md`):
 * MuseScore's keys on what is selected, as against note input, where the cursor types. Pure.
 */
import { type NoteValue, type Part, STRING_COUNT } from './clip';
import { columnAt, MAX_FRET, normalize, placeOf, selectedRange, type Cursor, type Selection } from './editing';
import { pitchOf } from './staffEntry';

/**
 * MuseScore's length keys, in normal mode on the staff (Jeremy, 2026-10-30): 1 a sixty-fourth, 2 a
 * thirty-second, 3 a sixteenth, 4 an eighth, 5 a quarter, 6 a half, 7 a whole. Frets has no longer or
 * shorter, so 8, 9 and 0 are nothing. On the tab, Shift with the digit does the same in note input.
 */
export function valueForDigit(digit: number): NoteValue | null {
  const values: Record<number, NoteValue> = { 1: 64, 2: 32, 3: 16, 4: 8, 5: 4, 6: 2, 7: 1 };
  return values[digit] ?? null;
}

/** The digit of a key's physical place (`KeyboardEvent.code`, "Digit5"), whatever Shift made it type. */
export function digitOfCode(code: string): number | null {
  const m = /^(?:Digit|Numpad)(\d)$/.exec(code);
  return m ? Number(m[1]) : null;
}

/** Every fretted note of the selected columns when there is a selection, else the cursor's note (if fretted). */
export function selectedNotes(clip: Part, cursor: Cursor, selection: Selection | null): Cursor[] {
  const fretted = (at: Cursor) => {
    const note = columnAt(clip, at)?.notes[at.string];
    return note !== null && note !== undefined && note.fret !== null;
  };
  if (!selection) return fretted(cursor) ? [cursor] : [];
  const [from, to] = selectedRange(selection);
  const places: Cursor[] = [];
  for (let i = from; i <= to; i++) {
    const { bar, column } = placeOf(clip, i);
    for (let string = 0; string < STRING_COUNT; string++) if (fretted({ bar, column, string })) places.push({ bar, column, string });
  }
  return places;
}

/**
 * ↑ ↓ on the tab in normal mode: each note a fret higher or lower on its own string, keeping its marks.
 * Nothing moves when any would go past the open string or the 24th fret.
 */
export function stepFrets(clip: Part, places: readonly Cursor[], step: 1 | -1): Part {
  if (places.length === 0) return clip;
  const fretOf = (p: Cursor) => clip.bars[p.bar].columns[p.column].notes[p.string]!.fret!;
  if (places.some(p => fretOf(p) + step < 0 || fretOf(p) + step > MAX_FRET)) return clip;
  const moved = new Set(places.map(p => `${p.bar}:${p.column}:${p.string}`));
  const bars = clip.bars.map((bar, b) => ({
    ...bar,
    columns: bar.columns.map((column, c) => ({
      ...column,
      notes: column.notes.map((note, s) => (note && moved.has(`${b}:${c}:${s}`) ? { ...note, fret: note.fret! + step } : note)),
    })),
  }));
  return normalize({ ...clip, bars });
}

/**
 * Alt+↑ ↓ in normal mode (MuseScore's "note above / below in the chord"): the string of the column's
 * next note up or down in pitch from `pitch`; from none (the column alone), its top or bottom note.
 * Null when there is none that way. Dead notes have no pitch and are passed over.
 */
export function nextInChord(clip: Part, at: Cursor, pitch: number | null, up: boolean): number | null {
  const column = columnAt(clip, at);
  if (!column) return null;
  const notes = column.notes
    .map((note, string) => (note && note.fret !== null ? { string, pitch: pitchOf(clip, string, note.fret) } : null))
    .filter((n): n is { string: number; pitch: number } => n !== null)
    .sort((a, b) => a.pitch - b.pitch);
  if (notes.length === 0) return null;
  if (pitch === null) return (up ? notes[notes.length - 1] : notes[0]).string;
  const next = up ? notes.find(n => n.pitch > pitch) : [...notes].reverse().find(n => n.pitch < pitch);
  return next?.string ?? null;
}

/** The pitch of the note on a string of the cursor's column, or null for none or a dead note. */
export function pitchAt(clip: Part, at: Cursor): number | null {
  const note = columnAt(clip, at)?.notes[at.string];
  return note && note.fret !== null ? pitchOf(clip, at.string, note.fret) : null;
}
