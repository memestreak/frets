import { TUNING } from '@/lib/music';
import type { ChordInfo } from './chordTypes';
import type { Voicing } from './voicings';
import data from './data/haus-of-chords.json';

/*
 * The shapes guitarists actually play, from Haus of Chords
 * (src/lib/chords/data/README.md): every shape here is published by at
 * least two independent teaching sources. Open shapes belong to one root;
 * moveable shapes are written on C and slid to the chord's root.
 */

interface PublishedShape {
  /** "x-3-2-0-1-0", as `voicingKey` writes it. */
  shape: string;
  /** Independent sources that publish it. */
  sources: number;
}

interface PublishedType {
  name: string;
  formula: string;
  open: PublishedShape[];
  moveableOnC: PublishedShape[];
}

/** The imported data, by our chord type id. */
export const PUBLISHED_TYPES: Readonly<Record<string, PublishedType>> = data.types;

export interface PublishedShapes {
  /** The open shapes for this root, as the source lists them. */
  open: Voicing[];
  /** The moveable shapes on this root, minus near-duplicates (see `dropMuteVariants`). */
  moveable: Voicing[];
  /** Every moveable shape on this root. */
  allMoveable: Voicing[];
}

const parse = (shape: string): Voicing => shape.split('-').map(f => (f === 'x' ? null : Number(f)));
const sounding = (v: Voicing) => v.filter((f): f is number => f !== null);
/** Pitch class of the lowest sounding note, which is the root. */
const bassPc = (v: Voicing) => {
  const s = v.findIndex(f => f !== null);
  return (TUNING[s] + v[s]!) % 12;
};

/** A shape written on C moved to `rootPc`, as low on the neck as it goes (the F barre at fret 1, not 13). */
function slide(onC: Voicing, rootPc: number): Voicing {
  let shift = rootPc;
  while (Math.min(...sounding(onC)) + shift - 12 >= 1) shift -= 12;
  return onC.map(f => (f === null ? null : f + shift));
}

/** Whether `a` is `b` with one more string muted. */
function isMuteVariant(a: Voicing, b: Voicing): boolean {
  const differing = a.flatMap((f, s) => (f === b[s] ? [] : [s]));
  return differing.length === 1 && a[differing[0]] === null;
}

/**
 * Of two shapes that differ only by one muted string, keeps the one more
 * sources publish (the first listed on a tie), as the Haus of Chords book
 * does: x-3-5-5-5-3 stays, x-3-5-5-5-x goes.
 */
function dropMuteVariants(shapes: PublishedShape[]): PublishedShape[] {
  const beats = (a: PublishedShape, b: PublishedShape, ia: number, ib: number) =>
    a.sources > b.sources || (a.sources === b.sources && ia < ib);
  return shapes.filter((s, i) => !shapes.some((t, j) => {
    const [vs, vt] = [parse(s.shape), parse(t.shape)];
    return (isMuteVariant(vs, vt) || isMuteVariant(vt, vs)) && beats(t, s, j, i);
  }));
}

/** The published shapes for a chord, or null when the source has none for its type. */
export function publishedShapes(chord: ChordInfo): PublishedShapes | null {
  const type = chord.type && PUBLISHED_TYPES[chord.type.id];
  if (!type) return null;
  const onRoot = (shapes: PublishedShape[]) =>
    shapes.map(s => slide(parse(s.shape), chord.rootPc));
  return {
    open: dropMuteVariants(type.open).map(s => parse(s.shape)).filter(v => bassPc(v) === chord.rootPc),
    moveable: onRoot(dropMuteVariants(type.moveableOnC)),
    allMoveable: onRoot(type.moveableOnC),
  };
}
