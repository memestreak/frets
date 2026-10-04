'use client';

import {
  useEffect, useEffectEvent, useId, useRef, type ReactNode,
} from 'react';
import { CloseIcon } from '@/components/icons';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  /** Put the dialog's fields back to their defaults; the dialog stays open. */
  onDefaults: () => void;
  /** Tuning note shown beside the Done button. */
  footnote: string;
  children: ReactNode;
}

/**
 * Modal settings dialog on the native `<dialog>`: the browser supplies the
 * focus trap, inert page and Esc. The parent owns `open`; every way of
 * closing reports through `onClose`.
 */
export function SettingsDialog(
  { open, onClose, onDefaults, footnote, children }: SettingsDialogProps,
) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  // Attached by hand: jsx-a11y does not count <dialog> as interactive, and
  // Esc already covers the keyboard.
  const close = useEffectEvent(onClose);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Content sits in the inner wrapper, so only the backdrop targets `el`.
    // The press must start there too: a drag out of a field ends in a click
    // on the dialog, and should not close it.
    let pressedBackdrop = false;
    const onPointerDown = (e: PointerEvent) => {
      pressedBackdrop = e.target === el;
    };
    const onClick = (e: MouseEvent) => {
      if (e.target === el && pressedBackdrop) close();
      pressedBackdrop = false;
    };
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('click', onClick);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('click', onClick);
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className="settings-dialog"
      aria-labelledby={headingId}
      onCancel={e => {
        e.preventDefault();
        onClose();
      }}
      // A close the parent did not ask for (e.g. a second Esc the browser
      // refuses to let us cancel): bring its state back in step.
      onClose={() => {
        if (open) onClose();
      }}
    >
      <div className="settings-dialog-inner">
        <div className="flex items-center justify-between gap-3">
          <h3 id={headingId} className="dialog-title m-0">Settings</h3>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            aria-label="Close settings"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>
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
      </div>
    </dialog>
  );
}
