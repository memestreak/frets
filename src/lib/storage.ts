/** Read JSON from localStorage; null when missing, unparsable or unavailable. */
export function loadJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Writes JSON to localStorage; false when storage is full or blocked (private mode), and nothing was kept. */
export function saveJson(key: string, value: unknown): boolean {
  return write(key, value) === null;
}

/** Writes JSON; the reason it couldn't, or null when it was kept. */
function write(key: string, value: unknown): string | null {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return null;
  } catch (e) {
    return e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')
      ? 'storage is full' : 'storage is blocked';
  }
}

/*
 * Preferences (the settings philosophy): a failed save never breaks the page, but is reported
 * once, quietly, by a red ⚠ after the Settings gear, until a save works again.
 */

let saveProblem: string | null = null;
const listeners = new Set<() => void>();

/** Saves a preference; false when it couldn't be, and the ⚠ shows why. */
export function savePreference(key: string, value: unknown): boolean {
  const problem = write(key, value);
  if (problem !== saveProblem) {
    saveProblem = problem;
    listeners.forEach(fn => fn());
  }
  return problem === null;
}

/** Why the last preference couldn't be saved, or null when it was. */
export const preferenceSaveProblem = (): string | null => saveProblem;

export function subscribePreferenceSaves(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
