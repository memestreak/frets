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
import { chainPlaces, chainTicks, lengthAnchor } from './ties';
import { placeAtTime, pullTime, pushTime, timeOf, withoutAddedRests, withoutTimeMarks, writeNote, writeOver, writeSpan } from './timeline';

export interface TimeMove {
  clip: Part;
  cursor: Cursor;
  selection: Selection | null;
}

/**
 * The target moved `by` ticks (negative: earlier). A selection of several Columns moves as one block; a
 * picked chord moves whole; a note picked by itself (`alone`) moves alone, leaving the rest of its chord
 * (Jeremy, 2026-11-14), unless it is the chord's only note. A Tie chain moves whole. Null when nothing
 * can move: a rest, a grace note, a note in a tuplet, a move before the clip's start, or one that would
 * put a tuplet across a bar line.
 */
export function moveInTime(clip: Part, target: Target, by: number, alone = false): TimeMove | null {
  if (by === 0) return null;
  const { selection } = target;
  if (selection && selection.anchor !== selection.focus) return moveRun(clip, selection, target.cursor.string, by);
  const pressed = selection ? { ...target.cursor, ...placeOf(clip, selection.anchor) } : target.cursor;
  const column = columnAt(clip, pressed);
  if (!column || column.grace || column.duration.tuplet) return null;
  if (alone && !selection && column.notes[pressed.string] && hasOthers(clip, pressed)) return moveNote(clip, pressed, by);
  return moveChord(clip, pressed, by);
}

/**
 * Insert mode's move in time (`docs/specs/2026-11-14-tab-insert-mode-design.md`, Jeremy 2026-11-15): nothing
 * is written over. Later, a Gap `by` long goes in before the target, so it and all the music after it move
 * on in every Voice of the Track (bars of rests it adds at the end dropped). Earlier, the time before it is
 * taken out, pulling it and the music after it back, but only when that time is quiet in every Voice: rests
 * and Gaps, no note sounding into it and no mark on them. The whole Column moves (a note picked alone too:
 * the time is the Track's). Null when nothing can move: a rest picked alone, a grace note, a note in a
 * tuplet, a move before the clip's start or over music, or a push that would put a tuplet across a bar line.
 */
export function shiftInTime(clip: Part, target: Target, by: number): TimeMove | null {
  if (by === 0) return null;
  const { cursor, selection } = target;
  const first = selection ? selectedRange(selection)[0] : indexOf(clip, cursor.bar, cursor.column);
  const place = placeOf(clip, first);
  const column = clip.bars[place.bar]?.columns[place.column];
  if (!column || column.grace || column.duration.tuplet) return null;
  if (!(selection && selection.anchor !== selection.focus) && !column.notes.some(Boolean)) return null;
  const start = timeOf(clip, place.bar, place.column);
  let moved: Part | null;
  if (by > 0) {
    const pushed = pushTime(clip, start, by);
    moved = pushed && withoutAddedRests(clip, pushed);
  } else moved = start + by >= 0 && isQuiet(clip, start + by, start) ? pullTime(clip, start + by, start) : null;
  if (!moved) return null;
  const after = moved;
  // Each Column keeps its place in the music: where it starts, `by` later.
  const mapped = (index: number) => {
    const from = placeOf(clip, index);
    const to = placeAtTime(after, timeOf(clip, from.bar, from.column) + by);
    return indexOf(after, to.bar, to.column);
  };
  const to = placeAtTime(after, timeOf(clip, cursor.bar, cursor.column) + by);
  return {
    clip: after,
    cursor: { ...cursor, ...to },
    selection: selection && { anchor: mapped(selection.anchor), focus: mapped(selection.focus) },
  };
}

/** Whether every Voice is quiet from `from` to `to`: plain rests (or an empty bar's room), no note sounding into it. */
function isQuiet(clip: Part, from: number, to: number): boolean {
  return clip.bars.every((bar, b) => {
    const barStart = timeOf(clip, b, 0);
    return [bar.columns, ...(bar.otherVoices ?? []).map(o => o.columns)].every(columns => {
      let t = barStart;
      return columns.every(c => {
        if (c.grace) return !(t >= from && t < to);
        const end = t + ticks(c.duration);
        const overlaps = t < to && end > from;
        t = end;
        return !overlaps || (c.notes.every(n => n === null) && Object.keys(c).every(k => k === 'duration' || k === 'notes'));
      });
    });
  });
}

/** Whether a Column the note at `at` is written in (any of its Tie chain's) has another note. */
function hasOthers(clip: Part, at: Cursor): boolean {
  return chainPlaces(clip, at).some(p => clip.bars[p.bar].columns[p.column].notes.some((n, s) => n && s !== at.string));
}

/**
 * The note at `pressed`, with its Tie chain, `by` ticks later on its own string; the rest of its chord
 * stays. Its time on that string becomes a Gap; where it lands it writes over that string only.
 */
function moveNote(clip: Part, pressed: Cursor, by: number): TimeMove | null {
  const places = chainPlaces(clip, pressed);
  const first = places[0];
  const string = pressed.string;
  const note = clip.bars[first.bar].columns[first.column].notes[string]!;
  const start = timeOf(clip, first.bar, first.column);
  const to = start + by;
  if (to < 0) return null;
  const bars = clip.bars.map(bar => ({ ...bar, columns: [...bar.columns] }));
  for (const p of places) {
    const column = bars[p.bar].columns[p.column];
    const notes = [...column.notes];
    notes[string] = null;
    bars[p.bar].columns[p.column] = { ...column, notes };
  }
  const written = writeNote({ ...clip, bars }, to, string, note, chainTicks(clip, pressed));
  if (!written) return null;
  const next = normalize(written);
  return { clip: next, cursor: { ...placeAtTime(next, to), string }, selection: null };
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
