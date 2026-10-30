import { Note, ScaleType } from 'tonal';
import { degreeNumber, intervalLabel } from './intervals';
import { pitchClassOf } from './notes';

/*
 * Scales and modes: the Scale lab's list, spelled from tonal. tonal names
 * notes in ASCII ("F##", "Bb") and intervals as "3m", "5d"; everything
 * shown to the user goes through `prettyNote` / `intervalLabel` for real
 * ♭ ♯ 𝄪 𝄫 glyphs.
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
const OTHER = 'Other scales';

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
  fromTonal('hungarian-major', 'Hungarian major', OTHER, 'hungarian major', 'Hungarian major'),
];

export const SCALE_GROUPS = [MAJOR, MELODIC, HARMONIC, PENTATONIC, OTHER] as const;

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
  const same = ROOTS.filter(r => pitchClassOf(r) === pitchClassOf(note));
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
  /** tonal ASCII; may be a note the root picker lacks, such as "E#" (a mode spelled from its parent key). */
  root: string;
  type: ScaleDef;
  degrees: ScaleDegree[];
}

/** The scale on a root, each degree spelled: D Dorian is D E F G A B C. */
export function scaleOf(root: string, type: ScaleDef): Scale {
  const rootPc = pitchClassOf(root);
  const degrees = type.intervals.map(iv => {
    const note = Note.transpose(root, iv);
    const pc = pitchClassOf(note);
    return {
      note, interval: iv, label: intervalLabel(iv), degree: degreeNumber(iv),
      semis: (pc - rootPc + 12) % 12, pc,
    };
  });
  return { root, type, degrees };
}
