/**
 * Moving music earlier or later in time, a grid step at a time (issue #473): Dorico's Alt+← → in Write
 * mode, and a sideways drag. What moves keeps its length and is written over what it lands on; the
 * time it leaves becomes a Gap, so bars stay full (`docs/specs/2026-11-13-tab-move-in-time-design.md`).
 * Pure: each returns the edited Part and where the cursor and selection go, or null when nothing moves.
 */

import { ticks, type Column, type Part } from './clip';
import { unbeamed } from './beams';
import { columnAt, indexOf, normalize, placeOf, selectedRange, type Cursor, type Selection, type Target } from './editing';
import { readVoice } from './sounding';
import { lineAt, type Layout } from './layout';
import { lengthAnchor } from './ties';
import { placeAtTime, timeOf, withoutTimeMarks, writeOver, writeSpan } from './timeline';

export interface TimeMove {
  clip: Part;
  cursor: Cursor;
  selection: Selection | null;
}

/**
 * The target moved `by` ticks (negative: earlier). A selection of several Columns moves as one block; a
 * picked note or Column moves its whole chord, as Dorico's do (a Column has one time; a note leaves its
 * chord only for another Voice). A Tie chain moves whole. Null when nothing can move: a rest, a grace
 * note, a note in a tuplet, a move before the clip's start, or one that would put a tuplet across a bar
 * line.
 */
export function moveInTime(clip: Part, target: Target, by: number): TimeMove | null {
  if (by === 0) return null;
  const { selection } = target;
  if (selection && selection.anchor !== selection.focus) return moveRun(clip, selection, target.cursor.string, by);
  const pressed = selection ? { ...target.cursor, ...placeOf(clip, selection.anchor) } : target.cursor;
  const column = columnAt(clip, pressed);
  if (!column || column.grace || column.duration.tuplet) return null;
  return moveChord(clip, pressed, by);
}

/** The pressed Column's chord, with its Tie chains, `by` ticks later. */
function moveChord(clip: Part, pressed: Cursor, by: number): TimeMove | null {
  const at = lengthAnchor(clip, pressed);
  if (!at) return null;
  const column = columnAt(clip, at)!;
  const start = timeOf(clip, at.bar, at.column);
  // The chord's Sounding notes all end here at the latest (a Tie chain runs on past its Column).
  const ends = readVoice(clip).notes.filter(n => n.start === start).map(n => n.start + n.length);
  const end = Math.max(start + ticks(column.duration), ...ends);
  return moveSpan(unmarked(clip, [at]), start, end, by, unbeamed(column), at.string);
}

/**
 * The Part with the time marks (a Text, chord name, fermata, wah or dynamic) of the Columns at `places`
 * taken off: they move with their Column, so the time it leaves keeps none of them (writing over it
 * would otherwise keep them there too).
 */
function unmarked(clip: Part, places: { bar: number; column: number }[]): Part {
  const bars = clip.bars.map(bar => ({ ...bar, columns: [...bar.columns] }));
  for (const { bar, column } of places) bars[bar].columns[column] = withoutTimeMarks(bars[bar].columns[column]);
  return { ...clip, bars };
}

/**
 * `column` taken from `start`–`end` and written `by` ticks later, as long as it was (the meter ties it
 * where it needs); the time it leaves becomes a Gap.
 */
function moveSpan(clip: Part, start: number, end: number, by: number, column: Column, string: number): TimeMove | null {
  const to = start + by;
  if (to < 0) return null;
  const cleared = writeOver(clip, start, [], end);
  if (!cleared) return null;
  const written = writeSpan(cleared, to, column, end - start);
  if (!written) return null;
  const next = normalize(written);
  const place = placeAtTime(next, to);
  return { clip: next, cursor: { ...place, string }, selection: null };
}

/** The selected Columns moved `by` ticks later as one block; the selection stays on them. */
function moveRun(clip: Part, selection: Selection, string: number, by: number): TimeMove | null {
  const [from, to] = selectedRange(selection);
  const first = placeOf(clip, from);
  const last = placeOf(clip, to);
  const columns: Column[] = [];
  const places: { bar: number; column: number }[] = [];
  for (let i = from; i <= to; i++) {
    const place = placeOf(clip, i);
    places.push(place);
    columns.push(unbeamed(clip.bars[place.bar].columns[place.column]));
  }
  // Only rests: nothing to move.
  if (columns.every(c => !c.grace && !c.notes.some(Boolean))) return null;
  const start = timeOf(clip, first.bar, first.column);
  const lastColumn = clip.bars[last.bar].columns[last.column];
  const end = timeOf(clip, last.bar, last.column) + (lastColumn.grace ? 0 : ticks(lastColumn.duration));
  const dest = start + by;
  if (dest < 0) return null;
  const cleared = writeOver(unmarked(clip, places), start, [], end);
  const written = cleared && writeOver(cleared, dest, columns);
  if (!written) return null;
  const next = normalize(written);
  const head = placeAtTime(next, dest);
  const tail = placeAtTime(next, dest + (end - start) - 1);
  return {
    clip: next,
    cursor: { ...head, string },
    selection: { anchor: indexOf(next, head.bar, head.column), focus: indexOf(next, tail.bar, tail.column) },
  };
}

/**
 * How far one Alt+← → moves the target with no fixed grid: the length of the note it starts with (the
 * picked chord's, or the selection's first note's), as the grid in note input mode is that mode's length.
 * Null when it starts with no note.
 */
export function ownStep(clip: Part, target: Target): number | null {
  const { selection } = target;
  if (selection && selection.anchor !== selection.focus) {
    const [from, to] = selectedRange(selection);
    for (let i = from; i <= to; i++) {
      const place = placeOf(clip, i);
      const column = clip.bars[place.bar].columns[place.column];
      if (!column.grace && column.notes.some(Boolean)) return ticks(column.duration);
    }
    return null;
  }
  const pressed = selection ? { ...target.cursor, ...placeOf(clip, selection.anchor) } : target.cursor;
  const column = columnAt(clip, pressed);
  return column && column.notes.some(Boolean) ? ticks(column.duration) : null;
}

/**
 * The time under the pointer at `x` on the line at `y`, in ticks from the clip's start: through a
 * column's room as time goes (as `xAlong` draws the grid), before the first column its start, past a
 * line's last bar its end. A drag in time (`TimeDrag`) measures how far it has gone with it. Null off
 * every line.
 */
export function timeAtX(layout: Layout, part: Part, x: number, y: number): number | null {
  const line = lineAt(layout, y) ?? (y < 0 ? null : { system: layout.systems[layout.systems.length - 1] });
  const bars = line?.system.bars;
  if (!bars || bars.length === 0) return null;
  const placed = bars.find(b => x < b.x1) ?? bars[bars.length - 1];
  const columns = placed.columns;
  if (columns.length === 0) return timeOf(part, placed.index, 0);
  let c = 0;
  while (c + 1 < columns.length && columns[c + 1].x <= x) c++;
  const column = columns[c];
  const length = column.column.grace ? 0 : ticks(column.column.duration);
  const through = column.width > 0 ? Math.min(1, Math.max(0, (x - column.x) / column.width)) : 0;
  const place = placeOf(part, column.index);
  return timeOf(part, place.bar, place.column) + through * length;
}
