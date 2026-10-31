'use client';

/**
 * A throwaway metronome for the look mocks (issue #149): Web Audio clock, a bar scheduled ahead
 * at a time, synthesized sounds (the wood block is Tab's metronome click, `clickWave`). Not the
 * final engine, but it plays everything the mocks show.
 *
 * The rhythm follows REAPER's click pattern: four voices, A to D, each with its own sound and
 * level; every beat is split into steps, and each step plays one voice or none.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { clickWave } from '@/features/tab/click';

export type SoundId = 'wood' | 'beep' | 'cowbell' | 'stick' | 'hihat' | 'clave' | 'kick';
export const SOUNDS: [SoundId, string][] = [
  ['wood', 'Wood block'], ['beep', 'Beep'], ['cowbell', 'Cowbell'], ['stick', 'Side stick'],
  ['hihat', 'Hi-hat'], ['clave', 'Clave'], ['kick', 'Kick'],
];

/** A voice: A (0) to D (3). A step plays one voice, or none (null). */
export type VoiceId = 0 | 1 | 2 | 3;
export type Step = VoiceId | null;
export const VOICE_NAMES = ['A', 'B', 'C', 'D'] as const;

export interface Voice {
  sound: SoundId;
  /** Its own pitch: the sound's high (accent) or low sample. */
  high: boolean;
  /** 0 to 1. */
  level: number;
}

export type Counting = 'none' | 'numbers' | 'takadimi';
export type TrainerEnd = 'hold' | 'restart' | 'stop';

export interface Section {
  name: string;
  bars: number;
  bpm: number;
  beats: number;
}

export interface MetronomeState {
  bpm: number;
  beats: number;
  /** The note a beat is: 4 a quarter, 8 an eighth. */
  beatUnit: 2 | 4 | 8 | 16;
  /** How the beats group (2+2+3); empty when they don't. Each group's first beat plays B. */
  groups: number[];
  /** Steps in each beat, 1 to 8. */
  subs: number[];
  /** What each step of each beat plays. */
  steps: Step[][];
  /** 50 is straight; 67 a triplet shuffle. Moves every second step of an even beat. */
  swing: number;
  voices: Voice[];
  /** A second, independent layer: `count` even clicks across the bar (3 over 4, 5 over 4…). 0 is off. */
  poly: { count: number; sound: SoundId; level: number };
  /** 0 to 1. */
  volume: number;

  /* Tempo */
  trainer: { on: boolean; to: number; by: number; every: number; end: TrainerEnd };

  /* Practice */
  playBars: number;
  silentBars: number;
  /** Per cent of clicks left out at random, to test time. */
  randomMute: number;
  countIn: number;
  /** Stop after this many bars (0: never). */
  stopAfterBars: number;
  /** Stop after this many minutes (0: never). */
  stopAfterMinutes: number;
  counting: Counting;
  spoken: boolean;
  flash: boolean;
  vibrate: boolean;
  tapAlong: boolean;

  /* Setlist */
  sections: Section[];
  playSections: boolean;
}

export const MIN_BPM = 20;
export const MAX_BPM = 400;
const LOOKAHEAD_S = 0.12;
const TICK_MS = 25;

/** Default steps: A on beat one, B on the beats (C on beats inside a group), C or D between beats. */
export function defaultSteps(beats: number, subs: number[], groups: number[]): Step[][] {
  const starts = new Set<number>();
  let at = 0;
  for (const g of groups) { starts.add(at); at += g; }
  const grouped = groups.length > 0;
  return Array.from({ length: beats }, (_, b) =>
    Array.from({ length: subs[b] ?? 1 }, (_, s): Step => {
      if (s > 0) return grouped ? 3 : 2;
      if (b === 0) return 0;
      return grouped && !starts.has(b) ? 2 : 1;
    }),
  );
}

const DEFAULT_VOICES: Voice[] = [
  { sound: 'wood', high: true, level: 1 },
  { sound: 'wood', high: false, level: 0.85 },
  { sound: 'wood', high: false, level: 0.45 },
  { sound: 'wood', high: false, level: 0.25 },
];

export function initialState(): MetronomeState {
  const subs = [1, 1, 1, 1];
  return {
    bpm: 96, beats: 4, beatUnit: 4, groups: [], subs, steps: defaultSteps(4, subs, []), swing: 50,
    voices: DEFAULT_VOICES, poly: { count: 0, sound: 'cowbell', level: 0.6 }, volume: 0.8,
    trainer: { on: false, to: 140, by: 4, every: 4, end: 'hold' },
    playBars: 4, silentBars: 0, randomMute: 0, countIn: 0, stopAfterBars: 0, stopAfterMinutes: 0,
    counting: 'numbers', spoken: false, flash: false, vibrate: false, tapAlong: false,
    sections: [
      { name: 'Intro', bars: 4, bpm: 90, beats: 4 },
      { name: 'Verse', bars: 16, bpm: 96, beats: 4 },
      { name: 'Chorus', bars: 8, bpm: 100, beats: 4 },
    ],
    playSections: false,
  };
}

/* — presets — */

type Rhythm = Pick<MetronomeState, 'beats' | 'beatUnit' | 'groups' | 'subs' | 'steps' | 'swing'> & { poly: number };

/** A bar of `beats` beats with `sub` steps each, voice `on` at the listed steps (counted across the bar), D on other beats. */
function hits(beats: number, sub: number, at: number[], on: VoiceId = 0): Rhythm {
  const subs = Array(beats).fill(sub);
  const steps = Array.from({ length: beats }, (_, b) => Array.from({ length: sub }, (_, s): Step => {
    const i = b * sub + s;
    if (at.includes(i)) return on;
    return s === 0 ? 3 : null;
  }));
  return { beats, beatUnit: 4, groups: [], subs, steps, swing: 50, poly: 0 };
}

function even(beats: number, sub: number, beatUnit: Rhythm['beatUnit'] = 4, groups: number[] = [], swing = 50, poly = 0): Rhythm {
  const subs = Array(beats).fill(sub);
  return { beats, beatUnit, groups, subs, steps: defaultSteps(beats, subs, groups), swing, poly };
}

export const PRESETS: { group: string; items: [string, () => Rhythm][] }[] = [
  { group: 'Straight', items: [
    ['Quarters', () => even(4, 1)], ['Eighths', () => even(4, 2)], ['Triplets', () => even(4, 3)],
    ['Sixteenths', () => even(4, 4)], ['Quintuplets', () => even(4, 5)], ['Sextuplets', () => even(4, 6)],
  ] },
  { group: 'Feel', items: [
    ['Shuffle', () => even(4, 2, 4, [], 67)], ['Swing sixteenths', () => even(4, 4, 4, [], 60)],
    ['Backbeat (2 and 4)', () => {
      const r = even(4, 1);
      r.steps = [[1], [0], [1], [0]];
      return r;
    }],
    ['Offbeats only', () => {
      const r = even(4, 2);
      r.steps = r.steps.map(() => [null, 1]);
      return r;
    }],
  ] },
  { group: 'Odd and compound', items: [
    ['3/4', () => even(3, 1)], ['5/4 (3+2)', () => even(5, 1, 4, [3, 2])], ['6/8 (3+3)', () => even(6, 1, 8, [3, 3])],
    ['7/8 (2+2+3)', () => even(7, 1, 8, [2, 2, 3])], ['9/8 (2+2+2+3)', () => even(9, 1, 8, [2, 2, 2, 3])],
    ['12/8 (3+3+3+3)', () => even(12, 1, 8, [3, 3, 3, 3])],
  ] },
  { group: 'Clave and world', items: [
    ['Son clave 3-2', () => hits(4, 4, [0, 3, 6, 10, 12])], ['Son clave 2-3', () => hits(4, 4, [2, 4, 8, 11, 14])],
    ['Rumba clave 3-2', () => hits(4, 4, [0, 3, 7, 10, 12])], ['Bossa nova', () => hits(4, 4, [0, 3, 6, 10, 13])],
    ['Tresillo', () => hits(4, 2, [0, 3, 6])], ['Cinquillo', () => hits(4, 2, [0, 2, 3, 5, 6])],
  ] },
  { group: 'Polyrhythm', items: [
    ['3 over 2', () => even(2, 1, 4, [], 50, 3)], ['4 over 3', () => even(3, 1, 4, [], 50, 4)],
    ['5 over 4', () => even(4, 1, 4, [], 50, 5)], ['3 over 4', () => even(4, 1, 4, [], 50, 3)],
    ['7 over 4', () => even(4, 1, 4, [], 50, 7)],
  ] },
];

/** Counting syllables for step `s` of `n` in a beat, as players say them. */
export function syllable(counting: Counting, beat: number, s: number, n: number): string {
  if (counting === 'none') return '';
  if (s === 0) return counting === 'numbers' ? String(beat + 1) : 'ta';
  if (counting === 'numbers') {
    if (n === 2) return '&';
    if (n === 3) return ['', 'trip', 'let'][s];
    if (n === 4) return ['', 'e', '&', 'a'][s];
    return '·';
  }
  if (n === 2) return 'di';
  if (n === 3) return ['', 'ki', 'da'][s];
  if (n === 4) return ['', 'ka', 'di', 'mi'][s];
  return '·';
}

/* — the sounds — */

interface Synth {
  seconds: number;
  partials: [number, number][];
  noise?: number;
  decay: number;
  /** A downward pitch sweep, for the kick: start frequency multiplier. */
  sweep?: number;
}

function synth(v: Synth, sampleRate: number): Float32Array {
  const length = Math.round(v.seconds * sampleRate);
  const wave = new Float32Array(length);
  const phase = v.partials.map(() => 0);
  let peak = 0;
  let last = 0;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const attack = Math.min(1, t / 0.0008);
    const tail = Math.min(1, (length - 1 - i) / (0.005 * sampleRate));
    const bend = v.sweep ? 1 + (v.sweep - 1) * Math.exp(-t / 0.03) : 1;
    let x = 0;
    v.partials.forEach(([hz, level], k) => {
      phase[k] += (2 * Math.PI * hz * bend) / sampleRate;
      x += level * Math.sin(phase[k]);
    });
    if (v.noise) {
      const n = Math.random() * 2 - 1;
      x += v.noise * (n - last);
      last = n;
    }
    wave[i] = x * attack * tail * Math.exp(-t / v.decay);
    peak = Math.max(peak, Math.abs(wave[i]));
  }
  for (let i = 0; i < length; i++) wave[i] *= 0.9 / peak;
  return wave;
}

/** A sound's high and low sample. */
function soundWaves(sound: SoundId, sr: number): [Float32Array, Float32Array] {
  switch (sound) {
    case 'wood': return [clickWave(true, sr), clickWave(false, sr)];
    case 'beep': return [synth({ seconds: 0.07, partials: [[1760, 1]], decay: 0.03 }, sr), synth({ seconds: 0.07, partials: [[1320, 1]], decay: 0.03 }, sr)];
    case 'cowbell': return [
      synth({ seconds: 0.25, partials: [[810, 1], [1210, 0.7], [2430, 0.2]], decay: 0.07 }, sr),
      synth({ seconds: 0.25, partials: [[562, 1], [845, 0.7], [1690, 0.2]], decay: 0.07 }, sr),
    ];
    case 'stick': return [
      synth({ seconds: 0.06, partials: [[1900, 0.6], [470, 0.4]], noise: 0.8, decay: 0.012 }, sr),
      synth({ seconds: 0.06, partials: [[1600, 0.6], [400, 0.4]], noise: 0.8, decay: 0.009 }, sr),
    ];
    case 'hihat': return [synth({ seconds: 0.18, partials: [], noise: 1, decay: 0.05 }, sr), synth({ seconds: 0.08, partials: [], noise: 1, decay: 0.018 }, sr)];
    case 'clave': return [synth({ seconds: 0.08, partials: [[2500, 1], [5400, 0.15]], decay: 0.02 }, sr), synth({ seconds: 0.08, partials: [[2000, 1], [4300, 0.15]], decay: 0.02 }, sr)];
    case 'kick': return [synth({ seconds: 0.25, partials: [[70, 1]], sweep: 3, decay: 0.08 }, sr), synth({ seconds: 0.2, partials: [[60, 1]], sweep: 2.5, decay: 0.06 }, sr)];
  }
}

/* — the bar, as timed events — */

interface Event {
  /** Seconds from the bar's start. */
  at: number;
  beat: number;
  step: number;
  voice: Step | 'poly';
  polyIndex?: number;
}

function barEvents(s: MetronomeState, bpm: number): { events: Event[]; length: number } {
  const beat = 60 / bpm;
  const events: Event[] = [];
  for (let b = 0; b < s.beats; b++) {
    const n = s.subs[b] ?? 1;
    for (let k = 0; k < n; k++) {
      let offset = (k / n) * beat;
      // Swing: every second step of a pair moves later, on beats split evenly.
      if (n % 2 === 0 && k % 2 === 1) offset = ((k - 1) / n) * beat + (2 / n) * beat * (s.swing / 100);
      events.push({ at: b * beat + offset, beat: b, step: k, voice: s.steps[b]?.[k] ?? null });
    }
  }
  const length = s.beats * beat;
  for (let i = 0; i < s.poly.count; i++) events.push({ at: (i / s.poly.count) * length, beat: -1, step: -1, voice: 'poly', polyIndex: i });
  events.sort((x, y) => x.at - y.at);
  return { events, length };
}

/* — the hook — */

export interface Now {
  beat: number;
  step: number;
  bar: number;
  silent: boolean;
  countIn: boolean;
  /** The poly layer's click sounding, or null. */
  poly: number | null;
  bpm: number;
  section: number | null;
}

export interface TapResult {
  /** Milliseconds: below zero early, above late. */
  offset: number;
}

export function useMetronome() {
  const [state, setState] = useState<MetronomeState>(initialState);
  const [playing, setPlaying] = useState(false);
  const [now, setNow] = useState<Now | null>(null);
  const [taps, setTaps] = useState<TapResult[]>([]);
  const [flashKey, setFlashKey] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const latest = useRef(state);
  useEffect(() => { latest.current = state; });
  const audio = useRef<{ ctx: AudioContext; out: GainNode; buffers: Map<SoundId, [AudioBuffer, AudioBuffer]> } | null>(null);
  const timer = useRef<number | null>(null);
  /** Times (audio clock) of recent clicks, for tap-along. */
  const clickTimes = useRef<number[]>([]);
  const startedAt = useRef(0);

  const ensureAudio = useCallback(() => {
    if (!audio.current) {
      const ctx = new AudioContext();
      const out = ctx.createGain();
      out.connect(ctx.destination);
      audio.current = { ctx, out, buffers: new Map() };
    }
    void audio.current.ctx.resume();
    return audio.current;
  }, []);

  const buffers = useCallback((sound: SoundId) => {
    const a = ensureAudio();
    let pair = a.buffers.get(sound);
    if (!pair) {
      pair = soundWaves(sound, a.ctx.sampleRate).map(w => {
        const b = a.ctx.createBuffer(1, w.length, a.ctx.sampleRate);
        b.copyToChannel(new Float32Array(w), 0);
        return b;
      }) as [AudioBuffer, AudioBuffer];
      a.buffers.set(sound, pair);
    }
    return pair;
  }, [ensureAudio]);

  const playSound = useCallback((sound: SoundId, high: boolean, level: number, at: number) => {
    const a = audio.current!;
    const [hi, lo] = buffers(sound);
    const src = a.ctx.createBufferSource();
    src.buffer = high ? hi : lo;
    const gain = a.ctx.createGain();
    gain.gain.value = level;
    src.connect(gain).connect(a.out);
    src.start(at);
  }, [buffers]);

  const stop = useCallback(() => {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    setPlaying(false);
    setNow(null);
  }, []);

  const start = useCallback(() => {
    const { ctx } = ensureAudio();
    const s0 = latest.current;
    let barStart = ctx.currentTime + 0.06;
    let bar = -s0.countIn;
    let bpm = s0.bpm;
    let section = s0.playSections ? 0 : null;
    let sectionBar = 0;
    let queue: Event[] = [];
    let qi = 0;
    let barLength = 0;
    startedAt.current = ctx.currentTime;
    clickTimes.current = [];
    setTaps([]);
    setElapsed(0);

    const nextBar = (): boolean => {
      const s = latest.current;
      // The setlist sets each section's tempo and beats as it comes round.
      if (s.playSections && section !== null) {
        const sec = s.sections[section];
        if (!sec) return false;
        bpm = sec.bpm;
        if (s.beats !== sec.beats) {
          const subs = Array(sec.beats).fill(1);
          const next = { ...s, beats: sec.beats, groups: [], subs, steps: defaultSteps(sec.beats, subs, []) };
          latest.current = next;
          setState(next);
        }
      }
      const { events, length } = barEvents(latest.current, bpm);
      queue = events;
      qi = 0;
      barLength = length;
      return true;
    };

    const schedule = () => {
      const a = audio.current!;
      const s = latest.current;
      a.out.gain.value = s.volume;
      if (s.stopAfterMinutes > 0 && a.ctx.currentTime - startedAt.current >= s.stopAfterMinutes * 60) { stop(); return; }
      while (true) {
        if (qi >= queue.length) {
          if (queue.length > 0) {
            barStart += barLength;
            bar += 1;
            if (bar > 0) {
              // Tempo trainer: a step every N bars.
              if (s.trainer.on && bar % s.trainer.every === 0) {
                const up = s.trainer.to >= s.bpm;
                const next = bpm + (up ? s.trainer.by : -s.trainer.by);
                const past = up ? next > s.trainer.to : next < s.trainer.to;
                if (!past) bpm = next;
                else if (s.trainer.end === 'restart') bpm = s.bpm;
                else if (s.trainer.end === 'stop') { stop(); return; }
              }
              if (s.playSections && section !== null) {
                sectionBar += 1;
                if (sectionBar >= (s.sections[section]?.bars ?? 0)) { section += 1; sectionBar = 0; }
              }
            }
            if (s.stopAfterBars > 0 && bar >= s.stopAfterBars) { stop(); return; }
          }
          if (!nextBar()) { stop(); return; }
        }
        const e = queue[qi];
        const at = barStart + e.at;
        if (at >= a.ctx.currentTime + LOOKAHEAD_S) break;
        qi += 1;
        const countIn = bar < 0;
        const cycle = s.playBars + s.silentBars;
        const silent = !countIn && s.silentBars > 0 && bar % cycle >= s.playBars;
        const sNow = latest.current;
        if (countIn) {
          if (e.voice !== 'poly' && e.step === 0) playSound(sNow.voices[0].sound, e.beat === 0, 1, at);
        } else if (!silent && !(s.randomMute > 0 && Math.random() * 100 < s.randomMute)) {
          if (e.voice === 'poly') playSound(sNow.poly.sound, true, sNow.poly.level, at);
          else if (e.voice !== null) {
            const v = sNow.voices[e.voice];
            playSound(v.sound, v.high, v.level, at);
          }
        }
        if (e.voice !== 'poly' && e.step === 0) {
          clickTimes.current = [...clickTimes.current, at].slice(-16);
        }
        const shown = {
          beat: e.beat, step: e.step, bar, silent, countIn, bpm, section,
          poly: e.voice === 'poly' ? e.polyIndex! : null,
        };
        const flash = s.flash && e.voice !== 'poly' && e.step === 0;
        const wait = Math.max(0, (at - a.ctx.currentTime) * 1000);
        window.setTimeout(() => {
          if (shown.poly !== null) setNow(n => (n ? { ...n, poly: shown.poly } : n));
          else setNow(n => ({ ...shown, poly: n?.poly ?? null }));
          if (flash) setFlashKey(k => k + 1);
          if (s.vibrate && e.step === 0 && e.voice !== 'poly') navigator.vibrate?.(e.beat === 0 ? 40 : 15);
          setElapsed(a.ctx.currentTime - startedAt.current);
        }, wait);
      }
    };
    schedule();
    timer.current = window.setInterval(schedule, TICK_MS);
    setPlaying(true);
  }, [ensureAudio, playSound, stop]);

  const toggle = useCallback(() => (timer.current === null ? start() : stop()), [start, stop]);

  /** A tap along with the beat: how early or late it was against the nearest beat. */
  const tapBeat = useCallback(() => {
    const a = audio.current;
    if (!a || timer.current === null || clickTimes.current.length === 0) return;
    // A tap answers the click as heard, which reaches the ear after the output's latency.
    const t = a.ctx.currentTime - (a.ctx.outputLatency || 0) - a.ctx.baseLatency;
    let best = clickTimes.current[0];
    for (const c of clickTimes.current) if (Math.abs(c - t) < Math.abs(best - t)) best = c;
    setTaps(ts => [...ts, { offset: Math.round((t - best) * 1000) }].slice(-24));
  }, []);

  // Space starts and stops, page-wide; with tap-along on, J taps.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as Element).closest('input, select, textarea')) return;
      if (e.key === ' ') {
        e.preventDefault();
        toggle();
      } else if ((e.key === 'j' || e.key === 'J') && latest.current.tapAlong) tapBeat();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, tapBeat]);

  useEffect(() => () => {
    if (timer.current !== null) window.clearInterval(timer.current);
    void audio.current?.ctx.close();
  }, []);

  const set = useCallback((patch: Partial<MetronomeState>) => {
    setState(s => {
      const merged = { ...s, ...patch };
      if (patch.beats !== undefined && patch.beats !== s.beats && patch.subs === undefined) {
        const sub = s.subs[0] ?? 1;
        merged.subs = Array(merged.beats).fill(sub);
        merged.groups = [];
        merged.steps = defaultSteps(merged.beats, merged.subs, []);
      }
      return merged;
    });
  }, []);

  /** Every beat split the same way (the main view's Quarters…Sixteenths). */
  const setAllSubs = useCallback((n: number) => {
    setState(s => {
      const subs = Array(s.beats).fill(n);
      return { ...s, subs, steps: defaultSteps(s.beats, subs, s.groups) };
    });
  }, []);

  /** One beat split into `n` steps; its first step keeps its voice. */
  const setBeatSubs = useCallback((beat: number, n: number) => {
    setState(s => {
      const subs = [...s.subs];
      subs[beat] = n;
      const steps = [...s.steps];
      const first = s.steps[beat]?.[0] ?? 1;
      steps[beat] = Array.from({ length: n }, (_, k): Step => (k === 0 ? first : s.groups.length ? 3 : 2));
      return { ...s, subs, steps };
    });
  }, []);

  /** A cell of the grid: plays voice `v` there, or nothing if it already did. */
  const toggleCell = useCallback((beat: number, step: number, v: VoiceId) => {
    setState(s => {
      const steps = s.steps.map(r => [...r]);
      steps[beat][step] = steps[beat][step] === v ? null : v;
      return { ...s, steps };
    });
  }, []);

  /** The tiles' press (D): A → B → C → D → none → A. */
  const cycleCell = useCallback((beat: number, step: number) => {
    setState(s => {
      const steps = s.steps.map(r => [...r]);
      const cur = steps[beat][step];
      steps[beat][step] = cur === null ? 0 : cur === 3 ? null : ((cur + 1) as VoiceId);
      return { ...s, steps };
    });
  }, []);

  const setVoice = useCallback((v: VoiceId, patch: Partial<Voice>) => {
    setState(s => ({ ...s, voices: s.voices.map((x, i) => (i === v ? { ...x, ...patch } : x)) }));
    if (patch.sound) {
      const a = ensureAudio();
      a.out.gain.value = latest.current.volume;
      const voice = { ...latest.current.voices[v], ...patch };
      playSound(voice.sound, voice.high, voice.level, a.ctx.currentTime + 0.01);
    }
  }, [ensureAudio, playSound]);

  /** The main view's Sound: every voice, and the poly layer, to one sound. */
  const setSound = useCallback((sound: SoundId) => {
    setState(s => ({ ...s, voices: s.voices.map(v => ({ ...v, sound })) }));
    const a = ensureAudio();
    a.out.gain.value = latest.current.volume;
    playSound(sound, true, 1, a.ctx.currentTime + 0.01);
  }, [ensureAudio, playSound]);

  const applyPreset = useCallback((make: () => Rhythm) => {
    const r = make();
    setState(s => ({ ...s, ...r, poly: { ...s.poly, count: r.poly } }));
  }, []);

  /** Typed groups, "2+2+3": sets the beats to their sum. */
  const setGroups = useCallback((text: string) => {
    const groups = text.split('+').map(x => Number(x.trim())).filter(n => Number.isInteger(n) && n > 0);
    setState(s => {
      if (groups.length < 2) return { ...s, groups: [], steps: defaultSteps(s.beats, s.subs, []) };
      const beats = groups.reduce((x, y) => x + y, 0);
      const subs = Array.from({ length: beats }, (_, b) => s.subs[b] ?? s.subs[0] ?? 1);
      return { ...s, beats, groups, subs, steps: defaultSteps(beats, subs, groups) };
    });
  }, []);

  // Tap tempo.
  const tapTimes = useRef<number[]>([]);
  const tap = useCallback(() => {
    const t = performance.now();
    const last = tapTimes.current.at(-1);
    tapTimes.current = last === undefined || t - last > 2000 ? [t] : [...tapTimes.current, t].slice(-8);
    const n = tapTimes.current.length;
    if (n >= 2) {
      const bpm = Math.round(60000 / ((tapTimes.current[n - 1] - tapTimes.current[0]) / (n - 1)));
      set({ bpm: Math.min(MAX_BPM, Math.max(MIN_BPM, bpm)) });
    }
  }, [set]);

  return {
    ...state, playing, now, taps, flashKey, elapsed,
    set, setAllSubs, setBeatSubs, toggleCell, cycleCell, setVoice, setSound, applyPreset, setGroups,
    toggle, tap, tapBeat, clearTaps: () => setTaps([]),
  };
}

/** The Italian tempo marking a bpm falls in, as printed on a classic metronome's scale. */
export function tempoName(bpm: number): string {
  const marks: [number, string][] = [
    [40, 'Grave'], [60, 'Largo'], [66, 'Larghetto'], [76, 'Adagio'], [108, 'Andante'],
    [120, 'Moderato'], [156, 'Allegro'], [176, 'Vivace'], [200, 'Presto'], [Infinity, 'Prestissimo'],
  ];
  return marks.find(([below]) => bpm < below)![1];
}

export type Metronome = ReturnType<typeof useMetronome>;
