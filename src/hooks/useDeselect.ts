import { useEffect, useEffectEvent } from 'react';

/**
 * What a press may land on and keep the selection: controls, so their tools still work on it, and menus
 * and dialogs. A page adds its own selectable things (the Tab page's drawing) to this list.
 */
export const KEEPS_SELECTION =
  'a, button, input, select, textarea, label, summary, dialog, [role="button"], [role="menu"], [role="dialog"], [role="slider"]';

const POPUPS = 'dialog, [role="dialog"], [role="menu"]';

interface DeselectOptions {
  /** What a press may land on and keep the selection. */
  keep?: string;
  /** Off where Esc lets a selection go a step at a time, by the page's own keys (the Tab editor). */
  escape?: boolean;
  /**
   * The selection is in a dialog (the Arrangements chooser): Esc there lets it go, and the dialog stays
   * open. Otherwise Esc in a dialog or menu is theirs, to close them, and the page's selection stays.
   */
  inDialog?: boolean;
}

/**
 * Esc, or a press anywhere but on `keep`, lets a selection go: the same on every page (Jeremy, 2026-11-01).
 * The press is caught as it starts (`pointerdown`, before what it lands on acts). Esc is left alone when
 * something else has taken it (a field giving up its text, a menu closing), and taken here once used.
 * While `active` is false (nothing selected) the hook does nothing.
 */
export function useDeselect(
  active: boolean,
  clear: () => void,
  { keep = KEEPS_SELECTION, escape = true, inDialog = false }: DeselectOptions = {},
) {
  const letGo = useEffectEvent(clear);
  useEffect(() => {
    if (!active) return;
    const onPress = (e: PointerEvent) => {
      if (e.target instanceof Element && e.target.closest(keep)) return;
      letGo();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (!inDialog && e.target instanceof Element && e.target.closest(POPUPS)) return;
      e.preventDefault();
      letGo();
    };
    document.addEventListener('pointerdown', onPress, true);
    if (escape) window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPress, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [active, keep, escape, inDialog]);
}
