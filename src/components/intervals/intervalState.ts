import {
  defaultIntervalSettings, generateIntervalQuestion, INTERVAL_STORAGE_KEY,
  isCorrectFret, isOutOfRange, parseIntervalSettings, type IntervalQuestion,
  type IntervalSettings,
} from '@/lib/intervals';
import { samePos, type Position, type Rng } from '@/lib/music';
import {
  applyMiss, applyPause, applySolve, freshAttempt, type QuizCore,
} from '@/lib/quizFlow';
import { emptyStats, parseStats } from '@/lib/stats';
import { loadJson } from '@/lib/storage';

/** A wrong try: an interval (Name it) or a board position (Find it). */
export type IntervalWrong = number | Position;

export interface IntervalState extends QuizCore<IntervalWrong> {
  set: IntervalSettings;
  q: IntervalQuestion | null;
  /** Where the correct Find-it answer was tapped. */
  picked: Position | null;
  /** Find-it taps on the right interval outside the box; not scored. */
  far: Position[];
  /** True while the latest tap was one of those. */
  farLast: boolean;
}

export type IntervalAction =
  | { type: 'answerName'; semis: number }
  | { type: 'answerFret'; pos: Position }
  | { type: 'next'; q: IntervalQuestion | null }
  /** New settings; `q` replaces the question when the change regenerates. */
  | { type: 'settings'; set: IntervalSettings; q?: IntervalQuestion | null }
  | { type: 'togglePause' }
  | { type: 'resetStats' };

const newQuestion = (state: IntervalState, q: IntervalQuestion | null): IntervalState => ({
  ...state, ...freshAttempt(), q, picked: null, far: [], farLast: false,
});

export function initIntervalState(rng: Rng = Math.random): IntervalState {
  const saved = (loadJson(INTERVAL_STORAGE_KEY) ?? {}) as Record<string, unknown>;
  const set = saved.set ? parseIntervalSettings(saved.set) : defaultIntervalSettings();
  return {
    set,
    stats: saved.stats ? parseStats(saved.stats) : emptyStats(),
    q: generateIntervalQuestion(set, rng),
    picked: null,
    far: [],
    farLast: false,
    ...freshAttempt(),
  };
}

export function intervalReducer(state: IntervalState, action: IntervalAction): IntervalState {
  const { q, set } = state;
  switch (action.type) {
    case 'answerName': {
      if (!q || state.answered || set.mode !== 'name') return state;
      if (state.wrong.includes(action.semis)) return state;
      return action.semis === q.semis
        ? applySolve(state, q.semis, set.pause)
        : applyMiss(state, action.semis, q.semis);
    }
    case 'answerFret': {
      if (!q || state.answered || set.mode !== 'fret') return state;
      const { pos } = action;
      if (state.wrong.some(w => typeof w !== 'number' && samePos(w, pos))) return state;
      if (state.far.some(p => samePos(p, pos))) return state;
      if (isCorrectFret(q, pos, set)) {
        return { ...applySolve(state, q.semis, set.pause), picked: pos, farLast: false };
      }
      // The right interval beyond the user's own range is not a miss.
      if (isOutOfRange(q, pos, set)) {
        return { ...state, far: [...state.far, pos], farLast: true };
      }
      return { ...applyMiss(state, pos, q.semis), farLast: false };
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
