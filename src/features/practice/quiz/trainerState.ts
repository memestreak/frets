import { sameSpot, type Spot } from '@/lib/music';
import {
  applyMiss, applyPause, applySolve, freshAttempt, type QuizCore,
} from '@/features/practice/quiz/quizFlow';
import { emptyStats, parseStats } from '@/features/practice/quiz/stats';
import { loadJson } from '@/lib/storage';

/**
 * A wrong try: an answer (Name it), a board position (Find it), or a
 * played MIDI note with no place on the board (Find it by mic).
 */
export type Wrong = number | Spot;

/** State of either trainer: `S` is its settings, `Q` its question. */
export interface TrainerState<S, Q> extends QuizCore<Wrong> {
  set: S;
  q: Q | null;
  /** Where the correct Find-it answer was tapped. */
  picked: Spot | null;
  /** Find-it taps on the right answer outside the range; not scored. */
  far: Spot[];
  /** True while the latest tap was one of those. */
  farLast: boolean;
  /** True while the latest note played was right in an octave out of reach. */
  octaveLast: boolean;
  /** The note the mic heard, when the latest answer was played, not tapped. */
  heard: string | null;
}

export type TrainerAction<S, Q> =
  | { type: 'answerName'; key: number }
  | { type: 'answerFret'; spot: Spot }
  /**
   * A note played into the mic: `midi` as heard, `heard` its name, and
   * `misses` whether a wrong note is scored as a miss.
   */
  | { type: 'answerPitch'; midi: number; heard: string; misses: boolean }
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
  isCorrect: (q: Q, spot: Spot, set: S) => boolean;
  /** The right answer beyond the user's own range: explained, not scored. */
  isOutOfRange: (q: Q, spot: Spot, set: S) => boolean;
  /**
   * Where a played MIDI note sits on the board for this question, or null
   * when it has no place there. A trainer without it ignores the mic.
   */
  placePitch?: (q: Q, midi: number, set: S) => Spot | null;
  /** Is a played MIDI note the right answer, in whatever octave? */
  rightPitch?: (q: Q, midi: number) => boolean;
}

type Taps = Pick<TrainerState<unknown, unknown>, 'wrong' | 'far'>;

/** Has `spot` already been tapped on this question? */
export const wasTapped = (state: Taps, spot: Spot): boolean =>
  state.far.some(p => sameSpot(p, spot))
  || state.wrong.some(w => typeof w !== 'number' && sameSpot(w, spot));

const freshTries = () => ({
  picked: null, far: [], farLast: false, octaveLast: false, heard: null,
});

const newQuestion = <S, Q>(state: TrainerState<S, Q>, q: Q | null): TrainerState<S, Q> => ({
  ...state, ...freshAttempt(), q, ...freshTries(),
});

/** A Find-it answer at `spot`: right, beyond the range, or a miss. */
function answerAt<S extends { pause: boolean }, Q>(
  rules: TrainerRules<S, Q>, state: TrainerState<S, Q>, q: Q, spot: Spot,
): TrainerState<S, Q> {
  const { set } = state;
  if (wasTapped(state, spot)) return state;
  const key = rules.key(q);
  const tries = { farLast: false, octaveLast: false, heard: null };
  if (rules.isCorrect(q, spot, set)) {
    return { ...applySolve(state, key, set.pause), ...tries, picked: spot };
  }
  if (rules.isOutOfRange(q, spot, set)) {
    return { ...state, ...tries, far: [...state.far, spot], farLast: true };
  }
  return { ...applyMiss(state, spot, key), ...tries };
}

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
    ...freshTries(),
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
    case 'answerFret':
      if (!q || state.answered || rules.named(q, set)) return state;
      return answerAt(rules, state, q, action.spot);
    case 'answerPitch': {
      const { placePitch, rightPitch } = rules;
      if (!q || state.answered || rules.named(q, set) || !placePitch || !rightPitch) {
        return state;
      }
      const { midi, heard, misses } = action;
      const spot = placePitch(q, midi, set);
      const played = (next: TrainerState<S, Q>) =>
        next === state ? state : { ...next, heard };
      if (spot && (rules.isCorrect(q, spot, set) || rules.isOutOfRange(q, spot, set))) {
        return played(answerAt(rules, state, q, spot));
      }
      if (rightPitch(q, midi)) {
        return { ...state, farLast: false, octaveLast: true, heard };
      }
      if (!misses) return state;
      if (spot) return played(answerAt(rules, state, q, spot));
      if (state.wrong.includes(midi)) return state;
      return {
        ...applyMiss(state, midi, rules.key(q)), farLast: false, octaveLast: false, heard,
      };
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
