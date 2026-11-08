/**
 * Where a bar's notes go on the notation staff, across and up: each column's heads, which way its stem
 * goes, and where the stem ends (issue #122). Pure. `StaffDrawing.tsx` draws from it and
 * `staffMarks.ts` places the technique marks by it, so the two agree.
 */
import { isRest } from './clip';
import { stemUpFor, wholeRestX, type PlacedBar, type PlacedColumn, type System } from './layout';
import { SPACE, STEM_STEPS, stepY, type ScoreRows } from './rows';
import { HEAD_WIDTH } from './widths';
import { GLYPHS, type GlyphName } from './smufl';
import { beamGroups } from './beams';
import { type DrawnAt } from './runs';
import type { Head } from './notation';

/** The rest drawn for each note value. */
export const RESTS: Record<number, GlyphName> = {
  1: 'restWhole', 2: 'restHalf', 4: 'restQuarter', 8: 'rest8th', 16: 'rest16th', 32: 'rest32nd', 64: 'rest64th',
};

/** How far each rest reaches above and below the step it hangs from, in staff spaces (from its glyph). */
const REST_REACH: Record<number, [number, number]> = {
  1: [0.04, 0.54], 2: [0.57, 0.01], 4: [1.49, 1.5], 8: [0.7, 1.0], 16: [0.72, 2.0], 32: [1.7, 2.0], 64: [1.72, 3.01],
};

/**
 * How far a rest moves, in steps, in a bar of two or more Voices (step 9, Q2): an up-stem Voice's up, a
 * down-stem Voice's down, clear of the other's notes; none in a bar of one Voice.
 */
export function restShift(placed: PlacedColumn | undefined): number {
  return placed?.voiceUp === undefined ? 0 : placed.voiceUp ? VOICE_REST_SHIFT : -VOICE_REST_SHIFT;
}
const VOICE_REST_SHIFT = 4;

/** Where a rest is drawn on the staff: its glyph, left edge and the y it hangs from, and its box. */
export interface StaffRest {
  glyph: GlyphName;
  step: number;
  x: number;
  y: number;
  top: number;
  bottom: number;
  width: number;
}

/**
 * The rest a rest Column draws on the staff, in the system's units: in a Whole-bar rest's bar, that one
 * whole rest centred in the bar, whichever of its Columns; else its own rest at its note's place.
 */
export function staffRest(bar: PlacedBar, placed: PlacedColumn, score: ScoreRows): StaffRest {
  const whole = bar.wholeRest;
  const value = whole ? 1 : placed.column.duration.value;
  const glyph = RESTS[value];
  const shift = restShift(whole ? bar.columns[0] : placed);
  const step = (value === 1 ? 6 : 4) + shift;
  const width = GLYPHS[glyph].width * SPACE;
  const centre = whole ? wholeRestX(bar) : placed.x + (placed.headShift ?? 0);
  const y = stepY(score, step);
  const [above, below] = REST_REACH[value];
  return { glyph, step, x: centre - width / 2, y, top: y - above * SPACE, bottom: y + below * SPACE, width };
}

/** A grace note's heads and stem, against a full one's. */
export const GRACE_SCALE = 0.65;

/** One column of notes on the staff; rests have none. */
export interface StaffColumn {
  placed: PlacedColumn;
  up: boolean;
  /** One head's width (smaller for a grace note). */
  width: number;
  /** Each head's left edge, in the order of `placed.heads` (low to high). */
  xs: number[];
  stemX: number;
  /** Where the stem ends: past the heads, or on its group's beam; null for a whole note, which has none. */
  tip: number | null;
  /** The beamed group it is in, when it has one of two or more. */
  group: PlacedColumn[] | null;
}

export interface StaffBarGeometry {
  columns: Map<PlacedColumn, StaffColumn>;
  groups: PlacedColumn[][];
  groupUp: Map<PlacedColumn[], boolean>;
  beamY: Map<PlacedColumn[], number>;
}

/** Where each head of a column goes across: a head a second from the one before it sits on the stem's other side. */
function headXs(heads: Head[], left: number, up: boolean, width: number): number[] {
  const xs = heads.map(() => left);
  if (up) {
    for (let k = 1; k < heads.length; k++) if (heads[k].step - heads[k - 1].step === 1 && xs[k - 1] === left) xs[k] = left + width;
  } else {
    for (let k = heads.length - 2; k >= 0; k--) if (heads[k + 1].step - heads[k].step === 1 && xs[k + 1] === left) xs[k] = left - width;
  }
  return xs;
}

/** A bar's columns on the staff: a beamed group's stems all go one way, decided by all its heads, and end on one flat beam. */
export function staffBar(bar: PlacedBar, score: ScoreRows): StaffBarGeometry {
  const groups = beamGroups(bar).map(g => g.columns);
  const groupOf = new Map<PlacedColumn, PlacedColumn[]>();
  for (const g of groups) for (const p of g) groupOf.set(p, g);
  const groupUp = new Map<PlacedColumn[], boolean>();
  const beamY = new Map<PlacedColumn[], number>();
  for (const g of groups) {
    // In a bar of two or more Voices each Voice's stems take its own side (step 9, Q2).
    const up = g[0].voiceUp ?? stemUpFor(g.flatMap(p => p.heads).sort((a, b) => a.step - b.step));
    groupUp.set(g, up);
    const ends = g.filter(p => p.heads.length > 0).map(p => (up
      ? stepY(score, p.heads[p.heads.length - 1].step + STEM_STEPS)
      : stepY(score, p.heads[0].step - STEM_STEPS)));
    beamY.set(g, up ? Math.min(...ends) : Math.max(...ends));
  }
  const columns = new Map<PlacedColumn, StaffColumn>();
  for (const placed of bar.columns) {
    const { column, heads } = placed;
    const x = placed.x + (placed.headShift ?? 0);
    if (isRest(column) || heads.length === 0) continue;
    const g = groupOf.get(placed) ?? null;
    const group = g && g.length > 1 ? g : null;
    const up = g ? groupUp.get(g)! : placed.stemUp;
    const grace = column.grace ? GRACE_SCALE : 1;
    const width = HEAD_WIDTH * grace;
    const left = x - width / 2;
    const stemX = up ? left + width - 0.6 : left + 0.6;
    const low = stepY(score, heads[0].step);
    const high = stepY(score, heads[heads.length - 1].step);
    const length = STEM_STEPS * SPACE / 2 * grace;
    const tip = column.duration.value === 1 ? null : group ? beamY.get(group)! : up ? high - length : low + length;
    columns.set(placed, { placed, up, width, xs: headXs(heads, left, up, width), stemX, tip, group });
  }
  return { columns, groups, groupUp, beamY };
}

/** Where a head was drawn: its line of music, its left edge, and its staff step. */
export type HeadDrawnAt = DrawnAt & { step: number };

/** For every head, keyed by its column's place and string, where the head before it on that string was: ties, slurs and slides join them. */
export function previousHeads(systems: System[]): Map<string, HeadDrawnAt> {
  const out = new Map<string, HeadDrawnAt>();
  const last = new Map<number, HeadDrawnAt>();
  systems.forEach((system, si) => {
    for (const bar of system.bars) {
      for (const placed of bar.columns) {
        for (const h of placed.heads) {
          const before = last.get(h.string);
          if (before) out.set(`${placed.index}:${h.string}`, before);
          last.set(h.string, { system: si, x: placed.x - HEAD_WIDTH / 2, step: h.step });
        }
      }
    }
  });
  return out;
}
