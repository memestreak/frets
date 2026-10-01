import { clampFret, MIN_WINDOW_SPAN } from './fretWindow';
import {
  intervalClass, midi, pick, samePos, SIMPLE_INTERVALS, STRINGS,
  type Position, type Rng,
} from './music';

export type IntervalMode = 'name' | 'fret';
export type Direction = 'asc' | 'desc' | 'rand' | 'same';

export interface IntervalSettings {
  mode: IntervalMode;
  dir: Direction;
  /** Max strings between root and target, 1–5. Ignored for Same string. */
  vRange: number;
  /** Max frets between root and target, 1–12. */
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

export const INTERVAL_STORAGE_KEY = 'eminor.intervals.v2';

export const V_RANGE_MAX = 5;
export const H_RANGE_MAX = 12;

export const clampHRange = (n: number): number =>
  Math.min(H_RANGE_MAX, Math.max(1, Math.round(n)));

export const defaultIntervalSettings = (): IntervalSettings => ({
  mode: 'name', dir: 'asc', vRange: V_RANGE_MAX, hRange: 4, minFret: 0, maxFret: 15,
  pool: [...SIMPLE_INTERVALS], compound: true, noteNames: false, pause: false,
});

/** Pool restricted to valid simple intervals. */
export const activePool = (set: IntervalSettings): number[] =>
  set.pool.filter(x => SIMPLE_INTERVALS.includes(x));

type Box = Pick<IntervalSettings, 'dir' | 'vRange' | 'hRange'>;
type Judging = Box & Pick<IntervalSettings, 'compound'>;

/**
 * Is `pos` in the box around `root` for a question in direction `up`? The
 * box reaches `hRange` frets either way. On other strings it follows the
 * string direction (higher strings when `up`) for `vRange` strings; on the
 * root's own string it follows the fret direction. Same string questions
 * stay on the root's string. The root itself is never in the box.
 */
export function inBox(root: Position, up: boolean, pos: Position, set: Box): boolean {
  const ds = pos.s - root.s;
  const df = pos.f - root.f;
  if (Math.abs(df) > set.hRange) return false;
  if (ds === 0) return up ? df > 0 : df < 0;
  if (set.dir === 'same') return false;
  return (up ? ds > 0 : ds < 0) && Math.abs(ds) <= set.vRange;
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

/** Every question the settings allow. Targets on the root's string are only
 * asked in Same string direction. */
function candidates(set: IntervalSettings, pool: number[]): IntervalQuestion[] {
  const same = set.dir === 'same';
  const ups = set.dir === 'rand' ? [true, false] : [set.dir !== 'desc'];
  const out: IntervalQuestion[] = [];
  for (const s of STRINGS) {
    for (let f = set.minFret; f <= set.maxFret; f++) {
      const root = { s, f };
      const lo = Math.max(set.minFret, f - set.hRange);
      const hi = Math.min(set.maxFret, f + set.hRange);
      for (const up of ups) {
        for (const ts of STRINGS) {
          if ((ts === s) !== same) continue;
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
const DIRS: Direction[] = ['asc', 'desc', 'rand', 'same'];

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

  return {
    mode: oneOf(r.mode, MODES, d.mode),
    dir: oneOf(r.dir, DIRS, d.dir),
    vRange: intRange(r.vRange, 1, V_RANGE_MAX, d.vRange),
    hRange: intRange(r.hRange, 1, H_RANGE_MAX, d.hRange),
    minFret,
    maxFret,
    pool,
    compound: bool(r.compound, d.compound),
    noteNames: bool(r.noteNames, d.noteNames),
    pause: bool(r.pause, d.pause),
  };
}
