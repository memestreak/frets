import { pitchClass, samePos, type Position, type Rng } from '@/lib/music';
import {
  defaultNoteSettings, generateNoteQuestion, NOTE_STORAGE_KEY,
  parseNoteSettings, type NoteQuestion, type NoteSettings,
} from '@/lib/notes';
import {
  applyMiss, applyPause, applySolve, freshAttempt, type QuizCore,
} from '@/lib/quizFlow';
import { emptyStats, parseStats } from '@/lib/stats';
import { loadJson } from '@/lib/storage';

/** A wrong try: a pitch class (Name it) or a board position (Find modes). */
export type NoteWrong = number | Position;

export interface NoteState extends QuizCore<NoteWrong> {
  set: NoteSettings;
  q: NoteQuestion | null;
  /** Correct positions tapped so far (Find modes). */
  found: Position[];
}

export type NoteAction =
  | { type: 'answerName'; pc: number }
  | { type: 'answerFret'; pos: Position }
  | { type: 'next'; q: NoteQuestion | null }
  | { type: 'settings'; set: NoteSettings; q?: NoteQuestion | null }
  | { type: 'togglePause' }
  | { type: 'resetStats' };

const newQuestion = (state: NoteState, q: NoteQuestion | null): NoteState => ({
  ...state, ...freshAttempt(), q, found: [],
});

export function initNoteState(rng: Rng = Math.random): NoteState {
  const saved = (loadJson(NOTE_STORAGE_KEY) ?? {}) as Record<string, unknown>;
  const set = saved.set ? parseNoteSettings(saved.set) : defaultNoteSettings();
  return {
    set,
    stats: saved.stats ? parseStats(saved.stats) : emptyStats(),
    q: generateNoteQuestion(set, null, rng),
    found: [],
    ...freshAttempt(),
  };
}

const hasPos = (list: NoteWrong[], pos: Position) =>
  list.some(w => typeof w !== 'number' && samePos(w, pos));

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
      if (!q || q.mode === 'name' || state.answered) return state;
      const { pos } = action;
      if (hasPos(state.wrong, pos) || state.found.some(p => samePos(p, pos))) return state;
      if (q.mode === 'string') {
        // Any octave of the note on the target string counts.
        return pos.s === q.s && pitchClass(pos.s, pos.f) === q.pc
          ? { ...applySolve(state, q.pc, set.pause), found: [pos] }
          : applyMiss(state, pos, q.pc);
      }
      if (!q.targets.some(t => samePos(t, pos))) return applyMiss(state, pos, q.pc);
      const found = [...state.found, pos];
      const next = { ...state, found };
      return found.length === q.targets.length ? applySolve(next, q.pc, set.pause) : next;
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
