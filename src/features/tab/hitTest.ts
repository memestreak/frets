/**
 * What a press on the drawn clip is on: a string at a column, a staff line or space, a gap between
 * columns, and where the cursor is drawn. Pure; works on a `layoutClip` layout.
 */

import { isRest } from './clip';
import type { MarkHit } from './marks';
import { xAlong } from './grid';
import { staffBar } from './staffGeometry';
import { type Layout, lineAt, type System, wholeRestX } from './layout';
import { SPACE, STRING_GAP, type ScoreRows, stepY } from './rows';
import { accidentalRoom, HEAD_WIDTH } from './widths';

/** Where a click lands: the bar under it, its nearest column (0 in an empty bar) and the nearest string. */
export interface Hit {
  bar: number;
  column: number;
  string: number;
  /** In note input mode, how far into a rest the press snapped, in ticks (issue #293); absent at a column's start. */
  at?: number;
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
    const geometry = staffBar(bar, score).columns;
    bar.columns.forEach((placed, column) => {
      const drawn = geometry.get(placed);
      if (!drawn) return;
      // A press on an accidental, left of the heads, is on its note too (step 8, Q1).
      const signs = accidentalRoom(placed.heads);
      placed.heads.forEach((head, k) => {
        // Where the head is drawn: a head a second from its neighbour sits on the stem's other side (issue #276).
        const centre = drawn.xs[k] + drawn.width / 2;
        const dx = Math.abs(centre - x);
        if (dx > HEAD_REACH_X + (x < centre ? signs : 0)) return;
        const dy = Math.abs(stepY(score, head.step) - localY);
        if (dy > HEAD_REACH_Y) return;
        const distance = dx + dy;
        if (!best || distance < best.distance) best = { hit: { bar: bar.index, column, string: head.string }, distance };
      });
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
  /** In note input mode, how far into a rest the press snapped, in ticks (issue #293). */
  at?: number;
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
 * A fret number on the tab dragged up or down to another string (issue #238, normal mode): the note
 * pressed, the string the pointer is over now, and `done` when it lets go (`cancelled` when it let go
 * off the drawing, or the browser took the pointer).
 */
/** A picked Span's Handle dragged (step 8): the Span, which end, the column it is over, and whether it let go or was called off. */
export interface SpanDrag {
  hit: MarkHit;
  end: 'start' | 'end';
  column: number;
  done: boolean;
  cancelled: boolean;
}

/**
 * A note head or fret number dragged left or right (issue #473, normal mode): the note pressed, how far
 * the pointer has gone in time, in ticks (not yet snapped to the grid; negative is earlier), and `done`
 * when it lets go (`cancelled` off the drawing, or when the browser took the pointer).
 */
export interface TimeDrag {
  hit: Hit;
  by: number;
  done: boolean;
  cancelled: boolean;
}

export interface FretDrag {
  hit: Hit;
  string: number;
  done: boolean;
  cancelled: boolean;
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
  // A Whole-bar rest is one thing: a press anywhere in it lands on beat 1.
  if (!bar.wholeRest) {
    bar.columns.forEach((c, i) => {
      if (Math.abs(c.x - x) < Math.abs(bar.columns[column].x - x)) column = i;
    });
  }
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
  // A Whole-bar rest is one thing: a press anywhere in it lands on beat 1.
  if (!bar.wholeRest) {
    bar.columns.forEach((c, i) => {
      if (Math.abs(c.x - x) < Math.abs(bar.columns[column].x - x)) column = i;
    });
  }
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

/**
 * Where the cursor's column is drawn: its system, centre and width; an empty bar's middle. With `at`, note
 * input's cursor that many ticks into a rest, along its room (issue #293).
 */
export function cursorSpot(layout: Layout, bar: number, column: number, at = 0): { system: number; x: number; start: number; width: number } | null {
  for (let s = 0; s < layout.systems.length; s++) {
    const placed = layout.systems[s].bars.find(b => b.index === bar);
    if (!placed) continue;
    const c = placed.columns[column];
    if (c) return { system: s, x: at ? xAlong(c, at) : c.x, start: c.start, width: c.width };
    const middle = (placed.x0 + placed.x1) / 2;
    return { system: s, x: middle, start: middle - 14, width: 28 };
  }
  return null;
}

/* — rhythm: rests and stems — */

/** How far across from a rest's middle, or a stem, a press still picks it. */
const REST_REACH_X = 9;
/** The tab alone draws a whole or half rest on a line 18 wide (`TabStems`), so a press anywhere along it picks it (issue #290). */
const TAB_BAR_REST_REACH_X = 12;

/**
 * The column whose rhythm is under a press: a rest where the staff draws it, across the staff's five
 * lines (issue #276), or, with the tab alone, a rest or a note's stem where the tab's own rhythm draws
 * them under the strings (issue #290). A multi-bar rest and a grace note have none to pick.
 */
export function rhythmAt(layout: Layout, x: number, y: number): { bar: number; column: number; lastBar?: number } | null {
  const line = lineAt(layout, y);
  if (!line) return null;
  const { system, localY } = line;
  const { rows } = system;
  // On the staff, a stem or a beam picks its column (step 8, Q4).
  const stem = rows.score ? staffStemAt(system, rows.score, x, localY) : null;
  if (stem) return stem;
  const [top, bottom] = rows.score ? [rows.score.top, rows.score.bottom] : rows.tabStems ? [rows.stemTop, rows.stemTop + 24] : [null, null];
  if (top === null || bottom === null || localY < top || localY > bottom) return null;
  // The nearest in reach, so a wide rest's reach doesn't take a press from a narrow stem or rest beside it.
  let best: { bar: number; column: number; off: number } | null = null;
  for (const bar of system.bars) {
    if (bar.restRun) {
      // A multi-bar rest picks its bars, as a Whole-bar rest picks its bar (step 8, Q1).
      const { span } = bar.restRun;
      if (bar.restRun.first && x >= span.x0 && x <= span.x1) {
        const last = system.bars.filter(b => b.restRun && b.restRun.span === span).at(-1)!;
        return { bar: bar.index, column: 0, lastBar: last.index };
      }
      continue;
    }
    if (bar.wholeRest) {
      // One whole rest drawn centred: a press on it picks the bar's first rest (the page picks them all).
      const off = Math.abs(wholeRestX(bar) - x);
      if (off <= TAB_BAR_REST_REACH_X && (!best || off < best.off)) best = { bar: bar.index, column: 0, off };
      continue;
    }
    for (let column = 0; column < bar.columns.length; column++) {
      const placed = bar.columns[column];
      if (placed.column.grace || (rows.score && !isRest(placed.column))) continue;
      const reach = !rows.score && isRest(placed.column) && placed.column.duration.value <= 2 ? TAB_BAR_REST_REACH_X : REST_REACH_X;
      const off = Math.abs(placed.x - x);
      if (off <= reach && (!best || off < best.off)) best = { bar: bar.index, column, off };
    }
  }
  return best && { bar: best.bar, column: best.column };
}

/** How near a staff stem or beam a press must be, across and up or down. */
const STEM_REACH = 4;
const BEAM_REACH = 6;

/**
 * The column whose stem or beam is under a press on the notation staff (step 8, Q4): a stem picks its
 * column, a beam the column whose stem is nearest the press. A press on a head is the note's, not the stem's.
 */
function staffStemAt(system: System, score: ScoreRows, x: number, localY: number): { bar: number; column: number } | null {
  for (const bar of system.bars) {
    if (bar.restRun) continue;
    const geometry = staffBar(bar, score);
    const onHead = bar.columns.some(p => Math.abs(p.x - x) <= HEAD_REACH_X && p.heads.some(h => Math.abs(stepY(score, h.step) - localY) <= SPACE / 2 + 1));
    if (onHead) return null;
    let best: { column: number; off: number } | null = null;
    for (const [placed, c] of geometry.columns) {
      if (c.tip === null || placed.column.grace) continue;
      const ys = placed.heads.map(h => stepY(score, h.step));
      const [y0, y1] = [Math.min(c.tip, ...ys), Math.max(c.tip, ...ys)];
      const column = bar.columns.indexOf(placed);
      if (Math.abs(x - c.stemX) <= STEM_REACH && localY >= y0 && localY <= y1) return { bar: bar.index, column };
      // On its group's beam: the nearest stem along it.
      if (c.group && Math.abs(localY - c.tip) <= BEAM_REACH) {
        const stems = c.group.map(p => geometry.columns.get(p)?.stemX ?? p.x);
        if (x < Math.min(...stems) || x > Math.max(...stems)) continue;
        const off = Math.abs(x - c.stemX);
        if (!best || off < best.off) best = { column, off };
      }
    }
    if (best) return { bar: bar.index, column: best.column };
  }
  return null;
}
