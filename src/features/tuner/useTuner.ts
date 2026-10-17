'use client';

import { useEffect, useRef, useState } from 'react';
import { STRINGS, TUNING } from '@/lib/music';
import { MicListener } from '@/features/practice/mic/listener';
import { MIC_ERROR_TEXT } from '@/features/practice/mic/MicButton';
import { pitchLabel } from '@/features/practice/mic/pitch';
import { playReference, preloadReference, referenceSounding } from '@/features/practice/mic/reference';
import type { RefSound } from '@/features/practice/mic/sounds';
import { centsFrom, centsText, IN_TUNE_CENTS, nearestString } from '@/features/practice/mic/tuner';
import type { MicStatus } from '@/features/practice/mic/useMic';
import { useTunerPitch } from '@/features/practice/mic/useTunerPitch';

/** A string's note split for display: "E" and "2". */
export function noteParts(midi: number): { name: string; octave: string } {
  const octave = Math.floor(midi / 12) - 1;
  const name = pitchLabel(midi).replace(/[₀-₉₋]+$/, '');
  return { name, octave: String(octave) };
}

/** High e at the top and low E at the bottom, as on the board. */
export const STRINGS_DOWN = [...STRINGS].reverse();

/** The simulated guitar: each string starts this far off, then is tuned. */
const DEMO_START_CENTS = [-34, 22, -16, 41, -11, 27];
const DEMO_TUNE_MS = 3200;
const DEMO_HOLD_MS = 1600;
const DEMO_GAP_MS = 700;
const DEMO_STEP_MS = DEMO_TUNE_MS + DEMO_HOLD_MS + DEMO_GAP_MS;

/** A pitch that tunes each string in turn, for looking at the mocks without a guitar. */
function useDemoPitch(on: boolean): number | null {
  const [pitch, setPitch] = useState<number | null>(null);
  useEffect(() => {
    if (!on) return;
    const t0 = performance.now();
    const id = window.setInterval(() => {
      const t = performance.now() - t0;
      const step = Math.floor(t / DEMO_STEP_MS);
      const s = step % STRINGS.length;
      const into = t - step * DEMO_STEP_MS;
      if (into > DEMO_TUNE_MS + DEMO_HOLD_MS) {
        setPitch(null);
        return;
      }
      const k = Math.min(1, into / DEMO_TUNE_MS);
      const eased = 1 - (1 - k) ** 3;
      const wobble = Math.sin(t / 90) * 1.2;
      const cents = DEMO_START_CENTS[s] * (1 - eased) + wobble;
      setPitch(TUNING[s] + cents / 100);
    }, 30);
    return () => {
      window.clearInterval(id);
      setPitch(null);
    };
  }, [on]);
  return pitch;
}

export interface Tuner {
  status: MicStatus;
  /** The open string nearest the note heard, or null. */
  string: number | null;
  /** Cents from that string: + sharp, − flat. */
  cents: number | null;
  inTune: boolean;
  /** "12¢ flat", "In tune", "Play a string", or why the mic is off. */
  message: string;
  sound: RefSound;
  setSound: (sound: RefSound) => void;
  /** Plays open string `s` in the chosen sound. */
  play: (s: number) => void;
}

/**
 * The tuner page's state: the mic, listening for as long as the page is
 * open, or (with `demo`) a simulated guitar; the string heard and how far
 * off; and the reference sound the string buttons play.
 */
export function useTuner(demo: boolean): Tuner {
  const [listener] = useState(() => new MicListener());
  const [status, setStatus] = useState<MicStatus>('starting');
  const [sound, setSound] = useState<RefSound>('acoustic');
  const soundRef = useRef(sound);
  useEffect(() => {
    soundRef.current = sound;
    preloadReference(sound);
  }, [sound]);

  useEffect(() => {
    if (demo) return;
    let live = true;
    void listener.start().then(error => {
      if (live) setStatus(error ?? (listener.listening ? 'on' : 'off'));
    });
    return () => {
      live = false;
      listener.stop();
      setStatus('starting');
    };
  }, [demo, listener]);

  const heard = useTunerPitch(listener, referenceSounding);
  const simulated = useDemoPitch(demo);
  const pitch = demo ? simulated : heard;

  const string = pitch == null ? null : nearestString(pitch);
  const cents = pitch == null || string == null ? null : centsFrom(pitch, string);
  const inTune = cents != null && Math.abs(cents) <= IN_TUNE_CENTS;
  const message = (!demo && MIC_ERROR_TEXT[status])
    || (!demo && status === 'starting' ? 'Waiting for the mic…'
      : cents == null ? 'Play a string' : centsText(cents));

  return {
    status: demo ? 'on' : status,
    string, cents, inTune, message, sound, setSound,
    play: s => void playReference(TUNING[s], soundRef.current),
  };
}
