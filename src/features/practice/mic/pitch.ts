import { SHARP_NAMES } from '@/lib/music';

/** Lowest pitch looked for: a little under the low E (82 Hz). */
export const MIN_HZ = 75;
/** Highest pitch looked for: well over fret 15 on the high e (784 Hz). */
export const MAX_HZ = 1100;
/** Quieter than this (RMS of the window) is silence. */
export const SILENCE_RMS = 0.01;
/** YIN's threshold: the first lag whose normalised difference dips under it. */
const YIN_THRESHOLD = 0.15;
/** With no dip under the threshold, the best lag must still beat this. */
const MAX_APERIODICITY = 0.35;

export interface Pitch {
  hz: number;
  /** 0–1, how periodic the window is at that pitch. */
  clarity: number;
}

/** Root mean square of a window of samples. */
export function rms(buf: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}

/**
 * The fundamental of a window of samples, by YIN (de Cheveigné and
 * Kawahara, 2002), or null for silence, noise or a pitch outside
 * MIN_HZ–MAX_HZ. The window must hold at least two periods of MIN_HZ.
 */
export function detectPitch(buf: Float32Array, sampleRate: number): Pitch | null {
  if (rms(buf) < SILENCE_RMS) return null;
  const tauMin = Math.floor(sampleRate / MAX_HZ);
  const tauMax = Math.min(Math.ceil(sampleRate / MIN_HZ), Math.floor(buf.length / 2));
  // One lag past tauMax is computed too, for the interpolation.
  const width = buf.length - tauMax - 1;

  // Cumulative mean normalised difference, d′(τ).
  const d = new Float32Array(tauMax + 2);
  d[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax + 1; tau++) {
    let sum = 0;
    for (let i = 0; i < width; i++) {
      const diff = buf[i] - buf[i + tau];
      sum += diff * diff;
    }
    running += sum;
    d[tau] = running > 0 ? (sum * tau) / running : 1;
  }

  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (d[t] < YIN_THRESHOLD) {
      while (t < tauMax && d[t + 1] < d[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) {
    let best = tauMin;
    for (let t = tauMin + 1; t <= tauMax; t++) if (d[t] < d[best]) best = t;
    if (d[best] > MAX_APERIODICITY || best === tauMax) return null;
    tau = best;
  }

  // Parabolic interpolation between the neighbouring lags.
  const [a, b, c] = [d[tau - 1], d[tau], d[tau + 1]];
  const denom = a - 2 * b + c;
  const shift = denom > 0 ? (a - c) / (2 * denom) : 0;
  const hz = sampleRate / (tau + shift);
  if (hz < MIN_HZ || hz > MAX_HZ) return null;
  return { hz, clarity: 1 - b };
}

/** MIDI note number, fractional, for a frequency (A4 = 440 Hz = 69). */
export const freqToMidi = (hz: number): number => 69 + 12 * Math.log2(hz / 440);

/** Loudness for a meter, 0–1 across −60 to 0 dBFS. */
export const levelOf = (r: number): number =>
  r > 0 ? Math.max(0, Math.min(1, (20 * Math.log10(r) + 60) / 60)) : 0;

const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉';

/** A MIDI note's name with its octave as a subscript: 45 → "A₂". */
export function pitchLabel(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const digits = [...String(Math.abs(octave))].map(n => SUBSCRIPTS[Number(n)]).join('');
  return `${SHARP_NAMES[((midi % 12) + 12) % 12]}${octave < 0 ? '₋' : ''}${digits}`;
}
