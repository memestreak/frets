import { detectPitch, freqToMidi } from '@/features/practice/mic/pitch';
import { renderPluck } from '@/features/practice/mic/pluck';
import {
  centsFrom, centsText, median, nearestString, strobeStep,
} from '@/features/practice/mic/tuner';
import { TUNING } from '@/lib/music';

describe('nearestString', () => {
  it('picks the open string closest to the pitch', () => {
    expect(TUNING.map(nearestString)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(nearestString(42.4)).toBe(0); // a third above E, closer than A
    expect(nearestString(43)).toBe(1);
    expect(nearestString(30)).toBe(0);
    expect(nearestString(80)).toBe(5);
  });
});

describe('cents', () => {
  it('measures from the string, sharp positive', () => {
    expect(centsFrom(45.2, 1)).toBeCloseTo(20);
    expect(centsFrom(44.5, 1)).toBeCloseTo(-50);
  });

  it('reads in tune within five cents', () => {
    expect(centsText(4.9)).toBe('In tune');
    expect(centsText(-5)).toBe('In tune');
    expect(centsText(-12.4)).toBe('12¢ flat');
    expect(centsText(8)).toBe('8¢ sharp');
  });
});

describe('median', () => {
  it('ignores one stray reading', () => {
    expect(median([45, 45.1, 57, 44.9, 45])).toBe(45);
    expect(median([1, 3])).toBe(2);
  });
});

describe('strobeStep', () => {
  it('drifts right sharp, left flat, still in tune, and no faster past 50¢', () => {
    expect(strobeStep(10, 1000)).toBe(20);
    expect(strobeStep(-10, 500)).toBe(-10);
    expect(strobeStep(0, 1000)).toBe(0);
    expect(strobeStep(300, 1000)).toBe(strobeStep(50, 1000));
  });
});

describe('renderPluck', () => {
  it('sounds each open string exactly in tune', () => {
    for (const midi of TUNING) {
      const samples = renderPluck(midi, 48000, 0.5);
      const window = samples.slice(2400, 2400 + 4096);
      const pitch = detectPitch(window, 48000);
      expect(Math.abs(freqToMidi(pitch!.hz) - midi) * 100).toBeLessThan(2);
    }
  });

  it('starts and ends silent, so it never clicks', () => {
    const samples = renderPluck(45, 48000, 1);
    expect(samples[0]).toBe(0);
    expect(Math.abs(samples[samples.length - 1])).toBeLessThan(1e-4);
    expect(Math.max(...samples.map(Math.abs))).toBeLessThanOrEqual(0.4);
  });
});
