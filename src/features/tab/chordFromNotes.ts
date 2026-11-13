/**
 * A chord named from picked notes (issue #464, `docs/specs/2026-11-13-tab-chord-from-notes-design.md`): the
 * notes of the selected columns (or the cursor's column), in every Voice in their time, even a broken or
 * arpeggiated chord spread over several beats, read as one chord. Its name goes over the first column and
 * its shape into the track's Chord set. Shapes are counted from the capo, as the Chords panel's are; the name
 * is the shape's by default (frets 5 5 5 7 under Capo 2 are Am), or the sounding one (Bm) when Settings ›
 * Tab › Editing says so. Pure.
 */
import { nameNotes } from '@/lib/theory/chordNames';
import { STRING_COUNT, type Part } from './clip';
import type { ChordNames } from './editingPrefs';
import { chordDefOf, freeName } from './chordSet';
import { shapeFor } from './chordShapes';
import { placeOf, selectedRange, withColumn, without, type Cursor, type Selection } from './editing';
import { writtenStrings } from './notation';
import { asVoice, voiceSelections } from './voices';
import { timeOf } from './timeline';

/** A picked note: its string (0 = high e), its fret, and when it starts, for "first on its string". */
interface PickedNote {
  string: number;
  fret: number;
  start: number;
}

/**
 * Every fretted note the columns `[from, to]` of the part's own Voice hold, and the other Voices' notes
 * starting in their time (Dorico's selection covers every Voice in its time), earliest first. Tied notes
 * count (they sound the same pitch); dead notes (x) have no pitch, so they don't.
 */
export function pickedNotes(part: Part, selection: Selection): PickedNote[] {
  const runs: [Part, [number, number]][] = [[part, selectedRange(selection)]];
  for (const [voice, range] of voiceSelections(part, selection)) runs.push([asVoice(part, voice), range]);
  const notes: PickedNote[] = [];
  for (const [voicePart, [from, to]] of runs) {
    for (let i = from; i <= to; i++) {
      const { bar, column } = placeOf(voicePart, i);
      const start = timeOf(voicePart, bar, column);
      voicePart.bars[bar].columns[column]?.notes.forEach((note, string) => {
        if (note && note.fret !== null) notes.push({ string, fret: note.fret, start });
      });
    }
  }
  return notes.sort((a, b) => a.start - b.start || a.string - b.string);
}

/** Why there is no chord when nothing picked has a note (rests, an empty bar, dead notes only). */
export const NO_NOTES = 'Pick some notes first: a chord, or the notes of a broken chord or arpeggio.';

/** What `chordFromNotes` makes: a name and shape (high e first), or why there is none. */
export type ChordFromNotes = { name: string; frets: (number | null)[] } | { problem: string };

/**
 * The picked notes as one chord: its best name (`nameNotes`: every note counts, the lowest note is the
 * bass; the shape's name, counted from the capo, or with `names` 'sounding' the sounding one), and its shape, each
 * string's first picked note, a string with none muted. Fewer than two
 * different notes (or none: rests), or notes no chord type spells, give a problem instead.
 */
export function chordFromNotes(part: Part, selection: Selection, names: ChordNames = 'shape'): ChordFromNotes {
  const notes = pickedNotes(part, selection);
  const open = writtenStrings(part.tuning);
  if (notes.length === 0) return { problem: NO_NOTES };
  // The sounding name counts the capo in; the shape's is counted from it, as tab is written.
  const capo = names === 'sounding' ? part.capo ?? 0 : 0;
  const pitches = notes.map(n => open[n.string] + capo + n.fret);
  if (new Set(pitches.map(p => p % 12)).size < 2) return { problem: 'Pick at least two different notes to name a chord.' };
  const best = nameNotes(pitches, Math.min(...pitches))[0];
  if (!best) return { problem: 'Frets can’t name these notes as a chord. If a passing note is among them, pick fewer.' };
  const frets: (number | null)[] = Array.from({ length: STRING_COUNT }, () => null);
  for (const n of notes) if (frets[n.string] === null) frets[n.string] = n.fret;
  return { name: best.symbol, frets };
}

const sameShape = (a: readonly (number | null)[], b: readonly (number | null)[]) =>
  a.length === b.length && a.every((f, i) => f === b[i]);

/**
 * The part with the chord written: `name` over the column at `at`, and `frets` in the Chord set. A name the
 * set already has with this shape is used again; with another shape (its definition's, or for a name only
 * typed, the shape it is drawn with), the chord is added under a free name ("Am 2"), so nothing else in the
 * track changes. Returns the part and the name written.
 */
export function writeChordFromNotes(part: Part, at: Cursor, name: string, frets: readonly (number | null)[]): { part: Part; name: string } {
  // Every name the track has: its definitions, and names only typed over a column, in every Voice.
  const taken = [...new Set([
    ...(part.chords ?? []).map(d => d.name),
    ...part.bars.flatMap(bar => [bar.columns, ...(bar.otherVoices ?? []).map(o => o.columns)].flat().flatMap(c => (c.chord ? [c.chord] : []))),
  ])];
  const has = (n: string) => taken.includes(n);
  const shapeOf = (n: string) => chordDefOf(part.chords, n)?.frets ?? shapeFor(part, n);
  let written = name;
  if (has(name)) {
    const shape = shapeOf(name);
    if (!shape || !sameShape(shape, frets)) written = freeName(name, taken);
  }
  const defined = chordDefOf(part.chords, written)?.frets
    ? part
    : { ...part, chords: [...(part.chords ?? []).filter(d => d.name !== written), { name: written, frets: [...frets] }] };
  const named = withColumn(defined, at, column => ({ ...without(column, 'chord'), chord: written }));
  return { part: named, name: written };
}
