/**
 * What the Metronome page saves (`docs/specs/2026-10-31-metronome-design.md`), each key with a
 * parser that checks every field, so a stored value can never break the page:
 *
 * - `frets.metronome.works.current`: the rhythm, the page's work (tempo, beats, the click pattern,
 *   the sounds). One for now; saved metronomes would join it under `frets.metronome.works`.
 * - `frets.metronome.display`: Settings › Metronome › Display, the view.
 * - `frets.metronome.playback`: the volume, a live control on the page, so not in Settings.
 */
import {
  DEFAULT_VOICES, MAX_BEATS, MAX_POLY, MAX_STEPS, MAX_SWING, MIN_SWING, SOUNDS, clampBpm, defaultRhythm,
  defaultSteps, type Poly, type Rhythm, type SoundId, type Step, type Voice,
} from './rhythm';

export const RHYTHM_KEY = 'frets.metronome.works.current';
export const DISPLAY_KEY = 'frets.metronome.display';
export const PLAYBACK_KEY = 'frets.metronome.playback';

export const VIEWS = [['readout', 'Readout'], ['dial', 'Dial'], ['pendulum', 'Pendulum'], ['bar', 'Bar']] as const;
export type ViewId = (typeof VIEWS)[number][0];

export interface Display {
  view: ViewId;
}
export const DEFAULT_DISPLAY: Display = { view: 'readout' };

export interface Playback {
  /** 0 to 1. */
  volume: number;
}
export const DEFAULT_PLAYBACK: Playback = { volume: 0.8 };

const fieldsOf = (raw: unknown) => (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
const isInt = (x: unknown, min: number, max: number): x is number => Number.isInteger(x) && (x as number) >= min && (x as number) <= max;
const isLevel = (x: unknown): x is number => typeof x === 'number' && x >= 0 && x <= 1;
const isSound = (x: unknown): x is SoundId => SOUNDS.some(([id]) => id === x);
const isStep = (x: unknown): x is Step => x === null || isInt(x, 0, 3);

export function parseDisplay(raw: unknown): Display {
  const f = fieldsOf(raw);
  return { view: VIEWS.some(([id]) => id === f.view) ? (f.view as ViewId) : DEFAULT_DISPLAY.view };
}

export function parsePlayback(raw: unknown): Playback {
  const f = fieldsOf(raw);
  return { volume: isLevel(f.volume) ? f.volume : DEFAULT_PLAYBACK.volume };
}

function parseVoice(raw: unknown, fallback: Voice): Voice {
  const f = fieldsOf(raw);
  return {
    sound: isSound(f.sound) ? f.sound : fallback.sound,
    high: typeof f.high === 'boolean' ? f.high : fallback.high,
    level: isLevel(f.level) ? f.level : fallback.level,
  };
}

function parsePoly(raw: unknown, fallback: Poly): Poly {
  const f = fieldsOf(raw);
  return {
    count: isInt(f.count, 0, MAX_POLY) ? f.count : fallback.count,
    sound: isSound(f.sound) ? f.sound : fallback.sound,
    level: isLevel(f.level) ? f.level : fallback.level,
  };
}

/**
 * The saved rhythm. The tempo, swing, sounds and polyrhythm each fall back on their own; the bar
 * (beats, groups, steps) is taken whole or not at all, since its parts must agree.
 */
export function parseRhythm(raw: unknown): Rhythm {
  const f = fieldsOf(raw);
  const d = defaultRhythm();
  const voices = Array.isArray(f.voices) && f.voices.length === 4
    ? f.voices.map((v, i) => parseVoice(v, DEFAULT_VOICES[i])) : d.voices;
  const out: Rhythm = {
    ...d,
    bpm: typeof f.bpm === 'number' && Number.isFinite(f.bpm) ? clampBpm(f.bpm) : d.bpm,
    swing: isInt(f.swing, MIN_SWING, MAX_SWING) ? f.swing : d.swing,
    voices,
    poly: parsePoly(f.poly, d.poly),
  };
  const beats = f.beats;
  if (!isInt(beats, 1, MAX_BEATS)) return out;
  const subs = Array.isArray(f.subs) && f.subs.length === beats && f.subs.every(n => isInt(n, 1, MAX_STEPS)) ? (f.subs as number[]) : null;
  if (!subs) return { ...out, beats, subs: Array(beats).fill(1), steps: defaultSteps(beats, Array(beats).fill(1), []) };
  const groups = Array.isArray(f.groups) && f.groups.every(g => isInt(g, 1, MAX_BEATS))
    && (f.groups.length === 0 || (f.groups.length >= 2 && (f.groups as number[]).reduce((x, y) => x + y, 0) === beats))
    ? (f.groups as number[]) : [];
  const steps = Array.isArray(f.steps) && f.steps.length === beats
    && f.steps.every((row, b) => Array.isArray(row) && row.length === subs[b] && row.every(isStep))
    ? (f.steps as Step[][]) : defaultSteps(beats, subs, groups);
  return { ...out, beats, groups, subs, steps };
}
