import { useEffect, useReducer, useRef, useState, useSyncExternalStore } from 'react';
import { emptyClip, type Clip } from './clip';
import { clipReducer, initClipState } from './clipState';
import {
  dropArrangement, libraryStore, loadArrangement, newArrangementId, storeArrangement, worthKeeping,
  type ArrangementInfo,
} from './arrangements';

/** An arrangement just deleted, kept until the dialog closes so Undo can bring it back. */
export interface Deleted {
  info: ArrangementInfo;
  clip: Clip;
}

/**
 * The clip with its undo history, and My arrangements (issue #187): the open arrangement is saved as
 * it is edited (never an example shown in its place); the others can be opened, renamed and deleted.
 */
export function useArrangements() {
  const [store] = useState(libraryStore);
  const library = useSyncExternalStore(store.subscribe, store.get, store.get);
  const setLibrary = store.set;
  const [state, dispatch] = useReducer(clipReducer, library, initClipState);
  const [deleted, setDeleted] = useState<Deleted | null>(null);

  // The arrangement last read or written, so opening one doesn't count as a change.
  const saved = useRef({ id: state.id, clip: state.clip });
  // The open arrangement is saved as it changes; the index names it, so a reload opens it again.
  useEffect(() => {
    const { id, clip, example } = state;
    const known = store.get();
    let next = known;
    if (!example && (saved.current.id !== id || saved.current.clip !== clip)) {
      saved.current = { id, clip };
      // A new clip joins the list once it has something in it.
      if (known.items.some(i => i.id === id) || worthKeeping(clip)) next = storeArrangement(known, id, clip, Date.now());
    }
    if (next !== known || known.open !== id) store.set({ ...next, open: id });
  }, [state, store]);

  /** Opens a kept arrangement in place of what is shown; false when its clip can't be read. */
  const open = (id: string): boolean => {
    if (id === state.id && !state.example) return true;
    const clip = id === state.id && state.example ? state.example.mine.clip : loadArrangement(id);
    if (!clip) return false;
    saved.current = { id, clip };
    dispatch({ type: 'open', id, clip });
    return true;
  };

  /** `clip` (an empty one when none) as a new arrangement, opened. */
  const openNew = (clip: Clip = emptyClip()) => dispatch({ type: 'open', id: newArrangementId(), clip });

  /** A new name for a kept arrangement; the open one's is an undo step, as a click on the title. */
  const rename = (id: string, name: string) => {
    if (id === state.id) {
      dispatch({ type: 'rename', name });
      // Behind an example the clip isn't saved until the example is left; the list shows the name now.
      if (!state.example) return;
    }
    const clip = loadArrangement(id);
    if (clip) setLibrary(storeArrangement(library, id, { ...clip, name }, Date.now()));
  };

  /** Deletes a kept arrangement; deleting the open one opens the latest other, or a new clip. */
  const remove = (id: string) => {
    const info = library.items.find(i => i.id === id);
    const isOpen = id === state.id;
    const clip = isOpen ? (state.example?.mine.clip ?? state.clip) : loadArrangement(id);
    if (!info || !clip) return;
    setDeleted({ info, clip });
    const left = dropArrangement(library, id);
    setLibrary(left);
    if (!isOpen) return;
    const next = left.items.find(i => loadArrangement(i.id));
    if (next) {
      const nextClip = loadArrangement(next.id)!;
      saved.current = { id: next.id, clip: nextClip };
      dispatch({ type: 'open', id: next.id, clip: nextClip });
    } else {
      openNew();
    }
  };

  /** Brings the last deleted arrangement back into the list, where it was. */
  const undoDelete = () => {
    if (!deleted) return;
    setLibrary(storeArrangement(library, deleted.info.id, deleted.clip, deleted.info.changed));
    setDeleted(null);
  };

  return {
    state, dispatch, library, deleted, open, openNew, rename, remove, undoDelete,
    forgetDeleted: () => setDeleted(null),
  };
}
