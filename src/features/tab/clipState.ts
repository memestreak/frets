/**
 * The Tab page's clip and its undo history, which arrangement it is (`arrangements.ts`), and the
 * example clip open in its place, if any. An example's edits are never saved: the page saves the
 * clip only while no example is open, and leaving the example brings back the clip and history it
 * set aside.
 */
import { withPart, type Clip, type Part } from './clip';
import type { FxSettings } from './effects';
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
  /** The example being shown (a built-in arrangement's id, `builtins.ts`) and the clip it set aside; null for the saved clip. */
  example: { id: string; mine: History } | null;
}

export type ClipAction =
  /** An edit, one undo step back to `from` when given (a drag's first clip), else to the clip before. */
  | { type: 'replace'; clip: Clip; from?: Clip }
  /** New FX for track `track`: changes made one after another, as a knob turns, are one undo step. */
  | { type: 'fx'; track: number; fx: FxSettings }
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

/** An edit or a preview made on the part the page shows, which goes back into the whole clip (`withPart`). */
export type PartAction =
  | { type: 'replacePart'; part: Part; from?: Part }
  | { type: 'previewPart'; part: Part };

/** The action on the whole clip `clip` that a part's edit makes; any other action as it is. */
export function clipAction(clip: Clip, action: ClipAction | PartAction): ClipAction {
  if (action.type === 'replacePart') {
    return { type: 'replace', clip: withPart(clip, action.part), from: action.from && withPart(clip, action.from) };
  }
  if (action.type === 'previewPart') return { type: 'preview', clip: withPart(clip, action.part) };
  return action;
}

export function clipReducer(state: ClipState, action: ClipAction): ClipState {
  switch (action.type) {
    case 'replace':
      return { ...state, clip: action.clip, past: [...state.past, action.from ?? state.clip], future: [] };
    case 'fx': {
      const tracks = state.clip.tracks.map((track, t) => (t === action.track ? { ...track, fx: action.fx } : track));
      const clip = { ...state.clip, tracks };
      const before = state.past[state.past.length - 1];
      // The clip is already a change of this track's FX from the one before: this change joins its step.
      const sameStep = before && before.tracks.length === tracks.length
        && before.tracks[action.track]?.fx !== state.clip.tracks[action.track]?.fx && sameMusic(before, state.clip);
      if (sameStep) return { ...state, clip, future: [] };
      return clipReducer(state, { type: 'replace', clip });
    }
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

/**
 * Whether two clips, or two parts, differ in nothing but their tracks' FX and sounds: the same music,
 * in another sound.
 */
export function sameMusic<T extends Clip | Part>(a: T, b: T): boolean {
  if (!sameBut(a, b, ['fx', 'instrument', 'tracks'])) return false;
  const tracksA = 'tracks' in a ? a.tracks : [];
  const tracksB = 'tracks' in b ? b.tracks : [];
  return tracksA.length === tracksB.length && tracksA.every((track, t) => sameBut(track, tracksB[t], ['fx', 'instrument']));
}

/** Whether every field of two objects but `skip` is the very same. */
function sameBut(a: object, b: object, skip: string[]): boolean {
  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
  return [...keys].every(key => skip.includes(key) || x[key] === y[key]);
}

/** The open arrangement, or a new empty clip. */
export function initClipState(library: Library): ClipState {
  return { ...openOnLoad(library), past: [], future: [], example: null };
}
