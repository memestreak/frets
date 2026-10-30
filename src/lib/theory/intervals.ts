import { Interval } from 'tonal';

/*
 * Intervals as tonal names them ("3m", "5d", "9A") and as Frets writes
 * them: degree labels against the major scale ("♭3"), chord tone labels
 * ("R", "♯9"), and quality-first names ("m3") with their words.
 */

/** An accidental's glyph, by how many semitones it alters: −2 𝄫 to +2 𝄪. */
export const ACCIDENTAL_GLYPHS: Readonly<Record<number, string>> = {
  [-2]: '𝄫', [-1]: '♭', 0: '', 1: '♯', 2: '𝄪',
};

/** Semitones above the root, 0–11: "3m" → 3, "9M" → 2. */
export const semisOf = (interval: string): number => Interval.get(interval).semitones % 12;

/** How far an interval is altered from the major scale's: "3m" −1, "4A" +1, "5P" 0. */
export const alterationOf = (interval: string): number => Interval.get(interval).alt;

/** Degree number 1–7 of an interval; octaves and beyond fold down: a 9 is a 2. */
export const degreeNumber = (interval: string): number => ((Interval.get(interval).num - 1) % 7) + 1;

/**
 * An interval as a degree against the major scale: "3m" → "♭3",
 * "4A" → "♯4", "7d" → "𝄫7", "1P" → "1".
 */
export function intervalLabel(interval: string): string {
  return ACCIDENTAL_GLYPHS[alterationOf(interval)] + degreeNumber(interval);
}

/** A chord tone's label: "3m" → "♭3", "9A" → "♯9", "1P" → "R". Extensions keep their number. */
export function toneLabel(interval: string): string {
  const { num, alt } = Interval.get(interval);
  return num === 1 ? 'R' : ACCIDENTAL_GLYPHS[alt] + num;
}

/** "3M" → "M3", "5d" → "d5": quality first, as guitarists write it. */
export function intervalName(interval: string): string {
  const { q, num } = Interval.get(interval);
  return `${q}${num}`;
}

/** The interval from one spelled note up to another: ("C", "Eb") → "3m". */
export const intervalBetween = (from: string, to: string): string => Interval.distance(from, to);

const QUALITY_WORDS: Record<string, string> = {
  M: 'major', m: 'minor', P: 'perfect', d: 'diminished', A: 'augmented',
};
const ORDINALS: Record<number, string> = {
  2: '2nd', 3: '3rd', 4: '4th', 5: '5th', 6: '6th', 7: '7th',
};

/** "M3" → "major 3rd", "d5" → "diminished 5th": for screen readers. */
export function intervalWords(name: string): string {
  return `${QUALITY_WORDS[name[0]]} ${ORDINALS[Number(name.slice(1))]}`;
}
