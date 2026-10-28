/**
 * Entering notes from the notation staff (issue #136; `docs/specs/2026-10-27-tab-staff-entry-design.md`):
 * the staff's own cursor is a pitch on the tab cursor's column. Up and Down move it a line or space in
 * the key, # and b a semitone; Enter puts a note at that pitch on the column, with a string and fret
 * Frets chooses, or takes the one there away; Alt+Up and Alt+Down move that note to another string.
 * Pitches here are sounding MIDI numbers, as `notation.ts` reckons them. Pure.
 */
import { keyAt, STRING_COUNT, type Clip, type Column, type Note } from './clip';
import { clearNote, columnAt, MAX_FRET, normalize, setFret, type Cursor } from './editing';
import { keyAccidentals, writtenStrings, spell, staffStep, WRITTEN_OCTAVE } from './notation';

const PITCH_CLASS = [0, 2, 4, 5, 7, 9, 11];
/** `staffStep` counts from E4, the bottom line: letter 2 of octave 4. */
const STEP_ZERO = 4 * 7 + 2;
/** How far the staff cursor may go: two octaves of ledger lines below the staff and above it. */
const LOWEST_STEP = -14;
const HIGHEST_STEP = 22;

/** Where a column is: its bar and its place in the bar. */
export type Place = Pick<Cursor, 'bar' | 'column'>;

/** The staff step a sounding pitch is written on, spelled in the bar's key. */
export function stepOf(clip: Clip, bar: number, pitch: number): number {
  return staffStep(spell(pitch + WRITTEN_OCTAVE, keyAt(clip, bar)));
}

/** The pitch of a line or space as the key has it: F♯ on the top line in G major. */
export function pitchOfStep(clip: Clip, bar: number, step: number): number {
  const letterSteps = step + STEP_ZERO;
  const octave = Math.floor(letterSteps / 7);
  const letter = letterSteps - octave * 7;
  const written = (octave + 1) * 12 + PITCH_CLASS[letter] + keyAccidentals(keyAt(clip, bar))[letter];
  return written - WRITTEN_OCTAVE;
}

/** The staff cursor moved a line or space up (1) or down (-1), onto the key's note there. */
export function stepPitch(clip: Clip, bar: number, pitch: number, direction: 1 | -1): number {
  const step = Math.max(LOWEST_STEP, Math.min(HIGHEST_STEP, stepOf(clip, bar, pitch) + direction));
  return pitchOfStep(clip, bar, step);
}

/** The pitch a press on the staff names: the key's note on that line or space. */
export function pitchAtStep(clip: Clip, bar: number, step: number): number {
  return pitchOfStep(clip, bar, Math.max(LOWEST_STEP, Math.min(HIGHEST_STEP, step)));
}

/** Each note's pitch in a column, as the staff writes it, by string; null for none or a dead note. */
function pitches(clip: Clip, column: Column | null): (number | null)[] {
  const open = writtenStrings(clip.tuning);
  const capo = clip.capo ?? 0;
  return Array.from({ length: STRING_COUNT }, (_, s) => {
    const note = column?.notes[s];
    return note && note.fret !== null ? open[s] + capo + note.fret : null;
  });
}

/** The string of the column's note at a pitch, or null. */
export function stringAtPitch(clip: Clip, at: Place, pitch: number): number | null {
  const s = pitches(clip, columnAt(clip, { ...at, string: 0 })).indexOf(pitch);
  return s < 0 ? null : s;
}

/** The fret to aim near: the column's other notes, else the nearest column before with fretted notes. */
function aimFret(clip: Clip, at: Place): number | null {
  const fretted = (column: Column | null) => (column?.notes ?? []).filter((n): n is Note => n !== null && n.fret !== null && n.fret > 0).map(n => n.fret!);
  const here = fretted(columnAt(clip, { ...at, string: 0 }));
  if (here.length) return here.reduce((x, y) => x + y, 0) / here.length;
  for (let b = at.bar; b >= 0; b--) {
    const columns = clip.bars[b].columns;
    for (let c = b === at.bar ? at.column - 1 : columns.length - 1; c >= 0; c--) {
      const frets = fretted(columns[c]);
      if (frets.length) return frets.reduce((x, y) => x + y, 0) / frets.length;
    }
  }
  return null;
}

/** Above this fret an open string is no longer "near" the hand. */
const OPEN_REACH = 5;

/**
 * The string and fret Frets picks for a pitch on a column: a string with no note there yet, with the
 * fret nearest the notes around it (an open string counts as near while the hand is low on the neck);
 * with nothing around, the lowest fret. Null when no free string can play it.
 */
export function choosePlace(clip: Clip, at: Place, pitch: number): { string: number; fret: number } | null {
  const open = writtenStrings(clip.tuning);
  const capo = clip.capo ?? 0;
  const column = columnAt(clip, { ...at, string: 0 });
  const aim = aimFret(clip, at);
  const cost = (fret: number) => {
    if (aim === null) return fret;
    if (fret === 0) return aim <= OPEN_REACH ? 0 : aim;
    return Math.abs(fret - aim);
  };
  let best: { string: number; fret: number } | null = null;
  for (let s = 0; s < STRING_COUNT; s++) {
    if (column?.notes[s]) continue;
    const fret = pitch - open[s] - capo;
    if (fret < 0 || fret > MAX_FRET) continue;
    // Ties go to the lower fret.
    if (!best || cost(fret) < cost(best.fret) || (cost(fret) === cost(best.fret) && fret < best.fret)) best = { string: s, fret };
  }
  return best;
}

/** What Enter on the staff did: the clip after it, and the string of the note now at the cursor (null after a removal). */
export interface StaffEdit {
  clip: Clip;
  string: number | null;
  /** Why nothing changed, for the line under the clip. */
  problem?: string;
}

/** Enter on the staff: takes away the column's note at the pitch, or puts one there on the string Frets picks. */
export function toggleStaffNote(clip: Clip, at: Place, pitch: number): StaffEdit {
  const there = stringAtPitch(clip, at, pitch);
  if (there !== null) return { clip: clearNote(clip, { ...at, string: there }), string: null };
  const place = choosePlace(clip, at, pitch);
  if (!place) return { clip, string: null, problem: 'No free string can play that note here.' };
  return { clip: setFret(clip, { ...at, string: place.string }, place.fret), string: place.string };
}

/**
 * Alt+Up (toward the high e, -1) or Alt+Down (toward the low E, 1): the note at the pitch moved to the
 * next string that way that can play it and has no note in the column, keeping its marks.
 */
export function moveToString(clip: Clip, at: Place, pitch: number, direction: -1 | 1): StaffEdit {
  const from = stringAtPitch(clip, at, pitch);
  if (from === null) return { clip, string: null };
  const open = writtenStrings(clip.tuning);
  const capo = clip.capo ?? 0;
  const column = columnAt(clip, { ...at, string: 0 })!;
  for (let s = from + direction; s >= 0 && s < STRING_COUNT; s += direction) {
    const fret = pitch - open[s] - capo;
    if (column.notes[s] || fret < 0 || fret > MAX_FRET) continue;
    const notes = column.notes.map((n, k) => (k === from ? null : k === s ? { ...column.notes[from]!, fret } : n));
    const bar = clip.bars[at.bar];
    const columns = bar.columns.map((c, i) => (i === at.column ? { ...c, notes } : c));
    const bars = clip.bars.map((b, i) => (i === at.bar ? { ...b, columns } : b));
    return { clip: normalize({ ...clip, bars }), string: s };
  }
  return { clip, string: from };
}

/** Where the staff cursor is drawn for a pitch: its step, and the sign it shows when the key doesn't give it. */
export function staffCursorPlace(clip: Clip, bar: number, pitch: number): { step: number; sign: -1 | 0 | 1 | null } {
  const key = keyAt(clip, bar);
  const n = spell(pitch + WRITTEN_OCTAVE, key);
  const fromKey = keyAccidentals(key)[n.letter];
  return { step: staffStep(n), sign: n.accidental === fromKey ? null : (Math.max(-1, Math.min(1, n.accidental)) as -1 | 0 | 1) };
}
