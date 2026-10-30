/**
 * Moving the cursor, or the end of a selection, by more than one column at a time, as MuseScore's
 * keys do (issue #238): Ctrl/⌘+← → a bar, Ctrl/⌘+Home / End the clip's start or end, and with
 * Shift the selection grows the same way; Shift+Home / End grows it to the ends of the line of tab.
 * Pure; places count columns in the whole clip from 0, as `indexOf` does.
 */
import type { Part } from './clip';
import { columnCount, placeOf, type Cursor } from './editing';

/** Back or on a bar, to the start or end of the line of tab, or to the start or end of the clip. */
export type Jump = 'barBack' | 'barOn' | 'lineStart' | 'lineEnd' | 'clipStart' | 'clipEnd';

/** Each line of tab's first and last place, in order (from the drawn layout). */
export type Lines = [number, number][];

/**
 * Where the cursor goes for a jump, on the same string. Back a bar goes to the start of the
 * cursor's bar, or, already there, to the start of the bar before; on a bar goes to the start of
 * the next bar. An empty bar is a place too, as it is for ← →. The line jumps only grow a selection,
 * so here they leave the cursor where it is.
 */
export function jumpCursor(clip: Part, cursor: Cursor, jump: Jump): Cursor {
  const { bar, column } = cursor;
  const last = clip.bars.length - 1;
  switch (jump) {
    case 'barBack':
      if (column > 0) return { ...cursor, column: 0 };
      return bar > 0 ? { ...cursor, bar: bar - 1, column: 0 } : cursor;
    case 'barOn':
      return bar < last ? { ...cursor, bar: bar + 1, column: 0 } : cursor;
    case 'clipStart':
      return { ...cursor, bar: 0, column: 0 };
    case 'clipEnd':
      return { ...cursor, bar: last, column: Math.max(0, clip.bars[last].columns.length - 1) };
    default:
      return cursor;
  }
}

/**
 * Where the moving end of a selection (its focus) goes for a jump. On a bar grows it to the end of
 * the focus's bar, or, already there, to the end of the next bar with columns; back a bar to the start
 * of its bar, or of the bar before. Empty bars hold no place, so they are stepped over.
 */
export function jumpFocus(clip: Part, focus: number, jump: Jump, lines: Lines): number {
  const count = columnCount(clip);
  if (count === 0) return focus;
  const { bar, column } = placeOf(clip, focus);
  const start = focus - column;
  const end = start + clip.bars[bar].columns.length - 1;
  switch (jump) {
    case 'barOn': {
      if (focus < end) return end;
      const next = clip.bars.slice(bar + 1).find(b => b.columns.length > 0);
      return next ? end + next.columns.length : focus;
    }
    case 'barBack': {
      if (focus > start) return start;
      const before = clip.bars.slice(0, bar).reverse().find(b => b.columns.length > 0);
      return before ? start - before.columns.length : focus;
    }
    case 'lineStart':
    case 'lineEnd': {
      const line = lines.find(([from, to]) => focus >= from && focus <= to);
      if (!line) return focus;
      return jump === 'lineStart' ? line[0] : line[1];
    }
    case 'clipStart':
      return 0;
    case 'clipEnd':
      return count - 1;
  }
}

/** The jump a key asks for, or null. With Shift the line and clip jumps grow a selection. */
export function jumpForKey(key: string, chord: boolean, shift: boolean): Jump | null {
  if (chord && key === 'ArrowLeft') return 'barBack';
  if (chord && key === 'ArrowRight') return 'barOn';
  if (chord && key === 'Home') return 'clipStart';
  if (chord && key === 'End') return 'clipEnd';
  if (!chord && shift && key === 'Home') return 'lineStart';
  if (!chord && shift && key === 'End') return 'lineEnd';
  return null;
}
