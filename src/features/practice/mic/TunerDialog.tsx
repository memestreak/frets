'use client';

import { useEffect } from 'react';
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

/** High e at the top and low E at the bottom, as on the board. */
const STRINGS_DOWN = [...STRINGS].reverse();

/**
 * The tuner, for standard tuning at A440: the strings down the left, the
 * one heard lit, each playing its note when pressed; beside them the note,
 * the cents off and a strobe, against the nearest open string. T or Esc
 * closes it.
 */
export function TunerDialog({ open, onClose, listener, status }: TunerDialogProps) {
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

  const s = pitch == null ? null : nearestString(pitch);
  const cents = pitch == null || s == null ? null : centsFrom(pitch, s);
  const inTune = cents != null && Math.abs(cents) <= IN_TUNE_CENTS;
  const message = MIC_ERROR_TEXT[status]
    ?? (status === 'starting' ? 'Waiting for the mic…'
      : cents == null ? 'Play a string' : centsText(cents));

  return (
    <Modal open={open} onClose={onClose} title="Tuner" className="tuner-dialog">
      <div className="tuner-body">
        <div className="tuner-strings" role="group" aria-label="Strings">
          {STRINGS_DOWN.map(string => (
            <button
              key={string}
              type="button"
              className="btn btn-secondary tuner-string"
              data-heard={s === string}
              aria-label={`Play ${pitchLabel(TUNING[string])}`}
              onClick={() => playPluck(TUNING[string])}
            >
              {pitchLabel(TUNING[string])}
            </button>
          ))}
        </div>
        <div className="tuner-main">
          <div className="tuner-readout" data-in-tune={inTune}>
            <span className="tuner-note" data-testid="tuner-note">
              {s == null ? '–' : pitchLabel(TUNING[s])}
            </span>
            <span className="tuner-cents" role="status" data-testid="tuner-cents">
              {message}
            </span>
          </div>
          <Strobe cents={cents} />
        </div>
      </div>
      <p className="text-muted m-0 text-[12px]">
        Standard tuning, A440 · press a string to hear it
      </p>
    </Modal>
  );
}
