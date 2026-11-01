'use client';

/**
 * The tuner sized for a chat column (#283), standard tuning at A440: Listen, the note heard and how
 * far off, a meter, and the six strings, each playing its note when pressed. Mocks (`layout`):
 * a the bar under the note, b a small dial beside it, c the strings as the readout.
 */
import type { ReactNode } from 'react';
import { Dial } from '@/components/tuner/Dial';
import { MIC_ERROR_TEXT, type MicListener, type MicStatus } from '@/components/tuner/listener';
import { pitchLabel } from '@/components/tuner/pitch';
import { playReference, referenceSounding } from '@/components/tuner/reference';
import type { RefSound } from '@/components/tuner/sounds';
import { centsFrom, centsText, IN_TUNE_CENTS, nearestString } from '@/components/tuner/tuner';
import { useTunerPitch } from '@/components/tuner/useTunerPitch';
import { STRINGS, TUNING } from '@/lib/music';
import { CentsBar } from './CentsBar';

export type ChatLayout = 'a' | 'b' | 'c';

/** A note's letter and its octave apart: 45 → A, 2. */
function noteParts(midi: number): { name: string; octave: number } {
  return { name: pitchLabel(midi).replace(/[₀-₉₋]+$/, ''), octave: Math.floor(midi / 12) - 1 };
}

interface ChatTunerProps {
  listener: MicListener;
  status: MicStatus;
  /** Starts or stops the mic. */
  onListen: () => void;
  sound: RefSound;
  layout: ChatLayout;
  /** Under the tuner, for the test build. */
  footer?: ReactNode;
}

export function ChatTuner({ listener, status, onListen, sound, layout, footer }: ChatTunerProps) {
  const heardPitch = useTunerPitch(listener, referenceSounding);
  const listening = status === 'on' || status === 'starting';
  // Stopped, the last note doesn't linger.
  const pitch = listening ? heardPitch : null;
  const heard = pitch == null ? null : nearestString(pitch);
  const cents = pitch == null || heard == null ? null : centsFrom(pitch, heard);
  const inTune = cents != null && Math.abs(cents) <= IN_TUNE_CENTS;
  const message = MIC_ERROR_TEXT[status]
    ?? (status === 'off' ? 'Press Listen, then play a string'
      : status === 'starting' ? 'Waiting for the mic…'
        : cents == null ? 'Play a string' : centsText(cents));
  const note = heard == null ? null : noteParts(TUNING[heard]);

  const listen = (
    <button type="button" className={`btn chat-tuner-listen ${listening ? 'btn-secondary' : 'btn-primary'}`} onClick={onListen}>
      {listening ? 'Stop' : 'Listen'}
    </button>
  );
  const readout = (
    <div className="chat-tuner-readout" data-in-tune={inTune}>
      <span className="chat-tuner-note" data-idle={note == null}>
        {note ? note.name : '–'}<sub>{note?.octave}</sub>
      </span>
      <span className="chat-tuner-cents" role="status">{message}</span>
    </div>
  );
  const strings = (
    <div className="tuner-strings chat-tuner-strings" role="group" aria-label="Strings">
      {STRINGS.map(s => {
        const { name, octave } = noteParts(TUNING[s]);
        return (
          <button
            key={s} type="button" className="tuner-string"
            data-heard={heard === s} data-in-tune={heard === s && inTune}
            aria-label={`Play ${pitchLabel(TUNING[s])}`}
            onClick={() => void playReference(TUNING[s], sound)}
          >
            <span>{name}<sub>{octave}</sub></span>
          </button>
        );
      })}
    </div>
  );

  return (
    <section className="card chat-tuner" data-layout={layout} aria-label="Tuner">
      {layout === 'a' && (
        <>
          <div className="chat-tuner-row">{listen}{readout}</div>
          <CentsBar cents={cents} />
          {strings}
        </>
      )}
      {layout === 'b' && (
        <>
          <div className="chat-tuner-row">
            <div className="chat-tuner-dial"><Dial cents={cents} /></div>
            <div className="chat-tuner-side">{readout}{listen}</div>
          </div>
          {strings}
        </>
      )}
      {layout === 'c' && (
        <>
          <div className="chat-tuner-row">{listen}{strings}</div>
          <CentsBar cents={cents} />
          <p className="chat-tuner-line" data-in-tune={inTune} role="status">
            {note && <b>{note.name}<sub>{note.octave}</sub></b>} {message}
          </p>
        </>
      )}
      {footer}
    </section>
  );
}
