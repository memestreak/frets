'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { preferenceSaveProblem, savePreference, subscribePreferenceSaves } from '@/lib/storage';

/** Writes the preference `value` to localStorage under `key` whenever it changes. */
export function usePersist(key: string, value: unknown) {
  useEffect(() => {
    savePreference(key, value);
  }, [key, value]);
}

/** Why the last preference couldn't be saved ("storage is full"), or null while saves work. */
export function usePreferenceSaveProblem(): string | null {
  return useSyncExternalStore(subscribePreferenceSaves, preferenceSaveProblem, () => null);
}
