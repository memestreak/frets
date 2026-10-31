/**
 * The Metronome's sounds, synthesized so they need no recordings: each a high (accent) and a low
 * sample. The wood block is Tab's metronome click (`src/lib/click.ts`).
 */
import { clickWave } from '@/lib/click';
import type { SoundId } from './rhythm';

/** A sound as a sum of sine partials (hertz, level), with optional noise, a decay, and a pitch drop. */
interface Synth {
  seconds: number;
  partials: [number, number][];
  noise?: number;
  decay: number;
  /** A downward pitch sweep, for the kick: start frequency multiplier. */
  sweep?: number;
}

function synth(v: Synth, sampleRate: number): Float32Array {
  const length = Math.round(v.seconds * sampleRate);
  const wave = new Float32Array(length);
  const phase = v.partials.map(() => 0);
  let peak = 0;
  let last = 0;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const attack = Math.min(1, t / 0.0008);
    const tail = Math.min(1, (length - 1 - i) / (0.005 * sampleRate));
    const bend = v.sweep ? 1 + (v.sweep - 1) * Math.exp(-t / 0.03) : 1;
    let x = 0;
    v.partials.forEach(([hz, level], k) => {
      phase[k] += (2 * Math.PI * hz * bend) / sampleRate;
      x += level * Math.sin(phase[k]);
    });
    if (v.noise) {
      const n = Math.random() * 2 - 1;
      x += v.noise * (n - last);
      last = n;
    }
    wave[i] = x * attack * tail * Math.exp(-t / v.decay);
    peak = Math.max(peak, Math.abs(wave[i]));
  }
  for (let i = 0; i < length; i++) wave[i] *= 0.9 / peak;
  return wave;
}

/** A sound's high and low samples, mono, from -1 to 1. */
export function soundWaves(sound: SoundId, sr: number): [Float32Array, Float32Array] {
  switch (sound) {
    case 'wood': return [clickWave(true, sr), clickWave(false, sr)];
    case 'beep': return [synth({ seconds: 0.07, partials: [[1760, 1]], decay: 0.03 }, sr), synth({ seconds: 0.07, partials: [[1320, 1]], decay: 0.03 }, sr)];
    case 'cowbell': return [
      synth({ seconds: 0.25, partials: [[810, 1], [1210, 0.7], [2430, 0.2]], decay: 0.07 }, sr),
      synth({ seconds: 0.25, partials: [[562, 1], [845, 0.7], [1690, 0.2]], decay: 0.07 }, sr),
    ];
    case 'stick': return [
      synth({ seconds: 0.06, partials: [[1900, 0.6], [470, 0.4]], noise: 0.8, decay: 0.012 }, sr),
      synth({ seconds: 0.06, partials: [[1600, 0.6], [400, 0.4]], noise: 0.8, decay: 0.009 }, sr),
    ];
    case 'hihat': return [synth({ seconds: 0.18, partials: [], noise: 1, decay: 0.05 }, sr), synth({ seconds: 0.08, partials: [], noise: 1, decay: 0.018 }, sr)];
    case 'clave': return [synth({ seconds: 0.08, partials: [[2500, 1], [5400, 0.15]], decay: 0.02 }, sr), synth({ seconds: 0.08, partials: [[2000, 1], [4300, 0.15]], decay: 0.02 }, sr)];
    case 'kick': return [synth({ seconds: 0.25, partials: [[70, 1]], sweep: 3, decay: 0.08 }, sr), synth({ seconds: 0.2, partials: [[60, 1]], sweep: 2.5, decay: 0.06 }, sr)];
  }
}
