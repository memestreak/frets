/**
 * Shift+drag from blank space (issue #238, as MuseScore's): a rectangle, and the run of columns whose
 * notes it takes in. Pure, in the drawing's units.
 */
import type { Layout } from './layout';

export interface Rectangle {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * The first and last column (places in the clip) drawn inside the rectangle: across its width, on a
 * line whose staff or tab it crosses. Null when it takes in none.
 */
export function columnsInRectangle(layout: Layout, rect: Rectangle): [number, number] | null {
  const [left, right] = [Math.min(rect.x0, rect.x1), Math.max(rect.x0, rect.x1)];
  const [top, bottom] = [Math.min(rect.y0, rect.y1), Math.max(rect.y0, rect.y1)];
  const inside: number[] = [];
  for (const system of layout.systems) {
    const { rows } = system;
    const bandTop = system.top + (rows.score ? rows.score.top : rows.staffTop);
    const bandBottom = system.top + (rows.tab ? rows.staffBottom : rows.score!.bottom);
    if (bottom < bandTop || top > bandBottom) continue;
    for (const bar of system.bars) for (const column of bar.columns) if (column.x >= left && column.x <= right) inside.push(column.index);
  }
  return inside.length ? [Math.min(...inside), Math.max(...inside)] : null;
}
