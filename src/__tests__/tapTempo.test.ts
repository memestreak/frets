/** Tap tempo, shared by the Metronome page and the Tab page's tempo panel. */
import { addTap, tapBpm, tapResetMs, TAPS_KEPT } from '@/lib/tapTempo';

const RANGE = { min: 20, max: 400 };
const reset = tapResetMs(RANGE);

/** The run after tapping at each time in turn, from none. */
const tapAll = (times: number[]) => times.reduce<number[]>((taps, t) => addTap(taps, t, RANGE), []);

describe('tap tempo', () => {
  it('takes the tempo from the gaps between taps, once there are two', () => {
    expect(tapBpm(tapAll([1000]), RANGE)).toBeNull();
    expect(tapBpm(tapAll([1000, 1500]), RANGE)).toBe(120);
    // Gaps of 500, 600 and 600 ms: an average of 566.7 ms is 106 bpm.
    expect(tapBpm(tapAll([1000, 1500, 2100, 2700]), RANGE)).toBe(106);
  });

  it('starts over after a pause longer than a beat at the slowest tempo', () => {
    expect(reset).toBe(3100);
    expect(addTap([0, 500], 500 + reset + 1, RANGE)).toEqual([500 + reset + 1]);
    expect(addTap([0, 500], 500 + reset, RANGE)).toEqual([0, 500, 500 + reset]);
  });

  it('reaches the slowest tempo: taps 3 seconds apart are one run', () => {
    expect(tapAll([0, 3000])).toEqual([0, 3000]);
    expect(tapBpm([0, 3000], RANGE)).toBe(20);
  });

  it('starts over when the time goes backwards or stands still', () => {
    expect(addTap([1000, 1500], 1200, RANGE)).toEqual([1200]);
    expect(addTap([1000, 1500], 1500, RANGE)).toEqual([1500]);
  });

  it('follows the latest eight taps', () => {
    // Five taps a second apart, then five half a second apart: the last eight give 93 bpm.
    const run = tapAll([0, 1000, 2000, 3000, 4000, 4500, 5000, 5500, 6000, 6500]);
    expect(run).toHaveLength(TAPS_KEPT);
    expect(run[0]).toBe(2000);
    expect(tapBpm(run, RANGE)).toBe(93);
  });

  it('keeps the tempo within the range, in whole bpm', () => {
    expect(tapBpm([0, 10], RANGE)).toBe(400);
    expect(tapBpm([0, 4000, 8000], RANGE)).toBe(20);
    expect(tapBpm([0, 10], { min: 40, max: 200 })).toBe(200);
    expect(tapResetMs({ min: 60, max: 200 })).toBe(1100);
  });
});
