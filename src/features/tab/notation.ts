/**
 * What the staff shows for a clip (issue #122; `docs/specs/2026-10-27-tab-notation-design.md`): each
 * note's pitch from its string, fret, the tuning and the capo; how it is spelled in the key in force;
 * where it sits on a treble staff written an octave above the sound, as guitar music is; and which
 * accidentals a bar must show. Pure.
 */
import { TUNING as STANDARD_MIDI } from '@/lib/music';
import { keyAccidentals, spellPitch, type Accidental, type Key, type Spelled } from '@/lib/theory/keys';
import { mod12, pitchClassOf } from '@/lib/theory/notes';
import { bentSemitones, whammyGoesOn, whammySemitones, keyAt, OTTAVA_SHIFT, STRING_COUNT, type Part, type Column, type Note } from './clip';

/**
 * Each string's open pitch as a MIDI number, high e (0) first as the clip's notes are. The tuning
 * names carry no octave, so each string takes the octave nearest its standard tuning's (drop D's
 * low D is D2).
 */
export function openStrings(tuning: readonly string[]): number[] {
  return Array.from({ length: STRING_COUNT }, (_, s) => {
    const low = STRING_COUNT - 1 - s;
    const standard = STANDARD_MIDI[low];
    const diff = mod12(pitchClassOf(tuning[low]) - standard);
    return standard + (diff > 6 ? diff - 12 : diff);
  });
}

/**
 * How far every string is tuned from standard when all are tuned alike, in semitones (E♭ tuning,
 * "tune down 1/2 step", is -1); 0 for standard tuning or one with strings tuned apart (drop D).
 */
export function tuningShift(tuning: readonly string[]): number {
  const open = openStrings(tuning);
  const shift = open[0] - STANDARD_MIDI[STRING_COUNT - 1];
  return open.every((p, s) => p - STANDARD_MIDI[STRING_COUNT - 1 - s] === shift) ? shift : 0;
}

/**
 * Each string's open pitch as the staff writes it, high e first. With every string tuned alike the
 * staff is written as if in standard tuning, as guitar books print music for a guitar tuned down
 * (a "tune down 1/2 step" score reads in the fingered key); otherwise as it sounds.
 */
export function writtenStrings(tuning: readonly string[]): number[] {
  const shift = tuningShift(tuning);
  return openStrings(tuning).map(p => p - shift);
}

/** A note's sounding pitch: open string, capo and fret; null for a dead note, which has none. */
export function soundingPitch(open: number[], capo: number, s: number, note: Note): number | null {
  return note.fret === null ? null : open[s] + capo + note.fret;
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

/** The key signature's signs, as written, each with its staff step. */
export function keySigns(key: Key): { step: number; sharp: boolean }[] {
  const count = Math.abs(key.fifths);
  const sharp = key.fifths > 0;
  return (sharp ? SHARP_STEPS : FLAT_STEPS).slice(0, count).map(step => ({ step, sharp }));
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
  /** A tied note held through a bend: drawn in brackets at the pitch it reaches (`bentSemitones`). */
  bent?: boolean;
  /**
   * A picked note bent up (`pickedBendSemitones`) is drawn at the pitch its bend reaches, as Guitar Pro
   * prints it, after the pitch it starts from in brackets, joined to it by a line (issue #176); a
   * pre-dipped note (the whammy bar) at the pitch it is dipped to, after its fret's (issue #216).
   */
  bendFrom?: SmallHead;
  /** Let down within the same note, the pitch it comes back to, in brackets after it. */
  bendBack?: SmallHead;
}

/** A bracketed head beside a bent note's own: its staff step and the sign it shows. */
export interface SmallHead {
  step: number;
  shows: Accidental | null;
}

/**
 * How far a picked note's own bend takes it up, in semitones; 0 for none. A pre-bend starts bent, a
 * tied note carries on from the note before, and a grace note bent up is itself the starting pitch,
 * so none of them gets a starting head of its own.
 */
export function pickedBendSemitones(column: Column, note: Note): number {
  if (!note.bend || note.tie || note.bend.pre || column.grace || note.fret === null) return 0;
  return Math.floor(note.bend.quarters / 2);
}

/**
 * Every column's note heads in a bar, as drawn: spelled in the bar's key, with the accidentals the
 * bar must show. An accidental holds for the rest of the bar on its line or space (not in other
 * octaves); a tied note takes its sign from the note before and shows none.
 */
export function barHeads(clip: Part, barIndex: number, open = writtenStrings(clip.tuning)): Head[][] {
  const key = keyAt(clip, barIndex);
  const inKey = keyAccidentals(key);
  const now = new Map<number, Accidental>();
  const capo = clip.capo ?? 0;
  const goesOn = whammyGoesOn(clip);
  return clip.bars[barIndex].columns.map(column => {
    // Under the whammy bar a note is drawn at the pitch its bar starts at, as the book prints Stop: a tied
    // note going on under a dive at the pitch reached, and a pre-dipped one after its fret's pitch in brackets.
    const dip = column.whammy ? whammySemitones(column.whammy[0]) : 0;
    const preDipped = dip !== 0 && !goesOn.has(column);
    const heads: Head[] = [];
    // Under an octave line the notes are written an octave or two from where they sound.
    const written = WRITTEN_OCTAVE - (column.ottava ? OTTAVA_SHIFT[column.ottava] : 0);
    column.notes.forEach((note, s) => {
      if (!note) return;
      if (note.fret === null) {
        const n = spellPitch(open[s] + capo + written, key);
        heads.push({ string: s, step: staffStep(n), shows: null, dead: true });
        return;
      }
      // Spelled in the key; a sign holds for the rest of the bar on its line or space.
      const place = (pitch: number, quiet = false): SmallHead => {
        const n = spellPitch(pitch, key);
        const step = staffStep(n);
        const current = now.get(step) ?? inKey[n.letter];
        const shows = quiet || n.accidental === current ? null : n.accidental;
        now.set(step, n.accidental);
        return { step, shows };
      };
      const fretted = soundingPitch(open, capo, s, note)! + written;
      // A picked note bent up: first the pitch it starts from, then the pitch the bend takes it to.
      const rise = pickedBendSemitones(column, note);
      const bendFrom = rise > 0 || (preDipped && !note.tie) ? place(fretted) : null;
      // A tied note in a bend sounds where the bend has taken it, spelled in the key like any other.
      const bent = !!(note.tie && note.bend);
      const { step, shows } = place(fretted + bentSemitones(note) + rise + dip, note.tie && !bent && dip === 0);
      const bendBack = rise > 0 && note.bend!.release ? place(fretted + Math.floor((note.bend!.to ?? 0) / 2)) : null;
      heads.push({
        string: s, step, shows, dead: false,
        ...(bent ? { bent } : {}), ...(bendFrom ? { bendFrom } : {}), ...(bendBack ? { bendBack } : {}),
      });
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
