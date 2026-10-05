import { STRING_NAMES, TUNING } from '@/lib/music';
import type { ChordInfo } from './chordTypes';

/*
 * Guitar voicings, found by search rather than from a table: every way to
 * play the chord within a few frets, filtered by the rules below. Each rule
 * is one named constant or function, so changing a rule is a one-line edit.
 * The spec (docs/specs/2026-10-05-chord-library-design.md) gives the why.
 */

/** One entry per string, low E first: a fret number, or null for a muted string. */
export type Voicing = readonly (number | null)[];

/** Highest fret a voicing may use. */
const HIGHEST_FRET = 15;
/** Highest fretted note minus lowest, in frets. */
const MAX_SPAN = 3;
const MAX_FINGERS = 4;
const MIN_STRINGS = 3;
/** Muted strings allowed between the lowest and highest sounding strings. */
const MAX_INNER_MUTES = 1;
/** Open shapes stay within this many frets of the nut. */
const OPEN_SHAPE_MAX_FRET = 4;

export interface Voicings {
  /** Shapes that ring open strings, most strings first. */
  open: Voicing[];
  /** The best few moveable shapes, from the nut up. */
  moveable: Voicing[];
  /** Every moveable shape except pure doublings, from the nut up. */
  allMoveable: Voicing[];
}

const mod12 = (n: number) => ((n % 12) + 12) % 12;
const isSounding = (f: number | null): f is number => f !== null;
/** Index of each sounding string, low to high. */
const soundingStrings = (v: Voicing) =>
  v.flatMap((f, s) => (isSounding(f) ? [s] : []));
const frettedNotes = (v: Voicing) => v.filter((f): f is number => isSounding(f) && f > 0);
const innerMutes = (v: Voicing) => {
  const strings = soundingStrings(v);
  return strings[strings.length - 1] - strings[0] + 1 - strings.length;
};
/** Semitones above the root of the note a string plays. */
const toneOn = (rootPc: number, s: number, f: number) => mod12(TUNING[s] + f - rootPc);

/** A stable key for a voicing: "x-0-2-0-1-0". */
export const voicingKey = (v: Voicing): string =>
  v.map(f => (isSounding(f) ? f : 'x')).join('-');

/** One finger per fretted note, except that the notes on the lowest fret share one (a barre). */
export function fingersNeeded(v: Voicing): number {
  const fretted = frettedNotes(v);
  if (!fretted.length) return 0;
  const lowest = Math.min(...fretted);
  return fretted.filter(f => f !== lowest).length + 1;
}

/**
 * Lower is easier: fingers, span and muted strings in the middle, with
 * each sounding string counting a little in favour, so a full barre beats
 * the same shape with a string left out.
 */
export function difficulty(v: Voicing): number {
  const fretted = frettedNotes(v);
  const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
  return fingersNeeded(v) + span + 3 * innerMutes(v) - soundingStrings(v).length / 2;
}

function isPlayable(v: Voicing, chord: ChordInfo): boolean {
  const strings = soundingStrings(v);
  if (strings.length < MIN_STRINGS || innerMutes(v) > MAX_INNER_MUTES) return false;

  const tones = strings.map(s => toneOn(chord.rootPc, s, v[s]!));
  if (tones[0] !== 0) return false; // the root in the bass
  const required = chord.tones.filter(t => t.required).map(t => t.semis);
  if (required.some(semis => !tones.includes(semis))) return false;

  const fretted = frettedNotes(v);
  if (fretted.length && Math.max(...fretted) - Math.min(...fretted) > MAX_SPAN) return false;
  return fingersNeeded(v) <= MAX_FINGERS;
}

/** Open shapes ring an open string near the nut, with no muted string in the middle. */
const isOpenShape = (v: Voicing) =>
  v.includes(0) && Math.max(...v.filter(isSounding)) <= OPEN_SHAPE_MAX_FRET && innerMutes(v) === 0;
/** Moveable shapes have no open strings, so they slide to any root. */
const isMoveable = (v: Voicing) => !v.includes(0);

/**
 * True when `fuller` is `v` with more strings above the same bass note,
 * adding no new tone: x-3-2-0-1-x next to x-3-2-0-1-0.
 */
function doubles(fuller: Voicing, v: Voicing, rootPc: number): boolean {
  const toneCount = (x: Voicing) =>
    new Set(soundingStrings(x).map(s => toneOn(rootPc, s, x[s]!))).size;
  return soundingStrings(fuller)[0] === soundingStrings(v)[0] &&
    soundingStrings(fuller).length > soundingStrings(v).length &&
    v.every((f, s) => !isSounding(f) || f === fuller[s]) &&
    toneCount(fuller) === toneCount(v);
}

/** Drops shapes that only leave strings out of a fuller shape with the same tones. */
const dropDoublings = (voicings: Voicing[], rootPc: number) =>
  voicings.filter(v => !voicings.some(w => doubles(w, v, rootPc)));

/** The easiest shape for each bass note (string and fret) and number of strings. */
function easiestPerBass(voicings: Voicing[]): Voicing[] {
  const best = new Map<string, Voicing>();
  for (const v of voicings) {
    const bass = soundingStrings(v)[0];
    const key = `${bass}:${v[bass]}:${soundingStrings(v).length}`;
    const current = best.get(key);
    if (!current || difficulty(v) < difficulty(current)) best.set(key, v);
  }
  return [...best.values()];
}

const lowestFret = (v: Voicing) => Math.min(...frettedNotes(v));
const byPosition = (a: Voicing, b: Voicing) =>
  lowestFret(a) - lowestFret(b) || soundingStrings(b).length - soundingStrings(a).length;
const byFullness = (a: Voicing, b: Voicing) =>
  soundingStrings(b).length - soundingStrings(a).length || difficulty(a) - difficulty(b);

/**
 * Every combination of one choice per string, where a string's choices
 * are a mute or a fret in `window` that plays a chord tone.
 */
function* combinations(window: number[], chord: ChordInfo): Generator<Voicing> {
  const tones = new Set(chord.tones.map(t => t.semis));
  const choices = TUNING.map((_, s) => [
    null, ...window.filter(f => tones.has(toneOn(chord.rootPc, s, f))),
  ]);
  function* fromString(s: number, chosen: (number | null)[]): Generator<Voicing> {
    if (s === choices.length) { yield chosen; return; }
    for (const c of choices[s]) yield* fromString(s + 1, [...chosen, c]);
  }
  yield* fromString(0, []);
}

const cache = new Map<string, Voicings>();

/** Every playable voicing of the chord, sorted into open and moveable. Cached. */
export function findVoicings(chord: ChordInfo): Voicings {
  const cacheKey = `${chord.rootPc}:${chord.type.id}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const found = new Map<string, Voicing>();
  for (let low = 1; low + MAX_SPAN <= HIGHEST_FRET; low++) {
    const window = [0, low, low + 1, low + 2, low + 3];
    for (const v of combinations(window, chord)) {
      const key = voicingKey(v);
      if (!found.has(key) && isPlayable(v, chord)) found.set(key, v);
    }
  }
  const candidates = [...found.values()];
  const allMoveable = dropDoublings(candidates.filter(isMoveable), chord.rootPc);
  const result = {
    open: dropDoublings(candidates.filter(isOpenShape), chord.rootPc).sort(byFullness),
    moveable: easiestPerBass(allMoveable).sort(byPosition),
    allMoveable: allMoveable.sort(byPosition),
  };
  cache.set(cacheKey, result);
  return result;
}

/** "root on A · frets 5–7", or "root on A · open" for a shape with no fretted notes. */
export function voicingCaption(v: Voicing): string {
  const fretted = frettedNotes(v);
  const where = fretted.length
    ? `frets ${Math.min(...fretted)}–${Math.max(...fretted)}`
    : 'open';
  return `root on ${STRING_NAMES[soundingStrings(v)[0]]} · ${where}`;
}

/** The first fret a diagram shows: 1 when the shape fits the first four frets, else its lowest fret. */
export function diagramStartFret(v: Voicing): number {
  const fretted = frettedNotes(v);
  if (!fretted.length || Math.max(...fretted) <= OPEN_SHAPE_MAX_FRET) return 1;
  return Math.min(...fretted);
}
