/**
 * Chord diagrams in the drawn clip (issue #242, `docs/specs/2026-11-06-tab-chord-diagrams-design.md`):
 * the Chord chart under the score head, every chord of the clip once, and a small diagram under every
 * chord name over the music, as fake books and guitar books print them: upright, nut on top, plain ink,
 * no degree colours (Jeremy, 2026-11-06).
 * Only a chord whose definition has a shape gets one; a name with none stays a name. Pure.
 */
import { diagramStartFret, type Shape } from '@/lib/chords/shapes';
import { chordDefOf, type ChordDef } from './chordSet';
import type { Column, Part } from './clip';

/** A chord as a diagram draws it: its name and its shape, low string first. */
export interface ShapedChord {
  name: string;
  shape: Shape;
  /** The fret the diagram starts at: the definition's `firstfret`, else worked out from the shape. */
  start: number;
}

/** A definition's shape as drawn, or null: no strings given, none played, or `showdiagram false`. */
export function shapedChord(def: ChordDef | undefined): ShapedChord | null {
  if (!def?.frets || def.showDiagram === false || def.frets.every(f => f === null)) return null;
  const shape = [...def.frets].reverse();
  return { name: def.name, shape, start: def.firstFret && def.firstFret > 0 ? Math.min(def.firstFret, lowestFret(shape)) : diagramStartFret(shape) };
}

/** The lowest fretted note, or 1 for a shape of open strings only. */
function lowestFret(shape: Shape): number {
  const fretted = shape.filter((f): f is number => f !== null && f > 0);
  return fretted.length > 0 ? Math.min(...fretted) : 1;
}

/** The diagram a chord name over a column draws, from the part's definitions; null for none. */
export function diagramOf(part: Pick<Part, 'chords'>, name: string): ShapedChord | null {
  return shapedChord(chordDefOf(part.chords, name));
}

/** Every Column of a part's bars, every Voice, in bar order. */
function* columnsOf(part: Part): Iterable<Column> {
  for (const bar of part.bars) {
    yield* bar.columns;
    for (const other of bar.otherVoices ?? []) yield* other.columns;
  }
}

/**
 * The Chord chart: every chord the music names that has a diagram, once, in the order first named,
 * the shown track's first and then the other tracks' (spec Q2: every track's together). Two tracks'
 * chords of one name and shape are one; of one name and different shapes, both.
 */
export function chartChords(part: Part): ShapedChord[] {
  const chart: ShapedChord[] = [];
  const seen = new Set<string>();
  for (const track of [part, ...(part.alongside ?? [])]) {
    for (const column of columnsOf(track)) {
      if (!column.chord) continue;
      const chord = diagramOf(track, column.chord);
      const key = chord && `${chord.name}|${chord.shape.join(',')}`;
      if (!chord || seen.has(key!)) continue;
      seen.add(key!);
      chart.push(chord);
    }
  }
  return chart;
}

/* — a diagram's size, in the drawing's units at scale 1 (the chart's size) — */

/** From one string to the next, and one fret to the next. */
export const GRID_STRING = 9;
export const GRID_FRET = 11;
/** The fewest frets a diagram draws. */
export const GRID_FRETS = 4;
/** Room over the nut for × and ○. */
export const GRID_MARKS = 9;
/** Room right of a diagram for its first fret ("5fr"). */
export const GRID_LABEL = 20;
/** The chord name over a chart diagram. */
export const GRID_NAME = 16;
/** A diagram over a chord name in the music is drawn this much smaller than the chart's. */
export const OVER_NAME_SCALE = 0.7;

/** How many frets a diagram draws: four, or more for a shape that reaches further. */
export function gridFrets(chord: ShapedChord): number {
  return Math.max(GRID_FRETS, ...chord.shape.map(f => (f ? f - chord.start + 1 : 0)));
}

/** A diagram's board and its marks, without its name or first fret, at scale 1: its width and height. */
export function gridSize(chord: ShapedChord): { width: number; height: number } {
  return { width: 5 * GRID_STRING, height: GRID_MARKS + gridFrets(chord) * GRID_FRET };
}

/** The room a four-fret diagram over a chord name takes down the line, at its scale: its row's height. */
export function overNameHeight(): number {
  return Math.ceil((GRID_MARKS + GRID_FRETS * GRID_FRET) * OVER_NAME_SCALE);
}

/**
 * The Chord chart laid out `width` wide: the diagrams in rows, left to right, each `GAP` apart and
 * wrapping onto another row when the next doesn't fit, each row centred, as books print the chart.
 * Positions are each diagram's top-left, the name's band included; `height` is the chart's.
 */
export function layoutChart(chords: readonly ShapedChord[], width: number): { places: { x: number; y: number }[]; height: number } {
  const GAP = 18;
  const ROW_GAP = 10;
  // Each diagram's cell: its board and the first fret's room, under its name.
  const cells = chords.map(c => {
    const { width: w, height: h } = gridSize(c);
    return { width: w + GRID_LABEL, height: GRID_NAME + h };
  });
  const rows: number[][] = [];
  let used = 0;
  cells.forEach((cell, i) => {
    const row = rows[rows.length - 1];
    if (row && used + GAP + cell.width <= width) {
      row.push(i);
      used += GAP + cell.width;
    } else {
      rows.push([i]);
      used = cell.width;
    }
  });
  const places = cells.map(() => ({ x: 0, y: 0 }));
  let y = 0;
  for (const row of rows) {
    const rowWidth = row.reduce((sum, i) => sum + cells[i].width, 0) + GAP * (row.length - 1);
    let x = Math.max(0, (width - rowWidth) / 2);
    for (const i of row) {
      places[i] = { x, y };
      x += cells[i].width + GAP;
    }
    y += Math.max(...row.map(i => cells[i].height)) + ROW_GAP;
  }
  return { places, height: rows.length > 0 ? y - ROW_GAP : 0 };
}
