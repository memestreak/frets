/**
 * The bar lines a press can pick (issue #276): a repeat's start and end, a repeat's ×N count and a
 * double bar line. Where each is and the box a press finds it by, on the tab and on the notation staff.
 * Pure; the boxes follow what `TabClip.tsx` and `StaffDrawing.tsx` draw.
 */
import { lineAt, type Layout, type System } from './layout';

/** A picked bar line: what it is, and its bar. A repeat's end and its count are picked apart. */
export type BarLineHit = { kind: 'repeatStart' | 'repeatEnd' | 'repeatCount' | 'doubleBar'; bar: number };

export interface BarLineBox {
  hit: BarLineHit;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A repeat's count over its end, as drawn ("×3"); a repeat played twice has none. */
export function repeatCountText(times: number): string {
  return `×${times}`;
}
export const REPEAT_COUNT_SIZE = 11;
const REPEAT_COUNT_WIDTH = 16;

/** How far a bar line's box reaches past what is drawn, so the mouse finds it. */
const REACH = 3;
/** A press this near a column's middle is on its note, not a bar line. */
const NOTE_REACH = 7;

/** Every picked-able bar line drawn on a line of music, in the line's own units (y from its top). */
function systemBoxes(system: System, lastBar: number): BarLineBox[] {
  const { rows } = system;
  // A bar line is drawn on the tab and on the staff: a box on each.
  const staves: [number, number][] = [];
  if (rows.score) staves.push([rows.score.top, rows.score.bottom]);
  if (rows.tab) staves.push([rows.staffTop, rows.staffBottom]);
  const out: BarLineBox[] = [];
  for (const bar of system.bars) {
    const { x0, x1 } = bar;
    const add = (kind: BarLineHit['kind'], left: number, right: number) => {
      for (const [top, bottom] of staves) {
        out.push({ hit: { kind, bar: bar.index }, x: left - REACH, y: top - REACH, width: right - left + 2 * REACH, height: bottom - top + 2 * REACH });
      }
    };
    // As drawn: a thick and a thin line and two dots at a repeat's start, the dots and a thin and a thick line at its end.
    if (bar.bar.repeatStart) add('repeatStart', x0, x0 + 14);
    if (bar.bar.repeatEnd !== undefined) {
      add('repeatEnd', x1 - 13, x1);
      // The count is written over the tab's end of the bar, on the endings' row.
      if (bar.bar.repeatEnd !== 2 && rows.tab && rows.endings !== null) {
        const y = rows.endings - 7;
        out.push({ hit: { kind: 'repeatCount', bar: bar.index }, x: x1 - REPEAT_COUNT_WIDTH - REACH, y, width: REPEAT_COUNT_WIDTH + 2 * REACH, height: 16 });
      }
    } else if (bar.bar.doubleBar && bar.index !== lastBar) {
      // The last bar's closing line is the final one, which a double bar doesn't change.
      add('doubleBar', x1 - 4, x1);
    }
  }
  return out;
}

/** Every bar line a press can pick, in the tab's units, top line first. */
export function barLineBoxes(layout: Layout): BarLineBox[] {
  const lastBar = Math.max(-1, ...layout.systems.flatMap(s => s.bars.map(b => b.index)));
  return layout.systems.flatMap(system => systemBoxes(system, lastBar).map(box => ({ ...box, y: box.y + system.top })));
}

/** The bar line under a point; null when there is none, or when the point is on a column's note. */
export function barLineAt(layout: Layout, x: number, y: number): BarLineHit | null {
  const line = lineAt(layout, y);
  if (!line) return null;
  if (line.system.bars.some(bar => bar.columns.some(c => Math.abs(c.x - x) <= NOTE_REACH))) return null;
  const box = barLineBoxes(layout).find(b => x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height);
  return box?.hit ?? null;
}

/** The box round a picked bar line (the topmost, where it is drawn on the staff and the tab); null when it isn't drawn. */
export function barLineBox(layout: Layout, hit: BarLineHit): BarLineBox | null {
  return barLineBoxes(layout).find(b => b.hit.kind === hit.kind && b.hit.bar === hit.bar) ?? null;
}

export function isBarLine(hit: { kind: string }): hit is BarLineHit {
  return hit.kind === 'repeatStart' || hit.kind === 'repeatEnd' || hit.kind === 'repeatCount' || hit.kind === 'doubleBar';
}
