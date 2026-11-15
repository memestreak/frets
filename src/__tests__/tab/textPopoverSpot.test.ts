/**
 * Where the text annotation popover sits (issue #342, `docs/specs/2026-11-14-tab-text-popover-design.md`): hanging up
 * from the top of the line's text annotations and chord names, so it covers neither them nor its column; under the
 * line when there is no room over it.
 */
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { partOf, type Part } from '@/features/tab/clip';
import { wordSpot } from '@/features/tab/fieldSpots';
import { layoutClip } from '@/features/tab/layout';

const clipOf = (tex: string): Part => {
  const result = readAlphaTexWith(alphaTab, tex);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return partOf(result.clip);
};
const W = 600;
// Many bars, so there are later lines; every bar has a long Text and a chord name over its first column.
const bars = Array.from({ length: 16 }, () => '0.6.4{ch "Am" txt "a long Text over the chord name"} 0.6.4 |').join(' ');

describe('the text annotation popover’s spot', () => {
  it('hangs up from over the text annotations and chord names on a later line', () => {
    const layout = layoutClip(clipOf(bars), W);
    const system = layout.systems[1];
    const bar = system.bars[0].index;
    const spot = wordSpot(layout, W, { kind: 'text', bar, column: 1 });
    expect(spot.up).toBe(true);
    expect(spot.y).toBeLessThan(system.top + system.rows.text!);
    expect(spot.y).toBeLessThan(system.top + system.rows.chords!);
    expect(spot.x).toBeCloseTo(system.bars[0].columns[1].x);
  });

  it('opens under the first line, where there is no room over it', () => {
    const layout = layoutClip(clipOf(bars), W);
    const system = layout.systems[0];
    const spot = wordSpot(layout, W, { kind: 'text', bar: 0, column: 0 });
    expect(spot.up).toBeFalsy();
    expect(spot.y).toBeGreaterThan(system.top + system.rows.staffBottom);
  });

  it('on a line with nothing over it yet, hangs up from where its text annotations will go', () => {
    const plain = Array.from({ length: 16 }, () => '0.6.4 0.6.4 |').join(' ');
    const layout = layoutClip(clipOf(plain), W);
    const system = layout.systems[1];
    const spot = wordSpot(layout, W, { kind: 'text', bar: system.bars[0].index, column: 0 });
    expect(spot.up).toBe(true);
    expect(spot.y).toBeLessThan(system.top + system.rows.staffTop);
  });
});
