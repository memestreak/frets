/**
 * The Metronome's rhythm (issue #149): the tempo, the bar, and what each click plays. Pure; no
 * React, no audio. `useMetronome.ts` plays it and `storage.ts` saves it.
 *
 * The click pattern follows REAPER's: four voices, A to D, each with its own sound, pitch and
 * level. Every beat is split into steps, and each step plays one voice or none. A polyrhythm layer
 * adds a second, independent run of even clicks across the bar.
 */

export type SoundId = 'wood' | 'beep' | 'cowbell' | 'stick' | 'hihat' | 'clave' | 'kick';
export const SOUNDS: readonly (readonly [SoundId, string])[] = [
  ['wood', 'Wood block'], ['beep', 'Beep'], ['cowbell', 'Cowbell'], ['stick', 'Side stick'],
  ['hihat', 'Hi-hat'], ['clave', 'Clave'], ['kick', 'Kick'],
];

/** A voice: A (0) to D (3). A step plays one voice, or none (null). */
export type VoiceId = 0 | 1 | 2 | 3;
export type Step = VoiceId | null;
export const VOICE_NAMES = ['A', 'B', 'C', 'D'] as const;

export interface Voice {
  sound: SoundId;
  /** The sound's high (accent) sample, or its low one. */
  high: boolean;
  /** 0 to 1. */
  level: number;
}

export interface Poly {
  /** Even clicks across the bar (3 over 4, 5 over 4…); 0 is off. */
  count: number;
  sound: SoundId;
  level: number;
}

export interface Rhythm {
  bpm: number;
  beats: number;
  /** How the beats group (2+2+3); empty when they don't. Each group's first beat plays B, the others C. */
  groups: number[];
  /** Steps in each beat, 1 to `MAX_STEPS`, one per beat. */
  subs: number[];
  /** What each step of each beat plays: `steps[beat][step]`. */
  steps: Step[][];
  /** 50 is straight; 67 a triplet shuffle. Moves every second step of a beat split evenly. */
  swing: number;
  /** A to D. */
  voices: Voice[];
  poly: Poly;
}

export const MIN_BPM = 20;
export const MAX_BPM = 400;
export const DEFAULT_BPM = 120;
export const MAX_BEATS = 32;
export const DEFAULT_BEATS = 4;
export const MAX_STEPS = 8;
export const MIN_SWING = 50;
export const MAX_SWING = 75;
export const MAX_POLY = 16;

export const clampBpm = (bpm: number) => Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));

/** The beats each group starts on: 0, 2, 4 for 2+2+3. */
export function groupStarts(groups: readonly number[]): Set<number> {
  const out = new Set<number>();
  let at = 0;
  for (const g of groups) {
    out.add(at);
    at += g;
  }
  return out;
}

/**
 * The usual steps: A on beat one, B on the other beats (C on a beat inside a group), and C between
 * the beats (D when the beats are grouped, so a group's beats stay clear of the steps between them).
 */
export function defaultSteps(beats: number, subs: readonly number[], groups: readonly number[]): Step[][] {
  const starts = groupStarts(groups);
  const grouped = groups.length > 0;
  return Array.from({ length: beats }, (_, b) =>
    Array.from({ length: subs[b] ?? 1 }, (_, s): Step => {
      if (s > 0) return grouped ? 3 : 2;
      if (b === 0) return 0;
      return grouped && !starts.has(b) ? 2 : 1;
    }),
  );
}

export const DEFAULT_VOICES: readonly Voice[] = [
  { sound: 'wood', high: true, level: 1 },
  { sound: 'wood', high: false, level: 0.85 },
  { sound: 'wood', high: false, level: 0.45 },
  { sound: 'wood', high: false, level: 0.25 },
];

export function defaultRhythm(): Rhythm {
  const subs = Array<number>(DEFAULT_BEATS).fill(1);
  return {
    bpm: DEFAULT_BPM, beats: DEFAULT_BEATS, groups: [], subs, steps: defaultSteps(DEFAULT_BEATS, subs, []),
    swing: MIN_SWING, voices: DEFAULT_VOICES.map(v => ({ ...v })), poly: { count: 0, sound: 'cowbell', level: 0.6 },
  };
}

/* — changes, each a new rhythm — */

/** A new number of beats: every beat split like the first, the usual steps, no groups. */
export function withBeats(r: Rhythm, beats: number): Rhythm {
  if (beats === r.beats) return r;
  const subs = Array<number>(beats).fill(r.subs[0] ?? 1);
  return { ...r, beats, groups: [], subs, steps: defaultSteps(beats, subs, []) };
}

/** Every beat split into `n` steps (Quarters…Sixteenths), with the usual steps. */
export function withAllSubs(r: Rhythm, n: number): Rhythm {
  const subs = Array<number>(r.beats).fill(n);
  return { ...r, subs, steps: defaultSteps(r.beats, subs, r.groups) };
}

/** One beat split into `n` steps; its first step keeps its voice. */
export function withBeatSubs(r: Rhythm, beat: number, n: number): Rhythm {
  const subs = r.subs.with(beat, n);
  const first = r.steps[beat]?.[0] ?? 1;
  const between: Step = r.groups.length > 0 ? 3 : 2;
  const steps = r.steps.with(beat, Array.from({ length: n }, (_, k): Step => (k === 0 ? first : between)));
  return { ...r, subs, steps };
}

/** The grid's cell: voice `v` plays the step, or nothing if it already did. */
export function toggleCell(r: Rhythm, beat: number, step: number, v: VoiceId): Rhythm {
  const row = r.steps[beat].with(step, r.steps[beat][step] === v ? null : v);
  return { ...r, steps: r.steps.with(beat, row) };
}

/** A tile's press (the Bar view): A → B → C → D → none → A. */
export function cycleCell(r: Rhythm, beat: number, step: number): Rhythm {
  const cur = r.steps[beat][step];
  const next: Step = cur === null ? 0 : cur === 3 ? null : ((cur + 1) as VoiceId);
  return { ...r, steps: r.steps.with(beat, r.steps[beat].with(step, next)) };
}

export function withVoice(r: Rhythm, v: VoiceId, patch: Partial<Voice>): Rhythm {
  return { ...r, voices: r.voices.with(v, { ...r.voices[v], ...patch }) };
}

/** The main Sound: every voice to one sound. */
export function withSound(r: Rhythm, sound: SoundId): Rhythm {
  return { ...r, voices: r.voices.map(v => ({ ...v, sound })) };
}

/** Groups as typed, "2+2+3": the beats become their sum. Fewer than two groups clears them. */
export function parseGroups(text: string): number[] {
  const groups = text.split('+').map(x => Number(x.trim())).filter(n => Number.isInteger(n) && n > 0);
  return groups.length >= 2 && groups.reduce((x, y) => x + y, 0) <= MAX_BEATS ? groups : [];
}

export function withGroups(r: Rhythm, groups: number[]): Rhythm {
  if (groups.length === 0) return { ...r, groups: [], steps: defaultSteps(r.beats, r.subs, []) };
  const beats = groups.reduce((x, y) => x + y, 0);
  const subs = Array.from({ length: beats }, (_, b) => r.subs[b] ?? r.subs[0] ?? 1);
  return { ...r, beats, groups, subs, steps: defaultSteps(beats, subs, groups) };
}

/* — presets — */

/** What a preset sets: the bar, and the polyrhythm's count. The tempo and the sounds stay. */
type Pattern = Pick<Rhythm, 'beats' | 'groups' | 'subs' | 'steps' | 'swing'> & { poly: number };

/** Every beat split into `sub` steps, with the usual steps. */
function even(beats: number, sub: number, groups: number[] = [], swing = MIN_SWING, poly = 0): Pattern {
  const subs = Array<number>(beats).fill(sub);
  return { beats, groups, subs, steps: defaultSteps(beats, subs, groups), swing, poly };
}

/** A beat played by every step of `steps`, and by nothing else. */
function onBeats(beats: number, sub: number, steps: (b: number) => Step[]): Pattern {
  return { ...even(beats, sub), steps: Array.from({ length: beats }, (_, b) => steps(b)) };
}

/**
 * A rhythm of hits (a clave): A at each step listed, counted across the bar, and D on the other
 * beats, quietly, to keep the pulse.
 */
function hits(beats: number, sub: number, at: number[]): Pattern {
  return onBeats(beats, sub, b => Array.from({ length: sub }, (_, s): Step => {
    if (at.includes(b * sub + s)) return 0;
    return s === 0 ? 3 : null;
  }));
}

export interface Preset {
  name: string;
  pattern: () => Pattern;
}

export const PRESETS: readonly { group: string; items: readonly Preset[] }[] = [
  { group: 'Straight', items: [
    { name: 'Quarters', pattern: () => even(4, 1) },
    { name: 'Eighths', pattern: () => even(4, 2) },
    { name: 'Triplets', pattern: () => even(4, 3) },
    { name: 'Sixteenths', pattern: () => even(4, 4) },
    { name: 'Quintuplets', pattern: () => even(4, 5) },
    { name: 'Sextuplets', pattern: () => even(4, 6) },
  ] },
  { group: 'Feel', items: [
    { name: 'Shuffle', pattern: () => even(4, 2, [], 67) },
    { name: 'Swing sixteenths', pattern: () => even(4, 4, [], 60) },
    { name: 'Backbeat (2 and 4)', pattern: () => onBeats(4, 1, b => [b % 2 === 0 ? 1 : 0]) },
    { name: 'Offbeats only', pattern: () => onBeats(4, 2, () => [null, 1]) },
  ] },
  { group: 'Odd and compound', items: [
    { name: '3/4', pattern: () => even(3, 1) },
    { name: '5/4 (3+2)', pattern: () => even(5, 1, [3, 2]) },
    { name: '6/8 (3+3)', pattern: () => even(6, 1, [3, 3]) },
    { name: '7/8 (2+2+3)', pattern: () => even(7, 1, [2, 2, 3]) },
    { name: '9/8 (2+2+2+3)', pattern: () => even(9, 1, [2, 2, 2, 3]) },
    { name: '12/8 (3+3+3+3)', pattern: () => even(12, 1, [3, 3, 3, 3]) },
  ] },
  { group: 'Clave and world', items: [
    { name: 'Son clave 3-2', pattern: () => hits(4, 4, [0, 3, 6, 10, 12]) },
    { name: 'Son clave 2-3', pattern: () => hits(4, 4, [2, 4, 8, 11, 14]) },
    { name: 'Rumba clave 3-2', pattern: () => hits(4, 4, [0, 3, 7, 10, 12]) },
    { name: 'Bossa nova', pattern: () => hits(4, 4, [0, 3, 6, 10, 13]) },
    { name: 'Tresillo', pattern: () => hits(4, 2, [0, 3, 6]) },
    { name: 'Cinquillo', pattern: () => hits(4, 2, [0, 2, 3, 5, 6]) },
  ] },
  { group: 'Polyrhythm', items: [
    { name: '3 over 2', pattern: () => even(2, 1, [], MIN_SWING, 3) },
    { name: '4 over 3', pattern: () => even(3, 1, [], MIN_SWING, 4) },
    { name: '5 over 4', pattern: () => even(4, 1, [], MIN_SWING, 5) },
    { name: '3 over 4', pattern: () => even(4, 1, [], MIN_SWING, 3) },
    { name: '7 over 4', pattern: () => even(4, 1, [], MIN_SWING, 7) },
  ] },
];

export function withPreset(r: Rhythm, preset: Preset): Rhythm {
  const { poly, ...bar } = preset.pattern();
  return { ...r, ...bar, poly: { ...r.poly, count: poly } };
}

/* — the bar, as timed clicks — */

export interface Click {
  /** Where in the bar, in beats from its start: 1.5 is beat two's "and". */
  at: number;
  /** The beat and its step; -1 for the polyrhythm layer. */
  beat: number;
  step: number;
  /** The voice it plays (null: none), or the polyrhythm layer's click number. */
  voice: Step;
  poly: number | null;
}

/** Every click of a bar, in order, in beats: steps (swung) and the polyrhythm layer. */
export function barClicks(r: Rhythm): Click[] {
  const out: Click[] = [];
  for (let b = 0; b < r.beats; b++) {
    const n = r.subs[b] ?? 1;
    for (let k = 0; k < n; k++) {
      // Swing moves every second step of a pair later, on a beat split evenly.
      const at = n % 2 === 0 && k % 2 === 1 ? (k - 1) / n + (2 / n) * (r.swing / 100) : k / n;
      out.push({ at: b + at, beat: b, step: k, voice: r.steps[b]?.[k] ?? null, poly: null });
    }
  }
  for (let i = 0; i < r.poly.count; i++) {
    out.push({ at: (i / r.poly.count) * r.beats, beat: -1, step: -1, voice: null, poly: i });
  }
  return out.sort((x, y) => x.at - y.at);
}

/**
 * Where the clock is anchored: a position in beats, the time (seconds) it sounds at, and the tempo
 * from there on. A tempo change re-anchors at the last click already scheduled, so that click stays
 * put and the new tempo is heard from the next one.
 */
export interface Anchor {
  pos: number;
  time: number;
  bpm: number;
}

/** When the beat position `pos` sounds. */
export const timeAt = (a: Anchor, pos: number) => a.time + ((pos - a.pos) * 60) / a.bpm;

/** The clock at a new tempo, anchored at the last click scheduled (at `pos`, under the old anchor). */
export const retempo = (a: Anchor, pos: number, bpm: number): Anchor => ({ pos, time: timeAt(a, pos), bpm });

/* — names — */

/** The Italian tempo marking a bpm falls in, as a classic metronome's scale prints them. */
export function tempoName(bpm: number): string {
  const marks: [below: number, name: string][] = [
    [40, 'Grave'], [60, 'Largo'], [66, 'Larghetto'], [76, 'Adagio'], [108, 'Andante'],
    [120, 'Moderato'], [156, 'Allegro'], [176, 'Vivace'], [200, 'Presto'], [Infinity, 'Prestissimo'],
  ];
  return marks.find(([below]) => bpm < below)![1];
}

/** How players count step `s` of a beat split into `n`: 1 e & a, 1 trip let, 1 &. */
export function countSyllable(beat: number, s: number, n: number): string {
  if (s === 0) return String(beat + 1);
  if (n === 2) return '&';
  if (n === 3) return ['', 'trip', 'let'][s];
  if (n === 4) return ['', 'e', '&', 'a'][s];
  return '·';
}

/* — tap tempo — */

/** A pause longer than this starts a new run of taps: a little over a beat at the slowest tempo. */
export const TAP_RESET_MS = 60000 / MIN_BPM + 100;
/** The taps a tempo is averaged over. */
export const TAP_KEEP = 8;

/** The run of taps after one at `t` (milliseconds). */
export function addTap(taps: readonly number[], t: number): number[] {
  const last = taps.at(-1);
  return last === undefined || t - last > TAP_RESET_MS ? [t] : [...taps, t].slice(-TAP_KEEP);
}

/** The tempo the taps keep, or null until there are two. */
export function tapBpm(taps: readonly number[]): number | null {
  if (taps.length < 2) return null;
  const gap = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
  return clampBpm(60000 / gap);
}
