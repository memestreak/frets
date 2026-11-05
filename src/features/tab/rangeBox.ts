/**
 * The box round a selected run of columns (`docs/specs/2026-11-01-tab-selection-look-design.md`), and
 * the Range handles on its two ends that drag either end of the run
 * (`docs/specs/2026-11-05-tab-range-handles-design.md`). Pure; works on a `layoutClip` layout, in the
 * drawing's units.
 */
import { STRING_COUNT } from './clip';
import { lineAt, stringY, type Layout, type System } from './layout';
import type { Selection } from './editing';

/** How far the box round a selected run reaches past the staff's top and the tab's bottom line. */
const RANGE_PAD = 10;

export interface RangeBox {
  system: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where a column's room starts and ends on its line: a bar's first starts at the bar line, a bar's last ends at the next, others halfway to their neighbours. */
function roomsOf(system: System): { index: number; start: number; end: number }[] {
  return system.bars.flatMap(bar => bar.columns.map((placed, k) => ({
    index: placed.index,
    start: k === 0 ? bar.x0 : (bar.columns[k - 1].x + placed.x) / 2,
    end: k === bar.columns.length - 1 ? bar.x1 : (placed.x + bar.columns[k + 1].x) / 2,
  })));
}

/**
 * The box round a selected run of columns on each line it reaches (issue #276): from the staff's top (or the
 * tab's top line) to the tab's bottom line (or the staff's bottom; with the tab alone, the foot of its stems), across the run's columns. Where the run
 * takes a bar from its first column it starts at the bar line, and where it takes it to its last it ends
 * at the next, so a whole bar is boxed bar line to bar line; inside a bar it ends halfway between notes.
 */
export function rangeBoxes(systems: System[], [from, to]: [number, number]): RangeBox[] {
  const boxes: RangeBox[] = [];
  systems.forEach((system, si) => {
    const rooms = roomsOf(system).filter(r => r.index >= from && r.index <= to);
    if (rooms.length === 0) return;
    const left = Math.min(...rooms.map(r => r.start));
    const right = Math.max(...rooms.map(r => r.end));
    const { top, bottom } = boxSpan(system.rows);
    boxes.push({ system: si, x: left, y: system.top + top, width: right - left, height: bottom - top });
  });
  return boxes;
}

/** How high a selection box reaches on a line, from its system's top: the staff's top (or the tab's top line) to the tab's bottom line (or the staff's bottom). */
export function boxSpan(rows: System['rows']): { top: number; bottom: number } {
  const top = (rows.score ? rows.score.top : stringY(rows, 0)) - RANGE_PAD;
  // With the tab alone its rhythm, rests too, is under the strings: the box takes it in.
  const bottom = rows.tabStems ? rows.stemBottom + 4 : (rows.tab ? stringY(rows, STRING_COUNT - 1) : rows.score!.bottom) + RANGE_PAD;
  return { top, bottom };
}

/** Which end of a selected run a Range handle drags. */
export type RangeEnd = 'start' | 'end';

/** A Range handle: the end it drags, the line it is on, and the box edge it sits on, top to bottom. */
export interface RangeHandle {
  end: RangeEnd;
  system: number;
  x: number;
  top: number;
  bottom: number;
}

/** The two Range handles of a selected run: on the left edge of its first box and the right edge of its last. */
export function rangeHandles(layout: Layout, range: [number, number]): RangeHandle[] {
  const boxes = rangeBoxes(layout.systems, range);
  if (boxes.length === 0) return [];
  const first = boxes[0];
  const last = boxes[boxes.length - 1];
  return [
    { end: 'start', system: first.system, x: first.x, top: first.y, bottom: first.y + first.height },
    { end: 'end', system: last.system, x: last.x + last.width, top: last.y, bottom: last.y + last.height },
  ];
}

/**
 * How a Range handle is drawn, while Jeremy picks one (`?handles=`): a knob half way down the box's edge
 * (as a Span's Handle), a grip bar along the whole edge, or a pin at its top (start) or foot (end).
 */
export type RangeHandleLook = 'knob' | 'bar' | 'pin';

/** Where a knob or pin's centre is on its edge. */
export function knobY(handle: RangeHandle, look: RangeHandleLook): number {
  if (look === 'pin') return handle.end === 'start' ? handle.top : handle.bottom;
  return (handle.top + handle.bottom) / 2;
}

/** How far round a knob or pin, and across from a grip bar's edge, a press takes it. */
export const RANGE_HANDLE_REACH = 10;

/** The Range handle under a press, or null; the nearer one where both reach. */
export function rangeHandleAt(handles: readonly RangeHandle[], x: number, y: number, look: RangeHandleLook = 'knob'): RangeHandle | null {
  let best: { handle: RangeHandle; off: number } | null = null;
  for (const handle of handles) {
    const across = Math.abs(handle.x - x);
    if (across > RANGE_HANDLE_REACH) continue;
    // A grip bar is taken anywhere along its edge; a knob or pin only round itself.
    const down = look === 'bar' ? (y < handle.top ? handle.top - y : y > handle.bottom ? y - handle.bottom : 0) : Math.abs(knobY(handle, look) - y);
    if (down > RANGE_HANDLE_REACH) continue;
    const off = Math.hypot(across, down);
    if (!best || off < best.off) best = { handle, off };
  }
  return best?.handle ?? null;
}

/**
 * Where a dragged Range handle lands: the column whose room is under the pointer, so the note pointed at
 * is taken in, as a Shift+press takes it in; on the line under the pointer, or the nearest line above or
 * below the drawing. Past a line's first or last column, that column. Unlike a Span's Handle, a Range
 * handle can go to another line.
 */
export function rangeEndAt(layout: Layout, x: number, y: number): number | null {
  const { systems } = layout;
  if (systems.length === 0) return null;
  const si = lineAt(layout, y)?.si ?? (y < 0 ? 0 : systems.length - 1);
  let best: { index: number; off: number } | null = null;
  for (const room of roomsOf(systems[si])) {
    const off = x < room.start ? room.start - x : x > room.end ? x - room.end : 0;
    if (!best || off < best.off) best = { index: room.index, off };
  }
  return best?.index ?? null;
}

/**
 * The selection after a Range handle's end is dragged to `column`: the other end stays where it is, as the
 * anchor, and the dragged end is the focus, so Shift+arrows go on from it. Dragged past the other end, it
 * stops there: the run is at least one column.
 */
export function draggedRange([from, to]: [number, number], end: RangeEnd, column: number): Selection {
  return end === 'start'
    ? { anchor: to, focus: Math.min(column, to) }
    : { anchor: from, focus: Math.max(column, from) };
}

/** A Range handle dragged: the column its end is over, as it moves, when it lets go, or called off with Esc. */
export interface RangeDrag {
  end: RangeEnd;
  column: number;
  done: boolean;
  cancelled: boolean;
}
