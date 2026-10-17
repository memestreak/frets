/** How long a reference pluck sounds, in seconds. */
export const PLUCK_SECONDS = 2;
/** Each overtone's level: bright like a steel string, the fundamental strongest. */
const HARMONICS = [1, 0.6, 0.35, 0.25, 0.15, 0.1, 0.06];
const ATTACK_SECONDS = 0.004;
const PEAK = 0.4;

/**
 * A plucked string, by adding up its overtones: each dies away, the higher
 * ones faster. Built from exact sines, so it is exactly in tune.
 */
export function renderPluck(
  midi: number, sampleRate: number,seconds = PLUCK_SECONDS,
): Float32Array<ArrayBuffer> {
  const hz = 440 * 2 ** ((midi - 69) / 12);
  const n = Math.round(sampleRate * seconds);
  const out = new Float32Array(n);
  const total = HARMONICS.reduce((a, b) => a + b, 0);
  HARMONICS.forEach((amp, k) => {
    const f = hz * (k + 1);
    if (f >= sampleRate / 2) return;
    const decay = 1.6 + k * 1.2;
    const w = (2 * Math.PI * f) / sampleRate;
    for (let i = 0; i < n; i++) out[i] += amp * Math.sin(w * i) * Math.exp((-decay * i) / sampleRate);
  });
  const attack = ATTACK_SECONDS * sampleRate;
  for (let i = 0; i < n; i++) {
    // Fade in over the attack and out over the last tenth, so it never clicks.
    const fadeOut = Math.min(1, (n - i) / (n * 0.1));
    out[i] *= (PEAK / total) * Math.min(1, i / attack) * fadeOut;
  }
  return out;
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
