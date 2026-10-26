/**
 * The Tab page's clip and its undo history, and the example clip open in
 * its place, if any. An example's edits are never saved: the page saves
 * the clip only while no example is open, and leaving the example brings
 * back the clip and history it set aside.
 */
import { emptyClip, parseClip, type Clip } from './clip';
import { loadJson } from '@/lib/storage';

export const STORAGE_KEY = 'frets.tab.clip';

/** A clip with its undo history. */
interface History {
  clip: Clip;
  /** Earlier clips, the latest last. */
  past: Clip[];
  /** Clips undone, the next redo last. */
  future: Clip[];
}

export interface ClipState extends History {
  /** The example being shown (its id in `examples.ts`) and the clip it set aside; null for the saved clip. */
  example: { id: string; mine: History } | null;
}

export type ClipAction =
  | { type: 'replace'; clip: Clip }
  | { type: 'undo' }
  | { type: 'redo' }
  /** An example in place of the clip, with a history of its own. */
  | { type: 'openExample'; id: string; clip: Clip }
  /** Back to the clip an example set aside. */
  | { type: 'leaveExample' }
  /** An import replaces the clip; over an example, it replaces the set-aside clip, so it is saved. */
  | { type: 'import'; clip: Clip };

export function clipReducer(state: ClipState, action: ClipAction): ClipState {
  switch (action.type) {
    case 'replace':
      return { ...state, clip: action.clip, past: [...state.past, state.clip], future: [] };
    case 'undo': {
      const clip = state.past[state.past.length - 1];
      if (!clip) return state;
      return { ...state, clip, past: state.past.slice(0, -1), future: [...state.future, state.clip] };
    }
    case 'redo': {
      const clip = state.future[state.future.length - 1];
      if (!clip) return state;
      return { ...state, clip, past: [...state.past, state.clip], future: state.future.slice(0, -1) };
    }
    case 'openExample': {
      const mine = state.example?.mine ?? { clip: state.clip, past: state.past, future: state.future };
      return { clip: action.clip, past: [], future: [], example: { id: action.id, mine } };
    }
    case 'leaveExample':
      return state.example ? { ...state.example.mine, example: null } : state;
    case 'import': {
      const mine: History = state.example?.mine ?? state;
      return { clip: action.clip, past: [...mine.past, mine.clip], future: [], example: null };
    }
  }
}

/** The saved clip, or an empty one. */
export function initClipState(): ClipState {
  return { clip: parseClip(loadJson(STORAGE_KEY)) ?? emptyClip(), past: [], future: [], example: null };
}
