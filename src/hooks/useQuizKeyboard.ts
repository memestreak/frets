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
}

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable;
}

/**
 * Window-level keys: `H` held shows the hint; Enter/Space goes to the next
 * question once answered (with Pause b/w on, any non-modifier key does);
 * other keys go to `onAnswerKey`. Ignored while typing in a field.
 */
export function useQuizKeyboard(opts: QuizKeyboardOptions) {
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
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
    opts.onAnswerKey?.(e.key);
  });

  const onKeyUp = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === 'h' || e.key === 'H') opts.onHint(false);
  });

  const onBlur = useEffectEvent(() => opts.onHint(false));

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
