import { Chord, ChordType, Interval, Note } from 'tonal';
import { prettyNote } from '@/lib/notation';

/*
 * The Chords section's music theory. tonal supplies the chord types and
 * spells the notes; this file decides how they are grouped, written and
 * labelled. It is the only file in the section that imports tonal.
 */

/** Roots the picker offers: one spelling per pitch, as chord charts write them. */
export const CHORD_ROOTS = [
  'C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B',
] as const;
export type ChordRoot = (typeof CHORD_ROOTS)[number];

export type ChordGroup = 'Common' | 'Triads' | 'Sixths and sevenths' | 'Extended' | 'Altered';
export const CHORD_GROUPS: readonly ChordGroup[] = [
  'Common', 'Triads', 'Sixths and sevenths', 'Extended', 'Altered',
];

export interface ChordTypeDef {
  /** tonal's first alias, e.g. "m7", "M", "7b9": stored in settings. */
  id: string;
  /** As written after the root: "m7", "7♭9", "" for major. */
  symbol: string;
  /** For the Type dropdown: "m7 · minor seventh". */
  label: string;
  group: ChordGroup;
  /** tonal interval names, root first: "1P", "3m", "5P", "7m". */
  intervals: readonly string[];
  /** The tones as semitones above the root, 0–11, ascending: how the lab matches notes to types. */
  semis: readonly number[];
}

/** Listed first, in this order, because they are the ones most people want. */
const COMMON_IDS = [
  'M', 'm', '7', 'maj7', 'm7', 'm7b5', 'dim', 'dim7', 'aug', 'sus2', 'sus4',
  '6', 'm6', '9', 'm9', 'maj9', 'Madd9', '7sus4', '13',
];

/** Where tonal's first alias isn't how the rest of Frets writes the chord. */
const SYMBOL_OVERRIDES: Record<string, string> = {
  M: '', 'm/ma7': 'm(maj7)', Madd9: 'add9', dim: '°', dim7: '°7', aug: '+',
};

/** "7b9#11" → "7♭9♯11": ♭ only where a b comes before a number. */
const prettySymbol = (id: string) =>
  SYMBOL_OVERRIDES[id] ?? id.replace(/#/g, '♯').replace(/b(?=\d)/g, '♭');

const ALTERED_TENSIONS = ['9m', '9A', '11A', '13m'];

function groupOf(id: string, intervals: readonly string[]): ChordGroup {
  if (COMMON_IDS.includes(id)) return 'Common';
  if (intervals.length <= 3) return 'Triads';
  if (intervals.some(iv => ALTERED_TENSIONS.includes(iv))) return 'Altered';
  if (intervals.some(iv => Interval.get(iv).num >= 9)) return 'Extended';
  return 'Sixths and sevenths';
}

const semisOf = (interval: string) => Interval.get(interval).semitones % 12;

function typeDef(id: string, name: string, intervals: readonly string[]): ChordTypeDef {
  const symbol = prettySymbol(id);
  const label = !symbol ? name : name ? `${symbol} · ${name}` : symbol;
  const semis = intervals.map(semisOf).sort((a, b) => a - b);
  return { id, symbol, label, group: groupOf(id, intervals), intervals, semis };
}

/** Every chord type tonal knows: the common ones first, then the rest in tonal's order. */
export const CHORD_TYPES: readonly ChordTypeDef[] = (() => {
  const all = ChordType.all().map(t => typeDef(t.aliases[0], t.name, t.intervals));
  const common = COMMON_IDS.map(id => all.find(t => t.id === id)!);
  return [...common, ...all.filter(t => t.group !== 'Common')];
})();

export const chordTypeDef = (id: string): ChordTypeDef | undefined =>
  CHORD_TYPES.find(t => t.id === id);

const ACCIDENTALS: Record<number, string> = {
  [-2]: '𝄫', [-1]: '♭', 0: '', 1: '♯', 2: '𝄪',
};

export interface ChordTone {
  /** tonal interval name: "3m", "9A". */
  interval: string;
  /** Shown in dots and the formula: "R", "♭3", "♯9", "13". */
  label: string;
  /** Semitones above the root, 0–11. */
  semis: number;
  /** Degree number 1–7 for the dot colour: a 9 is a 2, an 11 a 4, a 13 a 6. */
  degree: number;
  /** False for tones a voicing may leave out (see `isOptional`). */
  required: boolean;
}

export interface ChordInfo {
  root: ChordRoot;
  /** Pitch class of the root, 0–11. */
  rootPc: number;
  /** Null for a set of tones no chord type has (see `chordFromTones`). */
  type: ChordTypeDef | null;
  /** "Am7", "F♯°7"...; "" when `type` is null. */
  symbol: string;
  /** Spelled notes, root first: "A", "C", "E", "G". */
  notes: string[];
  tones: ChordTone[];
}

/** "3m" → "♭3", "9A" → "♯9", "1P" → "R". */
export function toneLabel(interval: string): string {
  const { num, alt } = Interval.get(interval);
  return num === 1 ? 'R' : ACCIDENTALS[alt] + num;
}

/**
 * A tone a voicing may leave out, as guitarists do: the perfect 5th in a
 * chord of four or more notes, and in an 11th or 13th chord the plain
 * tones below the top one (the 9th; and the 11th under a 13th).
 */
function isOptional(interval: string, intervals: readonly string[]): boolean {
  const top = Math.max(...intervals.map(iv => Interval.get(iv).num));
  if (interval === '5P') return intervals.length >= 4;
  if (interval === '9M') return top >= 11;
  if (interval === '11P') return top >= 13;
  return false;
}

function toneOf(interval: string, required: boolean): ChordTone {
  const { num } = Interval.get(interval);
  return {
    interval,
    label: toneLabel(interval),
    semis: semisOf(interval),
    degree: ((num - 1) % 7) + 1,
    required,
  };
}

export function chordOf(root: ChordRoot, typeId: string): ChordInfo {
  const type = chordTypeDef(typeId)!;
  return {
    root,
    rootPc: Note.get(root).chroma,
    type,
    symbol: prettyNote(root) + type.symbol,
    notes: Chord.getChord(type.id, root).notes.map(prettyNote),
    tones: type.intervals.map(iv => toneOf(iv, !isOptional(iv, type.intervals))),
  };
}

/** How a tone with no chord type to name it is written: ♭ for the black-key tones. */
const PLAIN_INTERVALS = ['1P', '2m', '2M', '3m', '3M', '4P', '5d', '5P', '6m', '6M', '7m', '7M'];

/**
 * The chord with exactly these tones above a root (semitones 0–11, the
 * root included): the first chord type with them, or an unnamed chord whose
 * tones take plain interval names and are all required.
 */
export function chordFromTones(rootPc: number, semis: readonly number[]): ChordInfo {
  const wanted = [...new Set(semis.map(s => ((s % 12) + 12) % 12))].sort((a, b) => a - b);
  const root = CHORD_ROOTS[rootPc];
  const type = CHORD_TYPES.find(t => t.semis.join() === wanted.join());
  if (type) return chordOf(root, type.id);
  const intervals = wanted.map(s => PLAIN_INTERVALS[s]);
  return {
    root,
    rootPc,
    type: null,
    symbol: '',
    notes: intervals.map(iv => prettyNote(Note.transpose(root, iv))),
    tones: intervals.map(iv => toneOf(iv, true)),
  };
}

/** "1 ♭3 5 ♭7": the formula as the title shows it. */
export const formulaOf = (chord: ChordInfo): string =>
  chord.tones.map(t => (t.label === 'R' ? '1' : t.label)).join(' ');
