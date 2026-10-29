/**
 * My arrangements (issue #187): the clips kept in the browser, at the top level or in a folder (one
 * level, no folders in folders). The open one is saved as it is edited; the rest wait in the list.
 * An index under `LIBRARY_KEY` lists the folders and the arrangements (name, folder, last change)
 * and names the open one; each clip has a key of its own, so an edit writes only its own clip.
 */
import { emptyClip, parseClip, type Clip } from './clip';
import { isEmpty } from './editing';
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

/** A clip with nothing in it, not even a title, isn't added to the list. */
export function worthKeeping(clip: Clip): boolean {
  return !isEmpty(clip) || clip.name.trim() !== '';
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

/** The open arrangement's clip on load: the one the index names, else a new empty clip. */
export function openOnLoad(library: Library): { id: string; clip: Clip } {
  const clip = library.open ? loadArrangement(library.open) : null;
  if (library.open && clip) return { id: library.open, clip };
  return { id: newArrangementId(), clip: emptyClip() };
}

/**
 * The index as a small store the page subscribes to (`useSyncExternalStore`): saving the open
 * arrangement as it is edited writes here from an effect, as to any storage outside React.
 */
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
