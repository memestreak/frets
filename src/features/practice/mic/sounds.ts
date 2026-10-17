/** The tuner's reference notes: recorded instruments, or the simulated string. */
export type RefSound = 'acoustic' | 'nylon' | 'electric' | 'piano' | 'synth';

export const REF_SOUNDS: readonly (readonly [RefSound, string])[] = [
  ['acoustic', 'Acoustic guitar'],
  ['nylon', 'Nylon-string guitar'],
  ['electric', 'Electric guitar'],
  ['piano', 'Piano'],
  ['synth', 'Simulated string'],
];

export const isRefSound = (v: unknown): v is RefSound =>
  REF_SOUNDS.some(([sound]) => sound === v);

/** A recording in public/sounds: its note, and how far off it was measured. */
interface Sample {
  note: string;
  midi: number;
  /** The recording's own tuning, in cents (+ sharp), measured by our detector. */
  cents: number;
}

/**
 * The recordings, from tonejs-instruments (CC BY 3.0; see
 * public/sounds/README.md). The electric guitar set has no D3, G3, B3 or
 * E4, so those play a near note at a different speed.
 */
const SAMPLES: Record<Exclude<RefSound, 'synth'>, Sample[]> = {
  acoustic: [
    { note: 'E2', midi: 40, cents: -2.3 }, { note: 'A2', midi: 45, cents: -0.5 },
    { note: 'D3', midi: 50, cents: -1.4 }, { note: 'G3', midi: 55, cents: -2 },
    { note: 'B3', midi: 59, cents: -0.9 }, { note: 'E4', midi: 64, cents: 0.9 },
  ],
  nylon: [
    { note: 'E2', midi: 40, cents: -1.5 }, { note: 'A2', midi: 45, cents: 0.9 },
    { note: 'D3', midi: 50, cents: -1.7 }, { note: 'G3', midi: 55, cents: -0.4 },
    { note: 'B3', midi: 59, cents: 0 }, { note: 'E4', midi: 64, cents: -0.9 },
  ],
  electric: [
    { note: 'E2', midi: 40, cents: -0.4 }, { note: 'A2', midi: 45, cents: -0.3 },
    { note: 'C3', midi: 48, cents: -0.5 }, { note: 'Fs3', midi: 54, cents: -1.1 },
    { note: 'C4', midi: 60, cents: -3.1 }, { note: 'Ds4', midi: 63, cents: -0.9 },
  ],
  piano: [
    { note: 'E2', midi: 40, cents: -1.9 }, { note: 'A2', midi: 45, cents: 0.5 },
    { note: 'D3', midi: 50, cents: 0.1 }, { note: 'G3', midi: 55, cents: 0.6 },
    { note: 'B3', midi: 59, cents: 0.8 }, { note: 'E4', midi: 64, cents: 1.1 },
  ],
};

/**
 * The recording to play for `midi` and the playback rate that puts it
 * exactly on pitch: the nearest recorded note, sped up or slowed down by
 * the difference, less the recording's own error.
 */
export function sampleFor(
  sound: Exclude<RefSound, 'synth'>, midi: number,
): { url: string; rate: number } {
  const sample = SAMPLES[sound].reduce((best, s) =>
    Math.abs(s.midi - midi) < Math.abs(best.midi - midi) ? s : best);
  return {
    url: `/sounds/${sound}/${sample.note}.mp3`,
    rate: 2 ** ((midi - sample.midi) / 12 - sample.cents / 1200),
  };
}

/** Every recording a sound uses, to fetch ahead of the first press. */
export const sampleUrls = (sound: Exclude<RefSound, 'synth'>): string[] =>
  SAMPLES[sound].map(s => `/sounds/${sound}/${s.note}.mp3`);
