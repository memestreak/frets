import { clampFret, MIN_WINDOW_SPAN } from '@/lib/fretWindow';
import {
  intervalClass, midi, pick, samePos, SIMPLE_INTERVALS, STRINGS,
  type Position, type Rng,
} from '@/lib/music';

export type IntervalMode = 'name' | 'fret';
/** `rand` asks ascending and descending questions at random. */
export type Direction = 'asc' | 'desc' | 'rand';

export interface IntervalSettings {
  mode: IntervalMode;
  dir: Direction;
  /** Strings the target may span, counting the root's: 1 (its own) to 6. */
  vRange: number;
  /** Frets the target may span, counting the root's: 1 (its own) to 12. */
  hRange: number;
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

export const INTERVAL_STORAGE_KEY = 'frets.practice.intervals';

export const V_RANGE_MAX = 6;
export const H_RANGE_MAX = 12;

/**
 * Highest fret a question's root may sit on. The target may still land
 * above it, up to the fret window's highest fret.
 */
export const ROOT_MAX_FRET = 10;

/**
 * Highest fret for the root in this fret window: ROOT_MAX_FRET, or the
 * window's lowest fret when the window starts above it, so there is still
 * a question to ask.
 */
export const rootMaxFret = (set: Pick<IntervalSettings, 'minFret' | 'maxFret'>): number =>
  Math.min(set.maxFret, Math.max(set.minFret, ROOT_MAX_FRET));

export const clampHRange = (n: number): number =>
  Math.min(H_RANGE_MAX, Math.max(1, Math.round(n)));

export const defaultIntervalSettings = (): IntervalSettings => ({
  mode: 'name', dir: 'rand', vRange: V_RANGE_MAX, hRange: 4, minFret: 0, maxFret: 15,
  pool: [...SIMPLE_INTERVALS], compound: true, noteNames: false, pause: false,
});

/**
 * The settings dialog's Defaults: every field it shows goes back to its
 * default. Mode and Pause b/w sit in the header, so they are kept.
 */
export const resetIntervalSettings = (set: IntervalSettings): IntervalSettings => ({
  ...defaultIntervalSettings(), mode: set.mode, pause: set.pause,
});

/** Pool restricted to valid simple intervals. */
export const activePool = (set: IntervalSettings): number[] =>
  set.pool.filter(x => SIMPLE_INTERVALS.includes(x));

type Box = Pick<IntervalSettings, 'vRange' | 'hRange'>;
type Judging = Box & Pick<IntervalSettings, 'compound'>;

/**
 * Range changes. One string by one fret is the root alone, which no question
 * fits, so setting one range to 1 while the other is 1 bumps the other to 2.
 */
export const withVRange = (set: Box, vRange: number): Box => ({
  vRange, hRange: vRange === 1 && set.hRange === 1 ? 2 : set.hRange,
});
export const withHRange = (set: Box, n: number): Box => {
  const hRange = clampHRange(n);
  return { hRange, vRange: hRange === 1 && set.vRange === 1 ? 2 : set.vRange };
};

/**
 * Is `pos` in the box around `root` for a question in direction `up`? The
 * ranges count the root's own string and fret, so the box reaches
 * `hRange - 1` frets either way. On other strings it follows the string
 * direction (higher strings when `up`) for `vRange - 1` strings; on the
 * root's own string it follows the fret direction. The root itself is never
 * in the box.
 */
export function inBox(root: Position, up: boolean, pos: Position, set: Box): boolean {
  const ds = pos.s - root.s;
  const df = pos.f - root.f;
  if (Math.abs(df) >= set.hRange) return false;
  if (ds === 0) return up ? df > 0 : df < 0;
  return (up ? ds > 0 : ds < 0) && Math.abs(ds) < set.vRange;
}

/**
 * Is `tgt` a correct answer for a Find-it question? It must be in the box,
 * lie in the question's pitch direction, name as the same interval class,
 * and stay within an octave unless compound spans are allowed.
 */
export function isCorrectFret(q: IntervalQuestion, tgt: Position, set: Judging): boolean {
  if (!inBox(q.root, q.up, tgt, set)) return false;
  const d = midi(tgt.s, tgt.f) - midi(q.root.s, q.root.f);
  return (q.up ? d > 0 : d < 0)
    && intervalClass(d) === q.semis
    && (Math.abs(d) <= 12 || set.compound);
}

/**
 * Is `tgt` the asked interval in the asked direction, but outside the box?
 * The trainer explains such a tap instead of scoring it as a miss.
 */
export function isOutOfRange(q: IntervalQuestion, tgt: Position, set: Box): boolean {
  if (inBox(q.root, q.up, tgt, set)) return false;
  const d = midi(tgt.s, tgt.f) - midi(q.root.s, q.root.f);
  return (q.up ? d > 0 : d < 0) && intervalClass(d) === q.semis;
}

/** Every correct fret for the question inside the fret window. */
export function correctFrets(q: IntervalQuestion, set: IntervalSettings): Position[] {
  const out: Position[] = [];
  for (const s of STRINGS) {
    for (let f = set.minFret; f <= set.maxFret; f++) {
      if (isCorrectFret(q, { s, f }, set)) out.push({ s, f });
    }
  }
  return out;
}

/** Every question the settings allow: a root no higher than `rootMaxFret`
 * and any target in the box, the root's own string included. */
function candidates(set: IntervalSettings, pool: number[]): IntervalQuestion[] {
  const ups = set.dir === 'rand' ? [true, false] : [set.dir === 'asc'];
  const out: IntervalQuestion[] = [];
  const rootMax = rootMaxFret(set);
  for (const s of STRINGS) {
    for (let f = set.minFret; f <= rootMax; f++) {
      const root = { s, f };
      const lo = Math.max(set.minFret, f - set.hRange + 1);
      const hi = Math.min(set.maxFret, f + set.hRange - 1);
      for (const up of ups) {
        for (const ts of STRINGS) {
          for (let tf = lo; tf <= hi; tf++) {
            const tgt = { s: ts, f: tf };
            const semis = intervalClass(midi(ts, tf) - midi(s, f));
            if (!pool.includes(semis)) continue;
            const q = { root, tgt, semis, up };
            if (isCorrectFret(q, tgt, set)) out.push(q);
          }
        }
      }
    }
  }
  return out;
}

/**
 * Random question for the settings, or null when none exists. Each interval
 * class that is possible comes up equally often, and `prev` is not repeated
 * unless it is the only question.
 */
export function generateIntervalQuestion(
  set: IntervalSettings,
  rng: Rng = Math.random,
  prev: IntervalQuestion | null = null,
): IntervalQuestion | null {
  const pool = activePool(set);
  if (!pool.length) return null;
  let all = candidates(set, pool);
  if (prev && all.length > 1) {
    all = all.filter(c => !(samePos(c.root, prev.root) && samePos(c.tgt, prev.tgt)));
  }
  if (!all.length) return null;
  const semis = pick(rng, pool.filter(c => all.some(q => q.semis === c)));
  return pick(rng, all.filter(q => q.semis === semis));
}

const MODES: IntervalMode[] = ['name', 'fret'];
const DIRS: Direction[] = ['asc', 'desc', 'rand'];

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
  // Ranges are rejected, not clamped, when out of bounds.
  const intRange = (v: unknown, min: number, max: number, fb: number) =>
    typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : fb;

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
  const vRange = intRange(r.vRange, 1, V_RANGE_MAX, d.vRange);

  return {
    mode: oneOf(r.mode, MODES, d.mode),
    dir: oneOf(r.dir, DIRS, d.dir),
    vRange,
    // Both ranges at 1 leave no question; see `withVRange`.
    hRange: withVRange(
      { vRange, hRange: intRange(r.hRange, 1, H_RANGE_MAX, d.hRange) }, vRange,
    ).hRange,
    minFret,
    maxFret,
    pool,
    compound: bool(r.compound, d.compound),
    noteNames: bool(r.noteNames, d.noteNames),
    pause: bool(r.pause, d.pause),
  };
}
