/**
 * Where everything in a clip goes when drawn at a given width: systems
 * (lines of tab), bars and columns, in SVG units. Pure; `TabClip.tsx` only
 * draws what this returns, so the page and the exported images agree.
 */
import {
  isRest, isStandardTuning, ticks,
  type Bar, type Clip, type Column, type Note,
} from './clip';

/* — vertical rows of one system, from its top — */
export const ROW = {
  /** Ending brackets and repeat counts. */
  endings: 12,
  strokes: 28,
  palmMute: 42,
  /** Bend labels, vibrato, taps. */
  marks: 56,
  /** The top string. */
  staffTop: 72,
  stringGap: 14,
  stemTop: 150,
  stemBottom: 174,
  tuplet: 187,
} as const;
export const STAFF_BOTTOM = ROW.staffTop + 5 * ROW.stringGap;
export const SYSTEM_HEIGHT = 196;

const NAMES_WIDTH = 16;
const CLEF_WIDTH = 30;
const TIME_WIDTH = 24;
const BAR_PAD_START = 14;
const BAR_PAD_END = 6;
const REPEAT_PAD = 12;
const EMPTY_BAR = 120;
const CHAR = 7.5;

export interface PlacedColumn {
  column: Column;
  /** The column's place in the whole clip, counting from 0 (as `editing.ts` counts). */
  index: number;
  /** The column's centre. */
  x: number;
  width: number;
}

export interface PlacedBar {
  bar: Bar;
  /** The bar's index in the clip. */
  index: number;
  /** Where the bar starts (its opening line) and ends (its closing line). */
  x0: number;
  x1: number;
  columns: PlacedColumn[];
}

export interface System {
  bars: PlacedBar[];
  /** Where the staff lines start: after the names, "TAB" and the time signature. */
  staffStart: number;
  first: boolean;
}

export interface Layout {
  systems: System[];
  height: number;
  /** Names to draw left of the strings, high string first, when the tuning isn't standard. */
  names: string[] | null;
}

/** A column's width: longer notes take more room, and its widest note must fit. */
export function columnWidth(column: Column): number {
  const byTime = 12 + 32 * Math.sqrt(ticks(column.duration) / 48);
  // A bend's arrow and label stand right of the number; a release needs more.
  const bend = column.notes.some(n => n?.bend?.release) ? 30 : column.notes.some(n => n?.bend) ? 18 : 0;
  return Math.max(byTime, minColumnWidth(column)) + bend;
}

/** The least room a column's widest note needs. */
function minColumnWidth(column: Column): number {
  const widest = Math.max(1, ...column.notes.map(n => (n ? noteLabel(n).length : 0)));
  return widest * CHAR + 6;
}

/** What is written on the string for a note: "5", "x", "(5)", "<12>". */
export function noteLabel(note: Note): string {
  if (note.fret === null) return 'x';
  if (note.tie) return `(${note.fret})`;
  if (note.harmonic) return `<${note.fret}>`;
  return String(note.fret);
}

function barWidth(bar: Bar): number {
  const inner = bar.columns.length === 0 ? EMPTY_BAR : bar.columns.reduce((w, c) => w + columnWidth(c), 0);
  return BAR_PAD_START + (bar.repeatStart ? REPEAT_PAD : 0) + inner + BAR_PAD_END + (bar.repeatEnd ? REPEAT_PAD : 0);
}

export function layoutClip(clip: Clip, width: number): Layout {
  const names = isStandardTuning(clip.tuning) ? null : [...clip.tuning].reverse();
  const head = (first: boolean) => (names ? NAMES_WIDTH : 0) + CLEF_WIDTH + (first ? TIME_WIDTH : 0);

  const systems: System[] = [];
  let current: PlacedBar[] = [];
  let place = 0; // the next column's place in the whole clip
  let x = head(true);
  const finish = () => {
    systems.push({ bars: current, staffStart: head(systems.length === 0), first: systems.length === 0 });
    current = [];
    x = head(false);
  };
  clip.bars.forEach((bar, index) => {
    let w = barWidth(bar);
    if (current.length > 0 && x + w > width) finish();
    const x0 = x;
    // A bar wider than a whole line is squeezed to fit, down to what its numbers need.
    const inner = bar.columns.reduce((sum, c) => sum + columnWidth(c), 0);
    const squeeze = inner > 0 ? Math.min(1, (width - x0 - (w - inner)) / inner) : 1;
    let cx = x0 + BAR_PAD_START + (bar.repeatStart ? REPEAT_PAD : 0);
    const columns = bar.columns.map(column => {
      const cw = Math.max(minColumnWidth(column), columnWidth(column) * squeeze);
      const placed = { column, index: place++, x: cx + cw / 2, width: cw };
      cx += cw;
      return placed;
    });
    if (squeeze < 1) w = cx - x0 + BAR_PAD_END + (bar.repeatEnd ? REPEAT_PAD : 0);
    x = x0 + w;
    current.push({ bar, index, x0, x1: x, columns });
  });
  finish();
  return { systems, height: systems.length * SYSTEM_HEIGHT, names };
}

/** The y of a string's line within a system, high e (0) on top. */
export function stringY(s: number): number {
  return ROW.staffTop + s * ROW.stringGap;
}

/* — the cursor — */

/** Where a click lands: the bar under it, its nearest column (0 in an empty bar) and the nearest string. */
export interface Hit {
  bar: number;
  column: number;
  string: number;
}

/** What a point in the drawing is over; null below the last system or left of every bar. */
export function hitTest(layout: Layout, x: number, y: number): Hit | null {
  const system = layout.systems[Math.floor(y / SYSTEM_HEIGHT)];
  if (!system || y < 0) return null;
  const bar = system.bars.find(b => x >= b.x0 && x < b.x1)
    ?? (x >= system.bars[system.bars.length - 1].x1 ? system.bars[system.bars.length - 1] : null);
  if (!bar) return null;
  const localY = y - Math.floor(y / SYSTEM_HEIGHT) * SYSTEM_HEIGHT;
  const string = Math.min(5, Math.max(0, Math.round((localY - ROW.staffTop) / ROW.stringGap)));
  let column = 0;
  bar.columns.forEach((c, i) => {
    if (Math.abs(c.x - x) < Math.abs(bar.columns[column].x - x)) column = i;
  });
  return { bar: bar.index, column, string };
}

/** Where the cursor's column is drawn: its system, centre and width; an empty bar's middle. */
export function cursorSpot(layout: Layout, bar: number, column: number): { system: number; x: number; width: number } | null {
  for (let s = 0; s < layout.systems.length; s++) {
    const placed = layout.systems[s].bars.find(b => b.index === bar);
    if (!placed) continue;
    const c = placed.columns[column];
    if (c) return { system: s, x: c.x, width: c.width };
    return { system: s, x: (placed.x0 + placed.x1) / 2, width: 28 };
  }
  return null;
}

/* — beams: eighths and shorter within one beat are joined — */

export interface BeamGroup {
  columns: PlacedColumn[];
}

/** Runs of beamable columns (eighth or shorter, not rests) within each beat of a bar. */
export function beamGroups(bar: PlacedBar, beat: number): BeamGroup[] {
  const groups: BeamGroup[] = [];
  let at = 0;
  let current: PlacedColumn[] = [];
  let currentBeat = -1;
  const close = () => {
    if (current.length > 0) groups.push({ columns: current });
    current = [];
  };
  for (const placed of bar.columns) {
    const b = Math.floor(at / beat);
    const beamable = placed.column.duration.value >= 8 && !isRest(placed.column);
    if (!beamable || b !== currentBeat) close();
    if (beamable) {
      current.push(placed);
      currentBeat = b;
    }
    at += ticks(placed.column.duration);
  }
  close();
  return groups;
}
