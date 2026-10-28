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
  it('reads \\systemsLayout and \\defaultSystemsLayout into the clip and writes them back', () => {
    const text = `\\systemsLayout (2 3 1)\n\\defaultSystemsLayout 4\n\\ts (4 4)\n${bars(3)}\n`;
    const clip = clipOf(text);
    expect(clip.systemsLayout).toEqual([2, 3, 1]);
    expect(clip.defaultSystemsLayout).toBe(4);
    expect(clip.header).toBeUndefined();
    expect(writeAlphaTex(clip)).toBe(text);
  });

  it('keeps \\scale and \\width as written but doesn\'t use them: Frets spaces bars by their notes', () => {
    const result = read(`\\scale 2 \\width 300 ${BAR}`);
    if (!result.ok) throw new Error('not read');
    expect(result.clip.bars[0].extra).toEqual(['\\scale 2', '\\width 300']);
    expect(writeAlphaTex(result.clip)).toContain('\\scale 2 \\width 300 ');
  });

  it('keeps a value Frets cannot use as written, and says so', () => {
    const result = read(`\\systemsLayout (2 0)\n${BAR}`);
    if (!result.ok) throw new Error('not read');
    expect(result.clip.systemsLayout).toBeUndefined();
    expect(result.clip.header).toEqual(['\\systemsLayout (2 0)']);
    expect(result.warnings.join(' ')).toMatch(/systemsLayout takes whole numbers/);
  });

  it('checks the stored fields', () => {
    const clip = clipOf(`\\systemsLayout (2)\n${BAR}`);
    expect(parseClip(clip)).not.toBeNull();
    expect(parseClip({ ...clip, systemsLayout: [2, 1.5] })).toBeNull();
    expect(parseClip({ ...clip, defaultSystemsLayout: 0 })).toBeNull();
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

  it('runs every full line to the width, like bars sharing it evenly', () => {
    const clip = clipOf(`\\defaultSystemsLayout 2\n${bars(4)}`);
    const layout = layoutClip(clip, 1000);
    for (const system of layout.systems) {
      expect(system.bars[system.bars.length - 1].x1).toBeCloseTo(1000);
    }
    const [first, second] = widths(clip, 1000)[1];
    expect(first).toBeCloseTo(second);
  });

  it('spreads a line by the room its bars\' notes take, as lines filled by width are', () => {
    const quarters = '0.6.4 2.6.4 3.6.4 5.6.4 |';
    const clip = clipOf(`\\defaultSystemsLayout 2\n${BAR}\n${quarters}\n`);
    const plain = layoutClip(clipOf(`${BAR}\n${quarters}\n${BAR}\n${BAR}\n${BAR}\n`), 1000).systems[0].bars;
    const [a, b] = layoutClip(clip, 1000).systems[0].bars;
    const room = (bar: typeof a) => bar.columns.reduce((t, c) => t + c.width, 0);
    expect(room(a) / room(b)).toBeCloseTo(room(plain[0]) / room(plain[1]));
    expect(b.x1).toBeCloseTo(1000);
    // Each column keeps its room's start, and the bar's columns follow one another.
    for (const bar of [a, b]) {
      bar.columns.forEach((c, k) => {
        expect(c.x).toBeGreaterThanOrEqual(c.start);
        expect(c.x).toBeLessThan(c.start + c.width);
        if (k > 0) expect(c.start).toBeCloseTo(bar.columns[k - 1].start + bar.columns[k - 1].width);
      });
    }
  });

  it('never squeezes a bar below what its notes need', () => {
    const clip = clipOf(`\\defaultSystemsLayout 4\n${bars(4)}`);
    for (const bar of layoutClip(clip, 640).systems[0].bars) {
      for (const c of bar.columns) expect(c.width).toBeGreaterThanOrEqual(13);
    }
  });

  it('gives a short last line the line before’s rate, and a short only line its own room', () => {
    const clip = clipOf(`\\defaultSystemsLayout 3\n${bars(4)}`);
    const [full, last] = widths(clip, 1200);
    expect(last[0]).toBeCloseTo(full[1]);
    const one = layoutClip(clipOf(`\\defaultSystemsLayout 3\n${bars(1)}`), 1200);
    expect(one.systems[0].bars[0].x1).toBeLessThan(1200);
  });
});
