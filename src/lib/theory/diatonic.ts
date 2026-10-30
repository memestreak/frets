import { chordFromIntervals, type ChordInfo } from './chords';
import {
  ACCIDENTAL_GLYPHS, alterationOf, intervalBetween, intervalLabel, intervalName,
} from './intervals';
import { mod12, prettyNote } from './notes';
import type { Scale } from './scales';

/*
 * Chords stacked in thirds on a scale's degrees, with their Roman
 * numerals. Their symbols come from the one chord table (`chords.ts`), so
 * the Scale lab, the Circle of fifths and the Chords page write a chord
 * the same way.
 */

export type ChordSize = 3 | 4;

export interface DiatonicChord {
  /** Index of the chord root in the scale, 0–6. */
  index: number;
  /** Chord tones, root first, spelled as the scale spells them, tonal ASCII. */
  tones: string[];
  /** Each tone against the chord root: "1", "♭3", "5", "♭7". */
  labels: string[];
  /** Semitones of each tone above the scale root, 0–11, for the neck. */
  semis: number[];
  /**
   * Semitones of each tone above the scale root as the stack climbs, so a
   * tone past the octave counts from 12: for the ladder, which spans two.
   */
  rising: number[];
  /** Each tone above the root, from the third up: "M3", "P5", "m7". */
  fromRoot: string[];
  /** The thirds between neighbouring tones, low to high: "M3", "m3". */
  thirds: string[];
  /** "Am7", spelled from the scale; a stack no chord type names shows its notes: "C F G♯". */
  symbol: string;
  numeral: string;
  /** In words: "minor 7", "half-diminished". */
  quality: string;
  /** The chord as the Chord library knows it: its type, tones and shapes. */
  info: ChordInfo;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

/** How the Scale lab says a chord type in words, by type id. Types not listed show their tones. */
const QUALITY_WORDS: Readonly<Record<string, string>> = {
  M: 'major', m: 'minor', dim: 'diminished', aug: 'augmented',
  'm#5': 'minor ♯5', 'sus4#5': 'suspended 4th ♯5',
  maj7: 'major 7', 7: 'dominant 7', m7: 'minor 7', 'm/ma7': 'minor-major 7',
  m7b5: 'half-diminished', dim7: 'diminished 7', 'maj7#5': 'augmented major 7',
  '7#5': 'augmented 7', oM7: 'diminished major 7', 'mMaj7#5': 'minor-major 7 ♯5',
  'M7#5sus4': 'major 7 ♯5 suspended 4th',
};

/**
 * What a numeral adds after its Roman numeral: the chord's symbol, less
 * the m a lower-case numeral already says (ii7, not iim7), and ø7 for a
 * half-diminished seventh.
 */
function numeralSuffix(info: ChordInfo, minorish: boolean): string {
  if (!info.type) return '';
  if (info.type.id === 'm7b5') return 'ø7';
  return minorish ? info.type.symbol.replace(/^m(?!aj)/, '') : info.type.symbol;
}

/**
 * Chords stacked in thirds on each degree: every other scale note, three
 * for triads, four for sevenths. Only seven-note scales have them; in
 * smaller scales alternate notes are not thirds. Each is numbered against
 * the major scale on the same root: ♭III, ♯iv°.
 */
export function diatonicChords(scale: Scale, size: ChordSize): DiatonicChord[] {
  const { degrees } = scale;
  if (degrees.length !== 7) return [];
  return degrees.map((root, index) => {
    const steps = Array.from({ length: size }, (_, k) => index + 2 * k);
    const stack = steps.map(n => degrees[n % 7]);
    const tones = stack.map(d => d.note);
    const intervals = tones.map(t => intervalBetween(root.note, t));
    const info = chordFromIntervals(root.pc, intervals);
    const labels = intervals.map(intervalLabel);

    const minorish = alterationOf(intervals[1]) < 0;
    const roman = ACCIDENTAL_GLYPHS[alterationOf(root.interval)] + ROMAN[root.degree - 1];
    const numeral = (minorish ? roman.toLowerCase() : roman) + numeralSuffix(info, minorish);

    return {
      index,
      tones,
      labels,
      semis: stack.map(d => d.semis),
      rising: stack.map((d, k) => d.semis + 12 * Math.floor(steps[k] / 7)),
      fromRoot: intervals.slice(1).map(intervalName),
      thirds: tones.slice(1).map((t, k) => intervalName(intervalBetween(tones[k], t))),
      // A stack outside the chord table (rare, in exotic modes) shows its notes.
      symbol: info.type ? prettyNote(root.note) + info.type.symbol : tones.map(prettyNote).join(' '),
      numeral,
      quality: (info.type && QUALITY_WORDS[info.type.id]) ?? labels.join(' '),
      info,
    };
  });
}

/** The quality of a triad as the Circle of fifths' rings hold them. */
export type TriadRing = 'major' | 'minor' | 'dim';

export interface Numeral {
  numeral: string;
  /** 1–7: picks the degree colour. */
  degree: number;
}

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];

/**
 * A triad's numeral against a tonic, from its root's pitch class, counted
 * on the major scale from the tonic as in the Scale lab. Its root takes the
 * plainest name: a natural degree, else the flat of the one above (E in C
 * is III, G♭ is ♭V).
 */
export function numeralOf(rootPc: number, ring: TriadRing, tonicPc: number): Numeral {
  const semis = mod12(rootPc - tonicPc);
  const natural = MAJOR_STEPS.indexOf(semis);
  const index = natural >= 0 ? natural : MAJOR_STEPS.indexOf(semis + 1);
  let roman = ROMAN[index];
  if (ring !== 'major') roman = roman.toLowerCase();
  if (ring === 'dim') roman += '°';
  return { numeral: (natural >= 0 ? '' : '♭') + roman, degree: index + 1 };
}
