/** The clip's own line breaks and bar shares: `\systemsLayout`, `\defaultSystemsLayout` and `\scale`. */
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { writeAlphaTex } from '@/features/tab/alphatex';
import { layoutClip } from '@/features/tab/layout';
import { barsPerLine, parseClip, type Clip } from '@/features/tab/clip';

const read = (text: string) => readAlphaTexWith(alphaTab, text);
function clipOf(text: string): Clip {
  const result = read(text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  expect(result.warnings).toEqual([]);
  return result.clip;
}

const BAR = '0.6.8 2.6.8 3.6.8 5.6.8 3.6.8 2.6.8 0.6.8 2.6.8 |';
const bars = (n: number, tags: (b: number) => string = () => '') =>
  Array.from({ length: n }, (_, b) => `${tags(b)}${BAR}`).join('\n');
const lineCounts = (clip: Clip, width: number, parts: 'tab' | 'staff' | 'both' = 'tab') =>
  layoutClip(clip, width, parts).systems.map(s => s.bars.length);
const widths = (clip: Clip, width: number) =>
  layoutClip(clip, width).systems.map(s => s.bars.map(b => b.x1 - b.x0));

describe('reading and writing the line breaks', () => {
  it('reads \\systemsLayout, \\defaultSystemsLayout and \\scale into the clip and writes them back', () => {
    const text = `\\systemsLayout (2 3 1)\n\\defaultSystemsLayout 4\n\\ts (4 4)\n${bars(3, b => (b === 1 ? '\\scale 1.5 ' : ''))}\n`;
    const clip = clipOf(text);
    expect(clip.systemsLayout).toEqual([2, 3, 1]);
    expect(clip.defaultSystemsLayout).toBe(4);
    expect(clip.bars.map(b => b.scale)).toEqual([undefined, 1.5, undefined]);
    expect(clip.header).toBeUndefined();
    expect(clip.bars[1].extra).toBeUndefined();
    expect(writeAlphaTex(clip)).toBe(text);
  });

  it('keeps \\width as written: alphaTab uses it only in its one-long-line layout', () => {
    const result = read(`\\width 300 ${BAR}`);
    expect(result.ok && result.clip.bars[0].extra).toEqual(['\\width 300']);
  });

  it('keeps a value Frets cannot use as written, and says so', () => {
    const result = read(`\\systemsLayout (2 0)\n\\scale 0 ${BAR}`);
    if (!result.ok) throw new Error('not read');
    expect(result.clip.systemsLayout).toBeUndefined();
    expect(result.clip.bars[0].scale).toBeUndefined();
    expect(result.clip.header).toEqual(['\\systemsLayout (2 0)']);
    expect(result.clip.bars[0].extra).toEqual(['\\scale 0']);
    expect(result.warnings.join(' ')).toMatch(/systemsLayout takes whole numbers/);
    expect(result.warnings.join(' ')).toMatch(/scale takes a number above 0; bar 1/);
  });

  it('checks the stored fields', () => {
    const clip = clipOf(`\\systemsLayout (2)\n${BAR}`);
    expect(parseClip(clip)).not.toBeNull();
    expect(parseClip({ ...clip, systemsLayout: [2, 1.5] })).toBeNull();
    expect(parseClip({ ...clip, defaultSystemsLayout: 0 })).toBeNull();
    expect(parseClip({ ...clip, bars: [{ ...clip.bars[0], scale: -1 }] })).toBeNull();
  });
});

describe('barsPerLine', () => {
  it('is null without either tag, so lines fill by width', () => {
    expect(barsPerLine(clipOf(BAR), 0)).toBeNull();
  });
  it('takes the list, then the default, which is 3 when unset as in alphaTab', () => {
    const clip = clipOf(`\\systemsLayout (2 4)\n${BAR}`);
    expect([0, 1, 2, 5].map(i => barsPerLine(clip, i))).toEqual([2, 4, 3, 3]);
    const only = clipOf(`\\defaultSystemsLayout 5\n${BAR}`);
    expect(barsPerLine(only, 0)).toBe(5);
  });
});

describe('laying out the clip’s own lines', () => {
  it('fills by width without the tags', () => {
    expect(lineCounts(clipOf(bars(8)), 1200)).toEqual([3, 3, 2]);
  });

  it('puts as many bars on each line as \\systemsLayout says, then \\defaultSystemsLayout', () => {
    const clip = clipOf(`\\systemsLayout (1 2)\n\\defaultSystemsLayout 2\n${bars(7)}`);
    expect(lineCounts(clip, 1200)).toEqual([1, 2, 2, 2]);
    expect(lineCounts(clip, 1200, 'both')).toEqual([1, 2, 2, 2]);
  });

  it('squeezes a line before it wraps, wraps one too wide even so, and starts the next listed line after it', () => {
    const clip = clipOf(`\\systemsLayout (4 1)\n${bars(6)}`);
    expect(lineCounts(clip, 700)).toEqual([4, 1, 1]);
    for (const system of layoutClip(clip, 700).systems) expect(system.bars.at(-1)!.x1).toBeLessThanOrEqual(700.01);
    expect(lineCounts(clip, 340)).toEqual([2, 2, 1, 1]);
  });

  it('counts a multi-bar rest as one bar, kept whole', () => {
    const rest = 'r.1 |';
    const clip = clipOf(`\\multiBarRest\n\\systemsLayout (2 1)\n${rest}\n${rest}\n${rest}\n${BAR}\n${BAR}\n`);
    expect(lineCounts(clip, 1200)).toEqual([4, 1]);
  });

  it('gives a multi-bar rest its first bar\'s \\scale, as one bar of the line', () => {
    const rest = 'r.1 |';
    const clip = clipOf(`\\multiBarRest\n\\defaultSystemsLayout 2\n${BAR}\n\\scale 2 ${rest}\n${rest}\n${rest}\n`);
    const [bar, ...rests] = layoutClip(clip, 1200).systems[0].bars;
    const restWidth = rests[rests.length - 1].x1 - rests[0].x0;
    expect(restWidth / (bar.x1 - bar.x0)).toBeGreaterThan(1.6);
  });

  it('runs every full line to the width, sharing it evenly when no bar sets \\scale', () => {
    const clip = clipOf(`\\defaultSystemsLayout 2\n${bars(4)}`);
    const layout = layoutClip(clip, 1000);
    for (const system of layout.systems) {
      expect(system.bars[system.bars.length - 1].x1).toBeCloseTo(1000);
    }
    const [first, second] = widths(clip, 1000)[1];
    expect(first).toBeCloseTo(second);
  });

  it('shares a line by \\scale', () => {
    const clip = clipOf(`\\defaultSystemsLayout 2\n${bars(2, b => (b === 1 ? '\\scale 2 ' : ''))}`);
    const layout = layoutClip(clip, 1600);
    const [a, b] = layout.systems[0].bars;
    const room = (bar: typeof a) => bar.columns.reduce((t, c) => t + c.width, 0);
    expect(room(b) / room(a)).toBeCloseTo(2);
    // Each column keeps its room's start, and the bar's columns follow one another.
    for (const bar of [a, b]) {
      bar.columns.forEach((c, k) => {
        expect(c.x).toBeGreaterThanOrEqual(c.start);
        expect(c.x).toBeLessThan(c.start + c.width);
        if (k > 0) expect(c.start).toBeCloseTo(bar.columns[k - 1].start + bar.columns[k - 1].width);
      });
    }
  });

  it('never gives a bar less than its notes need', () => {
    const clip = clipOf(`\\defaultSystemsLayout 2\n${bars(2, b => (b === 0 ? '\\scale 0.01 ' : ''))}`);
    const [a] = layoutClip(clip, 900).systems[0].bars;
    for (const c of a.columns) expect(c.width).toBeGreaterThanOrEqual(13);
  });

  it('gives a short last line the line before’s rate, and a short only line its own room', () => {
    const clip = clipOf(`\\defaultSystemsLayout 3\n${bars(4)}`);
    const [full, last] = widths(clip, 1200);
    expect(last[0]).toBeCloseTo(full[1]);
    const one = layoutClip(clipOf(`\\defaultSystemsLayout 3\n${bars(1)}`), 1200);
    expect(one.systems[0].bars[0].x1).toBeLessThan(1200);
  });
});
