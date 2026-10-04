'use client';

import { useSyncExternalStore } from 'react';
import { Segmented } from './controls';
import { saveJson } from '@/lib/storage';
import {
  applyTheme, currentTheme, THEME_KEY, type ThemeChoice,
} from '@/lib/theme';

const OPTIONS = [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']] as const;

// The document is the store: the boot script sets the saved choice before
// hydration, and every change goes through `choose`, which notifies here.
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

function choose(choice: ThemeChoice) {
  applyTheme(choice);
  saveJson(THEME_KEY, choice);
  listeners.forEach(fn => fn());
}

/** Auto / Light / Dark, saved per viewer. */
export function ThemeSwitch() {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => 'auto' as const);
  return (
    <Segmented<ThemeChoice>
      label="Theme" options={OPTIONS} value={theme} onChange={choose}
    />
  );
}
