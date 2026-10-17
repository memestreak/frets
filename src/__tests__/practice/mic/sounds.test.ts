import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  isRefSound, REF_SOUNDS, sampleFor, sampleUrls, type RefSound,
} from '@/features/practice/mic/sounds';
import { TUNING } from '@/lib/music';

const RECORDED = REF_SOUNDS.map(([v]) => v)
  .filter((v): v is Exclude<RefSound, 'synth'> => v !== 'synth');

describe('reference sounds', () => {
  it('has a recording in public/sounds for every sample it names', () => {
    for (const sound of RECORDED) {
      for (const url of sampleUrls(sound)) {
        expect(existsSync(join(process.cwd(), 'public', url))).toBe(true);
      }
    }
  });

  it('plays a recorded open string at its own speed, less its measured error', () => {
    const { url, rate } = sampleFor('acoustic', TUNING[0]);
    expect(url).toBe('/sounds/acoustic/E2.mp3');
    // Recorded 2.3¢ flat, so played that much faster.
    expect(1200 * Math.log2(rate)).toBeCloseTo(2.3);
  });

  it('plays a missing note from the nearest recording, shifted', () => {
    const { url, rate } = sampleFor('electric', 55); // G3: Fs3 a semitone up
    expect(url).toBe('/sounds/electric/Fs3.mp3');
    expect(1200 * Math.log2(rate)).toBeCloseTo(100 + 1.1);
  });

  it('keeps every open string within two semitones of its recording', () => {
    for (const sound of RECORDED) {
      for (const midi of TUNING) {
        expect(Math.abs(Math.log2(sampleFor(sound, midi).rate) * 12)).toBeLessThan(2.1);
      }
    }
  });

  it('isRefSound accepts only the listed sounds', () => {
    expect(isRefSound('piano')).toBe(true);
    expect(isRefSound('kazoo')).toBe(false);
  });
});
