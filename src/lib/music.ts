/** Standard tuning, low E (string 0) to high e (string 5), as MIDI notes. */
export const TUNING = [40, 45, 50, 55, 59, 64] as const;
export const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'] as const;
export const STRING_COUNT = 6;
export const STRINGS = [0, 1, 2, 3, 4, 5] as const;

export const SHARP_NAMES = [
  'C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B',
] as const;
export const FLAT_NAMES = [
  'C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B',
] as const;
/** Both spellings on one label: "C♯/D♭". */
export const NOTE_LABELS = SHARP_NAMES.map((s, i) =>
  s === FLAT_NAMES[i] ? s : `${s}/${FLAT_NAMES[i]}`,
);

/** Short interval names indexed by semitones (0 = unison, 12 = octave). */
export const INTERVAL_NAMES = [
  'P1', 'm2', 'M2', 'm3', 'M3', 'P4', 'TT', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8',
] as const;
export const INTERVAL_LONG_NAMES = [
  'unison', 'minor second', 'major second', 'minor third', 'major third',
  'perfect fourth', 'tritone', 'perfect fifth', 'minor sixth', 'major sixth',
  'minor seventh', 'major seventh', 'octave',
] as const;
/** Every simple interval class a question can ask for: m2 (1) … P8 (12). */
export const SIMPLE_INTERVALS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** Answer keys: `1–9 0 − =` map to the 12 answer buttons in order. */
export const ANSWER_KEYS = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=',
] as const;

export interface Position {
  s: number;
  f: number;
}

export const midi = (s: number, f: number): number => TUNING[s] + f;
export const pitchClass = (s: number, f: number): number => midi(s, f) % 12;

/**
 * Interval class: wraps at the octave, so 13 semitones is an m2 and 24 is
 * a P8. 0 is unison.
 */
export function intervalClass(semis: number): number {
  const a = Math.abs(semis);
  return a === 0 ? 0 : ((a - 1) % 12) + 1;
}

export const samePos = (a: Position, b: Position): boolean =>
  a.s === b.s && a.f === b.f;

export type Rng = () => number;
export const randInt = (rng: Rng, n: number): number => Math.floor(rng() * n);
export const pick = <T>(rng: Rng, a: readonly T[]): T => a[randInt(rng, a.length)];
