/**
 * Note input's grid (issue #293): where the cursor stops inside a rest, and what a press in note input
 * snaps to. By default it follows note input's length, as MuseScore's does; a fixed grid (Dorico's
 * rhythmic grid) is turned on from the palette's Grid button, Alt+G or Alt+[ ]. ← → step one grid line
 * at a time through a plain rest (and so through the empty time at a bar's end) and one note at a time
 * over notes; Shift+Space moves on by note input's length (`advance`). A note entered between grid
 * lines first splits the rest there (`splitRestAt`). Grid lines are counted from the bar's start, not
 * the rest's, so a 16th grid lands on the bar's 16ths whatever came before. Pure; a grid is passed as
 * its step in ticks.
 */
import { barLength, barTicks, fewestRests, NOTE_VALUES, ticks, timeAt, type Bar, type Duration, type NoteValue, type Part } from './clip';
import { emptyColumn, fillBar, isPlainRest, normalize, replaceBar, type Cursor } from './editing';
import type { Layout, PlacedBar, PlacedColumn } from './layout';

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
export function stopsIn(bar: Bar, column: number, step: number): number[] {
  const here = bar.columns[column];
  if (!here || !isPlainRest(here) || step <= 0) return [0];
  const start = columnStart(bar, column);
  const end = start + ticks(here.duration);
  const stops = [0];
  for (let line = (Math.floor(start / step) + 1) * step; line < end; line += step) stops.push(line - start);
  return stops;
}

/**
 * ← → in note input inside the cursor's rest: the next stop that way, in ticks from the rest's start,
 * or null when the key leaves the column (and the cursor goes to the next or last column, as before).
 */
export function stepInRest(clip: Part, cursor: Cursor, at: number, way: 1 | -1, step: number): number | null {
  const stops = stopsIn(clip.bars[cursor.bar], cursor.column, step);
  const next = way === 1 ? stops.find(s => s > at) : stops.filter(s => s < at).pop();
  return next ?? null;
}

/** The last stop in the cursor's column: where ← lands coming back into a rest. */
export function lastStop(clip: Part, cursor: Cursor, step: number): number {
  return stopsIn(clip.bars[cursor.bar], cursor.column, step).pop()!;
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
export function stopNear(layout: Layout, bar: number, x: number, step: number): { column: number; at: number; x: number } | null {
  for (const system of layout.systems) {
    const placed = system.bars.find(b => b.index === bar);
    if (!placed) continue;
    if (placed.restRun || placed.columns.length === 0) return null;
    let best: { column: number; at: number; x: number } | null = null;
    placed.columns.forEach((c, column) => {
      for (const at of stopsIn(placed.bar, column, step)) {
        const stopX = xAlong(c, at);
        if (!best || Math.abs(stopX - x) < Math.abs(best.x - x)) best = { column, at, x: stopX };
      }
    });
    return best;
  }
  return null;
}

/**
 * Shift+Space in note input (Jeremy, 2026-11-01): the cursor moved on by `length` ticks from where it is
 * (`at` ticks into its column), over notes and rests alike, as Dorico's Space moves its caret. Inside a
 * plain rest it stops there; inside a note, at the column after it. Past a bar's end it goes on into the
 * next bar, and past the clip's last bar, a bar of rests is added (a short last bar is filled first).
 */
export function advance(clip: Part, cursor: Cursor, at: number, length: number): { clip: Part; cursor: Cursor; at: number } {
  let part = clip;
  let bar = cursor.bar;
  let target = columnStart(part.bars[bar], cursor.column) + at + length;
  for (;;) {
    const here = part.bars[bar];
    const end = barLength(here);
    if (target < end) {
      let start = 0;
      for (let column = 0; column < here.columns.length; column++) {
        const c = here.columns[column];
        const span = c.grace ? 0 : ticks(c.duration);
        if (span > 0 && target < start + span) {
          if (target === start) return { clip: part, cursor: { ...cursor, bar, column }, at: 0 };
          if (isPlainRest(c)) return { clip: part, cursor: { ...cursor, bar, column }, at: target - start };
          // Inside a note: the next column, or the next bar's start.
          target = start + span;
          break;
        }
        start += span;
      }
      if (target < end) continue;
    }
    if (bar === part.bars.length - 1) {
      const filled = fillBar(part, bar);
      if (filled !== part && target < barLength(filled.bars[bar])) {
        part = filled;
        continue;
      }
      part = filled;
      const time = timeAt(part, bar);
      part = { ...part, bars: [...part.bars, { columns: fewestRests(barTicks(time)).map(emptyColumn) }] };
    }
    target -= Math.max(end, barLength(part.bars[bar]));
    bar++;
  }
}

/**
 * Where the grid's lines fall across a drawn bar (Jeremy, 2026-11-01: drawn over the bar being written, as
 * Dorico shows its rhythmic grid): an x for each grid line from the bar's start to its end, `beat` on the
 * bar's beats. Lines fall along each column's room as time goes (`xAlong`), notes included.
 */
export function gridLines(placed: PlacedBar, step: number): { x: number; beat: boolean }[] {
  if (step <= 0 || placed.columns.length === 0) return [];
  const lines: { x: number; beat: boolean }[] = [];
  let start = 0;
  for (const c of placed.columns) {
    const span = c.column.grace ? 0 : ticks(c.column.duration);
    for (let line = Math.ceil(start / step) * step; line < start + span; line += step) {
      lines.push({ x: xAlong(c, line - start), beat: line % placed.beat === 0 });
    }
    start += span;
  }
  return lines;
}
