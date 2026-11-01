'use client';

import { useEffect, type ReactNode } from 'react';
import { Segmented } from '@/components/controls';
import { STRINGS, TUNING } from '@/lib/music';
import { Dial } from './Dial';
import { MIC_ERROR_TEXT, type MicListener, type MicStatus } from './listener';
import { pitchLabel } from './pitch';
import { playReference, preloadReference, referenceSounding } from './reference';
import { METERS, useTunerSettings } from './settings';
import { REF_SOUNDS, type RefSound } from './sounds';
import { Strobe } from './Strobe';
import { centsFrom, centsText, IN_TUNE_CENTS, nearestString } from './tuner';
import { useTunerPitch } from './useTunerPitch';

/** A note's letter and its octave apart, to draw the octave small: 45 → A, 2. */
function noteParts(midi: number): { name: string; octave: number } {
  return { name: pitchLabel(midi).replace(/[₀-₉₋]+$/, ''), octave: Math.floor(midi / 12) - 1 };
}

interface TunerPanelProps {
  /** A mic that is listening, or starting to. */
  listener: MicListener;
  status: MicStatus;
  /** The page's heading, beside the tuning; the dialog has its own. */
  title?: ReactNode;
  /** The reference sounds offered, first the fallback; every one by default. */
  sounds?: readonly (readonly [RefSound, string])[];
}

/**
 * The tuner, for standard tuning at A440: the sound the strings play, the
 * Dial / Strobe switch, the meter, the string's note and how far off it is
 * against the nearest open string, and the strings, low E to high e, the
 * one heard lit, each playing its note when pressed. Every part keeps its
 * size whatever it reads. The Tuner page and the Note trainer's tuner.
 */
export function TunerPanel({ listener, status, title, sounds = REF_SOUNDS }: TunerPanelProps) {
  const [settings, update] = useTunerSettings();
  const sound = sounds.some(([v]) => v === settings.sound) ? settings.sound : sounds[0][0];
  // The mic would hear the reference note through the speakers.
  const pitch = useTunerPitch(listener, referenceSounding);

  useEffect(() => {
    preloadReference(sound);
  }, [sound]);

  const heard = pitch == null ? null : nearestString(pitch);
  const cents = pitch == null || heard == null ? null : centsFrom(pitch, heard);
  const inTune = cents != null && Math.abs(cents) <= IN_TUNE_CENTS;
  const message = MIC_ERROR_TEXT[status]
    ?? (status === 'starting' ? 'Waiting for the mic…'
      : cents == null ? 'Play a string' : centsText(cents));
  const note = heard == null ? null : noteParts(TUNING[heard]);

  return (
    <div className="tuner">
      <header className="tuner-head">
        <div>
          {title}
          <p className="text-muted m-0 text-[13px]">Standard tuning · A440</p>
        </div>
        <select
          className="input w-auto" aria-label="Reference sound" value={sound}
          onChange={e => update({ sound: e.target.value as RefSound })}
        >
          {sounds.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
        </select>
      </header>

      <div className="tuner-switch">
        <Segmented
          label="Meter" options={METERS} value={settings.meter}
          onChange={meter => update({ meter })}
        />
      </div>
      <div className="tuner-meter">
        {settings.meter === 'strobe' ? <Strobe cents={cents} /> : <Dial cents={cents} />}
      </div>

      <div className="tuner-readout" data-in-tune={inTune}>
        <span className="tuner-note" data-idle={note == null} data-testid="tuner-note">
          {note ? note.name : '–'}
          <sub>{note?.octave}</sub>
        </span>
        <span className="tuner-cents" role="status" data-testid="tuner-cents">{message}</span>
      </div>

      <div className="tuner-strings" role="group" aria-label="Strings">
        {STRINGS.map(s => {
          const { name, octave } = noteParts(TUNING[s]);
          return (
            <button
              key={s}
              type="button"
              className="tuner-string"
              data-heard={heard === s}
              data-in-tune={heard === s && inTune}
              aria-label={`Play ${pitchLabel(TUNING[s])}`}
              onClick={() => void playReference(TUNING[s], sound)}
            >
              <span>{name}<sub>{octave}</sub></span>
            </button>
          );
        })}
      </div>
      <p className="text-muted m-0 text-center text-[12px]">Press a string to hear it</p>
    </div>
  );
}
