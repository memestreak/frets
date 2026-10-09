import { prettyNote } from '@/lib/notation';
import {
  chromaOf, diatonicChords, scaleDef, scaleOf, transposeNote,
  type DiatonicChord, type Root, type Scale,
} from '../scales/theory';

/*
 * The circle of fifths page's music theory, with no React. The wheel has
 * twelve spokes, C at the top and clockwise in fifths; each spoke holds a
 * major key (outer ring), its relative minor (middle ring) and its vii°
 * (inner ring). `keyWheel` and `modeWheel` say what every cell shows for
 * the Circle (keys) and Advanced (modes) views; `CircleWheel` only draws what they return.
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
  /** The chord spelled in the key or mode, where it differs from the wheel's name. */
  name?: string;
  /** Filled with this degree's colour (1–7): a chord of the key or mode. */
  fill?: number;
  /** A dashed border in this degree's colour: a chord from outside. */
  edge?: number;
  numeral?: string;
  /** An ink ring: solid marks a root or signature chord, dashed a V/x. */
  ring?: 'solid' | 'dashed';
  tip?: string;
}

/**
 * An arrow from one cell to another: a secondary dominant resolving. The
 * wheel draws it only while either cell, or its chip, is hovered or focused.
 */
export interface WheelArrow {
  /** Names the arrow, so a chip can show it: "major:3>minor:11". */
  key: string;
  from: Cell;
  to: Cell;
}

/**
 * One note of the ring outside the wheel, on its spoke. A major scale is
 * seven neighbouring spokes: those are lit, and the root is the pin.
 */
export interface RingNote {
  spoke: number;
  /** Spelled as the key or mode spells it when lit, as the wheel does otherwise. */
  name: string;
  lit: boolean;
  /** The key's tonic or the mode's root. */
  root: boolean;
  /** Advanced view: the mode that starts on this note, written outside it. */
  label?: string;
  /** Advanced view: picking the note makes it the root, keeping the notes. */
  pick?: { root: string; mode: ModeId };
  tip?: string;
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
  /** The key of the arrow the wheel draws while this chip is hovered. */
  arrow?: string;
  tip?: string;
}

export interface WheelModel {
  cells: Map<string, CellLook>;
  arrows: WheelArrow[];
  /** The ring of notes, spoke 0 first; empty in Circle view. */
  notes: RingNote[];
  /**
   * The spoke of the major key whose notes are in use: its key signature
   * is drawn darker, and the ring's lit run is this spoke and the five
   * after it, plus the one before.
   */
  homeSpoke: number;
  /** The selected key's tonic cell (the Circle view's pressed cell), if any. */
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

/** Spoke 0's note first: the ring's names where nothing is lit. */
const RING_NAMES: readonly Root[] = MAJOR_KEYS;

/**
 * The ring for a scale whose notes are the major key on `home`: the seven
 * notes from the spoke before it to five after it are lit, spelled as the
 * scale spells them, and `rootPcValue` is the pin.
 */
function ringNotes(home: number, scale: Scale, rootPcValue: number): RingNote[] {
  const spelled = new Map(scale.degrees.map(d => [d.pc, d.note]));
  return Array.from({ length: 12 }, (_, spoke) => {
    const pc = mod12(spoke * 7);
    const lit = mod12(spoke - home + 1) < 7;
    return {
      spoke, lit, root: lit && pc === rootPcValue,
      name: prettyNote(lit ? spelled.get(pc)! : RING_NAMES[spoke]),
    };
  });
}

// ------------------------------------------------------------------ Circle view

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

/** Everything the Circle view shows for a key. */
export function keyWheel(k: Key, opts: KeyOptions): KeyWheel {
  const scale = keyScale(k);
  const tonicPc = scale.degrees[0].pc;
  const name = keyName(k);
  const home = placeTriads(scale);
  const cells = new Map<string, CellLook>();
  for (const p of home) {
    cells.set(p.id, { name: p.chord.symbol, fill: p.degree, numeral: p.chord.numeral, tip: describeInKey(p, k, scale) });
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
    cells.set(cellId(v), { name: symbol, edge: 5, numeral: 'V', tip });
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
      if (!cells.has(p.id)) cells.set(p.id, { name: p.chord.symbol, edge: p.degree, numeral: p.chord.numeral, tip });
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
      const arrow = `${cellId(vCell)}>${p.id}`;
      arrows.push({ key: arrow, from: vCell, to: p.cell });
      dominants.push({ name: symbol, numeral: `V/${p.chord.numeral}`, degree: 5, outside: true, arrow, tip });
      const id = cellId(vCell);
      if (id === cellId(keyCell(k))) continue;
      const look = cells.get(id) ?? {};
      cells.set(id, { ...look, ring: 'dashed', tip: look.tip ? `${look.tip} ${tip}` : tip });
    }
  }

  if (opts.allNumerals) numberTheRest(cells, tonicPc, name);

  return {
    // No ring of notes in Circle view: the chords show the key, and the wheel keeps the ring's room.
    title: name, cells, arrows, notes: [], homeSpoke: k.spoke, tonic: keyCell(k),
    centre: [prettyNote(keyTonic(k)), k.minor ? 'minor' : 'major'],
    chords, parallelName, borrowed, dominants,
  };
}

// ----------------------------------------------------------------- Advanced view

export type ModeId = 'lydian' | 'ionian' | 'mixolydian' | 'dorian' | 'aeolian' | 'phrygian' | 'locrian';

export interface ModeDef {
  id: ModeId;
  name: string;
  /** Spokes from the root's major key to the key whose notes the mode uses. */
  offset: number;
  /** The degree of that key (0–6) the mode starts on: Dorian starts on its 2nd. */
  start: number;
  /** Index (0–6) of the chord that carries the mode's sound; null for Ionian. */
  signature: number | null;
  /** The degree that sets the mode apart from major or minor: Dorian's 6. */
  character: string | null;
}

/**
 * The seven modes of the major scale, brightest first. On the ring they
 * run the same way, clockwise from the spoke before the key's own.
 */
export const MODES: readonly ModeDef[] = [
  { id: 'lydian', name: 'Lydian', offset: 1, start: 3, signature: 1, character: '♯4' },
  { id: 'ionian', name: 'Ionian', offset: 0, start: 0, signature: null, character: null },
  { id: 'mixolydian', name: 'Mixolydian', offset: -1, start: 4, signature: 6, character: '♭7' },
  { id: 'dorian', name: 'Dorian', offset: -2, start: 1, signature: 3, character: '6' },
  { id: 'aeolian', name: 'Aeolian', offset: -3, start: 5, signature: 5, character: '♭6' },
  { id: 'phrygian', name: 'Phrygian', offset: -4, start: 2, signature: 1, character: '♭2' },
  { id: 'locrian', name: 'Locrian', offset: -5, start: 6, signature: 4, character: '♭5' },
];

export const modeDef = (id: ModeId): ModeDef => MODES.find(m => m.id === id)!;

/** The other spelling of the outer ring's two keys that have a common one. */
const OTHER_SPELLING: Partial<Record<Root, Root>> = { 'F#': 'Gb', Db: 'C#' };

/** The major key whose notes a mode uses, and the mode's root spelled in it. */
interface ParentKey {
  spoke: number;
  key: Root;
  /** tonal ASCII; may be a note the root picker lacks, such as "E#". */
  root: string;
}

/**
 * A mode's notes are a major key's: spell the mode as that key spells
 * them, so its chords never need double flats. The root keeps its name
 * where the key's other spelling allows it (F♯ Lydian uses C♯ major's
 * notes, F Locrian G♭ major's); otherwise it takes the key's name for it
 * (D♭ Locrian uses D major's notes, so it is C♯ Locrian).
 */
export function parentKey(root: string, id: ModeId): ParentKey {
  const mode = modeDef(id);
  const spoke = mod12(majorSpoke(chromaOf(root)) + mode.offset);
  const keys = [MAJOR_KEYS[spoke], OTHER_SPELLING[MAJOR_KEYS[spoke]]].filter((k): k is Root => !!k);
  const options = keys.map(key => ({ spoke, key, root: scaleOf(key, IONIAN).degrees[mode.start].note }));
  return options.find(o => o.root === root) ?? options[0];
}

/** A mode spelled from its parent key. */
const modeScale = (parent: ParentKey, id: ModeId): Scale => scaleOf(parent.root as Root, scaleDef(id)!);

/** The degree labels a mode changes against the major scale: Dorian ♭3 ♭7. */
function alteredDegrees(scale: Scale): string[] {
  return scale.degrees.map(d => d.label).filter(l => /[♭♯]/.test(l));
}

/** A mode on a root, and whether it is the one shown. */
export interface ModeChoice {
  /** tonal ASCII. */
  root: string;
  mode: ModeId;
  current: boolean;
}

/** One chord in the Parallel modes table. */
export interface TableChord {
  name: string;
  numeral: string;
  /** 1–7: picks the degree colour. */
  degree: number;
  /** The current mode has this chord on this degree too. */
  same: boolean;
  tip: string;
}

/** One row of the Parallel modes table: a mode on the same root. */
export interface ParallelRow extends ModeChoice {
  /** "C Lydian". */
  title: string;
  /** "Lydian". */
  name: string;
  /** Its parent key's spoke: the ring's run when this row is previewed. */
  spoke: number;
  chords: TableChord[];
  /** The note this row has instead of the row above's: "B → B♭"; null for the first. */
  swap: string | null;
  tip: string;
}

export interface ModeWheel extends WheelModel {
  title: string;
  formula: string[];
  parallel: ParallelRow[];
}

/** Everything the Advanced view shows for a mode on a root (tonal ASCII). */
export function modeWheel(rootNote: string, id: ModeId, opts: { allNumerals: boolean }): ModeWheel {
  const mode = modeDef(id);
  const parent = modeScaleParts(rootNote, id);
  const { scale, title } = parent;
  const rootName = prettyNote(parent.root);
  const rootPcValue = scale.degrees[0].pc;
  const parentName = prettyNote(parent.key);
  const keyNotes = scaleOf(parent.key, IONIAN).degrees;

  const cells = new Map<string, CellLook>();
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
      const other = prettyNote(scale.degrees[p.chord.index].note);
      const otherMode = MODES.find(m => m.start === (mode.start + p.chord.index) % 7)!;
      tip += ` Start on ${other} instead and the same notes are ${other} ${otherMode.name}.`;
    }
    if (isSignature) tip += ` The ${mode.name} sound: it holds the ${mode.character}, the note that sets this mode apart.`;
    cells.set(p.id, {
      name: p.chord.symbol, fill: p.degree, numeral: p.chord.numeral,
      ring: isRoot || isSignature ? 'solid' : undefined, tip,
    });
  }

  // The ring: the parent key's notes lit, each named for the mode that starts on it.
  const notes = ringNotes(parent.spoke, scale, rootPcValue).map(n => {
    if (!n.lit) return n;
    const k = mod12(n.spoke - parent.spoke + 1);
    const m = MODES[k];
    const note = keyNotes.find(d => d.pc === mod12(n.spoke * 7))!.note;
    const label = `${prettyNote(note)} ${m.name}`;
    return {
      ...n, label: m.name, pick: { root: note, mode: m.id },
      tip: n.root
        ? `${label}: the mode shown. The lit notes are ${parentName} major's; the pin is the root.`
        : `${label}: the same notes as ${title}, starting on ${prettyNote(note)}.`,
    };
  });

  const current = placeTriads(scale);
  let above: Scale | null = null;
  const parallel = MODES.map((m): ParallelRow => {
    const row = modeScaleParts(parent.root, m.id);
    const changes = alteredDegrees(row.scale);
    const tip = `${row.title}: the notes of ${prettyNote(row.key)} major. ${changes.length ? `Against ${prettyNote(row.root)} major: ${changes.join(' ')}.` : `${prettyNote(row.root)} major itself.`}`;
    const chords = placeTriads(row.scale).map((p, j): TableChord => {
      const same = p.chord.numeral === current[j].chord.numeral;
      return {
        name: p.chord.symbol, numeral: p.chord.numeral, degree: p.degree, same,
        tip: same
          ? `${p.chord.symbol}: ${p.chord.numeral}, in ${title} too.`
          : `${p.chord.symbol}: ${p.chord.numeral} in ${row.title}. ${title} has ${current[j].chord.symbol} here: borrow ${p.chord.symbol} for ${m.name} colour.`,
      };
    });
    let swap: string | null = null;
    if (above) {
      const pcs = new Set(row.scale.degrees.map(d => d.pc));
      const prev = new Set(above.degrees.map(d => d.pc));
      const out = above.degrees.find(d => !pcs.has(d.pc))!;
      const into = row.scale.degrees.find(d => !prev.has(d.pc))!;
      swap = `${prettyNote(out.note)} → ${prettyNote(into.note)}`;
    }
    above = row.scale;
    return {
      root: row.root, mode: m.id, current: m.id === id, title: row.title, name: m.name,
      spoke: row.spoke, chords, swap, tip,
    };
  });

  if (opts.allNumerals) numberTheRest(cells, rootPcValue, title);

  return {
    title, formula: scale.degrees.map(d => d.label), cells, arrows: [], notes,
    homeSpoke: parent.spoke, tonic: null, centre: [rootName, mode.name], parallel,
  };
}

/** A mode's parent key, its spelled scale and its title: "C♯ Locrian". */
function modeScaleParts(rootNote: string, id: ModeId) {
  const parent = parentKey(rootNote, id);
  return { ...parent, scale: modeScale(parent, id), title: `${prettyNote(parent.root)} ${modeDef(id).name}` };
}

// ------------------------------------------------------------ view switching

/** The Advanced view's start for a key: its tonic, Aeolian if minor, else Ionian. */
export const modeForKey = (k: Key): { root: string; mode: ModeId } =>
  ({ root: keyTonic(k), mode: k.minor ? 'aeolian' : 'ionian' });

/** The Circle view's key for a mode: minor for Aeolian, else major, on its root. */
export function keyForMode(root: string, mode: ModeId): Key {
  const pc = chromaOf(root);
  return mode === 'aeolian'
    ? { spoke: cellOf(pc, 'minor')!.spoke, minor: true }
    : { spoke: majorSpoke(pc), minor: false };
}
