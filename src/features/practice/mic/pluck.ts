/** How long a reference pluck sounds, in seconds. */
export const PLUCK_SECONDS = 2;
/** Loudest sample of a pluck. */
const PEAK = 0.4;
/** The pick's attack, in seconds: short, but not a click. */
const ATTACK_SECONDS = 0.002;
/**
 * Where the pick strikes, as a fraction of the string from the bridge:
 * further from the bridge is warmer.
 */
const PICK_POSITION = 0.22;
/** How much the pick softens the noise, 0–1: lower is a softer, darker pluck. */
const PICK_BRIGHTNESS = 0.3;
/** Above this the body and air take the edge off, in Hz. */
const TOP_HZ = 2800;
/** Seconds for the low E to die away by 60 dB; higher strings die sooner. */
const LOW_E_DECAY = 4;
/** The guitar body's resonances: [Hz, gain in dB, Q]. */
const BODY: [number, number, number][] = [[100, 8, 1.2], [210, 5, 1.5], [420, 2, 2]];

/**
 * A plucked string, by Karplus-Strong (as extended by Jaffe and Smith): a
 * burst of noise shaped by the pick's position circulates in a loop one
 * period long, losing its highs a little on every pass, then sounds
 * through the guitar's body. An allpass tunes the loop's fractional
 * length, so the note is in tune to a fraction of a cent. `seed` makes the
 * noise, and so the pluck, repeatable.
 */
export function renderPluck(
  midi: number, sampleRate: number, seconds = PLUCK_SECONDS, seed = 1,
): Float32Array<ArrayBuffer> {
  const hz = 440 * 2 ** ((midi - 69) / 12);
  const n = Math.round(sampleRate * seconds);
  const period = sampleRate / hz;
  // The averaging filter delays half a sample; the allpass takes the rest
  // of the fraction, between 0.5 and 1.5 samples so it stays well behaved.
  const length = Math.floor(period - 1);
  const allpass = allpassFor(period - 0.5 - length, (2 * Math.PI * hz) / sampleRate);
  // Loss per pass, so the note dies by 60 dB in its decay time.
  const decay = LOW_E_DECAY * (82.41 / hz) ** 0.5;
  const loss = 10 ** (-3 / (decay * hz));

  const excitation = pickedNoise(length, seed);
  const loop = new Float32Array(length);
  const out = new Float32Array(n);
  let prev = 0;
  let apIn = 0;
  let apOut = 0;
  for (let i = 0; i < n; i++) {
    const k = i % length;
    const delayed = loop[k] + (i < length ? excitation[i] : 0);
    const averaged = 0.5 * (delayed + prev);
    prev = delayed;
    const tuned = allpass * averaged + apIn - allpass * apOut;
    apIn = averaged;
    apOut = tuned;
    loop[k] = loss * tuned;
    out[i] = delayed;
  }

  for (const [f, gain, q] of BODY) peak(out, sampleRate, f, gain, q);
  lowpass(out, sampleRate, TOP_HZ);
  let max = 0;
  for (let i = 0; i < n; i++) max = Math.max(max, Math.abs(out[i]));
  const attack = ATTACK_SECONDS * sampleRate;
  for (let i = 0; i < n; i++) {
    // Ramp in over the attack and out over the last tenth, so it never clicks.
    const fade = Math.min(1, i / attack, (n - i) / (n * 0.1));
    out[i] *= (PEAK / max) * fade;
  }
  return out;
}

/**
 * The allpass coefficient whose phase delay at `w` (radians a sample) is
 * `delay` samples, found by bisection.
 */
function allpassFor(delay: number, w: number): number {
  const phaseDelay = (c: number) => {
    // H(e^{-jw}) = (c + e^{-jw}) / (1 + c·e^{-jw})
    const num = Math.atan2(-Math.sin(w), c + Math.cos(w));
    const den = Math.atan2(-c * Math.sin(w), 1 + c * Math.cos(w));
    return -(num - den) / w;
  };
  // Phase delay falls as c rises.
  let lo = -0.999;
  let hi = 0.999;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (phaseDelay(mid) > delay) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** A burst of noise, softened, with the notch a pick at PICK_POSITION leaves. */
function pickedNoise(length: number, seed: number): Float32Array {
  let state = seed >>> 0 || 1;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32 - 0.5;
  };
  const noise = new Float32Array(length);
  let soft = 0;
  for (let i = 0; i < length; i++) {
    soft += PICK_BRIGHTNESS * (random() - soft);
    noise[i] = soft;
  }
  const notch = Math.max(1, Math.round(PICK_POSITION * length));
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) out[i] = noise[i] - (i >= notch ? noise[i - notch] : 0);
  return out;
}

/** A peaking filter (RBJ's cookbook), in place. */
function peak(x: Float32Array, sampleRate: number, f: number, gainDb: number, q: number) {
  const a = 10 ** (gainDb / 40);
  const w = (2 * Math.PI * f) / sampleRate;
  const alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha / a;
  biquad(x, [(1 + alpha * a) / a0, (-2 * Math.cos(w)) / a0, (1 - alpha * a) / a0],
    [(-2 * Math.cos(w)) / a0, (1 - alpha / a) / a0]);
}

/** A Butterworth low-pass (RBJ's cookbook), in place. */
function lowpass(x: Float32Array, sampleRate: number, f: number) {
  const w = (2 * Math.PI * f) / sampleRate;
  const alpha = Math.sin(w) / Math.SQRT2;
  const a0 = 1 + alpha;
  const b = (1 - Math.cos(w)) / 2 / a0;
  biquad(x, [b, 2 * b, b], [(-2 * Math.cos(w)) / a0, (1 - alpha) / a0]);
}

/** Runs a normalized biquad over `x` in place. */
function biquad(
  x: Float32Array, [b0, b1, b2]: number[], [a1, a2]: number[],
) {
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const y = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x[i];
    y2 = y1;
    y1 = y;
    x[i] = y;
  }
}

/** After a pluck, the room's echo dies away for this long. */
const ECHO_MS = 150;

let output: AudioContext | null = null;
let playing: AudioBufferSourceNode | null = null;
let soundingUntil = 0;

/** Is a reference pluck (or its echo) sounding, for a mic to ignore? */
export const pluckSounding = (): boolean => performance.now() < soundingUntil;

/** Plays open string `midi` through the speakers, cutting off any before it. */
export function playPluck(midi: number) {
  output ??= new AudioContext();
  const ctx = output;
  void ctx.resume();
  const samples = renderPluck(midi, ctx.sampleRate);
  const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
  buffer.copyToChannel(samples, 0);
  playing?.stop();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start();
  playing = source;
  soundingUntil = performance.now() + PLUCK_SECONDS * 1000 + ECHO_MS;
}
