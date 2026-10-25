/**
 * The Tab page's clip and its undo history. Imports are the only change so
 * far; each is one step back with undo.
 */
import { emptyClip, parseClip, type Clip } from './clip';
import { loadJson } from '@/lib/storage';

export const STORAGE_KEY = 'frets.tab.clip';

export interface ClipState {
  clip: Clip;
  /** Earlier clips, the latest last. */
  past: Clip[];
  /** Clips undone, the next redo last. */
  future: Clip[];
}

export type ClipAction =
  | { type: 'replace'; clip: Clip }
  | { type: 'undo' }
  | { type: 'redo' };

export function clipReducer(state: ClipState, action: ClipAction): ClipState {
  switch (action.type) {
    case 'replace':
      return { clip: action.clip, past: [...state.past, state.clip], future: [] };
    case 'undo': {
      const clip = state.past[state.past.length - 1];
      if (!clip) return state;
      return { clip, past: state.past.slice(0, -1), future: [...state.future, state.clip] };
    }
    case 'redo': {
      const clip = state.future[state.future.length - 1];
      if (!clip) return state;
      return { clip, past: [...state.past, state.clip], future: state.future.slice(0, -1) };
    }
  }
}

/** The saved clip, or an empty one. */
export function initClipState(): ClipState {
  return { clip: parseClip(loadJson(STORAGE_KEY)) ?? emptyClip(), past: [], future: [] };
}
