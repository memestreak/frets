/**
 * Where the whammy bar's lines go (alphaTex `tb`, issue #216;
 * `docs/specs/2026-10-29-tab-whammy-design.md`), as printed guitar books draw them: from the note's
 * number down through the tab to a label under it giving the depth in steps ("-6" an octave down).
 * A dive is a slanting line, a dip a V, a held bar a dashed line, a pre-dipped note a dashed drop
 * straight down from its number, and a return a line back up. Pure; `TabClip.tsx` draws it and
 * `marks.ts` picks it.
 */
import { isRest, type Part, type Column } from './clip';
import { BEND_PEAK, DIVES_ROOM, stringY, type Layout, type PlacedColumn, type Rows } from './layout';

/** The shapes the palette's Whammy bar button sets, as alphaTex points (quarter tones), in its panel's order. */
export const WHAMMY_SHAPES = {
  dip: [0, -2, 0],
  dive: [0, -8],
  diveReturn: [0, -8, 0],
  diveBomb: [0, -24],
} as const satisfies Record<string, readonly number[]>;
export type WhammyShape = keyof typeof WHAMMY_SHAPES;
export const WHAMMY_SHAPE_IDS = Object.keys(WHAMMY_SHAPES) as WhammyShape[];
/** Each shape's name in the panel, with its depth as the line is labelled. */
export const WHAMMY_SHAPE_NAMES: Record<WhammyShape, string> = {
  dip: 'Dip -½', dive: 'Dive -2', diveReturn: 'Dive and return -2', diveBomb: 'Dive bomb -6',
};

/** The palette shape a whammy bar is, or null for any other (one read from a book). */
export function whammyShape(points: readonly number[] | undefined): WhammyShape | null {
  if (!points) return null;
  return WHAMMY_SHAPE_IDS.find(id => WHAMMY_SHAPES[id].length === points.length && WHAMMY_SHAPES[id].every((p, i) => p === points[i])) ?? null;
}

/** A straight piece of a whammy line: solid while the bar moves, dashed while it is held or pre-dipped. */
export interface WhammyPiece {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dashed: boolean;
}

/** A depth's label, centred on `x` with its baseline at `y`. */
export interface WhammyLabel {
  x: number;
  y: number;
  text: string;
}

/** One column's whammy bar as drawn on its line, and the box under the tab a press picks it by. */
export interface WhammyDrawing {
  placed: PlacedColumn;
  pieces: WhammyPiece[];
  labels: WhammyLabel[];
  box: { x: number; y: number; width: number; height: number };
}

/** How far under its point a label's baseline goes. */
const LABEL_DROP = 11;
/** The shallowest line stands this far into the room under the tab, the deepest its label's height off its foot; between, by the root of their depth. */
const SHALLOWEST = 3;
/** How much sooner a line stops before a next note that is pre-dipped, its label clear of that note's. */
const NEXT_DROP_CLEAR = 12;
/** The least room a return from a hold needs to land on its note's number rather than run its length. */
const RETURN_ROOM = 30;
/** A depth that reaches the deepest line: an octave down. */
const OCTAVE = 24;

/**
 * A depth in steps as a guitar book labels it: quarter tones -2 "-½", -6 "-1½", -24 "-6", -14 "-3½",
 * with ¼ and ¾ for odd quarter tones.
 */
export function whammyLabel(quarters: number): string {
  const steps = Math.abs(quarters) / 4;
  const whole = Math.floor(steps);
  const part = ['', '¼', '½', '¾'][Math.abs(quarters) % 4];
  return `${quarters < 0 ? '-' : ''}${whole > 0 || part === '' ? whole : ''}${part}`;
}

/** Whether a whammy bar starts down where the one before it left off: a tied note going on under it. */
function goesOn(before: number[] | undefined, points: number[]): boolean {
  return !!before && points[0] !== 0 && before[before.length - 1] === points[0];
}

/** Whether a whammy bar stays at one depth, down, the whole note: held, or pre-dipped and held. */
function held(points: number[]): boolean {
  return points[0] !== 0 && points.every(p => p === points[0]);
}

/**
 * How each column with a whammy bar going on from the column before carries it on: held down the whole
 * note ('hold'), or brought back up to the note ('return'). Under a staff a held tied note has no
 * number, even where a bar starts, as the book prints Stop's bar 3 (the line says it); a returning
 * one has its number, for the line to climb back to (Stop, Gtr. 4, bar 13).
 */
export function whammyJoins(clip: Pick<Part, 'bars'>): Map<Column, 'hold' | 'return'> {
  const out = new Map<Column, 'hold' | 'return'>();
  const columns = clip.bars.flatMap(b => b.columns);
  columns.forEach((column, i) => {
    const points = column.whammy;
    if (!points || !goesOn(columns[i - 1]?.whammy, points)) return;
    if (points[points.length - 1] === 0) out.set(column, 'return');
    else if (held(points)) out.set(column, 'hold');
  });
  return out;
}

/** The y of a point `quarters` down, in the room under the tab. */
function depthY(rows: Rows, quarters: number): number {
  // Read here, not when the file loads: `layout.ts` and this file load each other.
  const deepest = DIVES_ROOM - LABEL_DROP - 3;
  return rows.dives! + SHALLOWEST + (deepest - SHALLOWEST) * Math.min(1, Math.sqrt(Math.abs(quarters) / OCTAVE));
}

/** Where a column's line leaves from: just under its lowest number, or the bottom string for a rest. */
function noteBottom(rows: Rows, column: Column): number {
  if (isRest(column)) return rows.staffBottom;
  const lowest = column.notes.reduce((low, n, s) => (n ? s : low), 0);
  return stringY(rows, lowest) + 6;
}

/**
 * Every whammy bar drawn in a layout, line by line. A column's points are spread over its note's
 * length, from its number to just before the next note (as a bend's arrows run); one that starts down
 * is pre-dipped, a dashed drop from its number. A bar held down a whole note draws nothing more: the
 * next note's change goes on from where the hold began, as guitar books draw it, and a return lands
 * on its note's number (Stop, Gtr. 4, bar 13). A depth is labelled where the line gets to it, not
 * again while it is held.
 */
export function whammyDrawings(layout: Layout): WhammyDrawing[][] {
  const out: WhammyDrawing[][] = layout.systems.map(() => []);
  const all = layout.systems.flatMap((system, si) => system.bars.flatMap(b => b.columns.map(placed => ({ placed, si }))));
  // Where the bar was left: its depth, and where on which line the line goes on from.
  let carry: { value: number; x: number; si: number } | null = null;
  all.forEach(({ placed, si }, k) => {
    const system = layout.systems[si];
    const { rows } = system;
    const points = placed.column.whammy;
    const before = carry;
    carry = null;
    if (!points || rows.dives === null) return;
    const top = noteBottom(rows, placed.column);
    const y = (v: number) => (v === 0 ? top : depthY(rows, v));
    const x0 = placed.x;
    const last = points[points.length - 1];
    const on = before !== null && goesOn(all[k - 1]?.placed.column.whammy, points);
    const from = on ? (before.si === si ? before.x : system.staffStart) : x0;
    const pieces: WhammyPiece[] = [];
    const labels: WhammyLabel[] = [];
    const label = (x: number, v: number) => labels.push({ x, y: y(v) + LABEL_DROP, text: whammyLabel(v) });
    if (!on && points[0] !== 0) {
      // Pre-dipped: a dashed drop from the number to where the bar starts.
      pieces.push({ x1: x0, y1: top, x2: x0, y2: y(points[0]), dashed: true });
      label(x0, points[0]);
    }
    if (held(points)) {
      // Nothing more: what changes next goes on from where the hold began.
      carry = { value: last, x: on ? from : x0, si };
    } else {
      // Short of the next note's own drop, so their labels stand apart.
      const next = all[k + 1];
      const nextPoints = next?.si === si ? next.placed.column.whammy : undefined;
      const clear = nextPoints && nextPoints[0] !== 0 && nextPoints[0] !== last ? NEXT_DROP_CLEAR : 0;
      // A return from a hold lands on its note's number, when the hold left room before it.
      const end = on && last === 0 && x0 - from >= RETURN_ROOM ? x0 : x0 + Math.max(BEND_PEAK, placed.bendRoom - clear);
      const xs = points.map((_, i) => from + ((end - from) * i) / (points.length - 1));
      for (let i = 1; i < points.length; i++) {
        const [a, b] = [points[i - 1], points[i]];
        if (a === 0 && b === 0) continue;
        // From the number, the line leaves its right edge.
        const startX = a === 0 && i === 1 && !on ? xs[0] + 5 : xs[i - 1];
        const endX = b === 0 && end === x0 ? xs[i] - 5 : xs[i];
        pieces.push({ x1: startX, y1: y(a), x2: endX, y2: y(b), dashed: a === b });
        if (b !== 0 && b !== a) label(xs[i], b);
      }
      carry = { value: last, x: end, si };
    }
    if (pieces.length === 0) return;
    const ends = pieces.flatMap(p => [[p.x1, p.y1], [p.x2, p.y2]]).concat(labels.map(l => [l.x, l.y]));
    const left = Math.min(...ends.map(p => p[0])) - 6;
    const right = Math.max(...ends.map(p => p[0])) + 6;
    // Picked under the tab only, where nothing else is: on the strings a press places the cursor.
    const high = rows.staffBottom + 4;
    const low = Math.max(...ends.map(p => p[1])) + 3;
    out[si].push({ placed, pieces, labels, box: { x: left, y: high, width: right - left, height: low - high } });
  });
  return out;
}
