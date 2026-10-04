import { recordAnswer, type SessionStats } from './stats';

/** Delay before the next question after a correct answer. */
export const AUTO_ADVANCE_MS = 1100;
/** Delay when Pause b/w is switched off while a question is answered. */
export const UNPAUSE_ADVANCE_MS = 800;

/** Answer state shared by every trainer. */
export interface QuizCore<W> {
  stats: SessionStats;
  answered: boolean;
  /** Wrong tries on the current question (answers or board positions). */
  wrong: W[];
  /** Pending auto-advance delay, or null to wait for the user. */
  advanceMs: number | null;
}

export const freshAttempt = () => ({
  answered: false, wrong: [], advanceMs: null,
});

/** Field-by-field settings equality, whatever the key order. */
export function sameSettings<T extends object>(a: T, b: T): boolean {
  const keys = Object.keys(a) as (keyof T)[];
  return keys.length === Object.keys(b).length
    && keys.every(k => JSON.stringify(a[k]) === JSON.stringify(b[k]));
}

/**
 * A wrong try. The question is scored as a miss on the first wrong try
 * only, and stays open until the right answer is found.
 */
export function applyMiss<T extends QuizCore<unknown>>(
  state: T, item: T['wrong'][number], key: number,
): T {
  return {
    ...state,
    wrong: [...state.wrong, item],
    stats: state.wrong.length ? state.stats : recordAnswer(state.stats, key, false),
  };
}

/** The question is solved; it scores a hit only with no prior misses. */
export function applySolve<T extends QuizCore<unknown>>(
  state: T, key: number, pause: boolean,
): T {
  return {
    ...state,
    answered: true,
    advanceMs: pause ? null : AUTO_ADVANCE_MS,
    stats: state.wrong.length ? state.stats : recordAnswer(state.stats, key, true),
  };
}

/** Toggling Pause b/w cancels or (re)starts a pending auto-advance. */
export function applyPause<T extends QuizCore<unknown>>(state: T, pause: boolean): T {
  if (!state.answered) return state;
  return { ...state, advanceMs: pause ? null : UNPAUSE_ADVANCE_MS };
}
