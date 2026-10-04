'use client';

import { useMemo, useReducer, useState } from 'react';
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
 * stats, drawing questions, auto-advance, the keyboard, and the hint and
 * settings-dialog flags.
 */
export function useTrainer<S extends { pause: boolean }, Q>({
  reducer, init, storageKey, generate, rng, answerFor,
}: TrainerOptions<S, Q>) {
  const [state, dispatch] = useReducer(reducer, rng, init);
  const [hint, setHint] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { set, stats, q } = state;

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
    onHint: setHint,
    onAnswerKey: key => {
      const answer = answerFor(ANSWER_KEYS.indexOf(key as (typeof ANSWER_KEYS)[number]), set);
      if (answer != null) answerName(answer);
    },
  });

  return {
    state, dispatch, hint, setHint, settingsOpen, setSettingsOpen,
    next, update, applyDefaults, answerName,
  };
}
