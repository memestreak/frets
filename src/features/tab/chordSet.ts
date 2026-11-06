/**
 * A track's Chord set (`docs/specs/2026-11-05-tab-chord-set-design.md`): every chord the track names,
 * each a name and, once given, a shape. The shapes are the track's `\chord` definitions, kept in the
 * clip (`Track.chords`); a name typed over a column with no definition is in the set too, with no
 * shape, for as long as a column carries it. Pure.
 */
import { readChordName, type ChordReading } from '@/lib/theory/chordSearch';
import type { Column, Part, Track, TrackBar } from './clip';

/**
 * One alphaTex `\chord` definition, as written: a name and a shape. Every property alphaTab 1.8.4
 * reads is kept; a property not written is left out, so the definition writes back as it was.
 */
export interface ChordDef {
  name: string;
  /**
   * The fret on each string, high e first as the clip's strings are, null for a string not played.
   * Counted from the capo, on the strings as tuned. None when the definition gives no strings.
   */
  frets?: (number | null)[];
  /** The diagram's first fret (alphaTab's default is 1). */
  firstFret?: number;
  /** The frets a finger bars across. */
  barre?: number[];
  showDiagram?: boolean;
  showFingering?: boolean;
  showName?: boolean;
}

/** One chord of a track's Chord set. */
export interface ChordEntry {
  name: string;
  /** Its `\chord` definition; none for a name only typed over a column. */
  def?: ChordDef;
  /** How many columns' symbols point at it: 0 for an unused one, which is kept (spec Q7). */
  uses: number;
  /** What the name means, or null for a name that isn't a chord ("N.C."), which stays plain text. */
  reading: ChordReading | null;
}

/** Every Column of the track, every Voice. */
function* columnsOf(bars: readonly TrackBar[]): Iterable<Column> {
  for (const bar of bars) for (const voice of bar.voices) yield* voice;
}

/**
 * The definition a symbol named `name` points at: the last one of that name, as alphaTab links it.
 * Names match exactly, case and all, since "AM7" and "Am7" are different chords.
 */
export function chordDefOf(chords: readonly ChordDef[] | undefined, name: string): ChordDef | undefined {
  return chords?.findLast(def => def.name === name);
}

/**
 * The track's Chord set: its definitions in the order written, then each name only typed over a
 * column, in the order the columns come. Two definitions may share a name; symbols point at the last.
 */
export function chordSet(track: Pick<Track, 'chords' | 'bars'>): ChordEntry[] {
  const defs = track.chords ?? [];
  const entries: ChordEntry[] = defs.map(def => ({ name: def.name, def, uses: 0, reading: readChordName(def.name) }));
  const byName = new Map<string, ChordEntry>();
  for (const entry of entries) byName.set(entry.name, entry);
  for (const column of columnsOf(track.bars)) {
    if (!column.chord) continue;
    let entry = byName.get(column.chord);
    if (!entry) {
      entry = { name: column.chord, uses: 0, reading: readChordName(column.chord) };
      entries.push(entry);
      byName.set(entry.name, entry);
    }
    entry.uses++;
  }
  return entries;
}

/** A definition as the alphaTex writer wants it: `\chord ("Am7" 0 1 0 2 0 x) {firstfret 1}`. */
export function chordDefTex(def: ChordDef, quoted: (text: string) => string): string {
  const frets = (def.frets ?? []).map(f => (f === null ? 'x' : String(f)));
  const props: string[] = [];
  if (def.firstFret !== undefined) props.push(`firstfret ${def.firstFret}`);
  if (def.barre?.length) props.push(def.barre.length === 1 ? `barre ${def.barre[0]}` : `barre (${def.barre.join(' ')})`);
  if (def.showDiagram !== undefined) props.push(`showdiagram ${def.showDiagram}`);
  if (def.showFingering !== undefined) props.push(`showfingering ${def.showFingering}`);
  if (def.showName !== undefined) props.push(`showname ${def.showName}`);
  const args = `(${[quoted(def.name), ...frets].join(' ')})`;
  return props.length > 0 ? `\\chord ${args} {${props.join(' ')}}` : `\\chord ${args}`;
}

const isFret = (v: unknown) => v === null || (Number.isInteger(v) && (v as number) >= 0);
const isWhole = (v: unknown) => Number.isInteger(v) && (v as number) >= 0;
const optBool = (v: unknown) => v === undefined || typeof v === 'boolean';

/** A stored definition, checked field by field. */
export function isChordDef(v: unknown): v is ChordDef {
  if (typeof v !== 'object' || v === null) return false;
  const d = v as Record<string, unknown>;
  return typeof d.name === 'string'
    && (d.frets === undefined || (Array.isArray(d.frets) && d.frets.length === 6 && d.frets.every(isFret)))
    && (d.firstFret === undefined || isWhole(d.firstFret))
    && (d.barre === undefined || (Array.isArray(d.barre) && d.barre.every(isWhole)))
    && optBool(d.showDiagram) && optBool(d.showFingering) && optBool(d.showName);
}

/** Chord definitions the track can change: a part or a track (`Track.chords`). */
type WithChords = { chords?: ChordDef[] };

/**
 * The track with the chord `name` given the shape `frets` (high e first), as the Chords panel picks one
 * (issue #251): the definition symbols point at (the last of that name) changes, keeping whether it
 * shows its diagram, name and fingering; its first fret and barre described the old shape, so they go.
 * A name with no definition gets one, at the end.
 */
export function withChordShape<T extends WithChords>(track: T, name: string, frets: readonly (number | null)[]): T {
  const chords = track.chords ?? [];
  const at = chords.findLastIndex(def => def.name === name);
  if (at < 0) return { ...track, chords: [...chords, { name, frets: [...frets] }] };
  const def: ChordDef = { ...chords[at], frets: [...frets] };
  delete def.firstFret;
  delete def.barre;
  return { ...track, chords: chords.map((d, i) => (i === at ? def : d)) };
}

/**
 * The track with a new chord in its Chord set (the chord view's Add chord): a definition of `name`, with
 * `frets` when there is a shape for it. A name that already has a definition is left as it is.
 */
export function withNewChord<T extends WithChords>(track: T, name: string, frets: readonly (number | null)[] | null): T {
  const chords = track.chords ?? [];
  if (chords.some(def => def.name === name)) return track;
  return { ...track, chords: [...chords, frets ? { name, frets: [...frets] } : { name }] };
}

/** The track with every definition of `name` taken out of its Chord set (the Chords panel's Delete, for an unused chord). */
export function withoutChord<T extends WithChords>(track: T, name: string): T {
  if (!track.chords?.some(def => def.name === name)) return track;
  return { ...track, chords: track.chords.filter(def => def.name !== name) };
}

/**
 * The part with the chord `from` called `to` (the chord view's Save chord): its definitions, and every
 * column that names it, in this Voice and the others the part carries. Nothing changes for `to` already
 * taken, which the view doesn't offer.
 */
export function withRenamedChord(part: Part, from: string, to: string): Part {
  const voices = part.bars.flatMap(bar => [bar.columns, ...(bar.otherVoices ?? []).map(v => v.columns)]);
  const taken = part.chords?.some(def => def.name === to) || voices.some(columns => columns.some(c => c.chord === to));
  if (from === to || taken) return part;
  const rename = (columns: Column[]) => columns.map(c => (c.chord === from ? { ...c, chord: to } : c));
  return {
    ...part,
    chords: part.chords?.map(def => (def.name === from ? { ...def, name: to } : def)),
    bars: part.bars.map(bar => ({
      ...bar,
      columns: rename(bar.columns),
      ...(bar.otherVoices && { otherVoices: bar.otherVoices.map(v => ({ ...v, columns: rename(v.columns) })) }),
    })),
  };
}
