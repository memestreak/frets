/**
 * Where the chord popover goes next (issue #342, `docs/specs/2026-11-10-tab-chord-popover-design.md`):
 * Dorico's Shift+Q popover stays open as Space, Shift+Space, Tab and Shift+Tab move it, so a run of
 * chord names is typed in one go. A chord name belongs to a column, so the popover goes column to
 * column; an empty bar has none yet, so it stops on the bar itself (column 0), where the name lands on
 * the first of the rests that fill it. Pure.
 */
import type { Part } from './clip';

/** What a key in the chord popover does once it has set what is typed. */
export type ChordMove = 'next' | 'back' | 'nextBar' | 'backBar';

/** A spot the popover can stand on: a column of a bar, or column 0 of an empty bar. */
export interface ChordSpot {
  bar: number;
  column: number;
}

/** The last spot of a bar: its last column, or the bar itself when it is empty. */
function lastSpot(clip: Part, bar: number): ChordSpot {
  return { bar, column: Math.max(0, clip.bars[bar].columns.length - 1) };
}

/**
 * Where a move takes the popover from `at`: Space to the next column, Shift+Space to the one before,
 * Tab to the start of the next bar, Shift+Tab to the start of the bar before. Null past either end of
 * the clip, where the popover stays put.
 */
export function chordStep(clip: Part, at: ChordSpot, move: ChordMove): ChordSpot | null {
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
