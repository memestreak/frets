import { useEffect } from 'react';

/**
 * No widget stays active after it's used with the mouse or a finger (Jeremy, 2026-10-30): a
 * button, link or list pressed lets go of the focus once it has done its work, so it shows no focus
 * outline and the page's own keys (Space to play, the arrows) work again rather than going to it.
 *
 * - A button or link let go after a press (a click with a `detail` of 1 or more). A press from the
 *   keyboard (Enter or Space, `detail` 0) keeps the focus, so a keyboard user keeps their place.
 * - A list (`<select>`) let go once a choice is made in it, when it was opened by a press. Tabbed to
 *   and stepped with the arrows, it keeps the focus, so each arrow doesn't drop it. Opened by a press
 *   and closed with no choice (Esc, or a click off it, which the open list swallows), it lets go at
 *   the mouse's next move over the page (#270).
 * - A control that keeps the focus where it was when pressed (a knob, a drag number) calls
 *   `letGoOfFields` first, so a field typed in or a list doesn't stay active under it (#270).
 * - A button that opened a dialog with a press is let go again when the dialog closes (by ×, Esc or
 *   its own buttons), as the browser hands the focus back to it. Opened from the keyboard, it keeps it.
 *
 * Left alone: anything in a dialog or menu (they keep the focus inside them), radio groups (their
 * arrow keys move from the pressed tile) and anything under `[data-keep-focus]`. A handler that
 * moved the focus on (say, into the popover a button opened) keeps it there.
 */
export function useLetGoAfterUse() {
  useEffect(() => {
    // The list last pressed, so a choice made with the arrows in a list tabbed to keeps the focus.
    let pressedList: HTMLSelectElement | null = null;
    // The widget last pressed (not clicked from the keyboard), which a closing dialog hands the focus back to.
    let pressedWidget: HTMLElement | null = null;
    // When the list last pressed was pressed: a move just after the press may come before it opens.
    let pressedAt = 0;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      const list = target?.closest?.('select');
      pressedList = list instanceof HTMLSelectElement ? list : null;
      pressedAt = performance.now();
    };
    // An open list takes the mouse to itself, so a move over the page means it has closed.
    const onPointerMove = (e: PointerEvent) => {
      const list = pressedList;
      if (!list || e.pointerType !== 'mouse' || performance.now() - pressedAt < 300) return;
      if (list.contains(e.target as Node)) return;
      pressedList = null;
      if (document.activeElement === list && !keepsFocus(list)) list.blur();
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
      const widget = (e.target as Element | null)?.closest?.('button, a[href], [role="button"]');
      if (e.detail === 0) {
        if (widget) pressedWidget = null;
        return;
      }
      if (!(widget instanceof HTMLElement) || keepsFocus(widget)) return;
      pressedWidget = widget;
      // After the click's own handlers and what they drew, which may have moved the focus on.
      window.setTimeout(() => {
        if (document.activeElement === widget) widget.blur();
      }, 0);
    };
    document.addEventListener('pointerdown', onPointerDown, { capture: true });
    document.addEventListener('pointermove', onPointerMove, { capture: true });
    document.addEventListener('keydown', onKeyDown, { capture: true });
    document.addEventListener('change', onChange);
    const onDialogClose = () => {
      const widget = pressedWidget;
      if (!widget) return;
      // After the browser (or the page) has given the focus back.
      window.setTimeout(() => {
        if (document.activeElement === widget) widget.blur();
      }, 0);
    };
    document.addEventListener('click', onClick, { capture: true });
    // A dialog's close doesn't bubble, so it is heard on the way down.
    document.addEventListener('close', onDialogClose, { capture: true });
    return () => {
      document.removeEventListener('close', onDialogClose, { capture: true });
      document.removeEventListener('pointerdown', onPointerDown, { capture: true });
      document.removeEventListener('pointermove', onPointerMove, { capture: true });
      document.removeEventListener('keydown', onKeyDown, { capture: true });
      document.removeEventListener('change', onChange);
      document.removeEventListener('click', onClick, { capture: true });
    };
  }, []);
}

/**
 * For a control that keeps the focus off itself when pressed (its press's default is prevented): the
 * field being typed in or the list that has the focus lets go of it, as a press anywhere else would
 * make it (#270). The field `within` (a number field's own steps) keeps it. Nothing else is touched,
 * so the Tab editor keeps its keys.
 */
export function letGoOfFields(within?: Element | null) {
  const active = document.activeElement;
  if (!(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement)) return;
  if (keepsFocus(active) || within?.contains(active)) return;
  active.blur();
}

/** Where a widget keeps the focus after use. */
const KEEPS_FOCUS = 'dialog, [role="dialog"], [role="menu"], [role="radiogroup"], [role="radio"], [data-keep-focus]';

function keepsFocus(el: Element) {
  return el.closest(KEEPS_FOCUS) !== null;
}
