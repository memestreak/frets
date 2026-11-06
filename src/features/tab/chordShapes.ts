/**
 * What the Chords panel and its Chord dialog share (`docs/specs/2026-11-05-tab-chord-panel-design.md`):
 * a chord name read into a chord, its shapes on a track's tuning, and the two ways round a shape is
 * written. Pure.
 */
import { PAGE_LOOK, type DiagramLook } from '@/components/chords/ChordDiagram';
import { findShapes, type Shape } from '@/lib/chords/shapes';
import { chordOf, withBass, type ChordInfo } from '@/lib/theory/chords';
import { readChordName } from '@/lib/theory/chordSearch';
import { pitchClassOf } from '@/lib/theory/notes';
import { chordDefOf } from './chordSet';
import type { Part } from './clip';
import { writtenStrings } from './notation';

/** Plain ink dots, as printed chord charts: no degree colours (Jeremy, 2026-11-01). */
export const PLAIN_LOOK: DiagramLook = { ...PAGE_LOOK, tone: () => ({ fill: 'var(--ink)', fg: 'var(--surface-raised)' }) };

/** The chord a name means, over its bass for a slash chord; null for a name that isn't a chord ("N.C."). */
export function chordOfName(name: string): ChordInfo | null {
  const reading = readChordName(name);
  if (!reading) return null;
  const chord = chordOf(reading.root, reading.type);
  return reading.bass ? withBass(chord, pitchClassOf(reading.bass)) : chord;
}

/** A shape (low string first, as the Chords page has them) as a definition's frets (high e first), and back. */
export const toFrets = (shape: Shape): (number | null)[] => [...shape].reverse();
export const toShape = (frets: readonly (number | null)[]): Shape => [...frets].reverse();

/** The track's tuning low string first, as MIDI, which the shape search takes. */
export const lowFirst = (part: Part): number[] => [...writtenStrings(part.tuning)].reverse();

/** A chord's shapes on the track's tuning: the open ones, then the best few moveable ones (published first). */
export function shapesOf(chord: ChordInfo, tuning: readonly number[]): Shape[] {
  const found = findShapes(chord, tuning);
  return [...found.open, ...found.moveable];
}

/** The shape a chord sounds and is inserted with: its definition's, else its first; null for none. */
export function shapeFor(part: Part, name: string): (number | null)[] | null {
  const def = chordDefOf(part.chords, name);
  if (def?.frets) return def.frets;
  const chord = chordOfName(name);
  const first = chord ? shapesOf(chord, lowFirst(part))[0] : undefined;
  return first ? toFrets(first) : null;
}
