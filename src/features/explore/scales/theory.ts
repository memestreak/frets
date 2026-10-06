import { Interval, Note, ScaleType } from 'tonal';
import { positionsOnNeck } from '@/lib/music';
import { prettyNote } from '@/lib/notation';

/*
 * The Scale lab's music theory: spelled notes and intervals from tonal,
 * stacked into diatonic chords. tonal names notes in ASCII ("F##", "Bb")
 * and intervals as "3m", "5d"; everything shown to the user goes through
 * `prettyNote` / `intervalLabel` for real ♭ ♯ 𝄪 𝄫 glyphs.
 */

/** Roots the picker offers: the naturals plus a ♯ and a ♭ per black key. */
export const ROOTS = [
  'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab',
  'A', 'A#', 'Bb', 'B',
] as const;
export type Root = (typeof ROOTS)[number];

export interface ScaleDef {
  id: string;
  /** Name in the scale list, e.g. "Aeolian (natural minor)". */
  name: string;
  /** Name after the root in titles, e.g. "A natural minor". */
  title: string;
  group: string;
  /** tonal interval names, ascending from the root. */
  intervals: readonly string[];
}

const fromTonal = (
  id: string, name: string, group: string, tonalName: string, title = name,
): ScaleDef => ({
  id, name, title, group, intervals: ScaleType.get(tonalName).intervals,
});

const MAJOR = 'Major modes';
const MELODIC = 'Melodic minor modes';
const HARMONIC = 'Harmonic minor modes';
const PENTATONIC = 'Pentatonic and blues';

export const SCALES: readonly ScaleDef[] = [
  fromTonal('ionian', 'Ionian (major)', MAJOR, 'major', 'major'),
  fromTonal('dorian', 'Dorian', MAJOR, 'dorian'),
  fromTonal('phrygian', 'Phrygian', MAJOR, 'phrygian'),
  fromTonal('lydian', 'Lydian', MAJOR, 'lydian'),
  fromTonal('mixolydian', 'Mixolydian', MAJOR, 'mixolydian'),
  fromTonal('aeolian', 'Aeolian (natural minor)', MAJOR, 'aeolian', 'natural minor'),
  fromTonal('locrian', 'Locrian', MAJOR, 'locrian'),
  fromTonal('melodic-minor', 'Melodic minor', MELODIC, 'melodic minor'),
  fromTonal('dorian-flat2', 'Dorian ♭2', MELODIC, 'dorian b2'),
  fromTonal('lydian-augmented', 'Lydian augmented', MELODIC, 'lydian augmented'),
  fromTonal('lydian-dominant', 'Lydian dominant', MELODIC, 'lydian dominant'),
  fromTonal('mixolydian-flat6', 'Mixolydian ♭6', MELODIC, 'mixolydian b6'),
  fromTonal('locrian-natural2', 'Locrian ♮2', MELODIC, 'locrian #2'),
  // tonal spells Altered 1 ♭2 ♯2 3 ♯4 ♭6 ♭7: two 2s and no 5, so stacked
  // thirds would be misnamed. Same pitches, one letter per degree.
  {
    id: 'altered', name: 'Altered', title: 'altered', group: MELODIC,
    intervals: ['1P', '2m', '3m', '4d', '5d', '6m', '7m'],
  },
  fromTonal('harmonic-minor', 'Harmonic minor', HARMONIC, 'harmonic minor', 'harmonic minor'),
  fromTonal('locrian-natural6', 'Locrian ♮6', HARMONIC, 'locrian 6'),
  fromTonal('ionian-sharp5', 'Ionian ♯5', HARMONIC, 'major augmented'),
  fromTonal('dorian-sharp4', 'Dorian ♯4', HARMONIC, 'dorian #4'),
  fromTonal('phrygian-dominant', 'Phrygian dominant', HARMONIC, 'phrygian dominant'),
  fromTonal('lydian-sharp9', 'Lydian ♯9', HARMONIC, 'lydian #9'),
  fromTonal('ultralocrian', 'Ultralocrian', HARMONIC, 'ultralocrian'),
  fromTonal('major-pentatonic', 'Major pentatonic', PENTATONIC, 'major pentatonic', 'major pentatonic'),
  fromTonal('minor-pentatonic', 'Minor pentatonic', PENTATONIC, 'minor pentatonic', 'minor pentatonic'),
  fromTonal('minor-blues', 'Minor blues', PENTATONIC, 'minor blues', 'minor blues'),
];

export const SCALE_GROUPS = [MAJOR, MELODIC, HARMONIC, PENTATONIC] as const;

export const scaleDef = (id: string): ScaleDef | undefined =>
  SCALES.find(t => t.id === id);

/**
 * The seven modes a scale belongs to, in order from its parent: each list
 * above that holds seven scales is one family, mode 1 first. Pentatonic
 * and blues scales have none.
 */
export function modeFamily(type: ScaleDef): readonly ScaleDef[] | null {
  const family = SCALES.filter(t => t.group === type.group);
  return family.length === 7 ? family : null;
}

/** A spelled note as a root the picker offers: E# → F, Cb → B, G## → A. */
function listedRoot(note: string): Root {
  if ((ROOTS as readonly string[]).includes(note)) return note as Root;
  const same = ROOTS.filter(r => Note.get(r).chroma === Note.get(note).chroma);
  return same.find(r => r.length === 1)
    ?? same.find(r => r[1] === (note.includes('#') ? '#' : 'b'))
    ?? same[0];
}

export interface Rotation {
  root: Root;
  type: ScaleDef;
  /** Semitones from the starting root up to the new one, 0–11. */
  shift: number;
}

/**
 * The mode `step` notes up the scale, renamed for its new root: C major
 * step 1 is D Dorian, step 6 B Locrian. A root the picker lacks is
 * respelled, so the notes keep their pitches but may change letter.
 * Scales outside a family, and step 0, stay as they are.
 */
export function rotateMode(root: Root, type: ScaleDef, step: number): Rotation {
  const family = modeFamily(type);
  if (!family || step === 0) return { root, type, shift: 0 };
  const degree = scaleOf(root, type).degrees[step];
  return {
    root: listedRoot(degree.note),
    type: family[(family.indexOf(type) + step) % 7],
    shift: degree.semis,
  };
}

const ACCIDENTALS: Record<number, string> = {
  [-2]: '𝄫', [-1]: '♭', 0: '', 1: '♯', 2: '𝄪',
};

/** Degree number 1–7 of an interval; octaves and beyond fold down. */
const degreeNumber = (iv: string): number => ((Interval.get(iv).num - 1) % 7) + 1;

/**
 * An interval as a degree against the major scale: "3m" → "♭3",
 * "4A" → "♯4", "7d" → "𝄫7", "1P" → "1".
 */
export function intervalLabel(iv: string): string {
  return ACCIDENTALS[Interval.get(iv).alt] + degreeNumber(iv);
}

export interface ScaleDegree {
  /** Spelled note, tonal ASCII. */
  note: string;
  interval: string;
  /** Formula label: "1", "♭3". */
  label: string;
  /** 1–7, picks the dot colour. */
  degree: number;
  /** Semitones above the root, 0–11. */
  semis: number;
  pc: number;
}

export interface Scale {
  root: Root;
  type: ScaleDef;
  degrees: ScaleDegree[];
}

export function scaleOf(root: Root, type: ScaleDef): Scale {
  const rootPc = Note.get(root).chroma;
  const degrees = type.intervals.map(iv => {
    const note = Note.transpose(root, iv);
    const pc = Note.get(note).chroma;
    return {
      note, interval: iv, label: intervalLabel(iv), degree: degreeNumber(iv),
      semis: (pc - rootPc + 12) % 12, pc,
    };
  });
  return { root, type, degrees };
}

export type ChordSize = 3 | 4;

export interface DiatonicChord {
  /** Index of the chord root in the scale, 0–6. */
  index: number;
  /** Chord tones, root first, tonal ASCII. */
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
  symbol: string;
  numeral: string;
  quality: string;
}

interface ChordKind {
  symbol: string;
  /** Appended to the numeral. */
  suffix: string;
  quality: string;
}

/** Keyed by the tonal intervals of the third, fifth and (for sevenths) seventh. */
const CHORD_KINDS: Record<string, ChordKind> = {
  '3M 5P': { symbol: '', suffix: '', quality: 'major' },
  '3m 5P': { symbol: 'm', suffix: '', quality: 'minor' },
  '3m 5d': { symbol: '°', suffix: '°', quality: 'diminished' },
  '3M 5A': { symbol: '+', suffix: '+', quality: 'augmented' },
  '3M 5P 7M': { symbol: 'maj7', suffix: 'maj7', quality: 'major 7' },
  '3M 5P 7m': { symbol: '7', suffix: '7', quality: 'dominant 7' },
  '3m 5P 7m': { symbol: 'm7', suffix: '7', quality: 'minor 7' },
  '3m 5P 7M': { symbol: 'm(maj7)', suffix: '(maj7)', quality: 'minor-major 7' },
  '3m 5d 7m': { symbol: 'm7♭5', suffix: 'ø7', quality: 'half-diminished' },
  '3m 5d 7d': { symbol: '°7', suffix: '°7', quality: 'diminished 7' },
  '3M 5A 7M': { symbol: '+maj7', suffix: '+maj7', quality: 'augmented major 7' },
  '3M 5A 7m': { symbol: '+7', suffix: '+7', quality: 'augmented 7' },
};

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

/** "3M" → "M3", "5d" → "d5": quality first, as guitarists write it. */
const intervalName = (iv: string): string => {
  const { q, num } = Interval.get(iv);
  return `${q}${num}`;
};

const QUALITY_WORDS: Record<string, string> = {
  M: 'major', m: 'minor', P: 'perfect', d: 'diminished', A: 'augmented',
};
const ORDINALS: Record<number, string> = {
  2: '2nd', 3: '3rd', 4: '4th', 5: '5th', 6: '6th', 7: '7th',
};

/** "M3" → "major 3rd", "d5" → "diminished 5th": for screen readers. */
export function intervalWords(name: string): string {
  return `${QUALITY_WORDS[name[0]]} ${ORDINALS[Number(name.slice(1))]}`;
}

/**
 * Chords stacked in thirds on each degree: every other scale note, three
 * for triads, four for sevenths. Only seven-note scales have them; in
 * smaller scales alternate notes are not thirds.
 */
export function diatonicChords(
  scale: Scale, size: ChordSize,
): DiatonicChord[] {
  const { degrees } = scale;
  if (degrees.length !== 7) return [];
  return degrees.map((root, index) => {
    const steps = Array.from({ length: size }, (_, k) => index + 2 * k);
    const stack = steps.map(n => degrees[n % 7]);
    const tones = stack.map(d => d.note);
    const intervals = tones.map(t => Interval.distance(root.note, t));
    const kind = CHORD_KINDS[intervals.slice(1).join(' ')];
    const labels = intervals.map(intervalLabel);

    const third = Interval.get(intervals[1]);
    const minorish = third.alt < 0;
    // Numbered against the major scale on the same root: ♭III, ♯iv°.
    const roman = ACCIDENTALS[Interval.get(root.interval).alt] + ROMAN[root.degree - 1];
    const numeral = (minorish ? roman.toLowerCase() : roman) + (kind?.suffix ?? '');

    return {
      index,
      tones,
      labels,
      semis: stack.map(d => d.semis),
      rising: stack.map((d, k) => d.semis + 12 * Math.floor(steps[k] / 7)),
      fromRoot: intervals.slice(1).map(intervalName),
      thirds: tones.slice(1).map((t, k) => intervalName(Interval.distance(tones[k], t))),
      // A stack outside the table (rare, in exotic modes) shows its notes.
      symbol: kind ? prettyNote(root.note) + kind.symbol : tones.map(prettyNote).join(' '),
      numeral,
      quality: kind?.quality ?? labels.join(' '),
    };
  });
}

export interface NeckNote {
  s: number;
  f: number;
  note: string;
  /** Interval label: against the chord root when a chord is shown. */
  label: string;
  /** 1–7, picks the colour. */
  degree: number;
}

/**
 * Every scale note from the nut to `maxFret`, low E first; with a chord,
 * only the chord's tones.
 */
export function neckNotes(
  scale: Scale, maxFret: number, chord: DiatonicChord | null = null,
): NeckNote[] {
  const bySemis = new Map(scale.degrees.map(d => [d.semis, d]));
  const shown = chord ? chord.semis : scale.degrees.map(d => d.semis);
  return positionsOnNeck(scale.degrees[0].pc, shown, maxFret).map(({ s, f, semis }) => {
    const d = bySemis.get(semis)!;
    if (!chord) return { s, f, note: d.note, label: d.label, degree: d.degree };
    const k = chord.semis.indexOf(semis);
    return { s, f, note: d.note, label: chord.labels[k], degree: 2 * k + 1 };
  });
}
