/**
 * Tap tempo: the tempo of a few presses in a row, for the Metronome page's Tap, the Tab page's
 * tempo panel and the show_tab app's Tap. Pure; each keeps the press times and passes its own bpm range.
 */

/** The slowest and fastest tempo a page offers, in bpm. */
export interface BpmRange {
  min: number;
  max: number;
}

/** How many taps the tempo is taken from: the latest ones, so it follows a player who speeds up. */
export const TAPS_KEPT = 8;

/** A pause longer than this starts a new run of taps: a little over one beat at the slowest tempo. */
export const tapResetMs = (range: BpmRange): number => 60000 / range.min + 100;

/**
 * The run of taps after one more at `now`, in milliseconds. A long pause starts over, and so does a
 * time that goes backwards (a clock that was reset).
 */
export function addTap(taps: readonly number[], now: number, range: BpmRange): number[] {
  const last = taps.at(-1);
  if (last === undefined || now <= last || now - last > tapResetMs(range)) return [now];
  return [...taps, now].slice(-TAPS_KEPT);
}

/** The tempo the taps keep, in whole bpm within the range; null until there are two. */
export function tapBpm(taps: readonly number[], range: BpmRange): number | null {
  if (taps.length < 2) return null;
  const gap = (taps.at(-1)! - taps[0]) / (taps.length - 1);
  return Math.min(range.max, Math.max(range.min, Math.round(60000 / gap)));
}
