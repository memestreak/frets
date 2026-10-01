import { clampFret, MIN_WINDOW_SPAN } from './fretWindow';
import {
  intervalClass, midi, pick, randInt, SIMPLE_INTERVALS, STRING_COUNT,
  type Position, type Rng,
} from './music';

export type IntervalMode = 'name' | 'fret';
export type Direction = 'asc' | 'desc' | 'rand' | 'same';
export type StringPairs = 'adj' | 'skip1' | 'skip2' | 'any';

export interface IntervalSettings {
  mode: IntervalMode;
  dir: Direction;
  pairs: StringPairs;
  minFret: number;
  maxFret: number;
  /** Interval classes (1–12) that questions may ask for. */
  pool: number[];
  /** Allow spans over an octave (they still name as the simple class). */
  compound: boolean;
  noteNames: boolean;
  pause: boolean;
}

export interface IntervalQuestion {
  root: Position;
  tgt: Position;
  /** Interval class, 1–12, named from the root even when the target is below. */
  semis: number;
  /** True when the target is above the root. */
  up: boolean;
}

export const INTERVAL_STORAGE_KEY = 'eminor.intervals.v2';

/** Max frets between root and target: four fingers plus one stretch. */
export const REACH = 4;
const MAX_TRIES = 600;

export const defaultIntervalSettings = (): IntervalSettings => ({
  mode: 'name', dir: 'asc', pairs: 'adj', minFret: 0, maxFret: 15,
  pool: [...SIMPLE_INTERVALS], compound: false, noteNames: false, pause: false,
});

const PAIR_GAPS: Record<StringPairs, number[]> = {
  adj: [1], skip1: [2], skip2: [3], any: [1, 2, 3, 4, 5],
};

/** Pool restricted to valid simple intervals. */
export const activePool = (set: IntervalSettings): number[] =>
  set.pool.filter(x => SIMPLE_INTERVALS.includes(x));

/**
 * Is `tgt` a correct answer for a Find-it question? It must lie in the
 * question's direction, name as the same interval class, stay within an
 * octave unless compound spans are allowed, and be within reach of the root.
 */
export function isCorrectFret(
  q: IntervalQuestion,
  tgt: Position,
  compound: boolean,
): boolean {
  const d = midi(tgt.s, tgt.f) - midi(q.root.s, q.root.f);
  return (q.up ? d > 0 : d < 0)
    && intervalClass(d) === q.semis
    && (Math.abs(d) <= 12 || compound)
    && Math.abs(tgt.f - q.root.f) <= REACH;
}

/** Random question for the settings, or null when nothing fits. */
export function generateIntervalQuestion(
  set: IntervalSettings,
  rng: Rng = Math.random,
): IntervalQuestion | null {
  const pool = activePool(set);
  if (!pool.length) return null;
  const gaps = PAIR_GAPS[set.pairs];
  const span = set.maxFret - set.minFret + 1;
  const randFret = () => set.minFret + randInt(rng, span);

  for (let i = 0; i < MAX_TRIES; i++) {
    let root: Position;
    let tgt: Position;
    let up: boolean;
    if (set.dir === 'same') {
      // The root is the lower-pitched of two frets on one string.
      const s = randInt(rng, STRING_COUNT);
      const f1 = randFret();
      const f2 = randFret();
      root = { s, f: Math.min(f1, f2) };
      tgt = { s, f: Math.max(f1, f2) };
      up = true;
    } else {
      const g = pick(rng, gaps);
      const lo = randInt(rng, STRING_COUNT - g);
      up = set.dir === 'asc' ? true : set.dir === 'desc' ? false : rng() < 0.5;
      const a = { s: lo, f: randFret() };
      const b = { s: lo + g, f: randFret() };
      root = up ? a : b;
      tgt = up ? b : a;
    }
    if (Math.abs(tgt.f - root.f) > REACH) continue;
    const d = midi(tgt.s, tgt.f) - midi(root.s, root.f);
    if (d === 0 || (up && d < 0) || (!up && d > 0)) continue;
    if (Math.abs(d) > 12 && !set.compound) continue;
    const semis = intervalClass(d);
    if (!pool.includes(semis)) continue;
    return { root, tgt, semis, up };
  }
  return null;
}

const MODES: IntervalMode[] = ['name', 'fret'];
const DIRS: Direction[] = ['asc', 'desc', 'rand', 'same'];
const PAIRS: StringPairs[] = ['adj', 'skip1', 'skip2', 'any'];

/** Coerce stored JSON into settings, falling back to defaults per field. */
export function parseIntervalSettings(raw: unknown): IntervalSettings {
  const d = defaultIntervalSettings();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  const oneOf = <T>(v: unknown, opts: T[], fb: T) =>
    opts.includes(v as T) ? (v as T) : fb;
  const bool = (v: unknown, fb: boolean) => (typeof v === 'boolean' ? v : fb);
  const num = (v: unknown, fb: number) =>
    typeof v === 'number' && Number.isFinite(v) ? clampFret(v) : fb;

  let minFret = num(r.minFret, d.minFret);
  let maxFret = num(r.maxFret, d.maxFret);
  if (maxFret - minFret < MIN_WINDOW_SPAN) {
    minFret = d.minFret;
    maxFret = d.maxFret;
  }
  const pool = Array.isArray(r.pool)
    ? [...new Set(r.pool.filter(
      (x): x is number => SIMPLE_INTERVALS.includes(x as number),
    ))].sort((a, b) => a - b)
    : d.pool;

  return {
    mode: oneOf(r.mode, MODES, d.mode),
    dir: oneOf(r.dir, DIRS, d.dir),
    pairs: oneOf(r.pairs, PAIRS, d.pairs),
    minFret,
    maxFret,
    pool,
    compound: bool(r.compound, d.compound),
    noteNames: bool(r.noteNames, d.noteNames),
    pause: bool(r.pause, d.pause),
  };
}
