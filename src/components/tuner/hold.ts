/** One analysis of the mic: the pitch heard, if any, and how loud. */
export interface Reading {
  /** Fractional MIDI note, or null for silence or noise. */
  midi: number | null;
  rms: number;
  /** Milliseconds, from any steady clock. */
  at: number;
}

/** A note held since its onset. */
export interface Hold {
  midi: number;
  /** When this note was played: a later pluck of the same note restarts it. */
  since: number;
  /** When it was last heard. */
  seen: number;
  rms: number;
}

/** Readings with no pitch for this long, mid-note, don't end it. */
export const DROPOUT_MS = 90;
/** A note keeps its name until it drifts this far, in semitones, from it. */
const HYSTERESIS = 0.7;
/** Louder than the last reading by this factor is a fresh pluck. */
const ONSET_RATIO = 1.8;

/** The right note counts once held this long, in milliseconds. */
export const RIGHT_HOLD_MS = 150;
/** Anything else counts once held this long. */
export const OTHER_HOLD_MS = 250;

/** Has a note sounded long enough to judge? */
export const heldEnough = (heldMs: number, right: boolean): boolean =>
  heldMs >= (right ? RIGHT_HOLD_MS : OTHER_HOLD_MS);

/** How long `hold` has sounded, in milliseconds. */
export const heldFor = (hold: Hold): number => hold.seen - hold.since;

/** The note held after `reading`, given the one held before it. */
export function trackHold(hold: Hold | null, reading: Reading): Hold | null {
  const { midi, rms, at } = reading;
  const gap = hold ? at - hold.seen : Infinity;
  if (midi == null) return gap <= DROPOUT_MS ? hold : null;
  const same = hold != null && gap <= DROPOUT_MS
    && Math.abs(midi - hold.midi) < HYSTERESIS && rms <= hold.rms * ONSET_RATIO;
  return same
    ? { ...hold, seen: at, rms }
    : { midi: Math.round(midi), since: at, seen: at, rms };
}
