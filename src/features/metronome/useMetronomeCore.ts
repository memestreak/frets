'use client';

/**
 * The Metronome's core: a rhythm, and Web Audio playing it. It knows nothing of storage or the
 * page, so the page (`useMetronome.ts`) and the MCP App (#269) share it. The rhythm goes in with
 * `setRhythm` and comes out as `rhythm`, whoever changed it.
 *
 * A timer looks a little ahead and schedules each click on the audio clock, so the clicks keep
 * time however busy the page is.
 *
 * Clicks are placed in beats, and beats become seconds at the tempo. When the tempo changes, the
 * clock re-anchors at the last click already queued, so the change is heard from the next click on,
 * with no jump. A change to the bar (beats, steps per beat, the polyrhythm) starts with the next
 * bar; a change to which voice a step plays is heard at once.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { addTap, barClicks, retempo, tapBpm, timeAt, type Anchor, type Rhythm, type SoundId } from './rhythm';
import { soundWaves } from './sounds';

/** How far ahead clicks are scheduled, and how often the timer looks. */
const LOOKAHEAD_S = 0.12;
const TICK_MS = 25;
/** The first click's delay after Start, so it isn't cut short. */
const START_DELAY_S = 0.06;

/** The click sounding now, for the beat displays. */
export interface Now {
  bar: number;
  beat: number;
  step: number;
  /** The polyrhythm layer's last click, or null before its first. */
  poly: number | null;
}

interface Audio {
  ctx: AudioContext;
  out: GainNode;
  buffers: Map<SoundId, [high: AudioBuffer, low: AudioBuffer]>;
}

/** Where the metronome starts: its rhythm and volume (0 to 1). */
export interface MetronomeStart {
  rhythm: Rhythm;
  volume: number;
}

export function useMetronomeCore(initial: () => MetronomeStart) {
  const [first] = useState(initial);
  const [rhythm, setRhythm] = useState<Rhythm>(first.rhythm);
  const [volume, setVolume] = useState(first.volume);
  const [playing, setPlaying] = useState(false);
  const [now, setNow] = useState<Now | null>(null);

  // The scheduler reads the latest values, not the ones it started with.
  const latest = useRef({ rhythm, volume });
  useEffect(() => {
    latest.current = { rhythm, volume };
  });

  const audio = useRef<Audio | null>(null);
  const timer = useRef<number | null>(null);
  /** The displays' pending updates, cleared on Stop so none lands after it. */
  const shows = useRef(new Set<number>());

  const ensureAudio = useCallback((): Audio => {
    if (!audio.current) {
      const ctx = new AudioContext();
      const out = ctx.createGain();
      out.connect(ctx.destination);
      audio.current = { ctx, out, buffers: new Map() };
    }
    void audio.current.ctx.resume();
    audio.current.out.gain.value = latest.current.volume;
    return audio.current;
  }, []);

  const playSound = useCallback((sound: SoundId, high: boolean, level: number, at: number) => {
    const a = ensureAudio();
    let pair = a.buffers.get(sound);
    if (!pair) {
      pair = soundWaves(sound, a.ctx.sampleRate).map(wave => {
        const buffer = a.ctx.createBuffer(1, wave.length, a.ctx.sampleRate);
        buffer.copyToChannel(new Float32Array(wave), 0);
        return buffer;
      }) as [AudioBuffer, AudioBuffer];
      a.buffers.set(sound, pair);
    }
    const source = a.ctx.createBufferSource();
    source.buffer = high ? pair[0] : pair[1];
    const gain = a.ctx.createGain();
    gain.gain.value = level;
    source.connect(gain).connect(a.out);
    source.start(at);
  }, [ensureAudio]);

  const stop = useCallback(() => {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    shows.current.forEach(id => window.clearTimeout(id));
    shows.current.clear();
    setPlaying(false);
    setNow(null);
  }, []);

  const start = useCallback(() => {
    const { ctx, out } = ensureAudio();
    const startedAt = ctx.currentTime + START_DELAY_S;
    let anchor: Anchor = { pos: 0, time: startedAt, bpm: latest.current.rhythm.bpm };
    /** The last click scheduled, in beats. */
    let lastPos = 0;
    // The bar being scheduled.
    let bar = 0;
    let barPos = 0;
    let barBeats = latest.current.rhythm.beats;
    let clicks = barClicks(latest.current.rhythm);
    let next = 0;
    let polyShown: number | null = null;

    const schedule = () => {
      const { rhythm: r, volume: v } = latest.current;
      out.gain.value = v;
      if (r.bpm !== anchor.bpm) anchor = retempo(anchor, lastPos, r.bpm);
      for (;;) {
        if (next >= clicks.length) {
          bar += 1;
          barPos += barBeats;
          const nr = latest.current.rhythm;
          barBeats = nr.beats;
          clicks = barClicks(nr);
          next = 0;
        }
        const c = clicks[next];
        const pos = barPos + c.at;
        const at = timeAt(anchor, pos);
        if (at >= ctx.currentTime + LOOKAHEAD_S) break;
        next += 1;
        lastPos = pos;

        const cr = latest.current.rhythm;
        // Turned off, the polyrhythm is silent at once, not from the next bar.
        if (c.poly !== null) {
          if (cr.poly.on) playSound(cr.poly.sound, cr.poly.high, cr.poly.level, at);
        }
        else {
          const voice = cr.steps[c.beat]?.[c.step] ?? null;
          if (voice !== null) {
            const sound = cr.voices[voice];
            playSound(sound.sound, sound.high, sound.level, at);
          }
        }

        const shownBar = bar;
        const id = window.setTimeout(() => {
          shows.current.delete(id);
          if (c.poly !== null) polyShown = c.poly;
          setNow(n => (c.poly !== null
            ? { ...(n ?? { bar: shownBar, beat: -1, step: -1 }), poly: c.poly }
            : { bar: shownBar, beat: c.beat, step: c.step, poly: polyShown }));
        }, Math.max(0, (at - ctx.currentTime) * 1000));
        shows.current.add(id);
      }
    };
    schedule();
    timer.current = window.setInterval(schedule, TICK_MS);
    setPlaying(true);
  }, [ensureAudio, playSound]);

  const toggle = useCallback(() => (timer.current === null ? start() : stop()), [start, stop]);

  /** Stops the clock and lets the audio go, for good: the MCP App's host is taking it away. */
  const close = useCallback(() => {
    stop();
    void audio.current?.ctx.close();
    audio.current = null;
  }, [stop]);

  /* Tap tempo. */
  const taps = useRef<number[]>([]);
  const tap = useCallback(() => {
    taps.current = addTap(taps.current, performance.now());
    const bpm = tapBpm(taps.current);
    if (bpm !== null) setRhythm(r => ({ ...r, bpm }));
  }, []);

  /** A new sound chosen: heard at once, so it can be judged. */
  const preview = useCallback((sound: SoundId, high = true, level = 1) => {
    playSound(sound, high, level, ensureAudio().ctx.currentTime + 0.01);
  }, [ensureAudio, playSound]);

  useEffect(() => () => {
    if (timer.current !== null) window.clearInterval(timer.current);
    shows.current.forEach(id => window.clearTimeout(id));
    void audio.current?.ctx.close();
  }, []);

  return { rhythm, setRhythm, volume, setVolume, playing, now, toggle, tap, preview, close };
}

export type Metronome = ReturnType<typeof useMetronomeCore>;
