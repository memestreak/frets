'use client';

import { useEffect, useRef } from 'react';

/** A touch held this long opens the menu (iPhone Safari sends no contextmenu). */
const LONG_PRESS_MS = 500;
/** A touch that moves further than this is a scroll, not a long press. */
const LONG_PRESS_SLOP = 10;

/** Props for anything that opens a context menu: right-click, Shift+F10 or a long press. */
export interface MenuTriggerProps {
  onContextMenu: (e: React.MouseEvent<HTMLElement>) => void;
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onClickCapture: (e: React.MouseEvent<HTMLElement>) => void;
}

/**
 * Where a menu opens: at the pointer, or under the trigger when the pointer
 * isn't over it (Shift+F10 or the menu key give no pointer).
 */
export function menuSpot(trigger: HTMLElement, x: number, y: number): { x: number; y: number } {
  const r = trigger.getBoundingClientRect();
  const inside = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  return inside ? { x, y } : { x: r.left, y: r.bottom + 4 };
}

/**
 * Opens a menu on right-click, Shift+F10 or a long press. `props(open)`
 * gives an element the handlers; `open` gets the element and the point.
 * The click that ends a long press is swallowed, so it presses nothing.
 * `cancel` stops a pending long press (a drag starting, say).
 */
export function useMenuTrigger(): {
  props: (open: (trigger: HTMLElement, x: number, y: number) => void) => MenuTriggerProps;
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

  const props = (open: (trigger: HTMLElement, x: number, y: number) => void): MenuTriggerProps => ({
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
          swallowClick.current = true;
          open(trigger, x, y);
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
