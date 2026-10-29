import { useEffect, useReducer, useRef, useState, useSyncExternalStore } from 'react';
import { emptyClip, type Clip } from './clip';
import { clipReducer, initClipState } from './clipState';
import {
  addFolder, dropArrangements, dropFolder, libraryStore, loadArrangement, moveArrangement, newArrangementId, renameFolder,
  storeArrangement, worthKeeping, type ArrangementInfo, type FolderInfo,
} from './arrangements';

/** What was just deleted, kept until the dialog closes so Undo can bring it back. */
export interface Deleted {
  /** Its name, as the dialog says it. */
  name: string;
  /** The folder deleted, with everything in it; none when one arrangement was. */
  folder?: FolderInfo;
  items: { info: ArrangementInfo; clip: Clip }[];
}

/**
 * The clip with its undo history, and My arrangements (issue #187): the open arrangement is saved as
 * it is edited (never an example shown in its place); the others can be opened, renamed, moved
 * between folders and deleted.
 */
export function useArrangements() {
  const [store] = useState(libraryStore);
  const library = useSyncExternalStore(store.subscribe, store.get, store.get);
  const [state, dispatch] = useReducer(clipReducer, library, initClipState);
  const [deleted, setDeleted] = useState<Deleted | null>(null);

  // The arrangement last read or written, so opening one doesn't count as a change.
  const saved = useRef({ id: state.id, clip: state.clip });
  // Where a new arrangement goes when it joins the list: the folder it was started in.
  const newFolder = useRef<string | undefined>(undefined);
  // The open arrangement is saved as it changes; the index names it, so a reload opens it again.
  useEffect(() => {
    const { id, clip, example } = state;
    const known = store.get();
    let next = known;
    if (!example && (saved.current.id !== id || saved.current.clip !== clip)) {
      saved.current = { id, clip };
      // A new clip joins the list once it has something in it.
      if (known.items.some(i => i.id === id) || worthKeeping(clip)) {
        next = storeArrangement(known, id, clip, Date.now(), newFolder.current);
      }
    }
    if (next !== known || known.open !== id) store.set({ ...next, open: id });
  }, [state, store]);

  /** The clip the arrangement `id` holds now: the open one's from the page, else from storage. */
  const clipOf = (id: string): Clip | null =>
    id === state.id ? (state.example?.mine.clip ?? state.clip) : loadArrangement(id);

  /** Opens a kept arrangement in place of what is shown; false when its clip can't be read. */
  const open = (id: string): boolean => {
    if (id === state.id && !state.example) return true;
    const clip = clipOf(id);
    if (!clip) return false;
    saved.current = { id, clip };
    dispatch({ type: 'open', id, clip });
    return true;
  };

  /** `clip` (an empty one when none) as a new arrangement, opened; it joins `folder` when kept. */
  const openNew = (clip: Clip = emptyClip(), folder?: string) => {
    newFolder.current = folder;
    dispatch({ type: 'open', id: newArrangementId(), clip });
  };

  /** A new name for a kept arrangement; the open one's is an undo step, as a click on the title. */
  const rename = (id: string, name: string) => {
    if (id === state.id) {
      dispatch({ type: 'rename', name });
      // Behind an example the clip isn't saved until the example is left; the list shows the name now.
      if (!state.example) return;
    }
    const clip = loadArrangement(id);
    if (clip) store.set(storeArrangement(library, id, { ...clip, name }, Date.now()));
  };

  /** After deleting, the open arrangement if it is still kept, else the latest other, else a new clip. */
  const reopen = (gone: string[]) => {
    if (!gone.includes(state.id)) return;
    const next = store.get().items.map(i => ({ id: i.id, clip: loadArrangement(i.id) })).find(i => i.clip);
    if (next?.clip) {
      saved.current = { id: next.id, clip: next.clip };
      dispatch({ type: 'open', id: next.id, clip: next.clip });
    } else {
      openNew();
    }
  };

  /** The arrangements `infos` with their clips, for Undo. */
  const withClips = (infos: ArrangementInfo[]) =>
    infos.flatMap(info => {
      const clip = clipOf(info.id);
      return clip ? [{ info, clip }] : [];
    });

  /** Deletes a kept arrangement; deleting the open one opens the latest other, or a new clip. */
  const remove = (id: string) => {
    const info = library.items.find(i => i.id === id);
    if (!info) return;
    setDeleted({ name: info.name, items: withClips([info]) });
    store.set(dropArrangements(library, [id]));
    reopen([id]);
  };

  /** Deletes a folder and everything in it. */
  const removeFolder = (id: string) => {
    const folder = library.folders.find(f => f.id === id);
    if (!folder) return;
    const inside = library.items.filter(i => i.folder === id);
    setDeleted({ name: folder.name, folder, items: withClips(inside) });
    store.set(dropFolder(library, id));
    reopen(inside.map(i => i.id));
  };

  /** Brings back what was last deleted, where it was. */
  const undoDelete = () => {
    if (!deleted) return;
    let next = deleted.folder ? addFolder(library, deleted.folder) : library;
    for (const { info, clip } of deleted.items) next = storeArrangement(next, info.id, clip, info.changed, info.folder);
    store.set(next);
    setDeleted(null);
  };

  /** A new, empty folder; its id. */
  const createFolder = (name: string): string => {
    const id = newArrangementId();
    store.set(addFolder(library, { id, name }));
    return id;
  };

  return {
    state, dispatch, library, deleted, open, openNew, rename, remove, removeFolder, undoDelete, createFolder,
    renameFolder: (id: string, name: string) => store.set(renameFolder(library, id, name)),
    move: (id: string, folder: string | undefined) => store.set(moveArrangement(library, id, folder)),
    forgetDeleted: () => setDeleted(null),
  };
}
