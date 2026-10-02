import { samePos, type Position } from '@/lib/music';
import {
  applyMiss, applyPause, applySolve, freshAttempt, type QuizCore,
} from '@/lib/quizFlow';
import { emptyStats, parseStats } from '@/lib/stats';
import { loadJson } from '@/lib/storage';

/** A wrong try: an answer (Name it) or a board position (Find it). */
export type Wrong = number | Position;

/** State of either trainer: `S` is its settings, `Q` its question. */
export interface TrainerState<S, Q> extends QuizCore<Wrong> {
  set: S;
  q: Q | null;
  /** Where the correct Find-it answer was tapped. */
  picked: Position | null;
  /** Find-it taps on the right answer outside the range; not scored. */
  far: Position[];
  /** True while the latest tap was one of those. */
  farLast: boolean;
}

export type TrainerAction<S, Q> =
  | { type: 'answerName'; key: number }
  | { type: 'answerFret'; pos: Position }
  | { type: 'next'; q: Q | null }
  /** New settings; `q` replaces the question when the change regenerates. */
  | { type: 'settings'; set: S; q?: Q | null }
  | { type: 'togglePause' }
  | { type: 'resetStats' };

/** What a trainer supplies to the shared reducer. */
export interface TrainerRules<S, Q> {
  /** The right Name-it answer, which is also what the question scores under. */
  key: (q: Q) => number;
  /** True when the question takes a named answer, false for a board tap. */
  named: (q: Q, set: S) => boolean;
  isCorrect: (q: Q, pos: Position, set: S) => boolean;
  /** The right answer beyond the user's own range: explained, not scored. */
  isOutOfRange: (q: Q, pos: Position, set: S) => boolean;
}

type Taps = Pick<TrainerState<unknown, unknown>, 'wrong' | 'far'>;

/** Has `pos` already been tapped on this question? */
export const wasTapped = (state: Taps, pos: Position): boolean =>
  state.far.some(p => samePos(p, pos))
  || state.wrong.some(w => typeof w !== 'number' && samePos(w, pos));

const newQuestion = <S, Q>(state: TrainerState<S, Q>, q: Q | null): TrainerState<S, Q> => ({
  ...state, ...freshAttempt(), q, picked: null, far: [], farLast: false,
});

/** Saved settings and stats from `storageKey`, with a first question. */
export function initTrainerState<S, Q>(
  storageKey: string,
  parse: (raw: unknown) => S,
  generate: (set: S) => Q | null,
): TrainerState<S, Q> {
  const saved = (loadJson(storageKey) ?? {}) as Record<string, unknown>;
  const set = parse(saved.set);
  return {
    set,
    stats: parseStats(saved.stats),
    q: generate(set),
    picked: null,
    far: [],
    farLast: false,
    ...freshAttempt(),
  };
}

export function trainerReducer<S extends { pause: boolean }, Q>(
  rules: TrainerRules<S, Q>,
  state: TrainerState<S, Q>,
  action: TrainerAction<S, Q>,
): TrainerState<S, Q> {
  const { q, set } = state;
  switch (action.type) {
    case 'answerName': {
      if (!q || state.answered || !rules.named(q, set)) return state;
      if (state.wrong.includes(action.key)) return state;
      const key = rules.key(q);
      return action.key === key
        ? applySolve(state, key, set.pause)
        : applyMiss(state, action.key, key);
    }
    case 'answerFret': {
      if (!q || state.answered || rules.named(q, set)) return state;
      const { pos } = action;
      if (wasTapped(state, pos)) return state;
      const key = rules.key(q);
      if (rules.isCorrect(q, pos, set)) {
        return { ...applySolve(state, key, set.pause), picked: pos, farLast: false };
      }
      if (rules.isOutOfRange(q, pos, set)) {
        return { ...state, far: [...state.far, pos], farLast: true };
      }
      return { ...applyMiss(state, pos, key), farLast: false };
    }
    case 'next':
      return newQuestion(state, action.q);
    case 'settings': {
      const next = { ...state, set: action.set };
      return action.q === undefined ? next : newQuestion(next, action.q);
    }
    case 'togglePause': {
      const pause = !set.pause;
      return applyPause({ ...state, set: { ...set, pause } }, pause);
    }
    case 'resetStats':
      return { ...state, stats: emptyStats() };
  }
}
