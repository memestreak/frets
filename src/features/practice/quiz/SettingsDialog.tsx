'use client';

import type { ReactNode } from 'react';
import { Modal } from '@/components/Modal';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  /** Put the dialog's fields back to their defaults; the dialog stays open. */
  onDefaults: () => void;
  /** Tuning note shown beside the Done button. */
  footnote: string;
  children: ReactNode;
}

/** The trainer's settings, in a modal with Defaults and Done. */
export function SettingsDialog(
  { open, onClose, onDefaults, footnote, children }: SettingsDialogProps,
) {
  return (
    <Modal open={open} onClose={onClose} title="Settings">
      <div className="settings-dialog-body">{children}</div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-muted text-[12px]">{footnote}</span>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" className="btn btn-ghost" onClick={onDefaults}>
            Defaults
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
