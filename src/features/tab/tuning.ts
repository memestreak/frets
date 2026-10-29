/**
 * Setting a clip's tuning from the clip (issue #203): the common tunings, and each string's note.
 * Pure. Changing the tuning keeps every note's fret, as Guitar Pro does by default, so the music
 * sounds as fingered in the new tuning. See docs/specs/2026-10-29-tab-credits-tuning-design.md.
 */
import { STANDARD_TUNING, STRING_COUNT, type Clip } from './clip';
import { openStrings } from './notation';

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export interface TuningPreset {
  name: string;
  /** Six note names, lowest string first, spelled with sharps as the clip reads them. */
  notes: readonly string[];
}

/** The common tunings, as the panel lists them. */
export const TUNING_PRESETS: readonly TuningPreset[] = [
  { name: 'Standard', notes: STANDARD_TUNING },
  { name: 'E♭', notes: ['D#', 'G#', 'C#', 'F#', 'A#', 'D#'] },
  { name: 'D', notes: ['D', 'G', 'C', 'F', 'A', 'D'] },
  { name: 'Drop D', notes: ['D', 'A', 'D', 'G', 'B', 'E'] },
  { name: 'Drop C♯', notes: ['C#', 'G#', 'C#', 'F#', 'A#', 'D#'] },
  { name: 'Drop C', notes: ['C', 'G', 'C', 'F', 'A', 'D'] },
  { name: 'DADGAD', notes: ['D', 'A', 'D', 'G', 'A', 'D'] },
  { name: 'Open G', notes: ['D', 'G', 'D', 'G', 'B', 'D'] },
  { name: 'Open D', notes: ['D', 'A', 'D', 'F#', 'A', 'D'] },
  { name: 'Open E', notes: ['E', 'B', 'E', 'G#', 'B', 'E'] },
];

/** Whether two tunings tune every string to the same pitch, however they spell it. */
function samePitches(a: readonly string[], b: readonly string[]): boolean {
  const pa = openStrings(a);
  const pb = openStrings(b);
  return pa.every((p, s) => p === pb[s]);
}

/** The preset this tuning is, or null for one of its own. */
export function presetOf(tuning: readonly string[]): TuningPreset | null {
  return TUNING_PRESETS.find(p => samePitches(p.notes, tuning)) ?? null;
}

/**
 * A string's note as the panel names it, in ASCII ("Eb"): with a flat when the string is tuned down
 * from standard, a sharp when tuned up, as the score's head names it. `low` counts from the low E (0).
 */
export function stringNote(tuning: readonly string[], low: number): string {
  const high = STRING_COUNT - 1 - low;
  const open = openStrings(tuning)[high];
  const standard = openStrings(STANDARD_TUNING)[high];
  return (open < standard ? FLAT_NAMES : SHARP_NAMES)[((open % 12) + 12) % 12];
}

/** The clip in another tuning, every fret kept; the clip itself when nothing changes. */
export function withTuning(clip: Clip, tuning: readonly string[]): Clip {
  if (samePitches(clip.tuning, tuning)) return clip;
  return { ...clip, tuning: tuning.map(sharpName) };
}

/** The clip with one string, counted from the low E (0), tuned to a note ("Eb" or "D#"). */
export function withStringNote(clip: Clip, low: number, note: string): Clip {
  return withTuning(clip, clip.tuning.map((n, s) => (s === low ? note : n)));
}

/** A note spelled with a sharp, as the clip reads a tuning: "Eb" gives "D#". */
function sharpName(note: string): string {
  const naturals: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const shift = note.slice(1).includes('#') ? 1 : note.slice(1).includes('b') ? -1 : 0;
  return SHARP_NAMES[(naturals[note[0]] + shift + 12) % 12];
}
