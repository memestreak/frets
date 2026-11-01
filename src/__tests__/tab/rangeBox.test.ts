/** The box round a selected run of columns (issue #276): bar line to bar line, halfway between notes, a box per line. */
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { layoutClip, stringY } from '@/features/tab/layout';
import { partOf, type Part } from '@/features/tab/clip';
import { rangeBoxes } from '@/features/tab/TabClip';
import { rhythmAt } from '@/features/tab/hitTest';

function clipOf(text: string): Part {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return partOf(result.clip);
}

// Two bars on each line: bar 0 holds places 0–3, bar 1 places 4–7, bar 2 (the next line) places 8–11.
const BAR = '0.6.4 2.6.4 3.6.4 5.6.4 |';
const clip = clipOf(`\\systemsLayout 2\n\\ts (4 4)\n${BAR}\n${BAR}\n${BAR}\n`);
const layout = layoutClip(clip, 800, 'tab');

describe('rangeBoxes', () => {
  it('boxes a whole bar from its opening line to its closing one, over the tab’s six strings', () => {
    const bar = layout.systems[0].bars[0];
    const { rows, top } = layout.systems[0];
    const [box] = rangeBoxes(layout.systems, [0, 3]);
    expect(box.x).toBe(bar.x0);
    expect(box.x + box.width).toBe(bar.x1);
    expect(box.y).toBeLessThan(top + stringY(rows, 0));
    expect(box.y + box.height).toBeGreaterThan(top + stringY(rows, 5));
    expect(rangeBoxes(layout.systems, [0, 3])).toHaveLength(1);
  });

  it('inside a bar ends halfway between notes, clear of the next', () => {
    const cols = layout.systems[0].bars[0].columns;
    const [box] = rangeBoxes(layout.systems, [1, 2]);
    expect(box.x).toBe((cols[0].x + cols[1].x) / 2);
    expect(box.x + box.width).toBe((cols[2].x + cols[3].x) / 2);
  });

  it('runs across a bar line in one box, and splits where the run goes on to the next line', () => {
    const [first, second] = layout.systems;
    const across = rangeBoxes(layout.systems, [2, 5]);
    expect(across).toHaveLength(1);
    expect(across[0].x).toBeLessThan(first.bars[1].x0);
    expect(across[0].x + across[0].width).toBeGreaterThan(first.bars[1].x0);
    const split = rangeBoxes(layout.systems, [4, 9]);
    expect(split.map(b => b.system)).toEqual([0, 1]);
    expect(split[0].x + split[0].width).toBe(first.bars[1].x1);
    expect(split[1].x).toBe(second.bars[0].x0);
    expect(split[1].y).toBeGreaterThan(split[0].y + split[0].height);
  });
});

describe('rhythmAt (issue #276)', () => {
  const rests = clipOf('\\ts (4 4)\n3.6.4 r.4 5.6.2 |');
  it('finds a rest where the tab alone draws it, under the strings, and nothing on the strings over it', () => {
    const tab = layoutClip(rests, 800, 'tab');
    const { rows, top, bars } = tab.systems[0];
    const x = bars[0].columns[1].x;
    expect(rhythmAt(tab, x, top + rows.stemTop + 10)).toEqual({ bar: 0, column: 1 });
    expect(rhythmAt(tab, x, top + stringY(rows, 2))).toBeNull();
    // A note's stem picks its column too (issue #290).
    expect(rhythmAt(tab, bars[0].columns[0].x, top + rows.stemTop + 10)).toEqual({ bar: 0, column: 0 });
  });

  it('finds a rest on the staff, across its lines', () => {
    const both = layoutClip(rests, 800, 'both');
    const { rows, top, bars } = both.systems[0];
    const x = bars[0].columns[1].x;
    expect(rhythmAt(both, x, top + (rows.score!.top + rows.score!.bottom) / 2)).toEqual({ bar: 0, column: 1 });
    expect(rhythmAt(both, x + 20, top + (rows.score!.top + rows.score!.bottom) / 2)).toBeNull();
  });
});
