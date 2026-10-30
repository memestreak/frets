import { prettyNote, LETTERS, LETTER_PCS, mod12, pitchClassOf } from './notes';
import { scaleDef, scaleOf, type Scale } from './scales';

/*
 * Major and minor keys, as a key signature counts them: by sharps (1 to 7)
 * or flats (−1 to −7), as alphaTex and MusicXML store them. The Tab page
 * keeps one per bar; the Circle of fifths walks the keys round its wheel
 * (`spokeOf`, `keyOnSpoke`). How a pitch is spelled in a key is here too.
 */

/**
 * A key signature: how many sharps (1 to 7) or flats (−1 to −7) it has, and
 * whether it names the minor key with them (E minor, one sharp) rather than
 * the major (G major).
 */
export interface Key {
  fifths: number;
  minor?: true;
}
export const C_MAJOR: Key = { fifths: 0 };
export const MAX_FIFTHS = 7;

/** The key with this many fifths, major or minor. */
export const keyOf = (fifths: number, minor: boolean): Key => (minor ? { fifths, minor: true } : { fifths });

export function isKey(v: unknown): v is Key {
  if (typeof v !== 'object' || v === null) return false;
  const { fifths, minor } = v as Record<string, unknown>;
  return Number.isInteger(fifths) && Math.abs(fifths as number) <= MAX_FIFTHS
    && (minor === undefined || minor === true);
}

export function sameKey(a: Key, b: Key): boolean {
  return a.fifths === b.fifths && !a.minor === !b.minor;
}

/** Each major key's tonic, from seven flats (C♭) to seven sharps (C♯). */
export const MAJOR_NAMES = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
/** Each minor key's tonic, from seven flats (A♭) to seven sharps (A♯). */
export const MINOR_NAMES = ['Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#'];

/** The key's tonic as alphaTex and tonal spell it, "F#" or "Bb", without major or minor. */
export function keyTonic(key: Key): string {
  return (key.minor ? MINOR_NAMES : MAJOR_NAMES)[key.fifths + MAX_FIFTHS];
}

/** "F♯ major", "B♭ minor". */
export const keyName = (key: Key): string =>
  `${prettyNote(keyTonic(key))} ${key.minor ? 'minor' : 'major'}`;

/**
 * The key with this tonic, spelled as given where a key signature can (D♯
 * minor has six sharps), else by its other name (D♯ major is written E♭).
 */
export function keyOfTonic(tonic: string, minor: boolean): Key {
  const names = minor ? MINOR_NAMES : MAJOR_NAMES;
  let at = names.indexOf(tonic);
  if (at < 0) at = names.findIndex(n => pitchClassOf(n) === pitchClassOf(tonic));
  return keyOf(at - MAX_FIFTHS, minor);
}

const IONIAN = scaleDef('ionian')!;
const AEOLIAN = scaleDef('aeolian')!;

/** The key's scale: major, or natural minor. */
export const keyScale = (key: Key): Scale => scaleOf(keyTonic(key), key.minor ? AEOLIAN : IONIAN);

/** The key with the same tonic, the other way: C major ↔ C minor. */
export function parallelKey(key: Key): Key {
  return keyOfTonic(keyTonic(key), !key.minor);
}

/** The key with the same signature, the other way: C major ↔ A minor. */
export const relativeKey = (key: Key): Key => keyOf(key.fifths, !key.minor);

// ---------------------------------------------------------------- the circle

/** The key's spoke on the circle of fifths, 0–11 clockwise from C at the top. */
export const spokeOf = (key: Key): number => mod12(key.fifths);

/**
 * The key on a spoke as the circle names it: sharps down the right side to
 * F♯ major (and D♯ minor) at the bottom, flats up the left from D♭ (B♭ minor).
 */
export const keyOnSpoke = (spoke: number, minor: boolean): Key =>
  keyOf(mod12(spoke) <= 6 ? mod12(spoke) : mod12(spoke) - 12, minor);

/** The key on this tonic (a pitch class) as the circle names it: C♯ minor, but D♭ major. */
export const wheelKey = (tonicPc: number, minor: boolean): Key =>
  // A minor key shares its spoke with the major key a minor 3rd up; 7 × 7 ≡ 1 (mod 12).
  keyOnSpoke(mod12((minor ? tonicPc + 3 : tonicPc) * 7), minor);

// ---------------------------------------------------------------- signatures

const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER = [...SHARP_ORDER].reverse();

export interface KeySignature {
  sharps: boolean;
  /** In the order they are written: "F♯", "C♯"… */
  notes: string[];
}

/** The sharps or flats a key signature writes, in order. */
export function keySignature(key: Key): KeySignature {
  if (key.fifths >= 0) return { sharps: true, notes: SHARP_ORDER.slice(0, key.fifths).map(n => `${n}♯`) };
  return { sharps: false, notes: FLAT_ORDER.slice(0, -key.fifths).map(n => `${n}♭`) };
}

/** −2 to 2: a double flat to a double sharp. */
export type Accidental = -2 | -1 | 0 | 1 | 2;

/** A pitch as a note name: its letter (0 C to 6 B), accidental and octave. */
export interface Spelled {
  letter: number;
  accidental: Accidental;
  octave: number;
}

/** Letters (0 C to 6 B) in the order a key signature adds sharps: F C G D A E B. */
const SHARP_LETTERS = [3, 0, 4, 1, 5, 2, 6];
/** Letters in the order a key signature adds flats: B E A D G C F. */
const FLAT_LETTERS = [6, 2, 5, 1, 4, 0, 3];

/** The accidental the key signature puts on each letter, C (0) to B (6). */
export function keyAccidentals(key: Key): Accidental[] {
  const out: Accidental[] = [0, 0, 0, 0, 0, 0, 0];
  const count = Math.abs(key.fifths);
  const letters = key.fifths > 0 ? SHARP_LETTERS : FLAT_LETTERS;
  for (const letter of letters.slice(0, count)) out[letter] = key.fifths > 0 ? 1 : -1;
  return out;
}

/** The key's seven notes, tonic first: the letter and accidental each is spelled with. */
function keyNotes(key: Key): { letter: number; accidental: Accidental; pc: number }[] {
  const tonic = keyTonic(key);
  const first = LETTERS.indexOf(tonic[0]);
  const tonicPc = pitchClassOf(tonic);
  const steps = key.minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  return steps.map((step, k) => {
    const letter = (first + k) % 7;
    const pc = (tonicPc + step) % 12;
    let accidental = pc - LETTER_PCS[letter];
    if (accidental > 6) accidental -= 12;
    if (accidental < -6) accidental += 12;
    return { letter, accidental: accidental as Accidental, pc };
  });
}

/**
 * How a pitch (MIDI) is spelled in a key (Jeremy, 2026-10-27): a note of the
 * key as the key spells it; in a minor key the raised seventh on the
 * seventh's letter (G♯ in A minor); any other white key as its natural; any
 * other black key sharpened from the letter below in sharp keys and C,
 * flattened from the letter above in flat keys.
 */
export function spellPitch(midi: number, key: Key): Spelled {
  const pc = mod12(midi);
  const scale = keyNotes(key);
  let found: { letter: number; accidental: Accidental } | undefined = scale.find(n => n.pc === pc);
  if (!found && key.minor && pc === (scale[6].pc + 1) % 12) found = { letter: scale[6].letter, accidental: (scale[6].accidental + 1) as Accidental };
  // Any other white key is its own letter, natural (F in G major, not E♯).
  const white = LETTER_PCS.indexOf(pc as (typeof LETTER_PCS)[number]);
  if (!found && white >= 0) found = { letter: white, accidental: 0 };
  if (!found) {
    const flat = key.fifths < 0;
    const base = flat ? (pc + 1) % 12 : (pc + 11) % 12;
    // Beside every note outside a major or minor scale, the one below and the one above are in it.
    const near = scale.find(n => n.pc === base)!;
    found = { letter: near.letter, accidental: (near.accidental + (flat ? -1 : 1)) as Accidental };
  }
  // The octave goes with the letter: B♯3 is C4's sound, C♭4 is B3's.
  const octave = Math.floor((midi - found.accidental - LETTER_PCS[found.letter]) / 12) - 1;
  return { letter: found.letter, accidental: found.accidental, octave };
}
