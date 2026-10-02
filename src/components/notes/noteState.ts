import { samePos, type Position, type Rng } from '@/lib/music';
import {
  defaultNoteSettings, generateNoteQuestion, isCorrectNoteFret,
  isNoteOutOfRange, NOTE_STORAGE_KEY, parseNoteSettings, type NoteQuestion,
  type NoteSettings,
} from '@/lib/notes';
import {
  applyMiss, applyPause, applySolve, freshAttempt, type QuizCore,
} from '@/lib/quizFlow';
import { emptyStats, parseStats } from '@/lib/stats';
import { loadJson } from '@/lib/storage';

/** A wrong try: a pitch class (Name it) or a board position (Find it). */
export type NoteWrong = number | Position;

export interface NoteState extends QuizCore<NoteWrong> {
  set: NoteSettings;
  q: NoteQuestion | null;
  /** Where the correct Find-it answer was tapped. */
  picked: Position | null;
  /** Find-it taps on the right note outside the fret range; not scored. */
  far: Position[];
  /** True while the latest tap was one of those. */
  farLast: boolean;
}

export type NoteAction =
  | { type: 'answerName'; pc: number }
  | { type: 'answerFret'; pos: Position }
  | { type: 'next'; q: NoteQuestion | null }
  | { type: 'settings'; set: NoteSettings; q?: NoteQuestion | null }
  | { type: 'togglePause' }
  | { type: 'resetStats' };

const newQuestion = (state: NoteState, q: NoteQuestion | null): NoteState => ({
  ...state, ...freshAttempt(), q, picked: null, far: [], farLast: false,
});

export function initNoteState(rng: Rng = Math.random): NoteState {
  const saved = (loadJson(NOTE_STORAGE_KEY) ?? {}) as Record<string, unknown>;
  const set = saved.set ? parseNoteSettings(saved.set) : defaultNoteSettings();
  return {
    set,
    stats: saved.stats ? parseStats(saved.stats) : emptyStats(),
    q: generateNoteQuestion(set, rng),
    picked: null,
    far: [],
    farLast: false,
    ...freshAttempt(),
  };
}

export function noteReducer(state: NoteState, action: NoteAction): NoteState {
  const { q, set } = state;
  switch (action.type) {
    case 'answerName': {
      if (!q || q.mode !== 'name' || state.answered) return state;
      if (state.wrong.includes(action.pc)) return state;
      return action.pc === q.pc
        ? applySolve(state, q.pc, set.pause)
        : applyMiss(state, action.pc, q.pc);
    }
    case 'answerFret': {
      if (!q || q.mode !== 'find' || state.answered) return state;
      const { pos } = action;
      if (state.wrong.some(w => typeof w !== 'number' && samePos(w, pos))) return state;
      if (state.far.some(p => samePos(p, pos))) return state;
      if (isCorrectNoteFret(q, pos, set)) {
        return { ...applySolve(state, q.pc, set.pause), picked: pos, farLast: false };
      }
      // The right note beyond the user's own range is not a miss.
      if (isNoteOutOfRange(q, pos, set)) {
        return { ...state, far: [...state.far, pos], farLast: true };
      }
      return { ...applyMiss(state, pos, q.pc), farLast: false };
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
