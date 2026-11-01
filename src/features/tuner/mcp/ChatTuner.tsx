'use client';

/**
 * The tuner sized for a chat column (#283; Jeremy picked it from three mocks, 2026-11-01), standard
 * tuning at A440: Listen beside the note heard and how far off, a bar from −50 to +50 cents under
 * them, and the six strings, each playing its note when pressed. No title (the host labels the app),
 * no Dial | Strobe switch and no sound picker: the page keeps those.
 */
import { MIC_ERROR_TEXT, type MicListener, type MicStatus } from '@/components/tuner/listener';
import { pitchLabel } from '@/components/tuner/pitch';
import { playReference, referenceSounding } from '@/components/tuner/reference';
import type { RefSound } from '@/components/tuner/sounds';
import { centsFrom, centsText, IN_TUNE_CENTS, nearestString } from '@/components/tuner/tuner';
import { useTunerPitch } from '@/components/tuner/useTunerPitch';
import { STRINGS, TUNING } from '@/lib/music';
import { CentsBar } from './CentsBar';

/** What the tuner says before Listen, and when the chat app keeps the mic from it. */
export const CHAT_TEXT = {
  off: 'Press Listen, then play a string',
  denied: 'No mic here: press a string to hear it',
};

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
}

export function ChatTuner({ listener, status, onListen, sound }: ChatTunerProps) {
  const heardPitch = useTunerPitch(listener, referenceSounding);
  const listening = status === 'on' || status === 'starting';
  // Stopped, the last note doesn't linger.
  const pitch = listening ? heardPitch : null;
  const heard = pitch == null ? null : nearestString(pitch);
  const cents = pitch == null || heard == null ? null : centsFrom(pitch, heard);
  const inTune = cents != null && Math.abs(cents) <= IN_TUNE_CENTS;
  const message = status === 'denied' ? CHAT_TEXT.denied
    : MIC_ERROR_TEXT[status]
      ?? (status === 'off' ? CHAT_TEXT.off
        : status === 'starting' ? 'Waiting for the mic…'
          : cents == null ? 'Play a string' : centsText(cents));
  const note = heard == null ? null : noteParts(TUNING[heard]);

  return (
    <section className="card chat-tuner" aria-label="Tuner">
      <div className="chat-tuner-row">
        <button
          type="button" className={`btn chat-tuner-listen ${listening ? 'btn-secondary' : 'btn-primary'}`}
          onClick={onListen}
        >
          {listening ? 'Stop' : 'Listen'}
        </button>
        <div className="chat-tuner-readout" data-in-tune={inTune}>
          <span className="chat-tuner-note" data-idle={note == null} data-testid="tuner-note">
            {note ? note.name : '–'}<sub>{note?.octave}</sub>
          </span>
          <span className="chat-tuner-cents" role="status" data-testid="tuner-cents">{message}</span>
        </div>
      </div>
      <CentsBar cents={cents} />
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
    </section>
  );
}
