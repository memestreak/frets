/**
 * The sign of a Strum or a Rolled chord (issue #384; `docs/specs/2026-11-09-tab-strums-rolled-chords-design.md`):
 * a vertical line beside the chord, straight for a Strum and wavy for a Rolled chord, with an arrowhead
 * at the end its roll finishes on, as alphaTab, Guitar Pro and Dorico draw them. A roll `down` starts
 * on the low string, so its arrow points up, to the high strings, on the staff and the tab alike.
 * Pure: the palette's icons, the tab (`ClipMarks.tsx`) and the staff (`StaffDrawing.tsx`) draw it.
 */
import type { Roll } from './clip';
import { stringY, type PlacedColumn } from './layout';
import type { Rows } from './rows';
import { charWidth, noteLabel, ROLL_ROOM } from './widths';

/** The arrowhead's height and half its width. */
const HEAD_HEIGHT = 6;
const HEAD_HALF = 3;
/** The wave's half period along the line, and how far it swings either side. */
const WAVE_STEP = 2.5;
const WAVE_SWING = 2;

/** The shortest a sign is drawn. */
const LEAST_LENGTH = 20;

export interface RollSignShape {
  /** The line, stroked. */
  line: string;
  /** The arrowhead, filled. */
  head: string;
}

/** Where a sign meant to reach from `from` to `to` is drawn: there, or longer beside one note, so it still reads as an arrow. */
export function rollSpan(from: number, to: number): { top: number; bottom: number } {
  const middle = (from + to) / 2;
  const half = Math.max((to - from) / 2, LEAST_LENGTH / 2);
  return { top: middle - half, bottom: middle + half };
}

/** Whether the roll's arrow points up the page: one that starts on the low string. */
export function pointsUp(roll: Pick<Roll, 'direction'>): boolean {
  return roll.direction === 'down';
}

/** The sign centred on x from `top` to `bottom`, its arrowhead at one end. */
export function rollSign(roll: Pick<Roll, 'sign' | 'direction'>, x: number, from: number, to: number): RollSignShape {
  const { top, bottom } = rollSpan(from, to);
  const up = pointsUp(roll);
  const tip = up ? top : bottom;
  const base = up ? top + HEAD_HEIGHT : bottom - HEAD_HEIGHT;
  const start = up ? bottom : top;
  const head = `M${x} ${tip} L${x - HEAD_HALF} ${base} L${x + HEAD_HALF} ${base} Z`;
  if (roll.sign === 'strum') return { line: `M${x} ${start} L${x} ${base}`, head };
  // A wave from the far end to the arrowhead, in whole half periods so it meets the head on the line.
  const steps = Math.max(2, Math.floor(Math.abs(base - start) / WAVE_STEP));
  const step = (base - start) / steps;
  let d = `M${x} ${start}`;
  for (let k = 0; k < steps; k++) {
    const side = k % 2 === 0 ? 1 : -1;
    d += ` Q${x + side * WAVE_SWING * 2} ${start + (k + 0.5) * step} ${x} ${start + (k + 1) * step}`;
  }
  return { line: d, head };
}

/** How far the sign reaches past the outer notes it stands beside. */
const TAB_REACH = 6;

/** Where a column's sign stands on the tab: left of its numbers, from its highest string to its lowest; null with none. */
export function tabRollPlace(placed: PlacedColumn, rows: Rows): { roll: Roll; x: number; top: number; bottom: number } | null {
  const { column } = placed;
  const strings = column.notes.flatMap((n, s) => (n ? [s] : []));
  if (!column.roll || !rows.tab || strings.length === 0) return null;
  const widest = Math.max(...strings.map(s => noteLabel(column.notes[s]!).length));
  const x = placed.x - (widest * charWidth(column)) / 2 - ROLL_ROOM / 2 - 1;
  return { roll: column.roll, x, ...rollSpan(stringY(rows, strings[0]) - TAB_REACH, stringY(rows, strings[strings.length - 1]) + TAB_REACH) };
}
