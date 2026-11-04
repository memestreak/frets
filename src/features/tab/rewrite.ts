/**
 * Rests are Gaps (`docs/specs/2026-11-03-tab-rests-are-gaps-design.md`): after an edit, the bars whose
 * rhythm it changed are written again by the meter, and the cursor and selection follow them by time.
 * Pure; no React. A bar whose rhythm didn't change keeps its Columns, so an imported bar keeps its own
 * rests until its rhythm is edited.
 */
import { ticks, type Bar, type Part } from './clip';
import { indexOf, placeOf, type Cursor, type Selection } from './editing';
import { readVoice, writeVoice, type ReadVoice } from './sounding';

/**
 * A bar's rhythm, as text to compare: its time and length, the spans its notes sound for in it (a
 * chord's strings and frets aside, so a note added to a chord or moved to another string is no
 * change), where its grace notes and tuplets are.
 */
function rhythmOf(read: ReadVoice, b: number): string {
  const { start, length, time, byMeter } = read.bars[b];
  const end = start + length;
  const spans = new Set<string>();
  for (const n of read.notes) {
    const to = n.start + n.length;
    if (n.start >= end || to <= start || (length === 0 && n.start !== start)) continue;
    spans.add(`${Math.max(n.start, start) - start}${n.start < start ? '<' : ''}-${Math.min(to, end) - start}${to > end ? '>' : ''}`);
  }
  const graces = read.graces.filter(g => g.bar === b).map(g => g.at - start);
  const tuplets = read.tuplets.filter(t => t.bar === b).map(t => `${t.start - start}-${t.end - start}`);
  return JSON.stringify([time.beats, time.value, length, byMeter, [...spans].sort(), graces, tuplets]);
}

/** The bars of `after` whose rhythm differs from `before`'s: those between the bars the two share at each end. */
function changedBars(before: ReadVoice, after: ReadVoice): number[] {
  const was = before.bars.map((_, b) => rhythmOf(before, b));
  const now = after.bars.map((_, b) => rhythmOf(after, b));
  let head = 0;
  while (head < was.length && head < now.length && was[head] === now[head]) head++;
  let tail = 0;
  while (tail < was.length - head && tail < now.length - head && was[was.length - 1 - tail] === now[now.length - 1 - tail]) tail++;
  const changed: number[] = [];
  for (let b = head; b < now.length - tail; b++) changed.push(b);
  return changed;
}

/** The bar each tick falls in (a bar's end is the next bar's start). */
function barAt(read: ReadVoice, at: number): number {
  for (let b = read.bars.length - 1; b >= 0; b--) if (read.bars[b].start <= at) return b;
  return 0;
}

/** `bars` and every bar a Tie chain sounding in one of them touches (spec Q8). */
function withChains(read: ReadVoice, bars: number[]): number[] {
  const out = new Set(bars);
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of read.notes) {
      const first = barAt(read, n.start);
      const last = barAt(read, n.start + n.length - 1);
      if (first === last) continue;
      let touches = false;
      for (let b = first; b <= last; b++) if (out.has(b)) touches = true;
      if (!touches) continue;
      for (let b = first; b <= last; b++) {
        if (!out.has(b)) {
          out.add(b);
          grew = true;
        }
      }
    }
  }
  return [...out].sort((x, y) => x - y);
}

/**
 * `after` (an edit of `before`) with every bar whose rhythm the edit changed written again by the
 * meter, as are the bars a changed Tie chain touches. Bars that don't add up come back as they are
 * (`writeVoice`). `after` itself when nothing needs writing.
 */
export function rewrite(before: Part, after: Part): Part {
  if (before === after) return after;
  const read = readVoice(after);
  const bars = withChains(read, changedBars(readVoice(before), read));
  if (bars.length === 0) return after;
  const written = writeVoice(after, read, { bars });
  // Keep `after` itself when writing changed nothing, so an edit stays the very edit made.
  return written.bars.every((bar, b) => bar === after.bars[b] || sameColumns(bar, after.bars[b])) ? after : written;
}

function sameColumns(a: Bar, b: Bar): boolean {
  return JSON.stringify(a.columns) === JSON.stringify(b.columns);
}

/* — following the cursor and selection by time — */

/** Each Column's start in its bar, in ticks; a grace note starts where the note after it does. */
function columnStarts(bar: Bar): number[] {
  const out: number[] = [];
  let t = 0;
  for (const column of bar.columns) {
    out.push(t);
    if (!column.grace) t += ticks(column.duration);
  }
  return out;
}

/**
 * The Column of `to`'s bar that holds the time Column `column` of `from`'s bar starts at (`end`:
 * the time just before it ends): the one starting there, else the one that time falls inside.
 */
function columnAtTime(from: Bar, to: Bar, column: number, end = false): number {
  if (from === to || to.columns.length === 0) return Math.min(column, Math.max(0, to.columns.length - 1));
  const starts = columnStarts(from);
  const c = Math.min(column, from.columns.length - 1);
  if (c < 0) return 0;
  const at = end ? starts[c] + (from.columns[c].grace ? 0 : ticks(from.columns[c].duration)) - 1 : starts[c];
  const now = columnStarts(to);
  let found = 0;
  for (let k = 0; k < to.columns.length; k++) {
    if (to.columns[k].grace) continue;
    if (now[k] <= at) found = k;
    else break;
  }
  if (!end && from.columns[c].grace) {
    // A grace note keeps its place among the grace notes before the same note.
    const ordinal = starts.slice(0, c).filter((t, k) => t === starts[c] && from.columns[k].grace).length;
    const graces = now.flatMap((t, k) => (t === starts[c] && to.columns[k].grace ? [k] : []));
    if (graces.length > 0) return graces[Math.min(ordinal, graces.length - 1)];
  }
  return found;
}

/** The cursor of `from` as a cursor of `to` (the same bars, some written again): the same time and string. */
export function cursorAtTime(from: Part, to: Part, cursor: Cursor): Cursor {
  const bar = from.bars[cursor.bar];
  const now = to.bars[cursor.bar];
  if (!bar || !now || bar === now) return cursor;
  return { ...cursor, column: columnAtTime(bar, now, cursor.column) };
}

/**
 * The selection of `from` as a selection of `to`: the same stretch of time, widened to whole written
 * notes and rests, in the same direction.
 */
export function selectionAtTime(from: Part, to: Part, selection: Selection | null): Selection | null {
  if (!selection || from === to) return selection;
  const low = Math.min(selection.anchor, selection.focus);
  const high = Math.max(selection.anchor, selection.focus);
  const place = (index: number, end: boolean) => {
    const { bar, column } = placeOf(from, index);
    const now = to.bars[bar];
    if (!now) return index;
    return indexOf(to, bar, columnAtTime(from.bars[bar], now, column, end));
  };
  const start = place(low, false);
  const end = place(high, true);
  return selection.anchor <= selection.focus ? { anchor: start, focus: end } : { anchor: end, focus: start };
}
