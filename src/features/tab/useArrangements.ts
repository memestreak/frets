import { useEffect, useReducer, useState, useSyncExternalStore } from 'react';
import { emptyClip, type Clip } from './clip';
import { clipReducer, initClipState } from './clipState';
import {
  addFolder, clearDraft, dropArrangements, dropFolder, libraryStore, loadArrangement, loadDraft, moveArrangement, newArrangementId,
  renameFolder, saveDraft, storeArrangement, type ArrangementInfo, type FolderInfo,
} from './arrangements';

/** What was just deleted, kept until the dialog closes so Undo can bring it back. */
export interface Deleted {
  /** Its name, as the dialog says it ("3 arrangements" when several were). */
  name: string;
  /** The folder deleted, with everything in it; none when one arrangement was. */
  folder?: FolderInfo;
  items: { info: ArrangementInfo; clip: Clip }[];
}

/**
 * The clip with its undo history, and My arrangements (issues #187, #259): the open arrangement is
 * written only on Save or Save As…; until then it has unsaved changes, kept as a draft so a reload
 * brings them back. The saved ones can be opened, renamed, moved between folders and deleted.
 */
export function useArrangements() {
  const [store] = useState(libraryStore);
  const library = useSyncExternalStore(store.subscribe, store.get, store.get);
  const [state, dispatch] = useReducer(clipReducer, null, () => initClipState({ library: store.get(), draft: loadDraft(store.get()) }));
  const [deleted, setDeleted] = useState<Deleted | null>(null);

  /** Whether the open arrangement is one of My arrangements. */
  const kept = library.items.some(i => i.id === state.id);
  /** Whether the clip differs from the one last saved or opened. */
  const unsaved = state.clip !== state.base;

  // The index names the open arrangement; the draft holds it while it isn't saved as it is.
  useEffect(() => {
    const known = store.get();
    if (known.open !== state.id) store.set({ ...known, open: state.id });
    if (kept && !unsaved) clearDraft();
    else saveDraft({ id: state.id, clip: state.clip, base: state.base }, kept);
  }, [state, kept, unsaved, store]);

  /** Opens a saved arrangement in place of the clip; false when its clip can't be read. */
  const open = (id: string): boolean => {
    const clip = loadArrangement(id);
    if (!clip) return false;
    dispatch({ type: 'open', id, clip });
    return true;
  };

  /** `clip` (an empty one when none) as a new arrangement, not saved yet; its id. */
  const openNew = (clip: Clip = emptyClip()): string => {
    const id = newArrangementId();
    dispatch({ type: 'open', id, clip });
    return id;
  };

  /** Saves the open arrangement where it is; false when it was never saved, which Save As… does first. */
  const save = (): boolean => {
    if (!kept) return false;
    store.set(storeArrangement(store.get(), state.id, state.clip, Date.now()));
    dispatch({ type: 'saved', id: state.id, clip: state.clip });
    return true;
  };

  /**
   * Saves the open clip named `name` into `folder` (the top level with none): a saved arrangement as
   * a new one, which the page then shows (the saved one stays as it was); one never saved, as itself.
   */
  const saveAs = (name: string, folder: string | undefined) => {
    const id = kept ? newArrangementId() : state.id;
    const clip = { ...state.clip, name };
    store.set(storeArrangement(store.get(), id, clip, Date.now(), folder));
    dispatch({ type: 'saved', id, clip });
  };

  /** A new name for a saved arrangement, saved at once; the open one's title follows, its other changes still unsaved. */
  const rename = (id: string, name: string) => {
    const clip = loadArrangement(id);
    if (clip) store.set(storeArrangement(store.get(), id, { ...clip, name }, Date.now()));
    if (id === state.id) dispatch({ type: 'renameSaved', name });
  };

  /** After deleting, the open arrangement if it is still saved, else the latest other, else a new clip. */
  const reopen = (gone: string[]) => {
    if (!gone.includes(state.id)) return;
    const next = store.get().items.map(i => ({ id: i.id, clip: loadArrangement(i.id) })).find(i => i.clip);
    if (next?.clip) dispatch({ type: 'open', id: next.id, clip: next.clip });
    else openNew();
  };

  /** The arrangements `infos` with their saved clips, for Undo. */
  const withClips = (infos: ArrangementInfo[]) =>
    infos.flatMap(info => {
      const clip = loadArrangement(info.id);
      return clip ? [{ info, clip }] : [];
    });

  /** Deletes saved arrangements; deleting the open one opens the latest other, or a new clip. */
  const remove = (ids: string[]) => {
    const infos = library.items.filter(i => ids.includes(i.id));
    if (infos.length === 0) return;
    const name = infos.length === 1 ? infos[0].name : `${infos.length} arrangements`;
    setDeleted({ name, items: withClips(infos) });
    store.set(dropArrangements(library, infos.map(i => i.id)));
    reopen(infos.map(i => i.id));
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
    state, dispatch, library, kept, unsaved, deleted, open, openNew, save, saveAs, rename, remove, removeFolder, undoDelete,
    createFolder,
    renameFolder: (id: string, name: string) => store.set(renameFolder(library, id, name)),
    /** Moves the arrangements `ids` into `folder`, or to the top level with none. */
    move: (ids: string[], folder: string | undefined) =>
      store.set(ids.reduce((next, id) => moveArrangement(next, id, folder), library)),
    forgetDeleted: () => setDeleted(null),
  };
}
