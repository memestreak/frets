import { STRING_NAMES, TUNING } from '@/lib/music';
import type { ChordInfo } from './chordTypes';
import { publishedShapes } from './publishedShapes';

/*
 * Guitar voicings. For the chord types Haus of Chords covers, the shapes
 * shown first are the published ones (`publishedShapes`). Every other
 * shape is found by search: every way to play the chord within a few
 * frets, filtered by the rules below. Each rule is one named constant or
 * function, so changing a rule is a one-line edit. The specs
 * (docs/specs/2026-10-05-chord-library-design.md and
 * docs/specs/2026-10-09-published-chord-shapes-design.md) give the why.
 */

/** One entry per string, low E first: a fret number, or null for a muted string. */
export type Voicing = readonly (number | null)[];

/** Highest fret a voicing may use. */
const HIGHEST_FRET = 15;
/** Highest fretted note minus lowest, in frets. */
const MAX_SPAN = 4;
const MAX_FINGERS = 4;
/** Searched shapes harder than this stay out of the best few (they remain under Show all). */
const BEST_FEW_MAX_DIFFICULTY = 6;
const MIN_STRINGS = 3;
/** Muted strings allowed between the lowest and highest sounding strings. */
const MAX_INNER_MUTES = 1;
/** Open shapes stay within this many frets of the nut. */
const OPEN_SHAPE_MAX_FRET = 4;
/** Frets a diagram draws: enough for any moveable shape and any open shape. */
export const DIAGRAM_FRETS = Math.max(MAX_SPAN + 1, OPEN_SHAPE_MAX_FRET);
/** Frets in a position: the widest stretch a shape may take. */
export const POSITION_FRETS = MAX_SPAN + 1;
/** The highest position's first fret, so the position ends at the highest fret. */
export const LAST_POSITION = HIGHEST_FRET - MAX_SPAN;

export interface Voicings {
  /** Shapes that ring open strings: the published ones in their order, else searched ones, easiest first. */
  open: Voicing[];
  /** The best few moveable shapes, from the nut up: the published ones, else the easiest searched ones. */
  moveable: Voicing[];
  /** Every moveable shape, published or searched, except pure doublings, from the nut up. */
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

/**
 * Barres a fret needs: its notes share one finger lying flat unless an open
 * string or a lower fretted note lies between them. A muted string or a
 * higher note under the finger doesn't break it. x-3-2-3-3-3 has two at
 * fret 3: the A string, and a barre over the top three.
 */
function barresAt(v: Voicing, fret: number): number {
  let barres = 0;
  let onBarre = false;
  for (const f of v) {
    if (f === fret) {
      if (!onBarre) barres++;
      onBarre = true;
    } else if (f !== null && f < fret) {
      onBarre = false;
    }
  }
  return barres;
}

/**
 * Fingers a shape needs: one per barre on each fret (see `barresAt`). The
 * index finger takes the lowest fret alone, so a shape whose lowest fret
 * needs two fingers is unplayable (Infinity): F as 1-0-3-2-1-1, where the
 * open A string splits the barre.
 */
export function fingersNeeded(v: Voicing): number {
  const frets = [...new Set(frettedNotes(v))].sort((a, b) => a - b);
  if (frets.length && barresAt(v, frets[0]) > 1) return Infinity;
  return frets.reduce((sum, fret) => sum + barresAt(v, fret), 0);
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
 * Drops shapes that only leave strings out of a fuller shape with the same
 * tones. A shape with a muted string in the middle stays: leaving the top
 * string out of 8-x-9-9-8-8 gives 8-x-9-9-8-x, the drop 3 grip players use.
 */
function dropDoublings(voicings: Voicing[], rootPc: number): Voicing[] {
  // Worked out once per shape: the lists can run to hundreds of shapes.
  const facts = voicings.map(v => {
    const strings = soundingStrings(v);
    return { v, strings, tones: new Set(strings.map(s => toneOn(rootPc, s, v[s]!))).size };
  });
  /** `fuller` is `v` with more strings above the same bass note, adding no new tone: x-3-2-0-1-0 over x-3-2-0-1-x. */
  const doubles = (fuller: typeof facts[number], v: typeof facts[number]) =>
    fuller.strings[0] === v.strings[0] &&
    fuller.strings.length > v.strings.length &&
    fuller.tones === v.tones &&
    v.strings.every(s => v.v[s] === fuller.v[s]) &&
    innerMutes(v.v) === 0;
  return facts.filter(v => !facts.some(w => doubles(w, v))).map(f => f.v);
}

/** The easiest shape for each bass note (string and fret) and number of strings, if it is easy enough. */
function easiestPerBass(voicings: Voicing[]): Voicing[] {
  const best = new Map<string, Voicing>();
  for (const v of voicings) {
    if (difficulty(v) > BEST_FEW_MAX_DIFFICULTY) continue;
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

/**
 * Every combination of one choice per string with the root in the bass,
 * where a string's choices are a mute or a fret in `window` that plays a
 * chord tone.
 */
function* combinations(window: number[], chord: ChordInfo): Generator<Voicing> {
  const tones = new Set(chord.tones.map(t => t.semis));
  const choices = TUNING.map((_, s) => [
    null, ...window.filter(f => tones.has(toneOn(chord.rootPc, s, f))),
  ]);
  function* fromString(s: number, chosen: (number | null)[], hasBass: boolean): Generator<Voicing> {
    if (s === choices.length) { yield chosen; return; }
    for (const c of choices[s]) {
      // The lowest sounding string must play the root; stop early when it doesn't.
      if (c !== null && !hasBass && toneOn(chord.rootPc, s, c) !== 0) continue;
      yield* fromString(s + 1, [...chosen, c], hasBass || c !== null);
    }
  }
  yield* fromString(0, [], false);
}

const cache = new Map<string, Voicings>();

/**
 * The chord's voicings, sorted into open and moveable: the published
 * shapes first where there are any, searched ones otherwise. Cached by
 * root, type and tones.
 */
export function findVoicings(chord: ChordInfo): Voicings {
  const tones = chord.tones.map(t => `${t.semis}${t.required ? '' : '?'}`);
  const cacheKey = `${chord.rootPc}:${chord.type?.id ?? ''}:${tones.join(',')}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const searched = searchVoicings(chord);
  const published = publishedShapes(chord);
  const result = published ? {
    open: published.open,
    moveable: published.moveable.filter(fitsNeck).sort(byPosition),
    allMoveable: uniqueShapes([...published.allMoveable.filter(fitsNeck), ...searched.allMoveable])
      .sort(byPosition),
  } : searched;
  cache.set(cacheKey, result);
  return result;
}

const fitsNeck = (v: Voicing) => Math.max(...frettedNotes(v)) <= HIGHEST_FRET;
const uniqueShapes = (voicings: Voicing[]) =>
  [...new Map(voicings.map(v => [voicingKey(v), v])).values()];

/** Every playable voicing of the chord found by search. */
function searchVoicings(chord: ChordInfo): Voicings {
  // One window per lowest fret, so each shape is found once: the open
  // string and the frets from `low` to `low + MAX_SPAN`.
  const found: Voicing[] = [];
  for (let low = 1; low <= HIGHEST_FRET; low++) {
    const top = Math.min(low + MAX_SPAN, HIGHEST_FRET);
    const window = [0, ...Array.from({ length: top - low + 1 }, (_, i) => low + i)];
    for (const v of combinations(window, chord)) {
      const fretted = frettedNotes(v);
      const lowest = fretted.length ? Math.min(...fretted) : 1; // all-open shapes once, at low 1
      if (lowest === low && isPlayable(v, chord)) found.push(v);
    }
  }
  const candidates = found;
  const allMoveable = dropDoublings(candidates.filter(isMoveable), chord.rootPc);
  return {
    open: dropDoublings(candidates.filter(isOpenShape), chord.rootPc).sort(byEase),
    moveable: easiestPerBass(allMoveable).sort(byPosition),
    allMoveable: allMoveable.sort(byPosition),
  };
}

/**
 * Whether every fretted note lies in the position from fret `first`; open
 * strings only count in the first position, at the nut.
 */
const inPosition = (v: Voicing, first: number) =>
  v.every(f => f === null || (f === 0 ? first === 1 : f >= first && f < first + POSITION_FRETS));

const byEase = (a: Voicing, b: Voicing) =>
  difficulty(a) - difficulty(b) || soundingStrings(b).length - soundingStrings(a).length;

/** A moveable shape and, when it fits under the highest fret, the same shape an octave up. */
const withOctaveUp = (v: Voicing): Voicing[] => {
  const up = v.map(f => (f === null ? null : f + 12));
  return fitsNeck(up) ? [v, up] : [v];
};

/**
 * The shapes to offer in the position starting at fret `first`, easiest
 * first: the open shapes and the best few moveable ones (in either octave)
 * that fit in it. When none of those fits, the easiest of all the shapes
 * that do, so a chord with any shape in the position has one to show.
 */
export function shapesInPosition(voicings: Voicings, first: number): Voicing[] {
  const core = [...voicings.open, ...voicings.moveable.flatMap(withOctaveUp)]
    .filter(v => inPosition(v, first));
  if (core.length) return core.sort(byEase);
  const fallback = voicings.allMoveable.filter(v => inPosition(v, first)).sort(byEase);
  return fallback.slice(0, 1);
}

/** "root on A · frets 5–7", or "root on A · open" for a shape with no fretted notes. */
export function voicingCaption(v: Voicing): string {
  const fretted = frettedNotes(v);
  const where = fretted.length
    ? `frets ${Math.min(...fretted)}–${Math.max(...fretted)}`
    : 'open';
  return `root on ${STRING_NAMES[soundingStrings(v)[0]]} · ${where}`;
}

/** The first fret a diagram shows: 1 for an open shape or one within the first four frets, else its lowest fret. */
export function diagramStartFret(v: Voicing): number {
  const fretted = frettedNotes(v);
  if (!fretted.length || Math.max(...fretted) <= OPEN_SHAPE_MAX_FRET) return 1;
  return Math.min(...fretted);
}
