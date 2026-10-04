'use client';

import { useEffect, useEffectEvent } from 'react';

const IGNORED_WHEN_PAUSED = /^(Shift|Control|Alt|Meta|Tab|Escape|CapsLock)$/;

interface QuizKeyboardOptions {
  answered: boolean;
  pause: boolean;
  onNext: () => void;
  onHint: (on: boolean) => void;
  /** Any other key while the question is open (answer shortcuts). */
  onAnswerKey?: (key: string) => void;
  /** Left (−1) or right (+1) arrow while the question is open. */
  onArrow?: (delta: -1 | 1) => void;
  /** False suspends key handling, e.g. while a dialog is open. Default true. */
  enabled?: boolean;
}

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable;
}

/**
 * Window-level keys: `H` held shows the hint; Enter/Space goes to the next
 * question once answered (with Pause b/w on, any non-modifier key does);
 * left/right arrows go to `onArrow` unless a control (the board) already
 * used them; other keys go to `onAnswerKey`. Ignored while typing in a field.
 * Enter/Space on an open question is left to the focused button.
 * With `enabled` false, key presses are ignored and a held hint is released.
 */
export function useQuizKeyboard(opts: QuizKeyboardOptions) {
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (opts.enabled === false) return;
    if (isTextEntry(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    const { answered, pause } = opts;
    if (e.key === 'h' || e.key === 'H') {
      if (!e.repeat) opts.onHint(true);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      if (answered) {
        e.preventDefault();
        opts.onNext();
      }
      return;
    }
    if (answered) {
      if (pause && !IGNORED_WHEN_PAUSED.test(e.key)) {
        e.preventDefault();
        opts.onNext();
      }
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (opts.onArrow && !e.defaultPrevented) {
        e.preventDefault();
        opts.onArrow(e.key === 'ArrowLeft' ? -1 : 1);
      }
      return;
    }
    opts.onAnswerKey?.(e.key);
  });

  const onKeyUp = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === 'h' || e.key === 'H') opts.onHint(false);
  });

  const onBlur = useEffectEvent(() => opts.onHint(false));

  const enabled = opts.enabled !== false;
  useEffect(() => {
    if (!enabled) onBlur();
  }, [enabled]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => onKeyDown(e);
    const up = (e: KeyboardEvent) => onKeyUp(e);
    const blur = () => onBlur();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);
}
