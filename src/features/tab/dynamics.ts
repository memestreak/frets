/**
 * Dynamics as drawn (issue #437, `docs/specs/2026-11-09-tab-dynamics-design.md`): a dynamic's letters in
 * Bravura's italic dynamic glyphs, centred on its column on the hairpins' row, and where a hairpin
 * starting or ending by one stops short of it. Pure; `ClipMarks.tsx` draws them and `marks.ts` picks them.
 */
import { ticks, type Dynamic } from './clip';
import type { Box } from './marks';
import type { PlacedColumn, System } from './layout';
import type { ColumnRun } from './runs';
import { SPACE } from './rows';
import { GLYPHS } from './smufl';

/** Each letter a dynamic is written with, and its Bravura glyph. */
const LETTER = {
  p: GLYPHS.dynamicPiano, m: GLYPHS.dynamicMezzo, f: GLYPHS.dynamicForte,
  r: GLYPHS.dynamicRinforzando, s: GLYPHS.dynamicSforzando, z: GLYPHS.dynamicZ,
} as const;

/** A dynamic's size: a little over the staff's own glyphs, so it reads as the books print it. */
const SCALE = SPACE * 1.15;
/** Neighbouring letters overlap a little, as the glyphs' italic slant leaves room (Bravura's own kerning is tighter still). */
const LETTER_OVERLAP = 0.12;
/** The gap between a dynamic and a hairpin beside it. */
const HAIRPIN_GAP = 3;

/** A dynamic's letters as paths, centred on `x` with their middle on `y`, and the box round them. */
export function dynamicWord(dynamic: Dynamic, x: number, y: number): { letters: { d: string; transform: string }[]; box: Box } {
  const glyphs = [...dynamic].map(letter => LETTER[letter as keyof typeof LETTER]);
  const advances = glyphs.map(g => (g.width - LETTER_OVERLAP) * SCALE);
  const width = advances.reduce((a, b) => a + b, 0) + LETTER_OVERLAP * SCALE;
  // The letters stand on their baseline, about a space tall; their middle goes on the row.
  const base = y + 0.45 * SCALE;
  let left = x - width / 2;
  const letters = glyphs.map((glyph, i) => {
    const letter = { d: glyph.d, transform: `translate(${left} ${base}) scale(${SCALE})` };
    left += advances[i];
    return letter;
  });
  return { letters, box: { x: x - width / 2, y: base - 1.1 * SCALE, width, height: 1.4 * SCALE } };
}

/** One dynamic as drawn on a line: the column it is on (`index` in its Voice's part), and whether that is the part's own Voice. */
export interface DrawnDynamic {
  dynamic: Dynamic;
  index: number;
  own: boolean;
  letters: { d: string; transform: string }[];
  box: Box;
}

/** The gap between two different dynamics of two Voices at one time, drawn side by side. */
const SIDE_GAP = 4;

/**
 * Every dynamic a line draws, the part's own Voice's and the other Voices', on row `y`. A dynamic belongs to
 * the staff, as Dorico and the books treat it: the same dynamic in two Voices at one time is drawn once (the
 * part's own, so a press picks it); two different ones stand side by side, the part's own first.
 */
export function drawnDynamics(system: System, y: number): DrawnDynamic[] {
  const out: DrawnDynamic[] = [];
  for (const bar of system.bars) {
    // By time in the bar: another Voice's column at the same time stands a little apart (its notes' side).
    const at = new Map<number, { x: number; entries: { dynamic: Dynamic; index: number; own: boolean }[] }>();
    const addVoice = (columns: PlacedColumn[], own: boolean) => {
      let t = 0;
      for (const { column, x, index } of columns) {
        if (column.dynamic) {
          const spot = at.get(t) ?? { x, entries: [] };
          // Centred on the part's own column when it has one there.
          if (own) spot.x = x;
          spot.entries.push({ dynamic: column.dynamic, index, own });
          at.set(t, spot);
        }
        if (!column.grace) t += ticks(column.duration);
      }
    };
    addVoice(bar.columns, true);
    for (const voice of bar.voices ?? []) addVoice(voice.columns, false);
    for (const { x, entries } of at.values()) {
      const shown = entries.filter((e, i) => entries.findIndex(f => f.dynamic === e.dynamic) === i);
      const widths = shown.map(e => dynamicWord(e.dynamic, x, y).box.width);
      let left = x - (widths.reduce((sum, w) => sum + w, 0) + SIDE_GAP * (shown.length - 1)) / 2;
      shown.forEach((entry, i) => {
        out.push({ ...entry, ...dynamicWord(entry.dynamic, left + widths[i] / 2, y) });
        left += widths[i] + SIDE_GAP;
      });
    }
  }
  return out;
}

/**
 * Where a hairpin over `run` is drawn along its row: from just before its first column to its `end`,
 * starting right of a dynamic on its first column and stopping left of one on the column after it.
 */
export function hairpinSpan(system: System, run: ColumnRun, y: number): { x0: number; x1: number } {
  let x0 = run.from.x - 4;
  let x1 = run.end;
  if (run.from.column.dynamic) {
    const { box } = dynamicWord(run.from.column.dynamic, run.from.x, y);
    x0 = Math.max(x0, box.x + box.width + HAIRPIN_GAP);
  }
  const placed = system.bars.flatMap(b => b.columns);
  const next = placed[placed.indexOf(run.to) + 1];
  if (next?.column.dynamic) x1 = Math.min(x1, dynamicWord(next.column.dynamic, next.x, y).box.x - HAIRPIN_GAP);
  // A hairpin squeezed between two dynamics keeps a little length, so it can still be seen and pressed.
  return { x0, x1: Math.max(x1, x0 + 8) };
}
