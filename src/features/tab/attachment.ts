/**
 * What a picked Mark belongs to, drawn while it is picked
 * (`docs/specs/2026-11-04-tab-pick-every-mark-design.md`): the notes it is on, tinted; its Attachment
 * line to them; and a picked Span's Handles. Pure; works on a `layoutClip` layout, in the drawing's units.
 */
import type { Note } from './clip';
import { lineAt, SPACE, stepY, stringY, type Layout, type PlacedBar, type PlacedColumn, type System } from './layout';
import { staffRest } from './staffGeometry';
import { textBox, type WordHit } from './layoutText';
import { markBoxes, sameMark, type Box, type MarkHit } from './marks';
import { isSpan } from './spans';

/** A note to tint: its column's place in the clip and its string. */
export interface TintedNote {
  index: number;
  string: number;
}

/** A line from (x, y0) to (x, y1), in the whole drawing's units. */
export interface AttachmentLine {
  x: number;
  y0: number;
  y1: number;
}

/** A Span's Handle: which end, and where its centre is, in the whole drawing's units. */
export interface Handle {
  end: 'start' | 'end';
  /** The line of tab it is on, which a drag stays on. */
  system: number;
  x: number;
  y: number;
}

/** A rest on the staff, tinted as a note is: its line of tab, and its box in that line's units. */
export interface TintedRest {
  system: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Attachment {
  tint: TintedNote[];
  lines: AttachmentLine[];
  handles: Handle[];
  /** The rest a picked word over a rest is on (issue #393). */
  rests: TintedRest[];
}

const NONE: Attachment = { tint: [], lines: [], handles: [], rests: [] };

/** How far a line stops short of a rest, and a tinted rest's margin round it. */
const REST_EDGE = 2;

/** Marks drawn touching their note already: no line (Q10). */
const TOUCHING = new Set(['bend', 'slideOut', 'tap', 'slide', 'tie', 'legato']);
/** Joins drawn from the note before on the string: both notes are tinted (Q19). */
const JOINS = new Set(['slide', 'tie', 'legato']);

/** How far outside a Span's drawn ends its Handles sit, clear of its label and line. */
const HANDLE_GAP = 2;

/** How far a line stops short of a number's middle, and of a head's. */
const NUMBER_EDGE = 7;
const HEAD_EDGE = SPACE / 2 + 1;

/** A placed column, with its line of tab and its bar. */
interface Placed {
  placed: PlacedColumn;
  system: number;
  bar: PlacedBar;
}

/** Every placed column of the layout by its place in the clip, with its line of tab. */
function placedColumns(layout: Layout): Map<number, Placed> {
  const out = new Map<number, Placed>();
  layout.systems.forEach((system, si) => {
    for (const bar of system.bars) for (const placed of bar.columns) out.set(placed.index, { placed, system: si, bar });
  });
  return out;
}

/** The strings a column has notes on. */
function noteStrings(placed: PlacedColumn): number[] {
  return placed.column.notes.flatMap((n: Note | null, s) => (n ? [s] : []));
}

/** The place of the note before `index` on `string`, or null. */
function noteBefore(columns: Map<number, { placed: PlacedColumn }>, index: number, string: number): number | null {
  for (let i = index - 1; i >= 0; i--) {
    const c = columns.get(i);
    if (c?.placed.column.notes[string]) return i;
  }
  return null;
}

/** The notes a picked Mark or word is on (Q19): none for what belongs to a bar. */
function tintOf(picked: MarkHit | WordHit, columns: Map<number, { placed: PlacedColumn }>): TintedNote[] {
  const whole = (from: number, to: number) => {
    const out: TintedNote[] = [];
    for (let i = from; i <= to; i++) {
      const c = columns.get(i);
      if (c) for (const string of noteStrings(c.placed)) out.push({ index: i, string });
    }
    return out;
  };
  // A chord belongs to its time, not its notes (Jeremy, 2026-11-06): none is tinted.
  if (picked.kind === 'chord') return [];
  if (picked.kind === 'text') return whole(picked.index, picked.index);
  if (picked.kind !== 'mark') return [];
  if (picked.string === null) return whole(picked.index, picked.to ?? picked.index);
  const own = { index: picked.index, string: picked.string };
  if (!JOINS.has(picked.mark)) return [own];
  const before = noteBefore(columns, picked.index, picked.string);
  return before === null ? [own] : [{ index: before, string: picked.string }, own];
}

/**
 * A line from a mark's box straight up or down to the nearest note of column `index` on the same line of
 * tab (Q11): the top note for a mark over it, the bottom one for a mark under it; a head on the staff
 * when the mark was picked there, or sits over the staff.
 */
function lineTo(layout: Layout, box: Box, at: { placed: PlacedColumn; system: number }, staff: boolean): AttachmentLine | null {
  const system: System = layout.systems[at.system];
  const { rows, top } = system;
  const { placed } = at;
  const middle = box.y + box.height / 2 - top;
  const strings = noteStrings(placed);
  const score = rows.score;
  const useStaff = score !== null && placed.heads.length > 0 && (staff || !rows.tab || middle < score.top);
  let target: number;
  if (useStaff) {
    const ys = placed.heads.map(h => stepY(score!, h.step));
    target = middle < Math.min(...ys) ? Math.min(...ys) - HEAD_EDGE : Math.max(...ys) + HEAD_EDGE;
  } else {
    if (strings.length === 0 || !rows.tab) return null;
    const ys = strings.map(s => stringY(rows, s));
    target = middle < Math.min(...ys) ? Math.min(...ys) - NUMBER_EDGE : Math.max(...ys) + NUMBER_EDGE;
  }
  const from = target < middle ? box.y - top : box.y + box.height - top;
  // A mark over its own number has nothing to draw.
  if ((target < middle && from <= target) || (target > middle && from >= target)) return null;
  return { x: placed.x, y0: top + from, y1: top + target };
}

/**
 * A chord name's line: from under its box (and diagram) down to the top line of the top staff at its
 * column's time, as Dorico draws a chord symbol's attachment line to its rhythmic position; a chord
 * belongs to its time, not to the notes there (Jeremy, 2026-11-06).
 */
function timeLine(layout: Layout, box: Box, at: Placed): AttachmentLine | null {
  const { rows, top } = layout.systems[at.system];
  const target = rows.score ? rows.score.top : rows.staffTop;
  const from = box.y + box.height - top;
  return from < target ? { x: at.placed.x, y0: top + from, y1: top + target } : null;
}

/**
 * The line from a word's box to the rest its column is (issue #393), and the rest to tint: with the staff
 * drawn and the word over it, the rest on the staff, or in a Whole-bar rest's bar the staff's top line
 * at the word's beat, the whole rest tinted; in the tab alone, which draws no rest, the top string at
 * the column's place.
 */
function restLine(layout: Layout, box: Box, at: Placed): { line: AttachmentLine | null; rests: TintedRest[] } {
  const { rows, top } = layout.systems[at.system];
  const middle = box.y + box.height / 2 - top;
  const score = rows.score;
  let x = at.placed.x;
  let target: number;
  const rests: TintedRest[] = [];
  if (score !== null && (!rows.tab || middle < score.top)) {
    const rest = staffRest(at.bar, at.placed, score);
    rests.push({ system: at.system, x: rest.x - REST_EDGE, y: rest.top - REST_EDGE, width: rest.width + 2 * REST_EDGE, height: rest.bottom - rest.top + 2 * REST_EDGE });
    if (at.bar.wholeRest) target = middle < score.top ? score.top : score.bottom;
    else {
      x = rest.x + rest.width / 2;
      target = middle < rest.top ? rest.top - REST_EDGE : rest.bottom + REST_EDGE;
    }
  } else if (rows.tab) {
    target = middle < stringY(rows, 0) ? stringY(rows, 0) : stringY(rows, 5);
  } else return { line: null, rests };
  const from = target < middle ? box.y - top : box.y + box.height - top;
  if ((target < middle && from <= target) || (target > middle && from >= target)) return { line: null, rests };
  return { line: { x, y0: top + from, y1: top + target }, rests };
}

/** What to draw for a picked Mark or word: its notes' tint, its Attachment lines and, for a Span, its Handles. */
export function attachment(layout: Layout, picked: MarkHit | WordHit | null, capo: number | null = null): Attachment {
  if (!picked) return NONE;
  const columns = placedColumns(layout);
  const tint = tintOf(picked, columns);
  if (picked.kind === 'chord') {
    const box = textBox(layout, picked, capo);
    const at = columns.get(picked.index);
    const line = box && at ? timeLine(layout, box, at) : null;
    return { tint, lines: line ? [line] : [], handles: [], rests: [] };
  }
  if (picked.kind === 'text') {
    const box = textBox(layout, picked, capo);
    const at = columns.get(picked.index);
    if (box && at && noteStrings(at.placed).length === 0 && !at.placed.column.grace) {
      const { line, rests } = restLine(layout, box, at);
      return { tint, lines: line ? [line] : [], handles: [], rests };
    }
    const line = box && at ? lineTo(layout, box, at, false) : null;
    return { tint, lines: line ? [line] : [], handles: [], rests: [] };
  }
  if (picked.kind !== 'mark') return { tint, lines: [], handles: [], rests: [] };
  // Where it was pressed, when it is drawn on both the staff and the tab; else wherever it is drawn.
  const drawn = markBoxes(layout).filter(m => sameMark(m.hit, picked));
  const pieces = drawn.some(m => m.hit.on === picked.on) ? drawn.filter(m => m.hit.on === picked.on) : drawn;
  if (pieces.length === 0) return { tint, lines: [], handles: [], rests: [] };
  const staff = picked.on === 'staff';
  const lines: AttachmentLine[] = [];
  const handles: Handle[] = [];
  const span = isSpan(picked.mark);
  const last = picked.to ?? picked.index;
  const ends = span && last !== picked.index ? [picked.index, last] : [picked.index];
  for (const { box } of pieces) {
    const system = lineAt(layout, box.y + box.height / 2)?.si ?? 0;
    // Each of the Mark's ends drawn on this line: a Span's first and last columns, else its own.
    for (const index of ends) {
      const at = columns.get(index);
      if (!at || at.system !== system) continue;
      if (!TOUCHING.has(picked.mark)) {
        const line = lineTo(layout, box, at, staff);
        if (line) lines.push(line);
      }
      if (span) {
        const y = box.y + box.height / 2;
        if (index === picked.index) handles.push({ end: 'start', system, x: box.x - HANDLE_GAP, y });
        if (index === last) handles.push({ end: 'end', system, x: box.x + box.width + HANDLE_GAP, y });
      }
    }
  }
  return { tint, lines, handles, rests: [] };
}

/** How far round a Handle's centre a press takes it, across and up or down. */
export const HANDLE_REACH = 10;

/** The Handle under a press, or null. */
export function handleAt(handles: readonly Handle[], x: number, y: number): Handle | null {
  let best: { handle: Handle; off: number } | null = null;
  for (const handle of handles) {
    const off = Math.hypot(handle.x - x, handle.y - y);
    if (Math.abs(handle.x - x) <= HANDLE_REACH && Math.abs(handle.y - y) <= HANDLE_REACH && (!best || off < best.off)) best = { handle, off };
  }
  return best?.handle ?? null;
}

/** The column on a line of tab nearest `x`, where a dragged Handle lands: a drag stays on its line (Q8). */
export function columnNear(layout: Layout, system: number, x: number): number | null {
  let best: { index: number; off: number } | null = null;
  for (const bar of layout.systems[system]?.bars ?? []) {
    for (const placed of bar.columns) {
      const off = Math.abs(placed.x - x);
      if (!best || off < best.off) best = { index: placed.index, off };
    }
  }
  return best?.index ?? null;
}
