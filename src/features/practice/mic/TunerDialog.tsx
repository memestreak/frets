'use client';

import { useEffect } from 'react';
import { Modal } from '@/features/practice/quiz/Modal';
import type { MicListener, MicStatus } from '@/components/tuner/listener';
import { TunerPanel } from '@/components/tuner/TunerPanel';

interface TunerDialogProps {
  open: boolean;
  onClose: () => void;
  /** The trainer's mic, which listens while the tuner is open. */
  listener: MicListener;
  status: MicStatus;
}

/**
 * The Note trainer's tuner: the Tuner page's panel in a dialog, drawn
 * only while open. T or Esc closes it.
 */
export function TunerDialog({ open, onClose, listener, status }: TunerDialogProps) {
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

  return (
    <Modal open={open} onClose={onClose} title="Tuner" className="tuner-dialog">
      {open && <TunerPanel listener={listener} status={status} />}
    </Modal>
  );
}
