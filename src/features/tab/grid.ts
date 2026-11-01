/**
 * Note input's grid (issue #293, as Dorico's rhythmic grid): where the cursor stops inside a rest, and
 * what a press in note input snaps to. ← → step one grid line at a time through a plain rest (and so
 * through the empty time at a bar's end) and one note at a time over notes; a note entered between
 * grid lines first splits the rest there (`splitRestAt`). Grid lines are counted from the bar's start,
 * not the rest's, so a 16th grid lands on the bar's 16ths whatever came before. Pure.
 */
import { fewestRests, NOTE_VALUES, ticks, type Bar, type Duration, type NoteValue, type Part } from './clip';
import { emptyColumn, isPlainRest, normalize, replaceBar, type Cursor } from './editing';
import type { Layout, PlacedColumn } from './layout';

/** The grids offered, coarsest first (Jeremy, 2026-11-01). */
export const GRID_VALUES = [4, 8, 16, 32] as const satisfies readonly NoteValue[];
export type GridValue = (typeof GRID_VALUES)[number];
export const DEFAULT_GRID: GridValue = 16;

/** A grid as Settings and the palette's panel name it. */
export const GRID_NAMES: Record<GridValue, string> = { 4: 'Quarter', 8: 'Eighth', 16: 'Sixteenth', 32: 'Thirty-second' };

export function isGridValue(value: unknown): value is GridValue {
  return (GRID_VALUES as readonly unknown[]).includes(value);
}

/** One grid step, in ticks. */
export function gridTicks(grid: GridValue): number {
  return gridLength(grid);
}

/** The next grid finer (−1) or coarser (+1), staying at the ends. */
export function stepGrid(grid: GridValue, step: 1 | -1): GridValue {
  const i = GRID_VALUES.indexOf(grid) - step;
  return GRID_VALUES[Math.min(GRID_VALUES.length - 1, Math.max(0, i))];
}

/** Ticks from the bar's start to its column `column` (grace notes take none). */
function columnStart(bar: Bar, column: number): number {
  return bar.columns.slice(0, column).reduce((sum, c) => sum + (c.grace ? 0 : ticks(c.duration)), 0);
}

/**
 * Where the cursor stops in a column, in ticks from its start: always at 0, and in a plain rest at each
 * grid line inside it too. A note, a tuplet or a grace note is one stop.
 */
export function stopsIn(bar: Bar, column: number, grid: GridValue): number[] {
  const here = bar.columns[column];
  if (!here || !isPlainRest(here)) return [0];
  const start = columnStart(bar, column);
  const end = start + ticks(here.duration);
  const step = gridTicks(grid);
  const stops = [0];
  for (let line = (Math.floor(start / step) + 1) * step; line < end; line += step) stops.push(line - start);
  return stops;
}

/**
 * ← → in note input inside the cursor's rest: the next stop that way, in ticks from the rest's start,
 * or null when the key leaves the column (and the cursor goes to the next or last column, as before).
 */
export function stepInRest(clip: Part, cursor: Cursor, at: number, step: 1 | -1, grid: GridValue): number | null {
  const stops = stopsIn(clip.bars[cursor.bar], cursor.column, grid);
  const next = step === 1 ? stops.find(s => s > at) : stops.filter(s => s < at).pop();
  return next ?? null;
}

/** The last stop in the cursor's column: where ← lands coming back into a rest. */
export function lastStop(clip: Part, cursor: Cursor, grid: GridValue): number {
  return stopsIn(clip.bars[cursor.bar], cursor.column, grid).pop()!;
}

/** Whether `at` is still a place inside the cursor's column a note could go: a plain rest longer than it. */
export function isInsideRest(clip: Part, cursor: Cursor, at: number): boolean {
  const here = clip.bars[cursor.bar]?.columns[cursor.column];
  return !!here && at > 0 && isPlainRest(here) && at < ticks(here.duration);
}

/**
 * The cursor's rest split `at` ticks in, before a note goes there: the time before it and the time from
 * it on each become the fewest rests that fill them, and the cursor goes to the first rest after the
 * split. With `at` 0, or anywhere but inside a plain rest, nothing changes.
 */
export function splitRestAt(clip: Part, cursor: Cursor, at: number): { clip: Part; cursor: Cursor } {
  if (!isInsideRest(clip, cursor, at)) return { clip, cursor };
  const bar = clip.bars[cursor.bar];
  const start = columnStart(bar, cursor.column);
  const end = start + ticks(bar.columns[cursor.column].duration);
  const before = restsOnBeat(start, start + at).map(emptyColumn);
  const after = restsOnBeat(start + at, end).map(emptyColumn);
  const columns = [...bar.columns];
  columns.splice(cursor.column, 1, ...before, ...after);
  return { clip: normalize(replaceBar(clip, cursor.bar, { ...bar, columns })), cursor: { ...cursor, column: cursor.column + before.length } };
}

/**
 * Rests from `from` to `to` (ticks from the bar's start) as printed music writes them: each the longest
 * plain rest that starts on a multiple of its own length and fits, so a rest never hides a beat it
 * crosses (a 16th then a half from the fourth 16th of beat 2, not a half then a 16th).
 */
function restsOnBeat(from: number, to: number): Duration[] {
  const rests: Duration[] = [];
  for (let at = from; at < to;) {
    const value = NOTE_VALUES.find(v => at % gridLength(v) === 0 && at + gridLength(v) <= to);
    // Time no 64th fits (a tuplet's leftover): the fewest rests that fill it.
    if (!value) return [...rests, ...fewestRests(to - at)];
    rests.push({ value, dots: 0 });
    at += gridLength(value);
  }
  return rests;
}

function gridLength(value: NoteValue): number {
  return ticks({ value, dots: 0 });
}

/** Where a stop `at` ticks into a placed column is drawn: from its note's x across its room, as time goes. */
export function xAlong(placed: PlacedColumn, at: number): number {
  const length = placed.column.grace ? 0 : ticks(placed.column.duration);
  return length > 0 ? placed.x + (at / length) * placed.width : placed.x;
}

/**
 * The stop nearest a press at `x` in bar `bar` (note input, issue #293): a column's note, or a grid line
 * inside a rest. Null for a bar not drawn, an empty bar or one inside a multi-bar rest.
 */
export function stopNear(layout: Layout, bar: number, x: number, grid: GridValue): { column: number; at: number; x: number } | null {
  for (const system of layout.systems) {
    const placed = system.bars.find(b => b.index === bar);
    if (!placed) continue;
    if (placed.restRun || placed.columns.length === 0) return null;
    let best: { column: number; at: number; x: number } | null = null;
    placed.columns.forEach((c, column) => {
      for (const at of stopsIn(placed.bar, column, grid)) {
        const stopX = xAlong(c, at);
        if (!best || Math.abs(stopX - x) < Math.abs(best.x - x)) best = { column, at, x: stopX };
      }
    });
    return best;
  }
  return null;
}
