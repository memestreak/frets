/** The box round a selected run of columns (issue #276): bar line to bar line, halfway between notes, a box per line. */
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { layoutClip, stepY, stringY } from '@/features/tab/layout';
import { partOf, type Part } from '@/features/tab/clip';
import { draggedRange, knobY, RANGE_HANDLE_REACH, rangeBoxes, rangeEndAt, rangeHandleAt, rangeHandles } from '@/features/tab/rangeBox';
import { rhythmAt } from '@/features/tab/hitTest';
import { staffBar } from '@/features/tab/staffGeometry';

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

describe('Range handles (docs/specs/2026-11-05-tab-range-handles-design.md)', () => {
  it('sit on the left edge of the run’s first box and the right edge of its last, on their own lines', () => {
    const boxes = rangeBoxes(layout.systems, [4, 9]);
    const [start, end] = rangeHandles(layout, [4, 9]);
    expect(start).toMatchObject({ end: 'start', system: 0, x: boxes[0].x, top: boxes[0].y });
    expect(end).toMatchObject({ end: 'end', system: 1, x: boxes[1].x + boxes[1].width });
    expect(rangeHandles(layout, [40, 50])).toEqual([]);
  });

  it('a knob is taken round its middle, a grip bar anywhere along its edge, a pin at its top (start) or foot (end)', () => {
    const handles = rangeHandles(layout, [1, 2]);
    const [start, end] = handles;
    const middle = (start.top + start.bottom) / 2;
    expect(rangeHandleAt(handles, start.x + RANGE_HANDLE_REACH, middle, 'knob')).toBe(start);
    expect(rangeHandleAt(handles, start.x + RANGE_HANDLE_REACH + 1, middle, 'knob')).toBeNull();
    expect(rangeHandleAt(handles, start.x, start.top + 2, 'knob')).toBeNull();
    expect(rangeHandleAt(handles, start.x, start.top + 2, 'bar')).toBe(start);
    expect(rangeHandleAt(handles, end.x - 3, end.bottom - 2, 'bar')).toBe(end);
    expect(knobY(start, 'pin')).toBe(start.top);
    expect(knobY(end, 'pin')).toBe(end.bottom);
    expect(rangeHandleAt(handles, start.x, start.top, 'pin')).toBe(start);
    expect(rangeHandleAt(handles, start.x, middle, 'pin')).toBeNull();
  });

  it('a dragged end lands on the column whose room is under the pointer, on that line; off a line, its nearest column', () => {
    const [first, second] = layout.systems;
    const cols = first.bars[0].columns;
    const y0 = first.top + stringY(first.rows, 2);
    expect(rangeEndAt(layout, cols[2].x, y0)).toBe(2);
    expect(rangeEndAt(layout, (cols[1].x + cols[2].x) / 2 + 1, y0)).toBe(2);
    expect(rangeEndAt(layout, 0, y0)).toBe(0);
    expect(rangeEndAt(layout, 10_000, y0)).toBe(7);
    expect(rangeEndAt(layout, second.bars[0].columns[1].x, second.top + stringY(second.rows, 2))).toBe(9);
    // Above the drawing, the first line; below it, the last.
    expect(rangeEndAt(layout, cols[3].x, -50)).toBe(3);
    expect(rangeEndAt(layout, second.bars[0].columns[0].x, layout.height + 50)).toBe(8);
  });

  it('the dragged end becomes the focus and the other the anchor; past the other end it stops there', () => {
    expect(draggedRange([2, 5], 'end', 9)).toEqual({ anchor: 2, focus: 9 });
    expect(draggedRange([2, 5], 'end', 3)).toEqual({ anchor: 2, focus: 3 });
    expect(draggedRange([2, 5], 'end', 0)).toEqual({ anchor: 2, focus: 2 });
    expect(draggedRange([2, 5], 'start', 0)).toEqual({ anchor: 5, focus: 0 });
    expect(draggedRange([2, 5], 'start', 7)).toEqual({ anchor: 5, focus: 5 });
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

describe('rhythmAt on staff stems, beams and multi-bar rests (step 8, Q1, Q4)', () => {
  it('a press on a staff stem picks its column; on a beam between two stems, the nearer column; on a head, nothing', () => {
    const eighths = clipOf('\\ts (4 4)\n5.3.8 7.3.8 5.3.4 3.3.2 |');
    const both = layoutClip(eighths, 800, 'both');
    const system = both.systems[0];
    const score = system.rows.score!;
    const geometry = staffBar(system.bars[0], score);
    const [first, second] = system.bars[0].columns;
    const a = geometry.columns.get(first)!;
    const b = geometry.columns.get(second)!;
    const head = stepY(score, first.heads[0].step);
    // Halfway along the stem, between its head and its tip.
    expect(rhythmAt(both, a.stemX, system.top + (head + a.tip!) / 2)).toEqual({ bar: 0, column: 0 });
    // On the beam, a quarter of the way from the first stem to the second: the first; three quarters: the second.
    expect(rhythmAt(both, a.stemX + (b.stemX - a.stemX) / 4, system.top + a.tip!)).toEqual({ bar: 0, column: 0 });
    expect(rhythmAt(both, a.stemX + (b.stemX - a.stemX) * 3 / 4, system.top + b.tip!)).toEqual({ bar: 0, column: 1 });
    expect(rhythmAt(both, first.x, system.top + head)).toBeNull();
  });

  it('a press on a multi-bar rest picks its bars', () => {
    const rests = clipOf('\\multiBarRest\n\\ts (4 4)\n3.3.1 | r.1 | r.1 | r.1 | 5.3.1 |');
    const tab = layoutClip(rests, 800, 'both');
    const system = tab.systems[0];
    const run = system.bars.find(b => b.restRun?.first)!;
    const { x0, x1 } = run.restRun!.span;
    const y = system.top + (system.rows.score!.top + system.rows.score!.bottom) / 2;
    expect(rhythmAt(tab, (x0 + x1) / 2, y)).toEqual({ bar: 1, column: 0, lastBar: 3 });
  });
});

describe('a press on what is part of a note picks the note (step 8, Q1)', () => {
  it('a staff accidental, a dot and a tab ghost bracket pick their note', async () => {
    const { staffAt, hitTest } = await import('@/features/tab/hitTest');
    // F# (2nd fret on the high E string) has a sharp in C; a dotted half note has a dot.
    const sharp = clipOf('\\ts (4 4)\n2.1.2{d} (5.3{g}).4 |');
    const both = layoutClip(sharp, 800, 'both');
    const system = both.systems[0];
    const score = system.rows.score!;
    const geometry = staffBar(system.bars[0], score);
    const first = system.bars[0].columns[0];
    const drawn = geometry.columns.get(first)!;
    const y = system.top + stepY(score, first.heads[0].step);
    const left = drawn.xs[0];
    // The sharp's middle, left of the head; the dot's, right of it.
    expect(staffAt(both, left - 2 - 5, y)).toMatchObject({ bar: 0, column: 0, string: 0 });
    expect(staffAt(both, left + drawn.width + 4, y)).toMatchObject({ bar: 0, column: 0, string: 0 });
    // The ghost note's bracket on the tab, left of its number.
    const tab = layoutClip(sharp, 800, 'tab');
    const ghost = tab.systems[0].bars[0].columns[1];
    expect(hitTest(tab, ghost.x - 7, tab.systems[0].top + stringY(tab.systems[0].rows, 2))).toEqual({ bar: 0, column: 1, string: 2 });
  });

  it('a press on a plain bar line or a bar number picks no word or mark', async () => {
    const { textAt } = await import('@/features/tab/layoutText');
    const { markAt } = await import('@/features/tab/marks');
    const tab = layoutClip(clip, 800, 'tab');
    const system = tab.systems[0];
    const barLineX = system.bars[0].x1;
    const middle = system.top + (system.rows.staffTop + system.rows.staffBottom) / 2;
    expect(textAt(tab, barLineX, middle)).toBeNull();
    expect(markAt(tab, barLineX, middle)).toBeNull();
    // The bar number sits over the bar's start, above the tab.
    const numberY = system.top + system.rows.staffTop - 10;
    expect(textAt(tab, system.bars[1].x0 + 3, numberY)).toBeNull();
    expect(markAt(tab, system.bars[1].x0 + 3, numberY)).toBeNull();
  });
});
