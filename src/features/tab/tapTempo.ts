/**
 * Tap tempo: the tempo of a few presses in a row, as a metronome's Tap button has it. Pure; the
 * panel keeps the press times.
 */
import { MAX_BPM, MIN_BPM } from './clip';

/** A pause longer than this starts a new run of taps. */
export const TAP_RESET_MS = 2000;
/** How many taps the tempo is taken from: the latest ones, so it follows a player who speeds up. */
const TAPS_KEPT = 8;

/** The run of taps after one more at `now`, in milliseconds; a long pause starts over. */
export function addTap(taps: readonly number[], now: number): number[] {
  const last = taps.at(-1);
  if (last === undefined || now - last > TAP_RESET_MS || now <= last) return [now];
  return [...taps, now].slice(-TAPS_KEPT);
}

/** The tempo the taps keep, in whole bpm within MIN_BPM to MAX_BPM; null until there are two. */
export function tapBpm(taps: readonly number[]): number | null {
  if (taps.length < 2) return null;
  const average = (taps.at(-1)! - taps[0]) / (taps.length - 1);
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(60000 / average)));
}
