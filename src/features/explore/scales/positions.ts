import { chordFromTones, type ChordInfo } from '@/lib/chords/chordTypes';
import { chordHref } from '@/lib/chords/chordUrls';
import {
  findVoicings, LAST_POSITION, POSITION_FRETS, shapesInPosition, type Voicing,
} from '@/lib/chords/voicings';
import type { DiatonicChord, Scale } from './theory';

/*
 * The "In one position" card's logic: each diatonic chord as the Chord
 * library knows it, and its shapes in a five-fret position. The shapes
 * come from the library's generator (`findVoicings`), so both pages agree.
 */

/** A diatonic chord as a `ChordInfo`: its root's pitch class and its tones above it. */
export function chordInfoOf(scale: Scale, chord: DiatonicChord): ChordInfo {
  const rootPc = scale.degrees[chord.index].pc;
  return chordFromTones(rootPc, chord.semis.map(s => s - chord.semis[0]));
}

export interface PositionChord {
  chord: DiatonicChord;
  info: ChordInfo;
  /** Its shapes in the position, easiest first; empty when none fits. */
  shapes: Voicing[];
}

/** Every chord with its shapes in the position from fret `first`. */
export function chordsInPosition(
  scale: Scale, chords: DiatonicChord[], first: number,
): PositionChord[] {
  return chords.map(chord => {
    const info = chordInfoOf(scale, chord);
    return { chord, info, shapes: shapesInPosition(findVoicings(info), first) };
  });
}

/** The last fret of the position from fret `first`. */
export const positionEnd = (first: number) => first + POSITION_FRETS - 1;

/** "Frets 5–9"; the first position takes in the open strings: "Open–5". */
export const positionLabel = (first: number) =>
  `${first === 1 ? 'Open' : `Frets ${first}`}–${positionEnd(first)}`;

/** Keeps a position on the neck: 1 to `LAST_POSITION`. */
export const clampPosition = (first: number) => Math.min(Math.max(first, 1), LAST_POSITION);

/** The chord's Chord library page, opening on the shape; null for a chord the library has no type for. */
export function libraryHref(info: ChordInfo, shape: Voicing | undefined): string | null {
  return info.type ? chordHref({ root: info.root, type: info.type.id }, shape) : null;
}
