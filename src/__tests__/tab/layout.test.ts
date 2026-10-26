import { readAscii } from '@/features/tab/ascii';
import { columnWidth, layoutClip, rowsFor } from '@/features/tab/layout';
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import type { Clip } from '@/features/tab/clip';

function clipOf(text: string): Clip {
  const result = readAscii(text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.clip;
}

/** Eight bars of eighth notes on the low E. */
const LONG = clipOf(
  ['e', 'B', 'G', 'D', 'A', 'E']
    .map(n => `${n}|${`${n === 'E' ? '-0-0-0-0-0-0-0-0-' : '-----------------'}|`.repeat(8)}`)
    .join('\n'),
);

describe('layoutClip', () => {
  it('keeps every bar on one line when there is room', () => {
    const layout = layoutClip(LONG, 10_000);
    expect(layout.systems).toHaveLength(1);
    expect(layout.systems[0].bars).toHaveLength(8);
  });

  it('wraps bars onto new lines, never splitting one, all within the width', () => {
    const layout = layoutClip(LONG, 600);
    expect(layout.systems.length).toBeGreaterThan(1);
    expect(layout.systems.flatMap(s => s.bars.map(b => b.index))).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    for (const system of layout.systems) {
      expect(system.bars[system.bars.length - 1].x1).toBeLessThanOrEqual(600);
    }
  });

  it('puts the time signature in front of the first line of tab, and "TAB" on the lines before the bars', () => {
    const layout = layoutClip(LONG, 600);
    const [first, ...rest] = layout.systems;
    expect(first.timeX).toBeGreaterThan(0);
    expect(first.timeX!).toBeLessThan(first.lineStart);
    for (const system of rest) {
      expect(system.timeX).toBeNull();
      expect(system.lineStart).toBe(0);
    }
    for (const system of layout.systems) {
      expect(system.bars[0].x0).toBe(system.staffStart);
      expect(system.staffStart).toBeGreaterThan(system.lineStart);
    }
  });

  it('squeezes a bar wider than a whole line to fit', () => {
    const layout = layoutClip(LONG, 300);
    for (const system of layout.systems) {
      expect(system.bars).toHaveLength(1);
      expect(system.bars[0].x1).toBeLessThanOrEqual(300);
    }
  });

  it('places columns left to right inside their bar', () => {
    const [bar] = layoutClip(LONG, 10_000).systems[0].bars;
    const xs = bar.columns.map(c => c.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    expect(xs[0]).toBeGreaterThan(bar.x0);
    expect(xs[xs.length - 1]).toBeLessThan(bar.x1);
  });

  it('gives longer notes more room', () => {
    const [eighth] = LONG.bars[0].columns;
    const half = { ...eighth, duration: { ...eighth.duration, value: 2 as const } };
    expect(columnWidth(half)).toBeGreaterThan(columnWidth(eighth));
  });

  it('names the strings only when the tuning is not standard', () => {
    expect(layoutClip(LONG, 800).names).toBeNull();
    expect(layoutClip({ ...LONG, tuning: ['D', 'A', 'D', 'G', 'B', 'E'] }, 800).names).toEqual(['E', 'B', 'G', 'D', 'A', 'D']);
  });
});

describe('rowsFor', () => {
  const rowsOf = (tex: string) => {
    const result = readAlphaTexWith(alphaTab, tex);
    if (!result.ok) throw new Error(result.errors.join('\n'));
    return rowsFor(result.clip);
  };

  it('has no rows above the staff for plain notes, only room for bends', () => {
    const rows = rowsOf('5.3.4 7.3{b (0 4)}.4 r.2 |');
    expect([rows.endings, rows.strokes, rows.letRing, rows.palmMute, rows.harmonics, rows.vibrato, rows.accents]).toEqual([null, null, null, null, null, null, null]);
    expect(rows.staffTop).toBe(30);
  });

  it('gives each mark the clip uses a row of its own, in order, and moves the staff down for them', () => {
    const rows = rowsOf('5.3{pm ac}.4{sd} 7.3{lr v}.4 r.2 |');
    expect(rows.endings).toBeNull();
    expect(rows.harmonics).toBeNull();
    const used = [rows.strokes!, rows.letRing!, rows.palmMute!, rows.vibrato!, rows.accents!];
    expect(used).toEqual([...used].sort((a, b) => a - b));
    expect(new Set(used).size).toBe(used.length);
    expect(rows.staffTop).toBeGreaterThan(rows.accents! + 10);
    expect(rows.height).toBe(rows.staffBottom + 54);
  });
});
