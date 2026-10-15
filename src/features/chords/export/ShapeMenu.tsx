'use client';

import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';

export interface MenuItem {
  label: string;
  onSelect: () => void;
}

interface ShapeMenuProps {
  /** Where it opens, in viewport pixels: its top-left corner, kept on screen. */
  x: number;
  y: number;
  label: string;
  items: MenuItem[];
  /**
   * Esc, Tab or an item chosen (`refocus`: focus goes back where the menu
   * came from), or a press outside, a scroll or a resize.
   */
  onClose: (refocus: boolean) => void;
}

/**
 * A small context menu, fixed at a point. It takes focus on its first item;
 * ↑ ↓ (and Home, End) move between items. Arrow keys go no further, so the
 * page's ← → don't step the shape behind it.
 */
export function ShapeMenu({ x, y, label, items, onClose }: ShapeMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // Keep the whole menu on screen, flipping above or left of the point if it must.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const margin = 8;
    setPos({
      left: x + width + margin > window.innerWidth ? Math.max(margin, x - width) : x,
      top: y + height + margin > window.innerHeight ? Math.max(margin, y - height) : y,
    });
    el.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [x, y]);

  const close = useEffectEvent(onClose);
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close(false);
    };
    const dismiss = () => close(false);
    // A scroll event can arrive late, from a scroll that ended before the
    // menu opened; only one that moves the page (or the shapes) closes it.
    const { scrollX, scrollY } = window;
    const onScroll = (e: Event) => {
      if (e.target !== document || window.scrollX !== scrollX || window.scrollY !== scrollY) dismiss();
    };
    window.addEventListener('pointerdown', onPointerDown, { capture: true });
    window.addEventListener('scroll', onScroll, { capture: true });
    window.addEventListener('resize', dismiss);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, { capture: true });
      window.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('resize', dismiss);
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const buttons = [...ref.current!.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    const at = buttons.indexOf(document.activeElement as HTMLElement);
    const focus = (i: number) => buttons[(i + buttons.length) % buttons.length]?.focus();
    switch (e.key) {
      case 'ArrowDown': focus(at + 1); break;
      case 'ArrowUp': focus(at - 1); break;
      case 'Home': focus(0); break;
      case 'End': focus(-1); break;
      case 'ArrowLeft': case 'ArrowRight': break;
      case 'Escape': case 'Tab': onClose(true); break;
      default: return;
    }
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      ref={ref} role="menu" aria-label={label} className="shape-menu"
      style={pos} onKeyDown={onKeyDown}
      onContextMenu={e => e.preventDefault()}
      tabIndex={-1}
    >
      {items.map(item => (
        <button
          key={item.label} type="button" role="menuitem" className="shape-menu-item"
          tabIndex={-1}
          onClick={() => {
            onClose(true);
            item.onSelect();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
