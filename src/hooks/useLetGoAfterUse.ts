import { useEffect } from 'react';

/**
 * No widget stays active after it's used with the mouse or a finger (Jeremy, 2026-10-30): a
 * button, link or list pressed lets go of the focus once it has done its work, so it shows no focus
 * outline and the page's own keys (Space to play, the arrows) work again rather than going to it.
 *
 * - A button or link let go after a press (a click with a `detail` of 1 or more). A press from the
 *   keyboard (Enter or Space, `detail` 0) keeps the focus, so a keyboard user keeps their place.
 * - A list (`<select>`) let go once a choice is made in it, when it was opened by a press. Tabbed to
 *   and stepped with the arrows, it keeps the focus, so each arrow doesn't drop it.
 *
 * Left alone: anything in a dialog or menu (they keep the focus inside them), radio groups (their
 * arrow keys move from the pressed tile) and anything under `[data-keep-focus]`. A handler that
 * moved the focus on (say, into the popover a button opened) keeps it there.
 */
export function useLetGoAfterUse() {
  useEffect(() => {
    // The list last pressed, so a choice made with the arrows in a list tabbed to keeps the focus.
    let pressedList: HTMLSelectElement | null = null;
    const onPointerDown = (e: PointerEvent) => {
      const list = (e.target as Element | null)?.closest?.('select');
      pressedList = list instanceof HTMLSelectElement ? list : null;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      // Tabbing into a list after a press elsewhere: its choices are the keyboard's now.
      if (e.key === 'Tab') pressedList = null;
    };
    const onChange = (e: Event) => {
      const list = e.target;
      if (!(list instanceof HTMLSelectElement) || list !== pressedList || keepsFocus(list)) return;
      if (document.activeElement === list) list.blur();
    };
    const onClick = (e: MouseEvent) => {
      if (e.detail === 0) return;
      const widget = (e.target as Element | null)?.closest?.('button, a[href], [role="button"]');
      if (!(widget instanceof HTMLElement) || keepsFocus(widget)) return;
      // After the click's own handlers and what they drew, which may have moved the focus on.
      window.setTimeout(() => {
        if (document.activeElement === widget) widget.blur();
      }, 0);
    };
    document.addEventListener('pointerdown', onPointerDown, { capture: true });
    document.addEventListener('keydown', onKeyDown, { capture: true });
    document.addEventListener('change', onChange);
    document.addEventListener('click', onClick, { capture: true });
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, { capture: true });
      document.removeEventListener('keydown', onKeyDown, { capture: true });
      document.removeEventListener('change', onChange);
      document.removeEventListener('click', onClick, { capture: true });
    };
  }, []);
}

/** Where a widget keeps the focus after use. */
const KEEPS_FOCUS = 'dialog, [role="dialog"], [role="menu"], [role="radiogroup"], [role="radio"], [data-keep-focus]';

function keepsFocus(el: Element) {
  return el.closest(KEEPS_FOCUS) !== null;
}
