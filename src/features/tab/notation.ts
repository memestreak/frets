/**
 * What the staff shows for a clip (issue #122; `docs/specs/2026-10-27-tab-notation-design.md`): each
 * note's pitch from its string, fret, the tuning and the capo; how it is spelled in the key in force;
 * where it sits on a treble staff written an octave above the sound, as guitar music is; and which
 * accidentals a bar must show. Pure.
 */
import { keyAt, keyTonic, STRING_COUNT, type Clip, type Key, type Note } from './clip';

/** Standard tuning's strings as MIDI numbers, lowest first: E2 A2 D3 G3 B3 E4. */
const STANDARD_MIDI = [40, 45, 50, 55, 59, 64];
const PITCH_CLASS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LETTERS = 'CDEFGAB';

/** A note name's pitch class: "F#" 6, "Bb" 10. */
function pitchClass(name: string): number {
  const base = PITCH_CLASS[name[0].toUpperCase()];
  const shift = [...name.slice(1)].reduce((n, c) => n + (c === '#' ? 1 : c === 'b' ? -1 : 0), 0);
  return (((base + shift) % 12) + 12) % 12;
}

/**
 * Each string's open pitch as a MIDI number, high e (0) first as the clip's notes are. The tuning
 * names carry no octave, so each string takes the octave nearest its standard tuning's (drop D's
 * low D is D2).
 */
export function openStrings(tuning: readonly string[]): number[] {
  return Array.from({ length: STRING_COUNT }, (_, s) => {
    const low = STRING_COUNT - 1 - s;
    const standard = STANDARD_MIDI[low];
    const diff = (((pitchClass(tuning[low]) - standard) % 12) + 12) % 12;
    return standard + (diff > 6 ? diff - 12 : diff);
  });
}

/** A note's sounding pitch: open string, capo and fret; null for a dead note, which has none. */
export function soundingPitch(open: number[], capo: number, s: number, note: Note): number | null {
  return note.fret === null ? null : open[s] + capo + note.fret;
}

/** -2 to 2: a double flat to a double sharp. */
export type Accidental = -2 | -1 | 0 | 1 | 2;

/** A pitch as a note name: its letter (0 C to 6 B), accidental and octave. */
export interface Spelled {
  letter: number;
  accidental: Accidental;
  octave: number;
}

/** The key's seven notes, tonic first: the letter and accidental each is spelled with. */
function scaleOf(key: Key): { letter: number; accidental: Accidental; pc: number }[] {
  const tonic = keyTonic(key);
  const first = LETTERS.indexOf(tonic[0]);
  const tonicPc = pitchClass(tonic);
  const steps = key.minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  return steps.map((step, k) => {
    const letter = (first + k) % 7;
    const pc = (tonicPc + step) % 12;
    let accidental = pc - PITCH_CLASS[LETTERS[letter]];
    if (accidental > 6) accidental -= 12;
    if (accidental < -6) accidental += 12;
    return { letter, accidental: accidental as Accidental, pc };
  });
}

/**
 * How a pitch is spelled in a key (Jeremy, 2026-10-27): a note of the key as the key spells it; in a
 * minor key the raised seventh on the seventh's letter (G♯ in A minor); any other white key as its
 * natural; any other black key sharpened from the letter below in sharp keys and C, flattened from the
 * letter above in flat keys.
 */
export function spell(midi: number, key: Key): Spelled {
  const pc = ((midi % 12) + 12) % 12;
  const scale = scaleOf(key);
  let found: { letter: number; accidental: Accidental } | undefined = scale.find(n => n.pc === pc);
  if (!found && key.minor && pc === (scale[6].pc + 1) % 12) found = { letter: scale[6].letter, accidental: (scale[6].accidental + 1) as Accidental };
  // Any other white key is its own letter, natural (F in G major, not E♯).
  const white = Object.entries(PITCH_CLASS).find(([, c]) => c === pc);
  if (!found && white) found = { letter: LETTERS.indexOf(white[0]), accidental: 0 };
  if (!found) {
    const flat = key.fifths < 0;
    const base = flat ? (pc + 1) % 12 : (pc + 11) % 12;
    // Beside every note outside a major or minor scale, the one below and the one above are in it.
    const near = scale.find(n => n.pc === base)!;
    found = { letter: near.letter, accidental: (near.accidental + (flat ? -1 : 1)) as Accidental };
  }
  // The octave goes with the letter: B♯3 is C4's sound, C♭4 is B3's.
  const octave = Math.floor((midi - found.accidental - PITCH_CLASS[LETTERS[found.letter]]) / 12) - 1;
  return { letter: found.letter, accidental: found.accidental, octave };
}

/** A spelled note's place on the treble staff in half spaces, up from the bottom line (E4 is 0, F4 1). */
export function staffStep(n: Spelled): number {
  return n.octave * 7 + n.letter - (4 * 7 + 2);
}

/** Guitar is written an octave above how it sounds. */
export const WRITTEN_OCTAVE = 12;

/** Where the key signature's sharps go, in the order written, as staff steps: F C G D A E B. */
const SHARP_STEPS = [8, 5, 9, 6, 3, 7, 4];
/** And its flats: B E A D G C F. */
const FLAT_STEPS = [4, 7, 3, 6, 2, 5, 1];
const SHARP_LETTERS = [3, 0, 4, 1, 5, 2, 6];
const FLAT_LETTERS = [6, 2, 5, 1, 4, 0, 3];

/** The key signature's signs, as written, each with its staff step. */
export function keySigns(key: Key): { step: number; sharp: boolean }[] {
  const count = Math.abs(key.fifths);
  const sharp = key.fifths > 0;
  return (sharp ? SHARP_STEPS : FLAT_STEPS).slice(0, count).map(step => ({ step, sharp }));
}

/** The accidental the key signature gives each letter, C to B. */
function keyAccidentals(key: Key): Accidental[] {
  const out: Accidental[] = [0, 0, 0, 0, 0, 0, 0];
  const count = Math.abs(key.fifths);
  const letters = key.fifths > 0 ? SHARP_LETTERS : FLAT_LETTERS;
  for (const letter of letters.slice(0, count)) out[letter] = key.fifths > 0 ? 1 : -1;
  return out;
}

/** One note head on the staff. */
export interface Head {
  /** The note's string, high e 0. */
  string: number;
  /** Half spaces up from the bottom line. */
  step: number;
  /** The sign drawn before it, or null when the key and the bar so far already say it. */
  shows: Accidental | null;
  /** A dead note: an × for a head, on its open string's place. */
  dead: boolean;
}

/**
 * Every column's note heads in a bar, as drawn: spelled in the bar's key, with the accidentals the
 * bar must show. An accidental holds for the rest of the bar on its line or space (not in other
 * octaves); a tied note takes its sign from the note before and shows none.
 */
export function barHeads(clip: Clip, barIndex: number, open = openStrings(clip.tuning)): Head[][] {
  const key = keyAt(clip, barIndex);
  const inKey = keyAccidentals(key);
  const now = new Map<number, Accidental>();
  const capo = clip.capo ?? 0;
  return clip.bars[barIndex].columns.map(column => {
    const heads: Head[] = [];
    column.notes.forEach((note, s) => {
      if (!note) return;
      if (note.fret === null) {
        const n = spell(open[s] + capo + WRITTEN_OCTAVE, key);
        heads.push({ string: s, step: staffStep(n), shows: null, dead: true });
        return;
      }
      const n = spell(soundingPitch(open, capo, s, note)! + WRITTEN_OCTAVE, key);
      const step = staffStep(n);
      const current = now.get(step) ?? inKey[n.letter];
      const shows = note.tie || n.accidental === current ? null : n.accidental;
      now.set(step, n.accidental);
      heads.push({ string: s, step, shows, dead: false });
    });
    // Low to high, as stems and seconds are worked out.
    return heads.sort((a, b) => a.step - b.step);
  });
}

/** Steps the staff's five lines are on. */
export const STAFF_LINES = [0, 2, 4, 6, 8];
/** The middle line, where stems turn round. */
export const MIDDLE_STEP = 4;

/** How close two accidentals may stand one over the other in the same lane, in steps. */
const ACCIDENTAL_CLEARANCE = 6;

/**
 * Which lane, leftward from the heads, each head's accidental goes in (null for none): top down,
 * each in the nearest lane with no sign too close above it, so a chord's signs don't overlap.
 */
export function accidentalLanes(heads: Head[]): (number | null)[] {
  const lanes: (number | null)[] = heads.map(() => null);
  const used: number[][] = [];
  for (let k = heads.length - 1; k >= 0; k--) {
    if (heads[k].shows === null) continue;
    let lane = 0;
    while (used[lane]?.some(step => Math.abs(step - heads[k].step) < ACCIDENTAL_CLEARANCE)) lane++;
    (used[lane] ??= []).push(heads[k].step);
    lanes[k] = lane;
  }
  return lanes;
}
