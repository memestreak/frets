/** A press picks a note only when it lands on it (issue #478): on its number on the tab, on its head (or sign or dot) on the staff. */
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { layoutClip, stringY } from '@/features/tab/layout';
import { stepY } from '@/features/tab/rows';
import { partOf, type Part } from '@/features/tab/clip';
import { HEAD_REACH_Y, hitTest, NUMBER_REACH, staffAt } from '@/features/tab/hitTest';
import { staffBar } from '@/features/tab/staffGeometry';
import { labelWidth } from '@/features/tab/widths';

function clipOf(text: string): Part {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return partOf(result.clip);
}

// Quarters on the high E string, then a two-digit fret and a ghost note.
const clip = clipOf('\\ts (4 4)\n3.1.4 5.1.4 12.1.4 (5.1{g}).4 |');

describe('a press on the tab (issue #478)', () => {
  const layout = layoutClip(clip, 800, 'tab');
  const { top, rows } = layout.systems[0];
  const columns = layout.systems[0].bars[0].columns;
  const y = top + stringY(rows, 0);
  const reach = (k: number) => labelWidth(columns[k].column.notes[0]!, columns[k].column) / 2 + NUMBER_REACH;

  it('on a number, or just past its ends, is on the note', () => {
    for (const k of [0, 1, 2, 3]) {
      const { x } = columns[k];
      expect(hitTest(layout, x, y)).toEqual({ bar: 0, column: k, string: 0 });
      expect(hitTest(layout, x - reach(k) + 0.5, y)).toEqual({ bar: 0, column: k, string: 0 });
      expect(hitTest(layout, x + reach(k) - 0.5, y)).toEqual({ bar: 0, column: k, string: 0 });
    }
  });

  it('a wider number reaches further: 12 further than 3, a ghost note’s brackets further still', () => {
    expect(reach(2)).toBeGreaterThan(reach(0));
    expect(reach(3)).toBeGreaterThan(reach(2));
  });

  it('on the string beside the number is beside the note, though its column is the nearest', () => {
    const { x } = columns[0];
    expect(hitTest(layout, x + reach(0) + 1, y)).toEqual({ bar: 0, column: 0, string: 0, beside: true });
    // Halfway to the next number, as in the issue's picture.
    expect(hitTest(layout, (x + columns[1].x) / 2 - 1, y)).toEqual({ bar: 0, column: 0, string: 0, beside: true });
  });

  it('on an empty string in the note’s column is beside the notes', () => {
    expect(hitTest(layout, columns[0].x, top + stringY(rows, 1))).toEqual({ bar: 0, column: 0, string: 1, beside: true });
  });

  it('in a bar of rests is beside the notes', () => {
    const empty = layoutClip(clipOf('\\ts (4 4)\n3.1.4 3.1.4 3.1.4 3.1.4 | r.1 |'), 800, 'tab');
    const bar = empty.systems[0].bars[1];
    expect(hitTest(empty, (bar.x0 + bar.x1) / 2, empty.systems[0].top + stringY(empty.systems[0].rows, 0)))
      .toEqual({ bar: 1, column: 0, string: 0, beside: true });
  });
});

describe('a press on the staff (issue #478)', () => {
  // A dotted half G on the third string, then a quarter.
  const staffClip = clipOf('\\ts (4 4)\n0.3.2{d} 0.3.4 |');
  const layout = layoutClip(staffClip, 800, 'staff');
  const system = layout.systems[0];
  const score = system.rows.score!;
  const first = system.bars[0].columns[0];
  const drawn = staffBar(system.bars[0], score).columns.get(first)!;
  const centre = drawn.xs[0] + drawn.width / 2;
  const headY = system.top + stepY(score, first.heads[0].step);

  it('on the head is on its note', () => {
    expect(staffAt(layout, centre, headY)).toMatchObject({ bar: 0, column: 0, string: 2 });
    expect(staffAt(layout, centre, headY - HEAD_REACH_Y + 0.5)).toMatchObject({ string: 2 });
  });

  it('on the next line up or down is not: it is that line, beside the heads', () => {
    // A line is two steps, a whole space, from the head's.
    expect(staffAt(layout, centre, headY - 9)).toMatchObject({ bar: 0, column: 0, string: null });
    expect(staffAt(layout, centre, headY + 9)).toMatchObject({ bar: 0, column: 0, string: null });
  });

  it('a head’s width to the side is beside it', () => {
    // The quarter after has no dot to reach for.
    const second = system.bars[0].columns[1];
    const quarter = staffBar(system.bars[0], score).columns.get(second)!;
    const middle = quarter.xs[0] + quarter.width / 2;
    expect(staffAt(layout, middle, headY)).toMatchObject({ column: 1, string: 2 });
    expect(staffAt(layout, middle + quarter.width + 1, headY)).toMatchObject({ string: null });
    expect(staffAt(layout, middle - quarter.width - 1, headY)).toMatchObject({ string: null });
  });

  it('on its dot is on its note', () => {
    // The dot is drawn 4 right of the head, in the space above a head on a line.
    expect(staffAt(layout, drawn.xs[0] + drawn.width + 4, headY)).toMatchObject({ string: 2 });
  });
});
