/**
 * Where a popover that moves on goes next (issue #342): the chord popover
 * (`docs/specs/2026-11-10-tab-chord-popover-design.md`) and the Text popover
 * (`docs/specs/2026-11-14-tab-text-popover-design.md`). Dorico's Shift+Q popover stays open as Space,
 * Shift+Space, Tab and Shift+Tab move it, so a run of chord names is typed in one go; the Text popover
 * moves column to column on Tab and Shift+Tab. A chord name or a Text belongs to a column, so the popover
 * goes column to column; an empty bar has none yet, so it stops on the bar itself (column 0), where what
 * is set lands on the first of the rests that fill it. Pure.
 */
import type { Part } from './clip';

/** Where a key in a popover moves it once it has set what is typed: a column on, back, or a bar on or back. */
export type PopoverMove = 'next' | 'back' | 'nextBar' | 'backBar';

/** A spot the popover can stand on: a column of a bar, or column 0 of an empty bar. */
export interface PopoverSpot {
  bar: number;
  column: number;
}

/** The last spot of a bar: its last column, or the bar itself when it is empty. */
function lastSpot(clip: Part, bar: number): PopoverSpot {
  return { bar, column: Math.max(0, clip.bars[bar].columns.length - 1) };
}

/**
 * Where a move takes the popover from `at`: Space to the next column, Shift+Space to the one before,
 * Tab to the start of the next bar, Shift+Tab to the start of the bar before. Null past either end of
 * the clip, where the popover stays put.
 */
export function popoverStep(clip: Part, at: PopoverSpot, move: PopoverMove): PopoverSpot | null {
  const { bar, column } = at;
  const columns = clip.bars[bar]?.columns.length ?? 0;
  const last = clip.bars.length - 1;
  switch (move) {
    case 'next':
      if (column + 1 < columns) return { bar, column: column + 1 };
      return bar < last ? { bar: bar + 1, column: 0 } : null;
    case 'back':
      if (column > 0) return { bar, column: column - 1 };
      return bar > 0 ? lastSpot(clip, bar - 1) : null;
    case 'nextBar':
      return bar < last ? { bar: bar + 1, column: 0 } : null;
    case 'backBar':
      return bar > 0 ? { bar: bar - 1, column: 0 } : null;
  }
}
