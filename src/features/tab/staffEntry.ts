/**
 * Entering notes from the notation staff (issue #136; `docs/specs/2026-10-27-tab-staff-entry-design.md`):
 * the staff's own cursor is a pitch on the tab cursor's column. Up and Down move it a line or space in
 * the key, # and b a semitone; Enter puts a note at that pitch on the column, with a string and fret
 * Frets chooses, or takes the one there away. Notes move up and down on the staff by keys or a drag
 * (issue #174, `docs/specs/2026-10-28-tab-staff-drag-design.md`), and to another string from the tab.
 * Pitches here are sounding MIDI numbers, as `notation.ts` reckons them. Pure.
 */
import { keyAt, STRING_COUNT, ticks, type Part, type Column, type Duration, type Note } from './clip';
import { advance, splitRestAt } from './grid';
import { clearNote, columnAt, MAX_FRET, normalize, placeOf, selectedRange, setFret, type Cursor, type Selection } from './editing';
import { keyAccidentals, spellPitch } from '@/lib/theory/keys';
import { LETTER_PCS } from '@/lib/theory/notes';
import { writtenStrings, staffStep, WRITTEN_OCTAVE } from './notation';
import { enterGrace, enterTupletNote, type TupletEntry } from './tuplets';
/** `staffStep` counts from E4, the bottom line: letter 2 of octave 4. */
const STEP_ZERO = 4 * 7 + 2;
/** How far the staff cursor may go: two octaves of ledger lines below the staff and above it. */
const LOWEST_STEP = -14;
const HIGHEST_STEP = 22;

/** Where a column is: its bar and its place in the bar. */
export type Place = Pick<Cursor, 'bar' | 'column'>;

/** The staff step a sounding pitch is written on, spelled in the bar's key. */
export function stepOf(clip: Part, bar: number, pitch: number): number {
  return staffStep(spellPitch(pitch + WRITTEN_OCTAVE, keyAt(clip, bar)));
}

/** The pitch of a line or space as the key has it: F♯ on the top line in G major. */
export function pitchOfStep(clip: Part, bar: number, step: number): number {
  const letterSteps = step + STEP_ZERO;
  const octave = Math.floor(letterSteps / 7);
  const letter = letterSteps - octave * 7;
  const written = (octave + 1) * 12 + LETTER_PCS[letter] + keyAccidentals(keyAt(clip, bar))[letter];
  return written - WRITTEN_OCTAVE;
}

/** The staff cursor moved a line or space up (1) or down (-1), onto the key's note there. */
export function stepPitch(clip: Part, bar: number, pitch: number, direction: 1 | -1): number {
  const step = Math.max(LOWEST_STEP, Math.min(HIGHEST_STEP, stepOf(clip, bar, pitch) + direction));
  return pitchOfStep(clip, bar, step);
}

/** The pitch a press on the staff names: the key's note on that line or space. */
export function pitchAtStep(clip: Part, bar: number, step: number): number {
  return pitchOfStep(clip, bar, Math.max(LOWEST_STEP, Math.min(HIGHEST_STEP, step)));
}

/** The sounding pitch, as the staff writes it, of a fret on a string. */
export function pitchOf(clip: Part, string: number, fret: number): number {
  return writtenStrings(clip.tuning)[string] + (clip.capo ?? 0) + fret;
}

/** Each note's pitch in a column, as the staff writes it, by string; null for none or a dead note. */
function pitches(clip: Part, column: Column | null): (number | null)[] {
  const open = writtenStrings(clip.tuning);
  const capo = clip.capo ?? 0;
  return Array.from({ length: STRING_COUNT }, (_, s) => {
    const note = column?.notes[s];
    return note && note.fret !== null ? open[s] + capo + note.fret : null;
  });
}

/** The string of the column's note at a pitch, or null. */
export function stringAtPitch(clip: Part, at: Place, pitch: number): number | null {
  const s = pitches(clip, columnAt(clip, { ...at, string: 0 })).indexOf(pitch);
  return s < 0 ? null : s;
}

/** The fret to aim near: the column's other notes, else the nearest column before with fretted notes. */
function aimFret(clip: Part, at: Place): number | null {
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
export function choosePlace(clip: Part, at: Place, pitch: number): { string: number; fret: number } | null {
  const column = columnAt(clip, { ...at, string: 0 });
  return placeAmong(clip, column?.notes ?? [], pitch, aimFret(clip, at));
}

/** The free string (no note in `notes`) that plays a pitch with the fret nearest `aim`; ties go to the lower fret. */
function placeAmong(clip: Part, notes: readonly (Note | null)[], pitch: number, aim: number | null): { string: number; fret: number } | null {
  const open = writtenStrings(clip.tuning);
  const capo = clip.capo ?? 0;
  const cost = (fret: number) => {
    if (aim === null) return fret;
    if (fret === 0) return aim <= OPEN_REACH ? 0 : aim;
    return Math.abs(fret - aim);
  };
  let best: { string: number; fret: number } | null = null;
  for (let s = 0; s < STRING_COUNT; s++) {
    if (notes[s]) continue;
    const fret = pitch - open[s] - capo;
    if (fret < 0 || fret > MAX_FRET) continue;
    if (!best || cost(fret) < cost(best.fret) || (cost(fret) === cost(best.fret) && fret < best.fret)) best = { string: s, fret };
  }
  return best;
}

/** What the line under the clip says when no string can take a note entered on the staff. */
const NO_FREE_STRING = 'No free string can play that note here.';

/** What Enter on the staff did: the clip after it, and the string of the note now at the cursor (null after a removal). */
export interface StaffEdit {
  clip: Part;
  string: number | null;
  /** Why nothing changed, for the line under the clip. */
  problem?: string;
}

/**
 * Enter on the staff: takes away the column's note at the pitch, or puts one there on the string Frets picks
 * (on a rest, `length` long when given, as `setFret`).
 */
export function toggleStaffNote(clip: Part, at: Place, pitch: number, length?: Duration): StaffEdit {
  const there = stringAtPitch(clip, at, pitch);
  if (there !== null) return { clip: clearNote(clip, { ...at, string: there }), string: null };
  const place = choosePlace(clip, at, pitch);
  if (!place) return { clip, string: null, problem: NO_FREE_STRING };
  return { clip: setFret(clip, { ...at, string: place.string }, place.fret, length), string: place.string };
}

/**
 * Alt+Up on the tab (toward the high e, -1) or Alt+Down (toward the low E, 1): the note at the pitch moved to the
 * next string that way that can play it and has no note in the column, keeping its marks.
 */
export function moveToString(clip: Part, at: Place, pitch: number, direction: -1 | 1): StaffEdit {
  const from = stringAtPitch(clip, at, pitch);
  if (from === null) return { clip, string: null };
  for (let s = from + direction; s >= 0 && s < STRING_COUNT; s += direction) {
    const moved = noteToString(clip, { ...at, string: from }, s);
    if (moved) return { clip: moved, string: s };
  }
  return { clip, string: from };
}

/**
 * The fretted note at `at` moved to string `to` at the same pitch, its fret worked out again and its
 * marks kept (issue #238: Ctrl/⌘+↑ ↓, and dragging a fret number to another string). Null when `to`
 * already has a note in the column or can't play the pitch between the open string and the 24th fret.
 */
export function noteToString(clip: Part, at: Cursor, to: number): Part | null {
  const column = columnAt(clip, at);
  const note = column?.notes[at.string];
  if (!column || !note || note.fret === null || to < 0 || to >= STRING_COUNT) return null;
  if (to === at.string) return clip;
  const fret = pitchOf(clip, at.string, note.fret) - writtenStrings(clip.tuning)[to] - (clip.capo ?? 0);
  if (column.notes[to] || fret < 0 || fret > MAX_FRET) return null;
  const notes = column.notes.map((n, k) => (k === at.string ? null : k === to ? { ...note, fret } : n));
  const bar = clip.bars[at.bar];
  const columns = bar.columns.map((c, i) => (i === at.column ? { ...c, notes } : c));
  const bars = clip.bars.map((b, i) => (i === at.bar ? { ...b, columns } : b));
  return normalize({ ...clip, bars });
}

/** Where the staff cursor is drawn for a pitch: its step, and the sign it shows when the key doesn't give it. */
export function staffCursorPlace(clip: Part, bar: number, pitch: number): { step: number; sign: -1 | 0 | 1 | null } {
  const key = keyAt(clip, bar);
  const n = spellPitch(pitch + WRITTEN_OCTAVE, key);
  const fromKey = keyAccidentals(key)[n.letter];
  return { step: staffStep(n), sign: n.accidental === fromKey ? null : (Math.max(-1, Math.min(1, n.accidental)) as -1 | 0 | 1) };
}

/**
 * How notes move on the staff (issue #174): `steps` lines or spaces in the key, or with `semitones`
 * that many semitones; up when positive.
 */
export interface PitchMove {
  steps: number;
  semitones: boolean;
}

/** A sounding pitch moved: a semitone at a time, or a line or space at a time in the bar's key. */
export function movedPitch(clip: Part, bar: number, pitch: number, move: PitchMove): number {
  if (move.semitones) return pitch + move.steps;
  let moved = pitch;
  for (let i = 0; i < Math.abs(move.steps); i++) moved = stepPitch(clip, bar, moved, move.steps > 0 ? 1 : -1);
  return moved;
}

/**
 * The notes a move on the staff carries: every note of the selected columns when there is a
 * selection; else, with `chord`, every note of the cursor's column; else the note at the pitch.
 * Dead notes have no pitch and stay where they are.
 */
export function notesToMove(clip: Part, at: Place, pitch: number, selection: Selection | null, chord: boolean): Cursor[] {
  const inColumn = (place: Place): Cursor[] => {
    const column = columnAt(clip, { ...place, string: 0 });
    if (!column) return [];
    return column.notes.flatMap((n, string) => (n && n.fret !== null ? [{ ...place, string }] : []));
  };
  if (selection) {
    const [from, to] = selectedRange(selection);
    const places: Cursor[] = [];
    for (let i = from; i <= to; i++) places.push(...inColumn(placeOf(clip, i)));
    return places;
  }
  if (chord) return inColumn(at);
  const string = stringAtPitch(clip, at, pitch);
  return string === null ? [] : [{ ...at, string }];
}

/**
 * Notes moved up or down on the staff (issue #174), keeping their marks. A note stays on its string
 * while that string can play the new pitch, so a chord keeps its shape; else Frets picks a free string
 * and fret for it, nearest where it was played. When any note can't be placed, nothing moves.
 */
export function moveNotes(clip: Part, places: readonly Cursor[], move: PitchMove): StaffEdit & { moved: Cursor[] } {
  const open = writtenStrings(clip.tuning);
  const capo = clip.capo ?? 0;
  const byColumn = new Map<string, Cursor[]>();
  for (const place of places) {
    const id = `${place.bar}:${place.column}`;
    byColumn.set(id, [...(byColumn.get(id) ?? []), place]);
  }
  let bars = clip.bars;
  const moved: Cursor[] = [];
  for (const group of byColumn.values()) {
    const { bar, column } = group[0];
    const notes = bars[bar].columns[column].notes;
    const leaving = group.map(p => ({ from: p.string, note: notes[p.string]!, pitch: movedPitch(clip, bar, open[p.string] + capo + notes[p.string]!.fret!, move) }));
    const left: (Note | null)[] = notes.map((n, s) => (group.some(p => p.string === s) ? null : n));
    const off: typeof leaving = [];
    for (const l of leaving) {
      const fret = l.pitch - open[l.from] - capo;
      if (fret < 0 || fret > MAX_FRET) off.push(l);
      else {
        left[l.from] = { ...l.note, fret };
        moved.push({ bar, column, string: l.from });
      }
    }
    // The notes off the end of their strings, highest first, near where they were played (an open
    // string doesn't say where the hand is).
    const frets = leaving.map(l => l.note.fret!).filter(f => f > 0);
    const aim = frets.length ? frets.reduce((x, y) => x + y, 0) / frets.length : aimFret(clip, { bar, column });
    for (const l of off.sort((a, b) => b.pitch - a.pitch)) {
      const place = placeAmong(clip, left, l.pitch, aim);
      if (!place) return { clip, string: null, moved: [], problem: NO_FREE_STRING };
      left[place.string] = { ...l.note, fret: place.fret };
      moved.push({ bar, column, string: place.string });
    }
    const columns = bars[bar].columns.map((c, i) => (i === column ? { ...c, notes: left } : c));
    bars = bars.map((b, i) => (i === bar ? { ...b, columns } : b));
  }
  return { clip: normalize({ ...clip, bars }), string: moved[0]?.string ?? null, moved };
}

/** A sign typed before a letter in note input mode, as Dorico's: - a flat, = a sharp, 0 a natural. */
export type TypedAccidental = -1 | 0 | 1;

/**
 * The pitch a letter key names in note input mode, as Dorico's A–G (Jeremy, 2026-11-07, issue #396): that
 * letter on the line or space nearest `near`, as the key has it (F♯ in G major); with a sign typed first,
 * that letter flat, natural or sharp instead.
 */
export function pitchOfLetter(clip: Part, bar: number, letter: string, near: number, sign: TypedAccidental | null): number {
  const wanted = 'cdefgab'.indexOf(letter.toLowerCase());
  const from = stepOf(clip, bar, near);
  const up = (((wanted - (from + STEP_ZERO)) % 7) + 7) % 7;
  const step = Math.max(LOWEST_STEP, Math.min(HIGHEST_STEP, up <= 3 ? from + up : from + up - 7));
  const inKey = pitchOfStep(clip, bar, step);
  if (sign === null) return inKey;
  return inKey - keyAccidentals(keyAt(clip, bar))[wanted] + sign;
}

/** Note input mode's Tuplet entry and Grace entry, which a note entered on the staff follows as a typed fret does. */
export interface StaffEntryModes {
  tuplet: TupletEntry;
  grace: boolean;
}

const NO_ENTRY_MODES: StaffEntryModes = { tuplet: { n: null, from: null }, grace: false };

/** What a note entered on the staff did: the caret after it, the note itself, and whether it started a tuplet. */
export type StaffEntered = StaffEdit & { cursor: Cursor; at: number; note: Cursor | null; tupletStarted?: boolean };

/**
 * A note put on the staff in note input mode at the caret (`at` ticks into its column, splitting a rest there),
 * and the caret on past it by its length, as Dorico's goes on (Jeremy, 2026-11-07, issue #396). A note
 * already at the pitch is taken away when `toggle` (Enter), the caret staying; else it stays and the caret
 * goes on past it. As a fret typed on the tab (issue #469): with Grace entry on it is a grace note before the
 * caret's column, the caret staying; in a tuplet's Gap, or with Tuplet entry on, it is a tuplet note, and the
 * caret goes on by that note's length.
 */
export function enterOnStaff(clip: Part, cursor: Cursor, at: number, pitch: number, length: Duration, toggle: boolean, modes: StaffEntryModes = NO_ENTRY_MODES): StaffEntered {
  const unchanged = (problem?: string): StaffEntered => ({ clip, string: null, problem, cursor, at, note: null });
  // A note entered on its own, in a Column of its own (a grace note, a new tuplet note): any free string.
  const placeAlone = (part: Part, place: Place) => placeAmong(part, [], pitch, aimFret(part, place));
  if (modes.grace) {
    const here = splitRestAt(clip, cursor, at);
    const place = placeAlone(here.clip, here.cursor);
    if (!place) return unchanged(NO_FREE_STRING);
    const entered = enterGrace(here.clip, { ...here.cursor, string: place.string }, place.fret);
    const note = { ...entered.cursor, column: entered.cursor.column - 1 };
    return { clip: entered.clip, string: place.string, cursor: entered.cursor, at: 0, note };
  }
  if (stringAtPitch(clip, cursor, pitch) === null) {
    const place = placeAlone(clip, cursor);
    const typed = place && enterTupletNote(clip, { ...cursor, string: place.string }, at, place.fret, length, modes.tuplet);
    if (typed && 'problem' in typed) return unchanged(typed.problem ?? undefined);
    if (typed) {
      const column = typed.clip.bars[typed.cursor.bar].columns[typed.cursor.column];
      const moved = advance(typed.clip, typed.cursor, 0, ticks(column.duration));
      return { clip: moved.clip, string: place.string, cursor: moved.cursor, at: moved.at, note: typed.cursor, tupletStarted: typed.started };
    }
  }
  const here = splitRestAt(clip, cursor, at);
  const there = stringAtPitch(here.clip, here.cursor, pitch);
  if (there !== null && toggle) return { ...toggleStaffNote(here.clip, here.cursor, pitch), cursor: here.cursor, at: 0, note: null };
  const edit = there !== null ? { clip: here.clip, string: there } : toggleStaffNote(here.clip, here.cursor, pitch, length);
  if (edit.string === null) return { ...edit, cursor: here.cursor, at: 0, note: null };
  const column = edit.clip.bars[here.cursor.bar].columns[here.cursor.column];
  const moved = advance(edit.clip, here.cursor, 0, ticks(column.duration));
  return { clip: moved.clip, string: edit.string, cursor: moved.cursor, at: moved.at, note: { ...here.cursor, string: edit.string } };
}
