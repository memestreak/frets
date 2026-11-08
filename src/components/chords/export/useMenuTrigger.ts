'use client';

import { useEffect, useRef } from 'react';

/** A touch held this long opens the menu (iPhone Safari sends no contextmenu). */
const LONG_PRESS_MS = 500;
/** A touch that moves further than this is a scroll, not a long press. */
const LONG_PRESS_SLOP = 10;

/** Props for anything that opens a context menu: right-click, Shift+F10 or a long press. */
export interface MenuTriggerProps<T extends Element = HTMLElement> {
  onContextMenu: (e: React.MouseEvent<T>) => void;
  onPointerDown: (e: React.PointerEvent<T>) => void;
  onPointerMove: (e: React.PointerEvent<T>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onClickCapture: (e: React.MouseEvent<T>) => void;
}

/**
 * Where a menu opens: at the pointer, or under the trigger when the pointer
 * isn't over it (Shift+F10 or the menu key give no pointer).
 */
export function menuSpot(trigger: Element, x: number, y: number): { x: number; y: number } {
  const r = trigger.getBoundingClientRect();
  const inside = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  return inside ? { x, y } : { x: r.left, y: r.bottom + 4 };
}

/**
 * Opens a menu on right-click, Shift+F10 or a long press. `props(open)`
 * gives an element the handlers; `open` gets the element and the point.
 * The click that ends a long press is swallowed, so it presses nothing.
 * `cancel` stops a pending long press (a drag starting, say). `T` is the trigger's element: HTML by
 * default, or an SVG group.
 */
export function useMenuTrigger<T extends Element = HTMLElement>(): {
  props: (open: (trigger: T, x: number, y: number) => void) => MenuTriggerProps<T>;
  cancel: () => void;
} {
  const press = useRef<{ timer: number; x: number; y: number } | null>(null);
  /** A long press just opened the menu, so the click that ends it is swallowed. */
  const swallowClick = useRef(false);

  const cancel = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  };
  useEffect(() => cancel, []);

  const props = (open: (trigger: T, x: number, y: number) => void): MenuTriggerProps<T> => ({
    onContextMenu: e => {
      e.preventDefault();
      cancel();
      open(e.currentTarget, e.clientX, e.clientY);
    },
    onPointerDown: e => {
      if (e.pointerType !== 'touch') return;
      const trigger = e.currentTarget;
      const { clientX: x, clientY: y } = e;
      cancel();
      press.current = {
        x, y,
        timer: window.setTimeout(() => {
          press.current = null;
          // As a right-click there: the handler drawn last opens the menu, so it sees what the press itself
          // changed (the Tab page's press picks a mark, whose menu then opens).
          trigger.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
          swallowClick.current = true;
        }, LONG_PRESS_MS),
      };
    },
    onPointerMove: e => {
      const p = press.current;
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > LONG_PRESS_SLOP) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onClickCapture: e => {
      if (!swallowClick.current) return;
      swallowClick.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  });

  return { props, cancel };
}
