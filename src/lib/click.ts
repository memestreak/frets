/**
 * The metronome click (issues #148, #149): a short wood-block-like tick, synthesized, so it needs no
 * recording. Tab's metronome and the Metronome page's wood block play the very same sound. Beat one
 * has its own, higher click. Tab wraps both in a SoundFont (`src/features/tab/click.ts`).
 */

/** The sample rate the clicks are made at: the synthesizer's (`audioOutput.ts`). */
export const CLICK_SAMPLE_RATE = 44100;
/** How long a click lasts, in seconds; it has died away to silence by then. */
const CLICK_SECONDS = 0.06;
/** The click's pitch, in hertz: beat one's, and every other beat's. */
const ACCENT_HZ = 2100;
const BEAT_HZ = 1400;
/**
 * A wood block's ring is not harmonic: two partials above the fundamental, as ratios of it, and
 * how loud each is. The decay (in seconds, to about a third) keeps it short and dry.
 */
const PARTIALS: readonly (readonly [ratio: number, level: number])[] = [[1, 1], [2.41, 0.35], [3.93, 0.15]];
const DECAY_SECONDS = 0.011;
/** The attack, in seconds: a cut straight into the wave would itself click. */
const ATTACK_SECONDS = 0.0008;

/** The click's samples, mono, from -1 to 1: beat one's (`accent`), or any other beat's. */
export function clickWave(accent: boolean, sampleRate = CLICK_SAMPLE_RATE): Float32Array {
  const pitch = accent ? ACCENT_HZ : BEAT_HZ;
  const length = Math.round(CLICK_SECONDS * sampleRate);
  const wave = new Float32Array(length);
  let peak = 0;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const attack = Math.min(1, t / ATTACK_SECONDS);
    // The last few milliseconds fade to exactly nothing, so the end makes no click either.
    const tail = Math.min(1, (length - 1 - i) / (0.005 * sampleRate));
    let x = 0;
    for (const [ratio, level] of PARTIALS) x += level * Math.sin(2 * Math.PI * pitch * ratio * t);
    wave[i] = x * attack * tail * Math.exp(-t / DECAY_SECONDS);
    peak = Math.max(peak, Math.abs(wave[i]));
  }
  // Beat one a little louder than the others.
  const level = (accent ? 0.9 : 0.7) / peak;
  for (let i = 0; i < length; i++) wave[i] *= level;
  return wave;
}
