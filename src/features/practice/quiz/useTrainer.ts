'use client';

import { useMemo, useReducer, useRef, useState } from 'react';
import { stepAnswerFocus } from './AnswerCard';
import type { TrainerAction, TrainerState } from '@/features/practice/quiz/trainerState';
import { ANSWER_KEYS, type Rng } from '@/lib/music';
import { sameSettings } from '@/features/practice/quiz/quizFlow';
import { useAutoAdvance } from './useAutoAdvance';
import { usePersist } from '@/hooks/usePersist';
import { useQuizKeyboard } from './useQuizKeyboard';

interface TrainerOptions<S, Q> {
  reducer: (state: TrainerState<S, Q>, action: TrainerAction<S, Q>) => TrainerState<S, Q>;
  init: (rng: Rng) => TrainerState<S, Q>;
  storageKey: string;
  generate: (set: S, rng: Rng, prev: Q | null) => Q | null;
  rng: Rng;
  /**
   * The answer for the `index`th answer key (−1 for any other key), or null
   * when that key answers nothing.
   */
  answerFor: (index: number, set: S) => number | null;
}

/**
 * Everything the trainers share around their reducer: saving settings and
 * stats, drawing questions, auto-advance, the keyboard, the hint (on for
 * one question at a time) and the settings-dialog flag. Left/right arrows move focus across the answer
 * buttons in `answerGridRef`; Enter or Space then presses the focused one.
 */
export function useTrainer<S extends { pause: boolean }, Q>({
  reducer, init, storageKey, generate, rng, answerFor,
}: TrainerOptions<S, Q>) {
  const [state, dispatch] = useReducer(reducer, rng, init);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { set, stats, q } = state;
  // The question the hint was turned on for: a new question turns it off.
  const [hintFor, setHintFor] = useState<Q | null>(null);
  const hint = q != null && hintFor === q;
  const toggleHint = () => setHintFor(hint ? null : q);
  const answerGridRef = useRef<HTMLDivElement>(null);
  // The last answer button arrows reached: a wrong answer disables it and
  // can drop focus, and the next arrow steps on from there.
  const lastAnswerTile = useRef(-1);

  const persisted = useMemo(() => ({ set, stats }), [set, stats]);
  usePersist(storageKey, persisted);

  const next = () => dispatch({ type: 'next', q: generate(set, rng, q) });
  /** Change settings; the question is redrawn unless `regen` is false. */
  const update = (patch: Partial<S>, regen = true) => {
    const s = { ...set, ...patch };
    dispatch({ type: 'settings', set: s, q: regen ? generate(s, rng, q) : undefined });
  };
  /** The dialog's Defaults; already there keeps the question. */
  const applyDefaults = (reset: S) => {
    if (!sameSettings(reset, set)) update(reset);
  };
  const answerName = (key: number) => dispatch({ type: 'answerName', key });

  // The quiz waits while the settings dialog covers it.
  useAutoAdvance(settingsOpen ? null : state.advanceMs, next);
  useQuizKeyboard({
    enabled: !settingsOpen,
    answered: state.answered,
    pause: set.pause,
    onNext: next,
    onToggleHint: toggleHint,
    onArrow: delta => {
      const grid = answerGridRef.current;
      if (!grid) return;
      lastAnswerTile.current = stepAnswerFocus(grid, delta, lastAnswerTile.current) ?? -1;
    },
    onAnswerKey: key => {
      const answer = answerFor(ANSWER_KEYS.indexOf(key as (typeof ANSWER_KEYS)[number]), set);
      if (answer != null) answerName(answer);
    },
  });

  return {
    state, dispatch, hint, toggleHint, settingsOpen, setSettingsOpen,
    next, update, applyDefaults, answerName, answerGridRef,
  };
}
