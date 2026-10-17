'use client';

import { useEffect, useState } from 'react';
import { PlayIcon } from '@/components/icons';
import { Modal } from '@/features/practice/quiz/Modal';
import { STRINGS, TUNING } from '@/lib/music';
import type { MicListener } from './listener';
import { MIC_ERROR_TEXT } from './MicButton';
import { pitchLabel } from './pitch';
import { playPluck, pluckSounding } from './pluck';
import { Strobe } from './Strobe';
import { centsFrom, centsText, IN_TUNE_CENTS, nearestString } from './tuner';
import { useTunerPitch } from './useTunerPitch';
import type { MicStatus } from './useMic';

interface TunerDialogProps {
  open: boolean;
  onClose: () => void;
  /** The trainer's mic, which listens while the tuner is open. */
  listener: MicListener;
  status: MicStatus;
}

/**
 * The tuner, for standard tuning at A440: a strobe against the nearest
 * open string, or the one locked by tapping it; ▶ beside each string plays
 * its note. T or Esc closes it.
 */
export function TunerDialog({ open, onClose, listener, status }: TunerDialogProps) {
  const [locked, setLocked] = useState<number | null>(null);
  // The mic would hear the reference note through the speakers.
  const pitch = useTunerPitch(listener, pluckSounding);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 't' || e.key === 'T') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const s = locked ?? (pitch == null ? null : nearestString(pitch));
  const cents = pitch == null || s == null ? null : centsFrom(pitch, s);
  const inTune = cents != null && Math.abs(cents) <= IN_TUNE_CENTS;
  const message = MIC_ERROR_TEXT[status]
    ?? (status === 'starting' ? 'Waiting for the mic…'
      : cents == null ? 'Play a string' : centsText(cents));

  return (
    <Modal open={open} onClose={onClose} title="Tuner" className="tuner-dialog">
      <div className="tuner-readout" data-in-tune={inTune}>
        <span className="tuner-note" data-testid="tuner-note">
          {s == null ? '–' : pitchLabel(TUNING[s])}
        </span>
        <span className="tuner-cents" role="status" data-testid="tuner-cents">
          {message}
        </span>
      </div>
      <Strobe cents={cents} />
      <div className="tuner-strings" role="group" aria-label="Strings">
        {STRINGS.map(string => (
          <div key={string} className="tuner-string">
            <button
              type="button"
              className="btn btn-secondary btn-toggle"
              aria-pressed={locked === string}
              data-current={s === string}
              aria-label={`Tune the ${pitchLabel(TUNING[string])} string`}
              onClick={() => setLocked(locked === string ? null : string)}
            >
              {pitchLabel(TUNING[string])}
            </button>
            <button
              type="button"
              className="btn btn-ghost tuner-play"
              aria-label={`Play ${pitchLabel(TUNING[string])}`}
              onClick={() => playPluck(TUNING[string])}
            >
              <PlayIcon />
            </button>
          </div>
        ))}
      </div>
      <p className="text-muted m-0 text-[12px]">
        {locked == null
          ? 'Standard tuning, A440 · following the nearest string; tap one to lock it'
          : `Standard tuning, A440 · locked to ${pitchLabel(TUNING[locked])}; tap it again to follow the nearest string`}
      </p>
    </Modal>
  );
}
