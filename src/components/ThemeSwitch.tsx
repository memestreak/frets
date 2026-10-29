'use client';

import { useSyncExternalStore, type ComponentType } from 'react';
import { MoonIcon, SunIcon, ThemeAutoIcon } from './icons';
import { savePreference } from '@/lib/storage';
import {
  APPEARANCE_KEY, applyTheme, currentTheme, type ThemeChoice,
} from '@/lib/theme';

const NAMES: Record<ThemeChoice, string> = { auto: 'Auto', light: 'Light', dark: 'Dark' };
const NEXT: Record<ThemeChoice, ThemeChoice> = { auto: 'light', light: 'dark', dark: 'auto' };
const ICONS: Record<ThemeChoice, ComponentType> = {
  auto: ThemeAutoIcon, light: SunIcon, dark: MoonIcon,
};

// The document is the store: the boot script sets the saved choice before
// hydration, and every change goes through `chooseTheme` (this button, or
// Settings › General › Appearance), which notifies here.
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

/** Applies and saves a theme (General › Appearance › Theme). */
export function chooseTheme(choice: ThemeChoice) {
  applyTheme(choice);
  savePreference(APPEARANCE_KEY, { theme: choice });
  listeners.forEach(fn => fn());
}

/** The theme applied now, kept up to date. */
export const useTheme = () => useSyncExternalStore(subscribe, currentTheme, () => 'auto' as const);

/** One icon button that cycles Auto, Light, Dark; saved per viewer. */
export function ThemeSwitch() {
  const theme = useTheme();
  const Icon = ICONS[theme];
  return (
    <button
      type="button"
      className="btn btn-icon text-(--ink-muted) hover:bg-(--surface-sunken) hover:text-(--ink)"
      aria-label={`Theme: ${NAMES[theme]}`}
      title={`Theme: ${NAMES[theme]}. Click for ${NAMES[NEXT[theme]]}.`}
      onClick={() => chooseTheme(NEXT[theme])}
    >
      <Icon />
    </button>
  );
}
