export const MIN_WINDOW_SPAN = 3;
export const MAX_FRET = 24;

export interface FretWindow {
  minFret: number;
  maxFret: number;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/**
 * Set the lowest fret of the board window (0–23), pushing the highest fret
 * up so the two stay at least MIN_WINDOW_SPAN apart.
 */
export function setWindowMin(w: FretWindow, value: number): FretWindow {
  const minFret = clamp(Math.round(value), 0, MAX_FRET - MIN_WINDOW_SPAN);
  const maxFret = Math.max(w.maxFret, minFret + MIN_WINDOW_SPAN);
  return { minFret, maxFret };
}

/**
 * Set the highest fret of the board window (1–24), pulling the lowest fret
 * down so the two stay at least MIN_WINDOW_SPAN apart.
 */
export function setWindowMax(w: FretWindow, value: number): FretWindow {
  const maxFret = clamp(Math.round(value), MIN_WINDOW_SPAN, MAX_FRET);
  const minFret = Math.min(w.minFret, maxFret - MIN_WINDOW_SPAN);
  return { minFret, maxFret };
}

/** Clamp an arbitrary fret number to 0–24. */
export const clampFret = (value: number): number =>
  clamp(Math.round(value), 0, MAX_FRET);
