/**
 * My arrangements (issues #187, #259): the clips saved in the browser, at the top level or in a folder
 * (one level, no folders in folders). An arrangement is written only when it is saved (Save, Save
 * As…). An index under `LIBRARY_KEY` lists the folders and the arrangements (name, folder, last
 * change) and names the open one; each clip has a key of its own. The open clip, while it has unsaved
 * changes or was never saved, is kept under `DRAFT_KEY` so a reload brings it back as it was.
 */
import { emptyClip, parseClip, titled, type Clip } from './clip';
import { loadJson, saveJson } from '@/lib/storage';

/** The index: which arrangement is open, and every kept one. */
export const LIBRARY_KEY = 'frets.tab.works';
/** One arrangement's clip. */
export const arrangementKey = (id: string) => `frets.tab.works.${id}`;

export interface ArrangementInfo {
  id: string;
  /** The clip's title, kept here so the list shows it without reading every clip. */
  name: string;
  /** When it last changed, in ms since 1970. */
  changed: number;
  /** The folder it is in; none at the top level. */
  folder?: string;
}

export interface FolderInfo {
  id: string;
  name: string;
}

export interface Library {
  /** The open arrangement; it may not be in `items` yet (a new clip with nothing in it). */
  open: string | null;
  folders: FolderInfo[];
  /** Latest change first. */
  items: ArrangementInfo[];
}

export const EMPTY_LIBRARY: Library = { open: null, folders: [], items: [] };

export function parseLibrary(v: unknown): Library {
  if (typeof v !== 'object' || v === null) return EMPTY_LIBRARY;
  const { open, folders, items } = v as Record<string, unknown>;
  if (!Array.isArray(items)) return EMPTY_LIBRARY;
  const kept = Array.isArray(folders) ? folders.filter(isFolder) : [];
  const known = new Set(kept.map(f => f.id));
  return {
    open: typeof open === 'string' ? open : null,
    folders: kept,
    // An arrangement whose folder is gone is back at the top level.
    items: items.filter(isInfo).map(i => (i.folder === undefined || known.has(i.folder) ? i : withoutFolder(i))),
  };
}

function withoutFolder(info: ArrangementInfo): ArrangementInfo {
  const { id, name, changed } = info;
  return { id, name, changed };
}

function isFolder(v: unknown): v is FolderInfo {
  if (typeof v !== 'object' || v === null) return false;
  const { id, name } = v as Record<string, unknown>;
  return typeof id === 'string' && id !== '' && typeof name === 'string';
}

function isInfo(v: unknown): v is ArrangementInfo {
  if (typeof v !== 'object' || v === null) return false;
  const { id, name, changed, folder } = v as Record<string, unknown>;
  return typeof id === 'string' && id !== '' && typeof name === 'string' && typeof changed === 'number' && Number.isFinite(changed)
    && (folder === undefined || typeof folder === 'string');
}

export function loadLibrary(): Library {
  return parseLibrary(loadJson(LIBRARY_KEY));
}

export function saveLibrary(library: Library): void {
  saveJson(LIBRARY_KEY, library);
}

export function loadArrangement(id: string): Clip | null {
  return parseClip(loadJson(arrangementKey(id)));
}

/** A new id for an arrangement or a folder. */
export function newArrangementId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * `clip` written under `id`, and the index with it, changed at `changed`, latest change first. It
 * stays in its folder, or goes into `folder` when it is new to the list.
 */
export function storeArrangement(library: Library, id: string, clip: Clip, changed: number, folder?: string): Library {
  saveJson(arrangementKey(id), clip);
  const into = library.items.find(i => i.id === id)?.folder ?? folder;
  const info: ArrangementInfo = { id, name: clip.name, changed, ...(into === undefined ? {} : { folder: into }) };
  const items = [info, ...library.items.filter(i => i.id !== id)].sort((a, b) => b.changed - a.changed);
  return { ...library, items };
}

/** The index without the arrangements `ids`, their clips removed from storage. */
export function dropArrangements(library: Library, ids: string[]): Library {
  for (const id of ids) {
    try {
      window.localStorage.removeItem(arrangementKey(id));
    } catch {
      // Storage blocked: nothing was kept anyway.
    }
  }
  return { ...library, items: library.items.filter(i => !ids.includes(i.id)) };
}

/** `id` moved into `folder`, or to the top level. */
export function moveArrangement(library: Library, id: string, folder: string | undefined): Library {
  return { ...library, items: library.items.map(i => (i.id !== id ? i : folder === undefined ? withoutFolder(i) : { ...i, folder })) };
}

export function addFolder(library: Library, folder: FolderInfo): Library {
  return { ...library, folders: [...library.folders, folder] };
}

export function renameFolder(library: Library, id: string, name: string): Library {
  return { ...library, folders: library.folders.map(f => (f.id === id ? { ...f, name } : f)) };
}

/** The index without the folder `id` and the arrangements in it, their clips removed from storage. */
export function dropFolder(library: Library, id: string): Library {
  const inside = library.items.filter(i => i.folder === id).map(i => i.id);
  return { ...dropArrangements(library, inside), folders: library.folders.filter(f => f.id !== id) };
}

/** The open clip while it isn't saved as it is: unsaved changes, or never saved. */
export const DRAFT_KEY = 'frets.tab.draft';

/** The open clip as it was left, and the clip it is a change of. */
export interface Draft {
  id: string;
  clip: Clip;
  /** As last saved or opened: the saved arrangement's clip when `id` is saved, else kept with the draft. */
  base: Clip;
}

/** What the draft key holds: the base only for an arrangement not saved (a saved one's is in its own key). */
interface StoredDraft {
  id: string;
  clip: unknown;
  base?: unknown;
}

/**
 * The draft as it was left, its base read from the saved arrangement when there is one; null when
 * there is none or it can't be read. A clip that is its base again is that very clip, so nothing shows
 * as unsaved.
 */
export function loadDraft(library: Library): Draft | null {
  const stored = loadJson(DRAFT_KEY) as StoredDraft | null;
  if (typeof stored !== 'object' || stored === null || typeof stored.id !== 'string' || stored.id === '') return null;
  const clip = parseClip(stored.clip);
  if (!clip) return null;
  const saved = library.items.some(i => i.id === stored.id) ? loadArrangement(stored.id) : null;
  const base = saved ?? parseClip(stored.base) ?? emptyClip();
  return { id: stored.id, clip: JSON.stringify(clip) === JSON.stringify(base) ? base : clip, base };
}

/** Keeps the open clip as a draft; `saved` when its arrangement is saved, whose clip is then its base. */
export function saveDraft(draft: Draft, saved: boolean): void {
  const stored: StoredDraft = saved ? { id: draft.id, clip: draft.clip } : { id: draft.id, clip: draft.clip, base: draft.base };
  saveJson(DRAFT_KEY, stored);
}

export function clearDraft(): void {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Storage blocked: there is no draft.
  }
}

/** The open arrangement's clip on load: the one the index names, else a new empty clip. */
export function openOnLoad(library: Library): { id: string; clip: Clip } {
  const clip = library.open ? loadArrangement(library.open) : null;
  if (library.open && clip) return { id: library.open, clip };
  return { id: newArrangementId(), clip: titled(emptyClip()) };
}

/** The index as a small store the page subscribes to (`useSyncExternalStore`). */
export function libraryStore() {
  let library = loadLibrary();
  const listeners = new Set<() => void>();
  return {
    get: () => library,
    set: (next: Library) => {
      library = next;
      saveLibrary(library);
      listeners.forEach(l => l());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
