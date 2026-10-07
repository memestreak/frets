import { prettyNote } from '@/lib/notation';
import {
  chromaOf, diatonicChords, rotateMode, scaleDef, scaleOf, transposeNote,
  type DiatonicChord, type Root, type Scale,
} from '../scales/theory';

/*
 * The circle of fifths page's music theory, with no React. The wheel has
 * twelve spokes, C at the top and clockwise in fifths; each spoke holds a
 * major key (outer ring), its relative minor (middle ring) and its vii°
 * (inner ring). `keyWheel` and `modeWheel` say what every cell shows for
 * the Key and Mode views; `CircleWheel` only draws what they return.
 * Spelling comes from the Scale lab's theory, the section's tonal import.
 */

const mod12 = (n: number) => ((n % 12) + 12) % 12;

/** Major keys round the outer ring, from C at the top, clockwise. */
export const MAJOR_KEYS: readonly Root[] = [
  'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F',
];
/** Each major key's relative minor, on the same spoke. */
export const MINOR_KEYS: readonly Root[] = [
  'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'Bb', 'F', 'C', 'G', 'D',
];
const IONIAN = scaleDef('ionian')!;
const AEOLIAN = scaleDef('aeolian')!;
/** Each major key's vii°, spelled in that key: F♯ major's is E♯°. */
export const DIM_ROOTS: readonly string[] = MAJOR_KEYS.map(k => scaleOf(k, IONIAN).degrees[6].note);

export type Ring = 'major' | 'minor' | 'dim';
export const RINGS: readonly Ring[] = ['major', 'minor', 'dim'];

/** One cell of the wheel: a ring and a spoke, 0–11 clockwise from the top. */
export interface Cell {
  ring: Ring;
  spoke: number;
}

export const cellId = ({ ring, spoke }: Cell): string => `${ring}:${spoke}`;

/** Semitones from a cell's major key up to the root of its chord. */
const RING_OFFSET: Record<Ring, number> = { major: 0, minor: 9, dim: 11 };

/** Pitch class (0–11) of the root of a cell's chord. */
export const rootPc = ({ ring, spoke }: Cell): number => mod12(spoke * 7 + RING_OFFSET[ring]);

/** The spoke whose major key starts on this pitch class (7 × 7 ≡ 1, mod 12). */
export const majorSpoke = (pc: number): number => mod12(pc * 7);

const RING_OF_QUALITY: Record<string, Ring> = { major: 'major', minor: 'minor', diminished: 'dim' };

/** The cell of a triad, from its root and quality; null for an augmented one. */
export function cellOf(pc: number, quality: string): Cell | null {
  const ring = RING_OF_QUALITY[quality];
  return ring ? { ring, spoke: majorSpoke(pc - RING_OFFSET[ring]) } : null;
}

/** A cell's chord as the wheel names it: "F♯", "D♯m", "E♯°". */
export function cellName({ ring, spoke }: Cell): string {
  if (ring === 'major') return prettyNote(MAJOR_KEYS[spoke]);
  if (ring === 'minor') return `${prettyNote(MINOR_KEYS[spoke])}m`;
  return `${prettyNote(DIM_ROOTS[spoke])}°`;
}

/** Every cell, outer ring first. */
export const ALL_CELLS: readonly Cell[] = RINGS.flatMap(ring =>
  Array.from({ length: 12 }, (_, spoke) => ({ ring, spoke })));

// ---------------------------------------------------------------- signatures

const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER = [...SHARP_ORDER].reverse();

export interface KeySignature {
  sharps: boolean;
  /** In the order they are written: "F♯", "C♯"… */
  notes: string[];
}

/** The key signature of a spoke: sharps up to F♯ at the bottom, then flats. */
export function keySignature(spoke: number): KeySignature {
  if (spoke <= 6) return { sharps: true, notes: SHARP_ORDER.slice(0, spoke).map(n => `${n}♯`) };
  return { sharps: false, notes: FLAT_ORDER.slice(0, 12 - spoke).map(n => `${n}♭`) };
}

/** What a key signature's hover tip says. */
export function signatureTip(spoke: number): string {
  const { notes } = keySignature(spoke);
  const keys = `${prettyNote(MAJOR_KEYS[spoke])} major and ${prettyNote(MINOR_KEYS[spoke])} minor`;
  const tip = `${keys}: ${notes.length ? notes.join(' ') : 'no sharps or flats'}.`;
  return spoke === 6 ? `${tip} Spelled as G♭ major, the same key has six flats: B♭ E♭ A♭ D♭ G♭ C♭.` : tip;
}

// ------------------------------------------------------------------ numerals

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];

export interface Numeral {
  numeral: string;
  /** 1–7: picks the degree colour. */
  degree: number;
}

/**
 * A cell's numeral against a tonic, counted on the major scale from it as
 * in the Scale lab. Its root takes the plainest name: a natural degree,
 * else the flat of the one above (E in C is III, G♭ is ♭V).
 */
export function numeralOf(cell: Cell, tonicPc: number): Numeral {
  const semis = mod12(rootPc(cell) - tonicPc);
  const natural = MAJOR_STEPS.indexOf(semis);
  const index = natural >= 0 ? natural : MAJOR_STEPS.indexOf(semis + 1);
  let roman = ROMAN[index];
  if (cell.ring !== 'major') roman = roman.toLowerCase();
  if (cell.ring === 'dim') roman += '°';
  return { numeral: (natural >= 0 ? '' : '♭') + roman, degree: index + 1 };
}

// ------------------------------------------------------------- wheel models

/** What one cell shows. A cell with none of these is drawn plain. */
export interface CellLook {
  /** Filled with this degree's colour (1–7): a chord of the key or mode. */
  fill?: number;
  /** A dashed border in this degree's colour: a chord from outside. */
  edge?: number;
  numeral?: string;
  /** An ink ring: solid marks a root or signature chord, dashed a V/x. */
  ring?: 'solid' | 'dashed';
  tip?: string;
}

/** An arrow from one cell to another: a secondary dominant resolving. */
export interface WheelArrow {
  from: Cell;
  to: Cell;
  tip: string;
}

/** A label outside the rim, on a spoke: the Mode view's mode names. */
export interface RimLabel {
  spoke: number;
  text: string;
  current: boolean;
  tip: string;
}

/** A chord listed under the wheel. */
export interface ChordChip {
  name: string;
  numeral: string;
  degree: number;
  /** Outside the key or mode: drawn dashed. */
  outside?: boolean;
  /** Ringed like its cell: a mode's root or signature chord. */
  ringed?: boolean;
  tip?: string;
}

export interface WheelModel {
  cells: Map<string, CellLook>;
  arrows: WheelArrow[];
  rim: RimLabel[];
  /** The spoke whose notes are in use: its key signature is drawn darker. */
  homeSpoke: number;
  /** The selected key's tonic cell (the Key view's pressed cell), if any. */
  tonic: Cell | null;
  /** Two lines in the middle of the wheel. */
  centre: [string, string];
}

/** A scale's seven triads, with the cell each sits in. */
interface Placed {
  chord: DiatonicChord;
  cell: Cell;
  id: string;
  /** 1–7. */
  degree: number;
}

function placeTriads(scale: Scale): Placed[] {
  return diatonicChords(scale, 3).flatMap(chord => {
    const cell = cellOf(scale.degrees[chord.index].pc, chord.quality);
    return cell ? [{ chord, cell, id: cellId(cell), degree: chord.index + 1 }] : [];
  });
}

const chipOf = (p: Placed, extra: Partial<ChordChip> = {}): ChordChip => ({
  name: p.chord.symbol, numeral: p.chord.numeral, degree: p.degree, ...extra,
});

/** Numerals and tips for every cell that has none yet: "All numerals". */
function numberTheRest(cells: Map<string, CellLook>, tonicPc: number, context: string) {
  for (const cell of ALL_CELLS) {
    const id = cellId(cell);
    const look = cells.get(id) ?? {};
    if (look.numeral) continue;
    const { numeral } = numeralOf(cell, tonicPc);
    cells.set(id, {
      ...look, numeral, tip: look.tip ?? `${cellName(cell)}: ${numeral} in ${context}, outside it.`,
    });
  }
}

// ------------------------------------------------------------------ Key view

/** A key: a spoke, and whether it is the spoke's minor key. */
export interface Key {
  spoke: number;
  minor: boolean;
}

export const keyTonic = (k: Key): Root => (k.minor ? MINOR_KEYS : MAJOR_KEYS)[k.spoke];
export const keyName = (k: Key): string =>
  `${prettyNote(keyTonic(k))} ${k.minor ? 'minor' : 'major'}`;
const keyScale = (k: Key): Scale => scaleOf(keyTonic(k), k.minor ? AEOLIAN : IONIAN);
const keyCell = (k: Key): Cell => ({ ring: k.minor ? 'minor' : 'major', spoke: k.spoke });

/** The key on the same tonic, the other way: C major ↔ C minor. */
export function parallelKey(k: Key): Key {
  const pc = rootPc(keyCell(k));
  return k.minor
    ? { spoke: majorSpoke(pc), minor: false }
    : { spoke: cellOf(pc, 'minor')!.spoke, minor: true };
}

/** Why a chord of the key sits where it does: its hover tip. */
function describeInKey(p: Placed, k: Key, scale: Scale): string {
  const name = keyName(k);
  const tip = `${p.chord.symbol}: ${p.chord.numeral} in ${name}. `;
  if (p.degree === 1) {
    const relative = { spoke: k.spoke, minor: !k.minor };
    return `${tip}The tonic. ${keyName(relative)}, its relative ${relative.minor ? 'minor' : 'major'}, shares this spoke: same notes, same key signature.`;
  }
  if (p.cell.ring === 'dim') {
    const root = prettyNote(scale.degrees[p.chord.index].note);
    const role = k.minor ? 'the 2nd degree' : 'the 7th degree, the leading tone';
    return `${tip}Built on ${root}, ${role}. The inner ring holds each major key's diminished chord, on that key's spoke.`;
  }
  const major = prettyNote(MAJOR_KEYS[p.cell.spoke]);
  if (p.cell.ring === 'minor') {
    if (p.cell.spoke === k.spoke) {
      return `${tip}Also the tonic of ${prettyNote(MINOR_KEYS[p.cell.spoke])} minor, ${name}'s relative minor: same notes, same key signature, so it shares the tonic's spoke.`;
    }
    return `${tip}It sits under ${major} because it is ${major}'s relative minor: the two share their notes.`;
  }
  if (p.cell.spoke === k.spoke) return `${tip}Straight above the tonic: ${major} major is ${name}'s relative major.`;
  const clockwise = mod12(p.cell.spoke - k.spoke) === 1;
  const role = k.minor ? '' : clockwise ? ': the dominant, which pulls back home' : ': the subdominant';
  return `${tip}One spoke ${clockwise ? 'clockwise' : 'counterclockwise'} of the tonic, a fifth ${clockwise ? 'above' : 'below'}${role}.`;
}

export interface KeyOptions {
  parallel: boolean;
  dominants: boolean;
  allNumerals: boolean;
}

export interface KeyWheel extends WheelModel {
  title: string;
  chords: ChordChip[];
  /** Name of the parallel key, and its chords that aren't in this key. */
  parallelName: string;
  borrowed: ChordChip[];
  dominants: ChordChip[];
}

/** Everything the Key view shows for a key. */
export function keyWheel(k: Key, opts: KeyOptions): KeyWheel {
  const scale = keyScale(k);
  const tonicPc = scale.degrees[0].pc;
  const name = keyName(k);
  const home = placeTriads(scale);
  const cells = new Map<string, CellLook>();
  for (const p of home) {
    cells.set(p.id, { fill: p.degree, numeral: p.chord.numeral, tip: describeInKey(p, k, scale) });
  }
  const chords = home.map(p => chipOf(p));

  // Minor keys mostly use a major V, with the 7th raised (harmonic minor).
  if (k.minor) {
    const fifth = scale.degrees[4];
    const seventh = scale.degrees[6];
    const raised = prettyNote(transposeNote(seventh.note, '1A'));
    const v = cellOf(fifth.pc, 'major')!;
    const symbol = prettyNote(fifth.note);
    const tip = `${symbol}: V in ${name}. Raising ${prettyNote(seventh.note)} to ${raised} (harmonic minor) makes the v chord major, so it pulls home like a major key's V. Most minor-key music uses it.`;
    cells.set(cellId(v), { edge: 5, numeral: 'V', tip });
    chords.push({ name: symbol, numeral: 'V', degree: 5, outside: true, tip });
  }

  const parallel = parallelKey(k);
  const parallelName = keyName(parallel);
  const borrowed: ChordChip[] = [];
  if (opts.parallel) {
    const homeIds = new Set(home.map(p => p.id));
    for (const p of placeTriads(keyScale(parallel))) {
      if (homeIds.has(p.id)) continue;
      const tip = `${p.chord.symbol}: ${p.chord.numeral} in ${name}, borrowed from ${parallelName}, the parallel ${parallel.minor ? 'minor' : 'major'}. Same tonic, different notes, so it sits outside the key's chords.`;
      if (!cells.has(p.id)) cells.set(p.id, { edge: p.degree, numeral: p.chord.numeral, tip });
      borrowed.push(chipOf(p, { outside: true, tip }));
    }
  }

  const arrows: WheelArrow[] = [];
  const dominants: ChordChip[] = [];
  if (opts.dominants) {
    for (const p of home) {
      if (p.degree === 1 || p.cell.ring === 'dim') continue;
      const v = transposeNote(p.chord.tones[0], '5P');
      const vCell = cellOf(chromaOf(v), 'major')!;
      const symbol = `${prettyNote(v)}7`;
      const tip = `${symbol} is V/${p.chord.numeral}, a secondary dominant: it resolves to ${p.chord.symbol}, a fifth below, as V resolves to I.`;
      arrows.push({ from: vCell, to: p.cell, tip });
      dominants.push({ name: symbol, numeral: `V/${p.chord.numeral}`, degree: 5, outside: true, tip });
      const id = cellId(vCell);
      if (id === cellId(keyCell(k))) continue;
      const look = cells.get(id) ?? {};
      cells.set(id, { ...look, ring: 'dashed', tip: look.tip ? `${look.tip} ${tip}` : tip });
    }
  }

  if (opts.allNumerals) numberTheRest(cells, tonicPc, name);

  return {
    title: name, cells, arrows, rim: [], homeSpoke: k.spoke, tonic: keyCell(k),
    centre: [prettyNote(keyTonic(k)), k.minor ? 'minor' : 'major'],
    chords, parallelName, borrowed, dominants,
  };
}

// ----------------------------------------------------------------- Mode view

export type ModeId = 'lydian' | 'ionian' | 'mixolydian' | 'dorian' | 'aeolian' | 'phrygian' | 'locrian';

export interface ModeDef {
  id: ModeId;
  name: string;
  /** Spokes from the root's major key to the key whose notes the mode uses. */
  offset: number;
  /** Index (0–6) of the chord that carries the mode's sound; null for Ionian. */
  signature: number | null;
  /** The degree that sets the mode apart from major or minor: Dorian's 6. */
  character: string | null;
}

/** The seven modes of the major scale, brightest first. */
export const MODES: readonly ModeDef[] = [
  { id: 'lydian', name: 'Lydian', offset: 1, signature: 1, character: '♯4' },
  { id: 'ionian', name: 'Ionian', offset: 0, signature: null, character: null },
  { id: 'mixolydian', name: 'Mixolydian', offset: -1, signature: 6, character: '♭7' },
  { id: 'dorian', name: 'Dorian', offset: -2, signature: 3, character: '6' },
  { id: 'aeolian', name: 'Aeolian', offset: -3, signature: 5, character: '♭6' },
  { id: 'phrygian', name: 'Phrygian', offset: -4, signature: 1, character: '♭2' },
  { id: 'locrian', name: 'Locrian', offset: -5, signature: 4, character: '♭5' },
];

export const modeDef = (id: ModeId): ModeDef => MODES.find(m => m.id === id)!;
const modeScale = (root: Root, id: ModeId): Scale => scaleOf(root, scaleDef(id)!);

/** The degree labels a mode changes against the major scale: Dorian ♭3 ♭7. */
function alteredDegrees(scale: Scale): string[] {
  return scale.degrees.map(d => d.label).filter(l => /[♭♯]/.test(l));
}

/** A mode on a root, and whether it is the one shown. */
export interface ModeChoice {
  root: Root;
  mode: ModeId;
  current: boolean;
}

/** One row of the Parallel modes table. */
export interface ParallelRow extends ModeChoice {
  name: string;
  /** Formula labels, "1" to "7". */
  degrees: string[];
  /** Which degrees this row flattens from the row above (none for the first). */
  changed: boolean[];
  /** The major key whose notes it uses, e.g. "B♭". */
  parent: string;
}

export interface ModeWheel extends WheelModel {
  title: string;
  formula: string[];
  chords: ChordChip[];
  relative: (ModeChoice & { label: string })[];
  parallel: ParallelRow[];
}

/** Everything the Mode view shows for a mode on a root. */
export function modeWheel(root: Root, id: ModeId, opts: { allNumerals: boolean }): ModeWheel {
  const mode = modeDef(id);
  const scale = modeScale(root, id);
  const rootName = prettyNote(root);
  const rootPcValue = scale.degrees[0].pc;
  const rootSpoke = majorSpoke(rootPcValue);
  const parentSpoke = mod12(rootSpoke + mode.offset);
  const parentName = prettyNote(MAJOR_KEYS[parentSpoke]);
  const title = `${rootName} ${mode.name}`;

  // The relative modes: the same notes from each degree of this mode.
  const relativeOf = (index: number) => {
    const r = rotateMode(root, scaleDef(id)!, index);
    return { root: r.root, mode: r.type.id as ModeId };
  };

  const cells = new Map<string, CellLook>();
  const chords: ChordChip[] = [];
  for (const p of placeTriads(scale)) {
    const isRoot = p.degree === 1;
    const isSignature = p.chord.index === mode.signature;
    let tip = `${p.chord.symbol}: ${p.chord.numeral} in ${title}.`;
    if (isRoot) {
      const away = Math.abs(mode.offset);
      tip += mode.offset === 0
        ? ` The root's own chord. ${title} is the major scale: its own key's notes.`
        : ` The root's own chord. ${title} uses ${parentName} major's notes, ${away} spoke${away === 1 ? '' : 's'} ${mode.offset > 0 ? 'clockwise' : 'counterclockwise'}.`;
    } else {
      const rel = relativeOf(p.chord.index);
      tip += ` Start on ${prettyNote(rel.root)} instead and the same notes are ${prettyNote(rel.root)} ${modeDef(rel.mode).name}.`;
    }
    if (isSignature) tip += ` The ${mode.name} sound: it holds the ${mode.character}, the note that sets this mode apart.`;
    const ringed = isRoot || isSignature;
    cells.set(p.id, { fill: p.degree, numeral: p.chord.numeral, ring: ringed ? 'solid' : undefined, tip });
    chords.push(chipOf(p, { ringed, tip }));
  }

  const rim: RimLabel[] = MODES.map(m => {
    const notes = prettyNote(MAJOR_KEYS[mod12(rootSpoke + m.offset)]);
    const changes = alteredDegrees(modeScale(root, m.id));
    return {
      spoke: mod12(rootSpoke + m.offset),
      text: m.name,
      current: m.id === id,
      tip: `${rootName} ${m.name}: the notes of ${notes} major. ${changes.length ? `Against ${rootName} major: ${changes.join(' ')}.` : `${rootName} major itself.`}`,
    };
  });

  const relative = Array.from({ length: 7 }, (_, index) => {
    const r = relativeOf(index);
    return { ...r, current: index === 0, label: `${prettyNote(r.root)} ${modeDef(r.mode).name}` };
  });

  const parallel = MODES.map((m, k): ParallelRow => {
    const degrees = modeScale(root, m.id).degrees.map(d => d.label);
    const above = k ? modeScale(root, MODES[k - 1].id).degrees.map(d => d.label) : null;
    return {
      root, mode: m.id, current: m.id === id, name: m.name, degrees,
      changed: degrees.map((d, j) => !!above && above[j] !== d),
      parent: prettyNote(MAJOR_KEYS[mod12(rootSpoke + m.offset)]),
    };
  });

  if (opts.allNumerals) numberTheRest(cells, rootPcValue, title);

  return {
    title, formula: scale.degrees.map(d => d.label), cells, arrows: [], rim,
    homeSpoke: parentSpoke, tonic: null, centre: [rootName, mode.name],
    chords, relative, parallel,
  };
}

// ------------------------------------------------------------ view switching

/** The Mode view's start for a key: its tonic, Aeolian if minor, else Ionian. */
export const modeForKey = (k: Key): { root: Root; mode: ModeId } =>
  ({ root: keyTonic(k), mode: k.minor ? 'aeolian' : 'ionian' });

/** The Key view's key for a mode: minor for Aeolian, else major, on its root. */
export function keyForMode(root: Root, mode: ModeId): Key {
  const pc = chromaOf(root);
  return mode === 'aeolian'
    ? { spoke: cellOf(pc, 'minor')!.spoke, minor: true }
    : { spoke: majorSpoke(pc), minor: false };
}
