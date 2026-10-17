'use client';

import {
  useEffect, useEffectEvent, useId, useRef, type ReactNode,
} from 'react';
import { CloseIcon } from '@/components/icons';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Extra class on the inner panel, e.g. to size it. */
  className?: string;
}

/**
 * Modal dialog on the native `<dialog>`: the browser supplies the focus
 * trap, inert page and Esc; a click on the backdrop closes it too. The
 * parent owns `open`; every way of closing reports through `onClose`.
 */
export function Modal({ open, onClose, title, children, className = '' }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      // Focus the dialog itself, not its first button: opened from the
      // keyboard, a ring on the close button would read as a selection.
      el.focus();
    } else if (!open && el.open) el.close();
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
      tabIndex={-1}
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
      <div className={`settings-dialog-inner ${className}`}>
        <div className="flex items-center justify-between gap-3">
          <h3 id={headingId} className="dialog-title m-0">{title}</h3>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            aria-label={`Close ${title.toLowerCase()}`}
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
