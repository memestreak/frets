/**
 * What a press on the drawn clip is on: a string at a column, a staff line or space, a gap between
 * columns, and where the cursor is drawn. Pure; works on a `layoutClip` layout.
 */

import { HEAD_WIDTH, type Layout, lineAt, SPACE, STRING_GAP, type ScoreRows, type System, stepY } from './layout';

/** Where a click lands: the bar under it, its nearest column (0 in an empty bar) and the nearest string. */
export interface Hit {
  bar: number;
  column: number;
  string: number;
}

/** How far above the top string and below the bottom one a press still lands on the staff, as the cursor's band reaches. */
export const STAFF_REACH = 10;

/** How near a note head a press on the notation staff must be: about a head's width across, a space up or down. */
const HEAD_REACH_X = HEAD_WIDTH;
const HEAD_REACH_Y = SPACE;

/** The tab note under a press on a note head of the notation staff: the nearest head within reach. */
function staffHeadAt(system: System, score: ScoreRows, x: number, localY: number): Hit | null {
  let best: { hit: Hit; distance: number } | null = null;
  for (const bar of system.bars) {
    bar.columns.forEach((placed, column) => {
      const dx = Math.abs(placed.x - x);
      if (dx > HEAD_REACH_X) return;
      for (const head of placed.heads) {
        const dy = Math.abs(stepY(score, head.step) - localY);
        if (dy > HEAD_REACH_Y) continue;
        const distance = dx + dy;
        if (!best || distance < best.distance) best = { hit: { bar: bar.index, column, string: head.string }, distance };
      }
    });
  }
  return best ? (best as { hit: Hit }).hit : null;
}

/** How far past the staff's lines a press still lands on it, in steps: two ledger lines. */
const STAFF_PRESS_STEPS = 4;
/**
 * In Both, below the staff toward the tab: one ledger line, and the tab reaches less far up, so the
 * gap between them is left for moving the cursor or the playback line (Jeremy, 2026-10-27).
 */
const STAFF_PRESS_STEPS_OVER_TAB = 2;
const TAB_REACH_UNDER_STAFF = 6;

/** Where a press on the notation staff lands: a column, the line or space, and the string of the head pressed (null off a head). */
export interface StaffHit {
  bar: number;
  column: number;
  step: number;
  string: number | null;
}

/**
 * A note head dragged up or down on the staff (issue #174): the head pressed, how many lines and spaces
 * the pointer has gone up (down below 0), and the keys held: Shift counts semitones instead, ⌘ or Ctrl
 * takes the whole chord. `done` when the pointer lets go.
 */
export interface StaffDrag {
  hit: StaffHit & { string: number };
  steps: number;
  semitones: boolean;
  chord: boolean;
  done: boolean;
}

/**
 * A press on the notation staff (issue #136): on a note head, that note; else the nearest column of
 * the bar and the line or space pressed, up to two ledger lines past the staff. Null anywhere else.
 */
export function staffAt(layout: Layout, x: number, y: number): StaffHit | null {
  const line = lineAt(layout, y);
  if (!line) return null;
  const { system, localY } = line;
  const { rows } = system;
  const score = rows.score;
  if (!score) return null;
  // A drawn head is pressed wherever it is, on ledger lines far under the staff too (Jeremy, 2026-10-28):
  // the gap left for the playback line is only the blank space there.
  const head = staffHeadAt(system, score, x, localY);
  if (head) {
    const placed = system.bars.find(b => b.index === head.bar)!.columns[head.column];
    return { bar: head.bar, column: head.column, step: placed.heads.find(h => h.string === head.string)!.step, string: head.string };
  }
  const step = Math.round((score.bottom - localY) / (SPACE / 2));
  const below = rows.tab ? STAFF_PRESS_STEPS_OVER_TAB : STAFF_PRESS_STEPS;
  if (step < -below || step > 8 + STAFF_PRESS_STEPS) return null;
  const bar = system.bars.find(b => x >= b.x0 && x < b.x1);
  if (!bar) return null;
  let column = 0;
  bar.columns.forEach((c, i) => {
    if (Math.abs(c.x - x) < Math.abs(bar.columns[column].x - x)) column = i;
  });
  return { bar: bar.index, column, step, string: null };
}

/** The column and string a press on the tab lands on; null anywhere else. */
export function hitTest(layout: Layout, x: number, y: number): Hit | null {
  const line = lineAt(layout, y);
  if (!line) return null;
  const { system, localY } = line;
  const { rows } = system;
  if (!rows.tab) return null;
  // Only the staff itself, as far as the cursor's band reaches: not the marks over it, the rhythm
  // under it, or the blank space beside the last bar.
  const above = rows.score ? TAB_REACH_UNDER_STAFF : STAFF_REACH;
  if (localY < rows.staffTop - above || localY > rows.staffBottom + STAFF_REACH) return null;
  const bar = system.bars.find(b => x >= b.x0 && x < b.x1);
  if (!bar) return null;
  const string = Math.min(5, Math.max(0, Math.round((localY - rows.staffTop) / STRING_GAP)));
  let column = 0;
  bar.columns.forEach((c, i) => {
    if (Math.abs(c.x - x) < Math.abs(bar.columns[column].x - x)) column = i;
  });
  return { bar: bar.index, column, string };
}

/** How far right of a column's centre a press still counts as on it: about a note head's half width. */
export const ON_COLUMN_REACH = 8;

/**
 * Where a press anywhere in a bar's height, above or below the staff included, puts the playback line:
 * on the column pressed, else the first column after the press (Jeremy, 2026-10-27: "it should be
 * sufficient to click anywhere after the note"). Past a bar's last column, the next bar's first; past
 * the clip's last, the last. Null beside the bars or in an empty bar.
 */
export function columnAt(layout: Layout, x: number, y: number): number | null {
  const at = boundaryAt(layout, x, y);
  if (at === null) return null;
  const count = layout.systems.reduce((n, s) => s.bars.reduce((m, b) => Math.max(m, ...b.columns.map(c => c.index + 1)), n), 0);
  return Math.min(at, count - 1);
}

/**
 * The same as `columnAt`, but as the gap between columns a press is at: past the clip's last column,
 * the column count. A Shift+press selects the columns between the playback line and this gap.
 */
export function boundaryAt(layout: Layout, x: number, y: number): number | null {
  const system = lineAt(layout, y)?.system;
  if (!system) return null;
  // Left of the line's first bar (over the clef, key and time signature): in front of its first column.
  const first = system.bars.find(b => b.columns.length > 0);
  if (first && x < system.bars[0].x0) return first.columns[0].index;
  const bar = system.bars.find(b => x >= b.x0 && x < b.x1);
  if (!bar || bar.columns.length === 0) return null;
  const next = bar.columns.find(c => x <= c.x + Math.min(ON_COLUMN_REACH, c.width / 2));
  if (next) return next.index;
  return bar.columns[bar.columns.length - 1].index + 1;
}

/** Where the cursor's column is drawn: its system, centre and width; an empty bar's middle. */
export function cursorSpot(layout: Layout, bar: number, column: number): { system: number; x: number; start: number; width: number } | null {
  for (let s = 0; s < layout.systems.length; s++) {
    const placed = layout.systems[s].bars.find(b => b.index === bar);
    if (!placed) continue;
    const c = placed.columns[column];
    if (c) return { system: s, x: c.x, start: c.start, width: c.width };
    const middle = (placed.x0 + placed.x1) / 2;
    return { system: s, x: middle, start: middle - 14, width: 28 };
  }
  return null;
}

/* — beams: eighths and shorter within one beat are joined; in 4/4, plain eighths by the half bar — */
