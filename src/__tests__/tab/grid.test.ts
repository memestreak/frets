import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { writeBars } from '@/features/tab/alphatex';
import { partOf, type Part } from '@/features/tab/clip';
import { setFret } from '@/features/tab/editing';
import { parseEditing } from '@/features/tab/editingPrefs';
import { advance, gridTicks, isInsideRest, lastStop, splitRestAt, stepGrid, stepInRest, stopNear, stopsIn } from '@/features/tab/grid';
import { layoutClip } from '@/features/tab/layout';

function clipOf(text: string): Part {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return partOf(result.clip);
}
const bars = (clip: Part) => writeBars(clip).join('\n');
const at = (column: number, bar = 0) => ({ bar, column, string: 0 });
const SIXTEENTH = gridTicks(16);

describe('note input’s grid (issue #293)', () => {
  it('stops at a rest’s start and at each grid line inside it, counted from the bar’s start', () => {
    const clip = clipOf('\\ts (4 4)\n5.1.8{d} r.16 r.2{d} |');
    // A note, and a rest no longer than the grid, are one stop each.
    expect(stopsIn(clip.bars[0], 0, gridTicks(16))).toEqual([0]);
    expect(stopsIn(clip.bars[0], 1, gridTicks(16))).toEqual([0]);
    // The dotted half starts on beat 2: a stop on every 16th after it, the last a 16th before the bar line.
    expect(stopsIn(clip.bars[0], 2, gridTicks(16))).toHaveLength(12);
    expect(stopsIn(clip.bars[0], 2, gridTicks(4))).toEqual([0, 4 * SIXTEENTH, 8 * SIXTEENTH]);
    // A rest starting off the grid stops at its start, then on the bar's grid lines.
    const off = clipOf('\\ts (4 4)\n5.1.16 r.4{d} r.2 |');
    expect(stopsIn(off.bars[0], 1, gridTicks(8))).toEqual([0, SIXTEENTH, 3 * SIXTEENTH, 5 * SIXTEENTH]);
  });

  it('steps through a rest with → and ←, and leaves it at either end', () => {
    const clip = clipOf('\\ts (4 4)\n5.1.4 r.2 7.1.4 |');
    expect(stepInRest(clip, at(1), 0, 1, gridTicks(8))).toBe(2 * SIXTEENTH);
    expect(stepInRest(clip, at(1), 6 * SIXTEENTH, 1, gridTicks(8))).toBeNull();
    expect(stepInRest(clip, at(1), 2 * SIXTEENTH, -1, gridTicks(8))).toBe(0);
    expect(stepInRest(clip, at(1), 0, -1, gridTicks(8))).toBeNull();
    // On a note there is nowhere to go inside it.
    expect(stepInRest(clip, at(0), 0, 1, gridTicks(32))).toBeNull();
    expect(lastStop(clip, at(1), gridTicks(4))).toBe(4 * SIXTEENTH);
    expect(lastStop(clip, at(0), gridTicks(4))).toBe(0);
  });

  it('splits the rest where the cursor is, so a note goes in there and the bar stays full', () => {
    const clip = clipOf('\\ts (4 4)\n5.1.4 r.2{d} |');
    const split = splitRestAt(clip, at(1), 3 * SIXTEENTH);
    // Written on the beat, as printed music has it: an 8th and a 16th up to the cursor, a 16th and a half after.
    expect(bars(split.clip)).toBe('5.1.4 r.8 r.16 r.16 r.2 |');
    expect(split.cursor).toEqual(at(3));
    // An eighth typed there takes its time from the rests after it.
    expect(bars(setFret(split.clip, split.cursor, 7, { value: 8, dots: 0 }))).toBe('5.1.4 r.8 r.16 7.1.8 r.4{dd} |');
    // At the rest's start, or off a rest, nothing changes.
    expect(splitRestAt(clip, at(1), 0).clip).toBe(clip);
    expect(splitRestAt(clip, at(0), SIXTEENTH).clip).toBe(clip);
    expect(isInsideRest(clip, at(1), 12 * SIXTEENTH)).toBe(false);
  });

  it('snaps a press to the nearest note or grid line inside a rest', () => {
    const clip = clipOf('\\ts (4 4)\n5.1.4 r.2{d} |');
    const layout = layoutClip(clip, 800, 'tab');
    const [note, rest] = layout.systems[0].bars[0].columns;
    expect(stopNear(layout, 0, note.x + 1, gridTicks(4))).toMatchObject({ column: 0, at: 0 });
    // Half way along the dotted half's room is its second quarter of three.
    expect(stopNear(layout, 0, rest.x + rest.width / 2, gridTicks(4))).toMatchObject({ column: 1, at: 4 * SIXTEENTH });
    expect(stopNear(layout, 0, rest.x + rest.width / 2, gridTicks(16))).toMatchObject({ column: 1, at: 6 * SIXTEENTH });
  });

  it('steps finer and coarser, staying at a quarter and a thirty-second, and is kept as a preference', () => {
    expect(stepGrid(16, -1)).toBe(32);
    expect(stepGrid(32, -1)).toBe(32);
    expect(stepGrid(8, 1)).toBe(4);
    expect(stepGrid(4, 1)).toBe(4);
    expect(parseEditing({}).grid).toBe(16);
    expect(parseEditing({}).fixedGrid).toBe(false);
    expect(parseEditing({ grid: 8 }).grid).toBe(8);
    expect(parseEditing({ grid: 64 }).grid).toBe(16);
  });

  it('Shift+Space moves on by a length over notes and rests, into the next bar and past the clip’s end', () => {
    const clip = clipOf('\\ts (4 4)\n5.1.4 r.2{d} | 7.1.2 r.2 |');
    const QUARTER = gridTicks(4);
    // From the first note a quarter on: the rest's start; a dotted quarter on: an 8th into the rest.
    expect(advance(clip, at(0), 0, QUARTER)).toMatchObject({ cursor: at(1), at: 0 });
    expect(advance(clip, at(0), 0, QUARTER * 1.5)).toMatchObject({ cursor: at(1), at: 2 * SIXTEENTH });
    // From the rest's last quarter a half on lands inside the next bar's half note: the column after it.
    expect(advance(clip, at(1), 2 * QUARTER, 2 * QUARTER)).toMatchObject({ cursor: at(1, 1), at: 0 });
    // Past the last bar a bar of rests is added.
    const past = advance(clip, at(1, 1), QUARTER, 2 * QUARTER);
    expect(past.clip.bars).toHaveLength(3);
    expect(past).toMatchObject({ cursor: at(0, 2), at: QUARTER });
  });
});

