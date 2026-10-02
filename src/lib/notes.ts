import {
  pick, pitchClass, STRINGS, type Position, type Rng,
} from './music';

export type NoteMode = 'name' | 'find';

export interface NoteSettings {
  mode: NoteMode;
  /** Strings questions are drawn from, low E first. */
  strings: boolean[];
  /** Fret range, in either order. Both modes stay inside it. */
  rFrom: number;
  rTo: number;
  pause: boolean;
}

export type NoteQuestion =
  | { mode: 'name'; pc: number; s: number; f: number }
  | { mode: 'find'; pc: number; s: number };
export type FindQuestion = Extract<NoteQuestion, { mode: 'find' }>;

export const NOTE_STORAGE_KEY = 'eminor.notes.v2';

/** The board always draws the open strings through this fret. */
export const NOTE_MAX_FRET = 15;

/** Clamp an arbitrary fret number to the board. */
export const clampNoteFret = (value: number): number =>
  Math.max(0, Math.min(NOTE_MAX_FRET, Math.round(value)));

export const defaultNoteSettings = (): NoteSettings => ({
  mode: 'name', strings: [true, true, true, true, true, true],
  rFrom: 1, rTo: 12, pause: false,
});

/**
 * The settings dialog's Defaults: every field it shows goes back to its
 * default. Mode and Pause b/w sit in the header, so they are kept.
 */
export const resetNoteSettings = (set: NoteSettings): NoteSettings => ({
  ...defaultNoteSettings(), mode: set.mode, pause: set.pause,
});

export const stringsInScope = (set: NoteSettings): number[] =>
  STRINGS.filter(s => set.strings[s]);

type Range = Pick<NoteSettings, 'rFrom' | 'rTo'>;

/** Fret range, ordered. */
export function targetRange(set: Range): [number, number] {
  return [Math.min(set.rFrom, set.rTo), Math.max(set.rFrom, set.rTo)];
}

const inRange = (set: Range, f: number): boolean => {
  const [a, b] = targetRange(set);
  return f >= a && f <= b;
};
const onTarget = (q: FindQuestion, pos: Position): boolean =>
  pos.s === q.s && pitchClass(pos.s, pos.f) === q.pc;

/** Is `pos` the asked note on the asked string, inside the fret range? */
export const isCorrectNoteFret = (q: FindQuestion, pos: Position, set: Range): boolean =>
  onTarget(q, pos) && inRange(set, pos.f);

/**
 * Is `pos` the asked note on the asked string, but outside the range? The
 * trainer explains such a tap instead of scoring it as a miss.
 */
export const isNoteOutOfRange = (q: FindQuestion, pos: Position, set: Range): boolean =>
  onTarget(q, pos) && !inRange(set, pos.f);

/**
 * Every question the settings allow. Find it lists a note once per string,
 * even when the range holds it at two frets.
 */
function candidates(set: NoteSettings): NoteQuestion[] {
  const [a, b] = targetRange(set);
  const out: NoteQuestion[] = [];
  for (const s of stringsInScope(set)) {
    const seen = new Set<number>();
    for (let f = a; f <= b; f++) {
      const pc = pitchClass(s, f);
      if (set.mode === 'name') out.push({ mode: 'name', pc, s, f });
      else if (!seen.has(pc)) {
        seen.add(pc);
        out.push({ mode: 'find', pc, s });
      }
    }
  }
  return out;
}

/**
 * Random question for the settings, or null when no string is in scope.
 * Every possible question is equally likely, and `prev`'s note is not asked
 * again unless it is the only note the settings allow.
 */
export function generateNoteQuestion(
  set: NoteSettings,
  rng: Rng = Math.random,
  prev: NoteQuestion | null = null,
): NoteQuestion | null {
  const all = candidates(set);
  const fresh = prev ? all.filter(c => c.pc !== prev.pc) : all;
  const from = fresh.length ? fresh : all;
  return from.length ? pick(rng, from) : null;
}

const MODES: NoteMode[] = ['name', 'find'];
/** Modes from before Find it merged them; both load as `find`. */
const OLD_FIND_MODES: unknown[] = ['string', 'range'];

/** Coerce stored JSON into settings, falling back to defaults per field. */
export function parseNoteSettings(raw: unknown): NoteSettings {
  const d = defaultNoteSettings();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown, fb: number) =>
    typeof v === 'number' && Number.isFinite(v) ? clampNoteFret(v) : fb;

  const strings = Array.isArray(r.strings) && r.strings.length === 6
    && r.strings.every(x => typeof x === 'boolean')
    ? (r.strings as boolean[])
    : d.strings;
  const mode = OLD_FIND_MODES.includes(r.mode)
    ? 'find'
    : MODES.includes(r.mode as NoteMode) ? (r.mode as NoteMode) : d.mode;

  return {
    mode,
    strings,
    rFrom: num(r.rFrom, d.rFrom),
    rTo: num(r.rTo, d.rTo),
    pause: typeof r.pause === 'boolean' ? r.pause : d.pause,
  };
}
