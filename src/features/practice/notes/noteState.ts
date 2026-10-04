import {
  initTrainerState, trainerReducer, type TrainerAction, type TrainerRules,
  type TrainerState,
} from '@/features/practice/quiz/trainerState';
import type { Rng } from '@/lib/music';
import {
  generateNoteQuestion, isCorrectNoteFret, isNoteOutOfRange, NOTE_STORAGE_KEY,
  parseNoteSettings, type NoteQuestion, type NoteSettings,
} from '@/features/practice/notes/notes';

export type NoteState = TrainerState<NoteSettings, NoteQuestion>;
/** `answerName` carries the pitch class, 0–11. */
export type NoteAction = TrainerAction<NoteSettings, NoteQuestion>;

const RULES: TrainerRules<NoteSettings, NoteQuestion> = {
  key: q => q.pc,
  named: q => q.mode === 'name',
  isCorrect: (q, pos, set) => q.mode === 'find' && isCorrectNoteFret(q, pos, set),
  isOutOfRange: (q, pos, set) => q.mode === 'find' && isNoteOutOfRange(q, pos, set),
};

export const initNoteState = (rng: Rng = Math.random): NoteState =>
  initTrainerState(
    NOTE_STORAGE_KEY, parseNoteSettings, set => generateNoteQuestion(set, rng),
  );

export const noteReducer = (state: NoteState, action: NoteAction): NoteState =>
  trainerReducer(RULES, state, action);
