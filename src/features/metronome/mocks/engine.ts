'use client';

/**
 * A throwaway metronome for the look mocks (issue #149): Web Audio clock, a short lookahead
 * loop, synthesized sounds (the wood block is Tab's metronome click, `clickWave`). Not the
 * final engine.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { clickWave } from '@/features/tab/click';

/** How a click in the pattern sounds: beat one's sound, a beat's, a quiet one, or nothing. */
export type Level = 'accent' | 'beat' | 'soft' | 'mute';
/** Clicks per beat: quarters, eighths, triplets, sixteenths. */
export type Subdivision = 1 | 2 | 3 | 4;
export type SoundId = 'wood' | 'beep' | 'cowbell' | 'stick' | 'hihat';

export const SOUNDS: [SoundId, string][] = [
  ['wood', 'Wood block'], ['beep', 'Beep'], ['cowbell', 'Cowbell'], ['stick', 'Side stick'], ['hihat', 'Hi-hat'],
];

export interface MetronomeState {
  bpm: number;
  beats: number;
  subdivision: Subdivision;
  /** One level per click: beats × subdivision. */
  levels: Level[];
  sound: SoundId;
  /** 0 to 1. */
  volume: number;
  /** Bars that click, then bars that stay silent (0: never silent), for practising time. */
  playBars: number;
  silentBars: number;
}

const CYCLE: Level[] = ['accent', 'beat', 'soft', 'mute'];

export const MIN_BPM = 30;
export const MAX_BPM = 300;
const LOOKAHEAD_S = 0.1;
const TICK_MS = 25;

/** Beat one accented, every other beat plain, the clicks between beats soft. */
export function defaultLevels(beats: number, subdivision: number): Level[] {
  return Array.from({ length: beats * subdivision }, (_, i) => (i === 0 ? 'accent' : i % subdivision === 0 ? 'beat' : 'soft'));
}

/* — the sounds — */

interface Voice {
  seconds: number;
  /** Partials as [hertz, level]. */
  partials: [number, number][];
  /** How much noise, 0 to 1, high-passed. */
  noise?: number;
  decay: number;
}

function synth(v: Voice, sampleRate: number): Float32Array {
  const length = Math.round(v.seconds * sampleRate);
  const wave = new Float32Array(length);
  let peak = 0;
  let last = 0;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const attack = Math.min(1, t / 0.0008);
    const tail = Math.min(1, (length - 1 - i) / (0.005 * sampleRate));
    let x = 0;
    for (const [hz, level] of v.partials) x += level * Math.sin(2 * Math.PI * hz * t);
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

/** The accented and plain sample of a sound. */
function soundWaves(sound: SoundId, sampleRate: number): [Float32Array, Float32Array] {
  switch (sound) {
    case 'wood':
      return [clickWave(true, sampleRate), clickWave(false, sampleRate)];
    case 'beep':
      return [
        synth({ seconds: 0.07, partials: [[1760, 1]], decay: 0.03 }, sampleRate),
        synth({ seconds: 0.07, partials: [[1320, 1]], decay: 0.03 }, sampleRate),
      ];
    case 'cowbell':
      return [
        synth({ seconds: 0.25, partials: [[810, 1], [1210, 0.7], [2430, 0.2]], decay: 0.07 }, sampleRate),
        synth({ seconds: 0.25, partials: [[562, 1], [845, 0.7], [1690, 0.2]], decay: 0.07 }, sampleRate),
      ];
    case 'stick':
      return [
        synth({ seconds: 0.06, partials: [[1900, 0.6], [470, 0.4]], noise: 0.8, decay: 0.012 }, sampleRate),
        synth({ seconds: 0.06, partials: [[1600, 0.6], [400, 0.4]], noise: 0.8, decay: 0.009 }, sampleRate),
      ];
    case 'hihat':
      return [
        synth({ seconds: 0.18, partials: [], noise: 1, decay: 0.05 }, sampleRate),
        synth({ seconds: 0.08, partials: [], noise: 1, decay: 0.018 }, sampleRate),
      ];
  }
}

export function useMetronome(initial: Partial<MetronomeState> = {}) {
  const [state, setState] = useState<MetronomeState>(() => ({
    bpm: 96, beats: 4, subdivision: 1, levels: defaultLevels(4, 1),
    sound: 'wood', volume: 0.8, playBars: 4, silentBars: 0, ...initial,
  }));
  const [playing, setPlaying] = useState(false);
  /** The click sounding now (beat, click within the beat, bar), or null while stopped. */
  const [now, setNow] = useState<{ beat: number; sub: number; bar: number; silent: boolean } | null>(null);

  const latest = useRef(state);
  useEffect(() => { latest.current = state; });
  const audio = useRef<{ ctx: AudioContext; out: GainNode; buffers: Map<SoundId, [AudioBuffer, AudioBuffer]> } | null>(null);
  const timer = useRef<number | null>(null);

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

  const play = useCallback((level: Level, sound: SoundId, at: number) => {
    if (level === 'mute') return;
    const a = audio.current!;
    const [accent, beat] = buffers(sound);
    const src = a.ctx.createBufferSource();
    src.buffer = level === 'accent' ? accent : beat;
    const gain = a.ctx.createGain();
    gain.gain.value = level === 'soft' ? 0.4 : 1;
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
    let next = ctx.currentTime + 0.05;
    let click = 0;
    let bar = 0;
    const schedule = () => {
      const a = audio.current!;
      const s = latest.current;
      a.out.gain.value = s.volume;
      while (next < a.ctx.currentTime + LOOKAHEAD_S) {
        const clicks = s.beats * s.subdivision;
        click %= clicks;
        const silent = s.silentBars > 0 && bar % (s.playBars + s.silentBars) >= s.playBars;
        if (!silent) play(s.levels[click] ?? 'beat', s.sound, next);
        const shown = { beat: Math.floor(click / s.subdivision), sub: click % s.subdivision, bar, silent };
        window.setTimeout(() => setNow(shown), Math.max(0, (next - a.ctx.currentTime) * 1000));
        next += 60 / s.bpm / s.subdivision;
        click += 1;
        if (click >= clicks) { click = 0; bar += 1; }
      }
    };
    schedule();
    timer.current = window.setInterval(schedule, TICK_MS);
    setPlaying(true);
  }, [ensureAudio, play]);

  const toggle = useCallback(() => (timer.current === null ? start() : stop()), [start, stop]);

  // Space starts and stops, page-wide.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' || (e.target as Element).closest('input, select, textarea')) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  useEffect(() => () => {
    if (timer.current !== null) window.clearInterval(timer.current);
    void audio.current?.ctx.close();
  }, []);

  const set = useCallback((patch: Partial<MetronomeState>) => {
    setState(s => {
      const merged = { ...s, ...patch };
      if (merged.beats !== s.beats || merged.subdivision !== s.subdivision) merged.levels = defaultLevels(merged.beats, merged.subdivision);
      return merged;
    });
  }, []);

  /** Picks a sound and plays its accent once, so it can be heard while stopped. */
  const setSound = useCallback((sound: SoundId) => {
    set({ sound });
    const a = ensureAudio();
    a.out.gain.value = latest.current.volume;
    play('accent', sound, a.ctx.currentTime + 0.01);
  }, [set, ensureAudio, play]);

  /** One click of the pattern: accent → beat → soft → silent → accent. */
  const cycleLevel = useCallback((click: number) => {
    setState(s => {
      const levels = [...s.levels];
      levels[click] = CYCLE[(CYCLE.indexOf(levels[click]) + 1) % CYCLE.length];
      return { ...s, levels };
    });
  }, []);

  // Tap tempo.
  const taps = useRef<number[]>([]);
  const tap = useCallback(() => {
    const t = performance.now();
    const last = taps.current.at(-1);
    taps.current = last === undefined || t - last > 2000 ? [t] : [...taps.current, t].slice(-8);
    const n = taps.current.length;
    if (n >= 2) {
      const bpm = Math.round(60000 / ((taps.current[n - 1] - taps.current[0]) / (n - 1)));
      set({ bpm: Math.min(MAX_BPM, Math.max(MIN_BPM, bpm)) });
    }
  }, [set]);

  return { ...state, playing, now, set, setSound, toggle, cycleLevel, tap };
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
