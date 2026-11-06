/**
 * What the Chords panel and its Chord dialog share (`docs/specs/2026-11-05-tab-chord-panel-design.md`):
 * a chord name read into a chord, its shapes on a track's tuning, the two ways round a shape is
 * written, the names and fingering of a column's notes, and the chord a diagram is drawn with. Pure.
 */
import { PAGE_LOOK, type DiagramLook } from '@/components/chords/ChordDiagram';
import { findShapes, type Shape } from '@/lib/chords/shapes';
import { nameNotes } from '@/lib/theory/chordNames';
import { chordOf, withBass, type ChordInfo } from '@/lib/theory/chords';
import { readChordName } from '@/lib/theory/chordSearch';
import { mod12, pitchClassOf } from '@/lib/theory/notes';
import { chordDefOf } from './chordSet';
import type { Column, Part } from './clip';
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

/**
 * The names `nameNotes` finds for a shape's notes (high e first), the best four; none for fewer than two
 * notes. Counted from the capo, as a name's shapes are, so the C shape is "C" whatever the capo.
 */
export function namesForFrets(part: Part, frets: readonly (number | null)[]): string[] {
  const open = writtenStrings(part.tuning);
  const pitches = frets.flatMap((fret, s) => (fret === null ? [] : [open[s] + fret]));
  if (pitches.length < 2) return [];
  return nameNotes(pitches, Math.min(...pitches)).slice(0, 4).map(n => n.symbol);
}

/** A column's frets as a definition's (high e first), or null for one with fewer than two fretted notes: not a chord. */
export function fretsOfColumn(column: Column | null): (number | null)[] | null {
  const frets = (column?.notes ?? []).map(n => (n && n.fret !== null ? n.fret : null));
  return frets.filter(f => f !== null).length >= 2 ? frets : null;
}

/** The names of a column's notes (`namesForFrets`); none for a column that isn't a chord. */
export function namesForColumn(part: Part, column: Column | null): string[] {
  const frets = fretsOfColumn(column);
  return frets ? namesForFrets(part, frets) : [];
}

/** Whether every note of a shape (low string first) is one of the chord's tones, as a diagram needs. */
export function fits(chord: ChordInfo, shape: Shape, tuning: readonly number[]): boolean {
  return shape.every((fret, s) => fret === null || chord.tones.some(t => t.semis === mod12(tuning[s] + fret - chord.rootPc)));
}

/**
 * The chord to draw a shape's diagram with: the one `name` means if the shape's notes are all its tones,
 * else one its notes are; null when there is none (a diagram can't be drawn).
 */
export function chordToDraw(part: Part, name: string, shape: Shape): ChordInfo | null {
  const tuning = lowFirst(part);
  for (const n of [name, ...namesForFrets(part, toFrets(shape))]) {
    const chord = chordOfName(n);
    if (chord && fits(chord, shape, tuning)) return chord;
  }
  return null;
}
