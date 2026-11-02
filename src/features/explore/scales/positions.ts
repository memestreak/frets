import type { ChordInfo } from '@/lib/theory/chords';
import { chordHref } from '@/lib/chords/chordUrls';
import {
  findShapes, LAST_POSITION, POSITION_FRETS, shapesInPosition, type Shape,
} from '@/lib/chords/shapes';
import type { DiatonicChord } from '@/lib/theory/diatonic';

/*
 * The "Diatonic chords" card's logic: each diatonic chord as the Chord
 * library knows it, and its shapes in a five-fret position. The shapes
 * come from the library's generator (`findShapes`), so both pages agree.
 */

export interface PositionChord {
  chord: DiatonicChord;
  info: ChordInfo;
  /** Its shapes in the position, easiest first; empty when none fits. */
  shapes: Shape[];
}

/** Every chord with its shapes in the position from fret `first`. */
export function chordsInPosition(
  chords: DiatonicChord[], first: number,
): PositionChord[] {
  return chords.map(chord => ({
    chord, info: chord.info, shapes: shapesInPosition(findShapes(chord.info), first),
  }));
}

/** The last fret of the position from fret `first`. */
export const positionEnd = (first: number) => first + POSITION_FRETS - 1;

/** "Frets 5–9"; the first position takes in the open strings: "Open–5". */
export const positionLabel = (first: number) =>
  `${first === 1 ? 'Open' : `Frets ${first}`}–${positionEnd(first)}`;

/** Keeps a position on the neck: 1 to `LAST_POSITION`. */
export const clampPosition = (first: number) => Math.min(Math.max(first, 1), LAST_POSITION);

/** The chord's Chord library page, opening on the shape; null for a chord the library has no type for. */
export function libraryHref(info: ChordInfo, shape: Shape | undefined): string | null {
  return info.type ? chordHref({ root: info.root, type: info.type.id }, shape) : null;
}
