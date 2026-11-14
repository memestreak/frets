/**
 * The chord popover's moves (issue #342, `docs/specs/2026-11-10-tab-chord-popover-design.md`): Space and
 * Shift+Space go column to column, Tab and Shift+Tab bar to bar, an empty bar is one stop, and past either
 * end of the clip it stays put.
 */
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { partOf, type Part } from '@/features/tab/clip';
import { chordStep } from '@/features/tab/chordPopover';

function partFrom(tex: string): Part {
  const result = readAlphaTexWith(alphaTab, tex);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return partOf(result.clip);
}

// Two columns, an empty bar, then one column.
const part = () => {
  const p = partFrom('5.1.2 7.1.2 | 3.2.1 | 0.1.1 |');
  return { ...p, bars: [p.bars[0], { ...p.bars[1], columns: [] }, p.bars[2]] };
};

describe('chordStep', () => {
  it('moves column to column on Space, crossing bars, and stops once on an empty bar', () => {
    const p = part();
    expect(chordStep(p, { bar: 0, column: 0 }, 'next')).toEqual({ bar: 0, column: 1 });
    expect(chordStep(p, { bar: 0, column: 1 }, 'next')).toEqual({ bar: 1, column: 0 });
    expect(chordStep(p, { bar: 1, column: 0 }, 'next')).toEqual({ bar: 2, column: 0 });
    expect(chordStep(p, { bar: 2, column: 0 }, 'next')).toBeNull();
  });

  it('moves back on Shift+Space to the bar before’s last column', () => {
    const p = part();
    expect(chordStep(p, { bar: 2, column: 0 }, 'back')).toEqual({ bar: 1, column: 0 });
    expect(chordStep(p, { bar: 1, column: 0 }, 'back')).toEqual({ bar: 0, column: 1 });
    expect(chordStep(p, { bar: 0, column: 1 }, 'back')).toEqual({ bar: 0, column: 0 });
    expect(chordStep(p, { bar: 0, column: 0 }, 'back')).toBeNull();
  });

  it('moves to the start of the next or previous bar on Tab and Shift+Tab', () => {
    const p = part();
    expect(chordStep(p, { bar: 0, column: 1 }, 'nextBar')).toEqual({ bar: 1, column: 0 });
    expect(chordStep(p, { bar: 2, column: 0 }, 'nextBar')).toBeNull();
    expect(chordStep(p, { bar: 0, column: 1 }, 'backBar')).toBeNull();
    expect(chordStep(p, { bar: 2, column: 0 }, 'backBar')).toEqual({ bar: 1, column: 0 });
  });
});
