/**
 * The keyboard shortcuts overlay's list (issue #180): what a page's keys are, and how a key is shown.
 * Pure; no React. A page hands its groups to `useShortcuts` (`src/components/shortcuts/`), and `?`
 * shows them.
 */

/** One shortcut: the keys that do it (alternatives, any one works) and what it does. */
export interface Shortcut {
  /**
   * Each a key or a combination joined with `+`, as `Mod+Shift+Z`. `Mod` is ⌘ on a Mac and Ctrl
   * elsewhere; `Ctrl` is Ctrl everywhere.
   */
  keys: string[];
  does: string;
}

/** Shortcuts that act in the same place (the tab, the staff, the page). */
export interface ShortcutGroup {
  title: string;
  shortcuts: Shortcut[];
}

/** The keys every page has. */
export const EVERYWHERE: ShortcutGroup = {
  title: 'Everywhere',
  shortcuts: [
    { keys: ['?'], does: 'Show or hide this list' },
    { keys: ['Esc'], does: 'Close a dialog, menu or this list' },
  ],
};

const MAC_NAMES: Record<string, string> = { Mod: '⌘', Shift: '⇧', Alt: '⌥', Ctrl: '⌃', Enter: '↩' };
const OTHER_NAMES: Record<string, string> = { Mod: 'Ctrl' };
const ARROWS: Record<string, string> = { Up: '↑', Down: '↓', Left: '←', Right: '→' };

/**
 * A combination's keys as drawn, one per key cap: `Mod+Shift+Z` is ⌘ ⇧ Z on a Mac and Ctrl Shift Z
 * elsewhere. A `+` with a space beside it is the key itself, not a join (`+ −`).
 */
export function keyCaps(combo: string, mac: boolean): string[] {
  const names = mac ? MAC_NAMES : OTHER_NAMES;
  return combo.split(/(?<=[^\s+])\+(?=\S)/).map(key => ARROWS[key] ?? names[key] ?? key);
}

/** Whether this browser is on a Mac (or an iPad, with a keyboard), where Mod is ⌘. */
export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
}

/** A key press is `?` meant for the page: not typed into a field, and with no Ctrl, ⌘ or Alt held. */
export function isHelpKey(e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'target' | 'defaultPrevented'>): boolean {
  if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return false;
  const target = e.target as HTMLElement | null;
  if (target?.isContentEditable) return false;
  return !target?.closest?.('input, select, textarea');
}
