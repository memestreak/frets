'use client';

import { useEffect, useSyncExternalStore } from 'react';
import type { ShortcutGroup } from '@/lib/shortcuts';

/** The page's groups, as its `useShortcuts` last gave them; empty on a page with none. */
let current: readonly ShortcutGroup[] = [];
const listeners = new Set<() => void>();

function set(groups: readonly ShortcutGroup[]) {
  current = groups;
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const NONE: readonly ShortcutGroup[] = [];

/**
 * Hands the page's shortcuts to the `?` overlay while the page is shown. Pass a constant (or a
 * memoised list): a new array each render re-registers it.
 */
export function useShortcuts(groups: readonly ShortcutGroup[]) {
  useEffect(() => {
    set(groups);
    return () => {
      if (current === groups) set(NONE);
    };
  }, [groups]);
}

/** The shortcuts of the page shown. */
export function usePageShortcuts(): readonly ShortcutGroup[] {
  return useSyncExternalStore(subscribe, () => current, () => NONE);
}

/** What the overlay does when a page's ? button asks for it. */
let showing: (() => void) | null = null;

/** Opens the shortcuts overlay, as `?` does: for a page's ? button. */
export function showShortcuts() {
  showing?.();
}

/** The overlay's own: `show` runs on `showShortcuts`, until the returned function stops it. */
export function onShowShortcuts(show: () => void) {
  showing = show;
  return () => {
    if (showing === show) showing = null;
  };
}
