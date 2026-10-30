'use client';

/**
 * A throwaway metronome for the look mocks (issue #149): Web Audio clock, a short lookahead
 * loop, the Tab metronome's click (`clickWave`). Not the final engine.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { clickWave } from '@/features/tab/click';

export type Level = 'accent' | 'beat' | 'mute';
/** Clicks per beat: quarters, eighths, triplets, sixteenths. */
export type Subdivision = 1 | 2 | 3 | 4;

export interface MetronomeState {
  bpm: number;
  beats: number;
  subdivision: Subdivision;
  /** One level per beat. */
  levels: Level[];
}

const LOOKAHEAD_S = 0.1;
const TICK_MS = 25;

export function defaultLevels(beats: number): Level[] {
  return Array.from({ length: beats }, (_, i) => (i === 0 ? 'accent' : 'beat'));
}

export function useMetronome(initial: Partial<MetronomeState> = {}) {
  const [state, setState] = useState<MetronomeState>(() => {
    const beats = initial.beats ?? 4;
    return { bpm: 96, beats, subdivision: 1, levels: defaultLevels(beats), ...initial };
  });
  const [playing, setPlaying] = useState(false);
  /** The beat and sub-click sounding now, or null while stopped. */
  const [now, setNow] = useState<{ beat: number; sub: number; at: number } | null>(null);

  const latest = useRef(state);
  useEffect(() => { latest.current = state; });
  const audio = useRef<{ ctx: AudioContext; accent: AudioBuffer; beat: AudioBuffer; sub: AudioBuffer } | null>(null);
  const timer = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    setPlaying(false);
    setNow(null);
  }, []);

  const start = useCallback(() => {
    if (!audio.current) {
      const ctx = new AudioContext();
      const buffer = (wave: Float32Array, gain: number) => {
        const b = ctx.createBuffer(1, wave.length, ctx.sampleRate);
        b.copyToChannel(wave.map(x => x * gain), 0);
        return b;
      };
      audio.current = {
        ctx,
        accent: buffer(clickWave(true, ctx.sampleRate), 1),
        beat: buffer(clickWave(false, ctx.sampleRate), 1),
        sub: buffer(clickWave(false, ctx.sampleRate), 0.45),
      };
    }
    const { ctx } = audio.current;
    void ctx.resume();
    let next = ctx.currentTime + 0.05;
    let beat = 0;
    let sub = 0;
    const schedule = () => {
      const a = audio.current!;
      const s = latest.current;
      while (next < a.ctx.currentTime + LOOKAHEAD_S) {
        const b = beat % s.beats;
        const level = s.levels[b] ?? 'beat';
        if (level !== 'mute') {
          const src = a.ctx.createBufferSource();
          src.buffer = sub > 0 ? a.sub : level === 'accent' ? a.accent : a.beat;
          src.connect(a.ctx.destination);
          src.start(next);
        }
        const at = next;
        const shown = { beat: b, sub, at: performance.now() + (at - a.ctx.currentTime) * 1000 };
        window.setTimeout(() => setNow(shown), Math.max(0, (at - a.ctx.currentTime) * 1000));
        next += 60 / s.bpm / s.subdivision;
        sub += 1;
        if (sub >= s.subdivision) { sub = 0; beat = (b + 1) % s.beats; }
      }
    };
    schedule();
    timer.current = window.setInterval(schedule, TICK_MS);
    setPlaying(true);
  }, []);

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
      if (patch.beats !== undefined && patch.beats !== s.beats) {
        merged.levels = Array.from({ length: patch.beats }, (_, i) => s.levels[i] ?? (i === 0 ? 'accent' : 'beat'));
      }
      return merged;
    });
  }, []);

  /** Accent → beat → mute → accent. */
  const cycleLevel = useCallback((i: number) => {
    setState(s => {
      const order: Level[] = ['accent', 'beat', 'mute'];
      const levels = [...s.levels];
      levels[i] = order[(order.indexOf(levels[i]) + 1) % order.length];
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

  return { ...state, playing, now, set, toggle, cycleLevel, tap };
}

export const MIN_BPM = 30;
export const MAX_BPM = 300;

/** The Italian tempo marking a bpm falls in, as printed on a classic metronome's scale. */
export function tempoName(bpm: number): string {
  const marks: [number, string][] = [
    [40, 'Grave'], [60, 'Largo'], [66, 'Larghetto'], [76, 'Adagio'], [108, 'Andante'],
    [120, 'Moderato'], [156, 'Allegro'], [176, 'Vivace'], [200, 'Presto'], [Infinity, 'Prestissimo'],
  ];
  return marks.find(([below]) => bpm < below)![1];
}

export type Metronome = ReturnType<typeof useMetronome>;
