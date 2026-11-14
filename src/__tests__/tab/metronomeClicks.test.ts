import { describe, expect, it } from 'vitest';
import { barClicks, clickVelocity, countOf, DEFAULT_LEVELS, stepsPerBeat } from '@/features/tab/metronomeClicks';

const Q = 960;

describe("Tab metronome's count (issues #148, #477)", () => {
  it('clicks each beat of quarter and half bars, with no group accents', () => {
    expect(countOf(4, 4, [2, 2])).toEqual({ ticks: Q, clicks: 4, groupStarts: [] });
    expect(countOf(3, 4, [1, 1, 1])).toEqual({ ticks: Q, clicks: 3, groupStarts: [] });
    expect(countOf(2, 2, [1, 1])).toEqual({ ticks: 2 * Q, clicks: 2, groupStarts: [] });
  });

  it('clicks every eighth of bars over 8, each Beat group after the first marked', () => {
    // 6/8 clicks six eighths, the 4 marked (Jeremy, 2026-10-28).
    expect(countOf(6, 8, [3, 3])).toEqual({ ticks: Q / 2, clicks: 6, groupStarts: [3] });
    expect(countOf(12, 8, [3, 3, 3, 3])).toEqual({ ticks: Q / 2, clicks: 12, groupStarts: [3, 6, 9] });
    expect(countOf(7, 8, [2, 2, 3])).toEqual({ ticks: Q / 2, clicks: 7, groupStarts: [2, 4] });
    expect(countOf(7, 8, [3, 2, 2])).toEqual({ ticks: Q / 2, clicks: 7, groupStarts: [3, 5] });
    expect(countOf(3, 8, [3])).toEqual({ ticks: Q / 2, clicks: 3, groupStarts: [] });
  });

  it('splits a beat only into whole subdivisions', () => {
    expect(stepsPerBeat(countOf(4, 4), 'off')).toBe(1);
    expect(stepsPerBeat(countOf(4, 4), 'eighths')).toBe(2);
    expect(stepsPerBeat(countOf(4, 4), 'triplets')).toBe(3);
    expect(stepsPerBeat(countOf(4, 4), 'sixteenths')).toBe(4);
    expect(stepsPerBeat(countOf(2, 2), 'eighths')).toBe(4);
    // Eighth bars already click every eighth: only sixteenths split them.
    expect(stepsPerBeat(countOf(6, 8, [3, 3]), 'eighths')).toBe(1);
    expect(stepsPerBeat(countOf(6, 8, [3, 3]), 'triplets')).toBe(1);
    expect(stepsPerBeat(countOf(6, 8, [3, 3]), 'sixteenths')).toBe(2);
    expect(stepsPerBeat(countOf(5, 16, [3, 2]), 'sixteenths')).toBe(1);
  });

  it('names each click: beat one, a group start, a beat or a subdivision', () => {
    expect(barClicks(countOf(6, 8, [3, 3]), { subdivide: 'off', clickOn: 'every' }).map(c => c.kind))
      .toEqual(['one', 'beat', 'beat', 'group', 'beat', 'beat']);
    expect(barClicks(countOf(2, 4), { subdivide: 'eighths', clickOn: 'every' }))
      .toEqual([{ offset: 0, kind: 'one' }, { offset: Q / 2, kind: 'sub' }, { offset: Q, kind: 'beat' }, { offset: 1.5 * Q, kind: 'sub' }]);
  });

  it('clicks the backbeat: every second beat, or the group starts after the first', () => {
    const on = (count: ReturnType<typeof countOf>) => barClicks(count, { subdivide: 'off', clickOn: 'backbeat' }).map(c => c.offset / count.ticks);
    expect(on(countOf(4, 4))).toEqual([1, 3]);
    expect(on(countOf(3, 4))).toEqual([1]);
    expect(on(countOf(6, 8, [3, 3]))).toEqual([3]);
    expect(on(countOf(7, 8, [2, 2, 3]))).toEqual([2, 4]);
    // No groups after the first: every second eighth.
    expect(on(countOf(3, 8, [3]))).toEqual([1]);
  });

  it('clicks only beat one on Beat one, and every beat in a count-in whatever it says', () => {
    expect(barClicks(countOf(4, 4), { subdivide: 'off', clickOn: 'one' }).map(c => c.offset)).toEqual([0]);
    expect(barClicks(countOf(4, 4), { subdivide: 'off', clickOn: 'one' }, { countIn: true }).map(c => c.offset)).toEqual([0, Q, 2 * Q, 3 * Q]);
  });

  it('strikes each kind by its level, nothing at 0', () => {
    expect(clickVelocity('one', DEFAULT_LEVELS)).toBe(110);
    expect(clickVelocity('group', DEFAULT_LEVELS)).toBe(120);
    expect(clickVelocity('beat', DEFAULT_LEVELS)).toBe(80);
    expect(clickVelocity('sub', DEFAULT_LEVELS)).toBe(48);
    expect(clickVelocity('sub', { ...DEFAULT_LEVELS, subdivisions: 0 })).toBe(0);
    expect(clickVelocity('beat', { ...DEFAULT_LEVELS, beats: 0.001 })).toBe(1);
  });
});
