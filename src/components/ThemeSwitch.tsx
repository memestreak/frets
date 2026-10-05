'use client';

import { useSyncExternalStore, type ComponentType } from 'react';
import { MoonIcon, SunIcon, ThemeAutoIcon } from './icons';
import { saveJson } from '@/lib/storage';
import {
  applyTheme, currentTheme, THEME_KEY, type ThemeChoice,
} from '@/lib/theme';

const NAMES: Record<ThemeChoice, string> = { auto: 'Auto', light: 'Light', dark: 'Dark' };
const NEXT: Record<ThemeChoice, ThemeChoice> = { auto: 'light', light: 'dark', dark: 'auto' };
const ICONS: Record<ThemeChoice, ComponentType> = {
  auto: ThemeAutoIcon, light: SunIcon, dark: MoonIcon,
};

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

/** One icon button that cycles Auto, Light, Dark; saved per viewer. */
export function ThemeSwitch() {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => 'auto' as const);
  const Icon = ICONS[theme];
  return (
    <button
      type="button"
      className="btn btn-icon text-(--ink-muted) hover:bg-(--surface-sunken) hover:text-(--ink)"
      aria-label={`Theme: ${NAMES[theme]}`}
      title={`Theme: ${NAMES[theme]}. Click for ${NAMES[NEXT[theme]]}.`}
      onClick={() => choose(NEXT[theme])}
    >
      <Icon />
    </button>
  );
}
