/**
 * The Tab page's clip and its undo history, which arrangement it is (`arrangements.ts`), and the
 * example clip open in its place, if any. An example's edits are never saved: the page saves the
 * clip only while no example is open, and leaving the example brings back the clip and history it
 * set aside.
 */
import type { Clip } from './clip';
import { openOnLoad, type Library } from './arrangements';

/** A clip with its undo history. */
interface History {
  clip: Clip;
  /** Earlier clips, the latest last. */
  past: Clip[];
  /** Clips undone, the next redo last. */
  future: Clip[];
}

export interface ClipState extends History {
  /** The arrangement the clip is saved as; while an example is shown, the one it set aside. */
  id: string;
  /** The example being shown (its id in `examples.ts`) and the clip it set aside; null for the saved clip. */
  example: { id: string; mine: History } | null;
}

export type ClipAction =
  /** An edit, one undo step back to `from` when given (a drag's first clip), else to the clip before. */
  | { type: 'replace'; clip: Clip; from?: Clip }
  /** A clip shown while a drag goes on, not an undo step of its own. */
  | { type: 'preview'; clip: Clip }
  | { type: 'undo' }
  | { type: 'redo' }
  /** An example in place of the clip, with a history of its own. */
  | { type: 'openExample'; id: string; clip: Clip }
  /** Back to the clip an example set aside. */
  | { type: 'leaveExample' }
  /** A new title for the arrangement: one undo step; while an example is shown, in the clip it set aside. */
  | { type: 'rename'; name: string }
  /** Another arrangement (a kept one, a new one, an import or a copy) in place of the clip, with a fresh history. */
  | { type: 'open'; id: string; clip: Clip };

export function clipReducer(state: ClipState, action: ClipAction): ClipState {
  switch (action.type) {
    case 'replace':
      return { ...state, clip: action.clip, past: [...state.past, action.from ?? state.clip], future: [] };
    case 'preview':
      return { ...state, clip: action.clip };
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
      return { clip: action.clip, past: [], future: [], id: state.id, example: { id: action.id, mine } };
    }
    case 'leaveExample':
      return state.example ? { ...state.example.mine, id: state.id, example: null } : state;
    case 'rename': {
      if (!state.example) return clipReducer(state, { type: 'replace', clip: { ...state.clip, name: action.name } });
      const { mine } = state.example;
      const renamed = { clip: { ...mine.clip, name: action.name }, past: [...mine.past, mine.clip], future: [] };
      return { ...state, example: { ...state.example, mine: renamed } };
    }
    case 'open':
      return { clip: action.clip, past: [], future: [], id: action.id, example: null };
  }
}

/** The open arrangement, or a new empty clip. */
export function initClipState(library: Library): ClipState {
  return { ...openOnLoad(library), past: [], future: [], example: null };
}
