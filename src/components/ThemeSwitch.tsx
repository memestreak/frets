'use client';

import { useLayoutEffect, useSyncExternalStore, type ComponentType } from 'react';
import { MoonIcon, SunIcon, ThemeAutoIcon } from './icons';
import { loadJson, savePreference } from '@/lib/storage';
import {
  APPEARANCE_KEY, DEFAULT_THEME, applyTheme, currentTheme, parseAppearance, type ThemeChoice,
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
export const useTheme = () => useSyncExternalStore(subscribe, currentTheme, () => DEFAULT_THEME);

/**
 * Applies the saved theme again once React has the page. A hydration error
 * makes React draw the whole document afresh, which drops the boot script's
 * `data-theme` and status bar metas; until those errors are gone, a saved
 * Dark would otherwise turn Light on those pages. Before paint, so no flash.
 */
function useReapplySavedTheme() {
  useLayoutEffect(() => {
    applyTheme(parseAppearance(loadJson(APPEARANCE_KEY)).theme);
    listeners.forEach(fn => fn());
  }, []);
}

/** One icon button that cycles Auto, Light, Dark; saved per viewer. */
export function ThemeSwitch() {
  useReapplySavedTheme();
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
