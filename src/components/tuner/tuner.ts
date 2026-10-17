import { STRINGS, TUNING } from '@/lib/music';

/** Within this many cents of the string's note, it reads as in tune. */
export const IN_TUNE_CENTS = 5;
/** The strobe drifts this many pixels a second per cent off. */
const STROBE_PX_PER_CENT = 2;
/** Beyond this many cents the strobe drifts no faster. */
const STROBE_MAX_CENTS = 50;

/** The open string nearest a pitch (a fractional MIDI note). */
export function nearestString(pitch: number): number {
  return STRINGS.reduce((best, s) =>
    Math.abs(pitch - TUNING[s]) < Math.abs(pitch - TUNING[best]) ? s : best);
}

/** How far `pitch` is from open string `s`, in cents: + sharp, − flat. */
export const centsFrom = (pitch: number, s: number): number => (pitch - TUNING[s]) * 100;

/** The median of some numbers, which one stray reading can't move. */
export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** "In tune", "12¢ flat", "8¢ sharp". */
export function centsText(cents: number): string {
  const n = Math.round(Math.abs(cents));
  if (Math.abs(cents) <= IN_TUNE_CENTS) return 'In tune';
  return `${n}¢ ${cents < 0 ? 'flat' : 'sharp'}`;
}

/** How far the strobe drifts in `ms`: right when sharp, left when flat. */
export function strobeStep(cents: number, ms: number): number {
  const c = Math.max(-STROBE_MAX_CENTS, Math.min(STROBE_MAX_CENTS, cents));
  return (c * STROBE_PX_PER_CENT * ms) / 1000;
}
