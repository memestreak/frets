'use client';

import { useEffect } from 'react';
import { saveJson } from '@/lib/storage';

/** Writes `value` to localStorage under `key` whenever it changes. */
export function usePersist(key: string, value: unknown) {
  useEffect(() => {
    saveJson(key, value);
  }, [key, value]);
}
