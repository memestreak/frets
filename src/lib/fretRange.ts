export const MIN_RANGE_SPAN = 3;
/** The highest fret the board draws; the range always lies inside 0–15. */
export const MAX_FRET = 15;

export interface FretRange {
  minFret: number;
  maxFret: number;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/**
 * Set the lowest fret of the fret range (0–12), pushing the highest fret
 * up so the two stay at least MIN_RANGE_SPAN apart.
 */
export function setRangeMin(w: FretRange, value: number): FretRange {
  const minFret = clamp(Math.round(value), 0, MAX_FRET - MIN_RANGE_SPAN);
  const maxFret = Math.max(w.maxFret, minFret + MIN_RANGE_SPAN);
  return { minFret, maxFret };
}

/**
 * Set the highest fret of the fret range (3–15), pulling the lowest fret
 * down so the two stay at least MIN_RANGE_SPAN apart.
 */
export function setRangeMax(w: FretRange, value: number): FretRange {
  const maxFret = clamp(Math.round(value), MIN_RANGE_SPAN, MAX_FRET);
  const minFret = Math.min(w.minFret, maxFret - MIN_RANGE_SPAN);
  return { minFret, maxFret };
}

/** Clamp an arbitrary fret number to 0–15. */
export const clampFret = (value: number): number =>
  clamp(Math.round(value), 0, MAX_FRET);
