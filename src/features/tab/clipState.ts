/**
 * The Tab page's clip and its undo history, which arrangement it is (`arrangements.ts`), and the clip
 * as it was last saved or opened (`base`): the clip has unsaved changes while it isn't that very clip,
 * so undoing back to it leaves nothing unsaved (issue #259).
 */
import { withPart, type Clip, type Part } from './clip';
import type { FxSettings } from './effects';
import { openOnLoad, type Draft, type Library } from './arrangements';

/** A clip with its undo history. */
interface History {
  clip: Clip;
  /** Earlier clips, the latest last. */
  past: Clip[];
  /** Clips undone, the next redo last. */
  future: Clip[];
}

export interface ClipState extends History {
  /** The arrangement the clip is saved as (it may not be in My arrangements yet). */
  id: string;
  /** The clip as it was last saved or opened. */
  base: Clip;
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
  /** Another arrangement (a saved one, a new one, a built-in, an import or a link) in place of the clip, with a fresh history. */
  | { type: 'open'; id: string; clip: Clip }
  /** The clip saved as `id` (Save, or Save As… under a new id), as `clip`: nothing is unsaved; the history stays. */
  | { type: 'saved'; id: string; clip: Clip }
  /** The arrangement renamed in Arrangements…, which saves the name at once: other unsaved changes stay unsaved. */
  | { type: 'renameSaved'; name: string };

/** An edit or a preview made on the part the page shows, which goes back into the whole clip (`withPart`). */
export type PartAction =
  | { type: 'replacePart'; part: Part; from?: Part }
  | { type: 'previewPart'; part: Part };

/** The action on the whole clip `clip` that an edit of its track `track` makes; any other action as it is. */
export function clipAction(clip: Clip, action: ClipAction | PartAction, track = 0): ClipAction {
  if (action.type === 'replacePart') {
    return { type: 'replace', clip: withPart(clip, action.part, track), from: action.from && withPart(clip, action.from, track) };
  }
  if (action.type === 'previewPart') return { type: 'preview', clip: withPart(clip, action.part, track) };
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
    case 'open':
      return { clip: action.clip, past: [], future: [], id: action.id, base: action.clip };
    case 'saved':
      return { ...state, id: action.id, clip: action.clip, base: action.clip };
    case 'renameSaved': {
      const base = { ...state.base, name: action.name };
      // The saved clip, wherever it is in the history, stays the very one saved, so undoing back to it leaves nothing unsaved.
      const named = (clip: Clip) => (clip === state.base ? base : { ...clip, name: action.name });
      return { ...state, clip: named(state.clip), base, past: state.past.map(named), future: state.future.map(named) };
    }
  }
}

/**
 * Whether two clips, or two parts, differ in nothing but their tracks' FX and sounds: the same music,
 * in another sound. A part's other tracks (`alongside`) aren't its music.
 */
export function sameMusic<T extends Clip | Part>(a: T, b: T): boolean {
  if (!sameBut(a, b, ['fx', 'instrument', 'tracks', 'alongside'])) return false;
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

/**
 * The page's clip on load (issue #259): the clip as it was left when it had unsaved changes or was
 * never saved (`draft`), else the open arrangement, else a new empty clip.
 */
export function initClipState({ library, draft }: { library: Library; draft: Draft | null }): ClipState {
  if (draft) return { id: draft.id, clip: draft.clip, base: draft.base, past: [], future: [] };
  const { id, clip } = openOnLoad(library);
  return { id, clip, base: clip, past: [], future: [] };
}
