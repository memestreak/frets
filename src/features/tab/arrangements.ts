/**
 * My arrangements (issue #187): the clips kept in the browser. The open one is saved as it is
 * edited; the rest wait in the list. An index under `LIBRARY_KEY` lists them (name, last change)
 * and names the open one; each clip has a key of its own, so an edit writes only its own clip.
 */
import { emptyClip, parseClip, type Clip } from './clip';
import { isEmpty } from './editing';
import { loadJson, saveJson } from '@/lib/storage';

/** The index: which arrangement is open, and every kept one. */
export const LIBRARY_KEY = 'frets.tab.arrangements';
/** One arrangement's clip. */
export const arrangementKey = (id: string) => `frets.tab.arrangement.${id}`;

export interface ArrangementInfo {
  id: string;
  /** The clip's title, kept here so the list shows it without reading every clip. */
  name: string;
  /** When it last changed, in ms since 1970. */
  changed: number;
}

export interface Library {
  /** The open arrangement; it may not be in `items` yet (a new clip with nothing in it). */
  open: string | null;
  /** Latest change first. */
  items: ArrangementInfo[];
}

export const EMPTY_LIBRARY: Library = { open: null, items: [] };

export function parseLibrary(v: unknown): Library {
  if (typeof v !== 'object' || v === null) return EMPTY_LIBRARY;
  const { open, items } = v as Record<string, unknown>;
  if (!Array.isArray(items)) return EMPTY_LIBRARY;
  return {
    open: typeof open === 'string' ? open : null,
    items: items.filter(isInfo),
  };
}

function isInfo(v: unknown): v is ArrangementInfo {
  if (typeof v !== 'object' || v === null) return false;
  const { id, name, changed } = v as Record<string, unknown>;
  return typeof id === 'string' && id !== '' && typeof name === 'string' && typeof changed === 'number' && Number.isFinite(changed);
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

export function newArrangementId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** A clip with nothing in it, not even a title, isn't added to the list. */
export function worthKeeping(clip: Clip): boolean {
  return !isEmpty(clip) || clip.name.trim() !== '';
}

/** `clip` written under `id`, and the index with it, changed at `changed`, latest change first. */
export function storeArrangement(library: Library, id: string, clip: Clip, changed: number): Library {
  saveJson(arrangementKey(id), clip);
  const info: ArrangementInfo = { id, name: clip.name, changed };
  const items = [info, ...library.items.filter(i => i.id !== id)].sort((a, b) => b.changed - a.changed);
  return { ...library, items };
}

/** The index without `id`, its clip removed from storage. */
export function dropArrangement(library: Library, id: string): Library {
  try {
    window.localStorage.removeItem(arrangementKey(id));
  } catch {
    // Storage blocked: nothing was kept anyway.
  }
  return { ...library, items: library.items.filter(i => i.id !== id) };
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
