import {
  initTrainerState, trainerReducer, type TrainerAction, type TrainerRules,
  type TrainerState,
} from '@/components/quiz/trainerState';
import {
  generateIntervalQuestion, INTERVAL_STORAGE_KEY, isCorrectFret, isOutOfRange,
  parseIntervalSettings, type IntervalQuestion, type IntervalSettings,
} from '@/lib/intervals';
import type { Rng } from '@/lib/music';

export type IntervalState = TrainerState<IntervalSettings, IntervalQuestion>;
/** `answerName` carries the interval class, 1–12. */
export type IntervalAction = TrainerAction<IntervalSettings, IntervalQuestion>;

const RULES: TrainerRules<IntervalSettings, IntervalQuestion> = {
  key: q => q.semis,
  named: (_q, set) => set.mode === 'name',
  isCorrect: isCorrectFret,
  isOutOfRange,
};

export const initIntervalState = (rng: Rng = Math.random): IntervalState =>
  initTrainerState(
    INTERVAL_STORAGE_KEY, parseIntervalSettings,
    set => generateIntervalQuestion(set, rng),
  );

export const intervalReducer = (
  state: IntervalState, action: IntervalAction,
): IntervalState => trainerReducer(RULES, state, action);
