import { clampFret, MIN_WINDOW_SPAN } from './fretWindow';
import {
  pick, pitchClass, randInt, STRINGS, type Position, type Rng,
} from './music';

export type NoteMode = 'name' | 'string' | 'range';

export interface NoteSettings {
  mode: NoteMode;
  /** Strings in scope, low E first. */
  strings: boolean[];
  minFret: number;
  maxFret: number;
  /** Target range, used by Name it and Find in range. */
  rFrom: number;
  rTo: number;
  pause: boolean;
}

export type NoteQuestion =
  | { mode: 'name'; pc: number; s: number; f: number }
  | { mode: 'string'; pc: number; s: number }
  | { mode: 'range'; pc: number; targets: Position[] };

export const NOTE_STORAGE_KEY = 'eminor.notes.v2';

const MAX_TRIES = 200;
/** Tries during which a repeat of the previous pitch class is rejected. */
const AVOID_REPEAT_TRIES = 50;

export const defaultNoteSettings = (): NoteSettings => ({
  mode: 'name', strings: [true, true, true, true, true, true],
  minFret: 0, maxFret: 15, rFrom: 3, rTo: 7, pause: false,
});

export const stringsInScope = (set: NoteSettings): number[] =>
  STRINGS.filter(s => set.strings[s]);

/** Target range, ordered and clamped to the board window. */
export function targetRange(set: NoteSettings): [number, number] {
  return [
    Math.max(set.minFret, Math.min(set.rFrom, set.rTo)),
    Math.min(set.maxFret, Math.max(set.rFrom, set.rTo)),
  ];
}

/** Every in-scope position in the target range with pitch class `pc`. */
export function rangeTargets(set: NoteSettings, pc: number): Position[] {
  const [a, b] = targetRange(set);
  const out: Position[] = [];
  for (const s of stringsInScope(set)) {
    for (let f = a; f <= b; f++) if (pitchClass(s, f) === pc) out.push({ s, f });
  }
  return out;
}

/**
 * Random question for the settings, or null when nothing fits. Avoids
 * repeating `lastPc` when possible.
 */
export function generateNoteQuestion(
  set: NoteSettings,
  lastPc: number | null,
  rng: Rng = Math.random,
): NoteQuestion | null {
  const strings = stringsInScope(set);
  if (!strings.length) return null;
  const [a, b] = targetRange(set);
  if (set.mode !== 'string' && a > b) return null;

  for (let i = 0; i < MAX_TRIES; i++) {
    const avoid = (p: number) => p === lastPc && i < AVOID_REPEAT_TRIES;
    if (set.mode === 'name') {
      const s = pick(rng, strings);
      const f = a + randInt(rng, b - a + 1);
      const pc = pitchClass(s, f);
      if (avoid(pc)) continue;
      return { mode: 'name', pc, s, f };
    }
    const pc = randInt(rng, 12);
    if (avoid(pc)) continue;
    if (set.mode === 'string') {
      const s = pick(rng, strings);
      for (let f = set.minFret; f <= set.maxFret; f++) {
        if (pitchClass(s, f) === pc) return { mode: 'string', pc, s };
      }
    } else {
      const targets = rangeTargets(set, pc);
      if (targets.length) return { mode: 'range', pc, targets };
    }
  }
  return null;
}

const MODES: NoteMode[] = ['name', 'string', 'range'];

/** Coerce stored JSON into settings, falling back to defaults per field. */
export function parseNoteSettings(raw: unknown): NoteSettings {
  const d = defaultNoteSettings();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown, fb: number) =>
    typeof v === 'number' && Number.isFinite(v) ? clampFret(v) : fb;

  let minFret = num(r.minFret, d.minFret);
  let maxFret = num(r.maxFret, d.maxFret);
  if (maxFret - minFret < MIN_WINDOW_SPAN) {
    minFret = d.minFret;
    maxFret = d.maxFret;
  }
  const strings = Array.isArray(r.strings) && r.strings.length === 6
    && r.strings.every(x => typeof x === 'boolean')
    ? (r.strings as boolean[])
    : d.strings;

  return {
    mode: MODES.includes(r.mode as NoteMode) ? (r.mode as NoteMode) : d.mode,
    strings,
    minFret,
    maxFret,
    rFrom: num(r.rFrom, d.rFrom),
    rTo: num(r.rTo, d.rTo),
    pause: typeof r.pause === 'boolean' ? r.pause : d.pause,
  };
}
