import { describe, expect, it } from 'vitest';
import { beatTicks, isTimeSignature, parseClip, WHOLE } from '@/features/tab/clip';

describe('time signatures', () => {
  it('hold 1 to 32 beats over 2, 4, 8, 16 or 32', () => {
    expect(isTimeSignature(1, 2)).toBe(true);
    expect(isTimeSignature(32, 32)).toBe(true);
    expect(isTimeSignature(0, 4)).toBe(false);
    expect(isTimeSignature(33, 4)).toBe(false);
    expect(isTimeSignature(2.5, 4)).toBe(false);
    expect(isTimeSignature(4, 1)).toBe(false);
    expect(isTimeSignature(4, 64)).toBe(false);
  });

  it('beam in threes in compound time, and never within less than a quarter', () => {
    const quarter = WHOLE / 4;
    expect(beatTicks({ beats: 4, value: 4 })).toBe(quarter);
    expect(beatTicks({ beats: 2, value: 2 })).toBe(WHOLE / 2);
    expect(beatTicks({ beats: 6, value: 8 })).toBe(quarter * 1.5);
    expect(beatTicks({ beats: 3, value: 8 })).toBe(quarter * 1.5);
    expect(beatTicks({ beats: 12, value: 16 })).toBe(quarter * 0.75);
    expect(beatTicks({ beats: 5, value: 8 })).toBe(quarter);
    expect(beatTicks({ beats: 3, value: 4 })).toBe(quarter);
  });

  it('are checked when a saved clip is read', () => {
    const clip = { name: '', tuning: ['E', 'A', 'D', 'G', 'B', 'E'], bars: [{ columns: [] }] };
    expect(parseClip({ ...clip, time: { beats: 7, value: 16 } })).not.toBeNull();
    expect(parseClip({ ...clip, time: { beats: 7, value: 3 } })).toBeNull();
  });
});
