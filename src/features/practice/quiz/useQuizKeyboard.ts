'use client';

import { useEffect, useEffectEvent } from 'react';

const IGNORED_WHEN_PAUSED = /^(Shift|Control|Alt|Meta|Tab|Escape|CapsLock)$/;

interface QuizKeyboardOptions {
  answered: boolean;
  pause: boolean;
  onNext: () => void;
  onToggleHint: () => void;
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
 * Window-level keys: Space toggles the hint, whatever has focus; Enter goes
 * to the next question once answered (with Pause b/w on, any other
 * non-modifier key does too); left/right arrows go to `onArrow` unless a
 * control (the board) already used them; other keys go to `onAnswerKey`.
 * Ignored while typing in a field. Enter on an open question is left to the
 * focused button. With `enabled` false, key presses are ignored.
 */
export function useQuizKeyboard(opts: QuizKeyboardOptions) {
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (opts.enabled === false) return;
    if (isTextEntry(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    const { answered, pause } = opts;
    if (e.key === 'Enter') {
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

  /**
   * Space is taken before it reaches the focused element, so it neither
   * presses a focused button (an answer, the hint button itself) nor taps a
   * focused board cell, and the page does not scroll.
   */
  const onSpace = useEffectEvent((e: KeyboardEvent) => {
    if (e.key !== ' ' || opts.enabled === false) return;
    if (isTextEntry(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'keydown' && !e.repeat) opts.onToggleHint();
  });

  useEffect(() => {
    const down = (e: KeyboardEvent) => onKeyDown(e);
    const space = (e: KeyboardEvent) => onSpace(e);
    window.addEventListener('keydown', down);
    // Capture phase: runs before the focused element's own handlers. Keyup
    // too, because some browsers press a focused button on Space's keyup.
    window.addEventListener('keydown', space, { capture: true });
    window.addEventListener('keyup', space, { capture: true });
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keydown', space, { capture: true });
      window.removeEventListener('keyup', space, { capture: true });
    };
  }, []);
}
