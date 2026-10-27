'use client';

import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';

export interface MenuItem {
  label: string;
  /** What the item does; an item with `items` opens them instead. */
  onSelect?: () => void;
  /** A submenu, opened beside the item by hovering it, a click, → or Enter; ← or Esc closes it. */
  items?: MenuItem[];
}

/** A thin line between groups of items. */
export const DIVIDER = 'divider' as const;
/** A small caption over a group of items; not an item itself. */
export interface MenuHeading {
  heading: string;
}
export type MenuEntry = MenuItem | MenuHeading | typeof DIVIDER;

interface ShapeMenuProps {
  /** Where it opens, in viewport pixels: its top-left corner, kept on screen. */
  x: number;
  y: number;
  label: string;
  items: MenuEntry[];
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
  /** The item whose submenu is open, by its index in `items`. */
  const [openSub, setOpenSub] = useState<number | null>(null);

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
    const active = document.activeElement as HTMLElement;
    // The keys move among the items of the menu or submenu that has focus.
    const inSub = active.dataset.level === '1';
    const buttons = [...ref.current!.querySelectorAll<HTMLElement>(`[role="menuitem"][data-level="${inSub ? 1 : 0}"]`)];
    const at = buttons.indexOf(active);
    const focus = (i: number) => buttons[(i + buttons.length) % buttons.length]?.focus();
    const parent = () => ref.current!.querySelector<HTMLElement>(`[data-sub-index="${openSub}"]`);
    switch (e.key) {
      case 'ArrowDown': focus(at + 1); break;
      case 'ArrowUp': focus(at - 1); break;
      case 'Home': focus(0); break;
      case 'End': focus(-1); break;
      case 'ArrowRight':
        if (!inSub && active.dataset.subIndex) openSubmenu(Number(active.dataset.subIndex), true);
        break;
      case 'ArrowLeft':
        if (inSub) {
          parent()?.focus();
          setOpenSub(null);
        }
        break;
      case 'Escape':
        if (inSub) {
          parent()?.focus();
          setOpenSub(null);
        } else {
          onClose(true);
        }
        break;
      case 'Tab': onClose(true); break;
      default: return;
    }
    e.preventDefault();
    e.stopPropagation();
  };

  /** Opens item `index`'s submenu; from the keys, focus goes to its first item. */
  const openSubmenu = (index: number, focusFirst: boolean) => {
    setOpenSub(index);
    if (focusFirst) {
      requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>('[role="menuitem"][data-level="1"]')?.focus());
    }
  };

  const choose = (item: MenuItem) => {
    onClose(true);
    item.onSelect?.();
  };

  return (
    <div
      ref={ref} role="menu" aria-label={label} className="shape-menu"
      style={pos} onKeyDown={onKeyDown}
      onContextMenu={e => e.preventDefault()}
      tabIndex={-1}
    >
      {items.map((item, i) => {
        if (item === DIVIDER) return <div key={`divider-${i}`} role="separator" className="shape-menu-divider" />;
        if ('heading' in item) return <div key={`heading-${i}`} role="presentation" className="shape-menu-heading">{item.heading}</div>;
        if (!item.items) {
          return (
            <button
              key={item.label} type="button" role="menuitem" className="shape-menu-item" data-level="0"
              tabIndex={-1} onClick={() => choose(item)} onPointerEnter={() => setOpenSub(null)}
            >
              {item.label}
            </button>
          );
        }
        const open = openSub === i;
        return (
          <div key={item.label} className="shape-menu-parent">
            <button
              type="button" role="menuitem" className="shape-menu-item shape-menu-has-sub" data-level="0" data-sub-index={i}
              aria-haspopup="menu" aria-expanded={open} tabIndex={-1}
              onClick={() => openSubmenu(i, true)} onPointerEnter={() => openSubmenu(i, false)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openSubmenu(i, true);
                }
              }}
            >
              <span>{item.label}</span>
              <span aria-hidden="true">›</span>
            </button>
            {open && <Submenu label={item.label} items={item.items} onChoose={choose} />}
          </div>
        );
      })}
    </div>
  );
}

/** A submenu beside its item: to the right, or to the left where there is no room. */
function Submenu({ label, items, onChoose }: { label: string; items: MenuItem[]; onChoose: (item: MenuItem) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState(false);
  useLayoutEffect(() => {
    const r = ref.current?.getBoundingClientRect();
    if (r && r.right + 8 > window.innerWidth) setLeft(true);
  }, []);
  return (
    <div ref={ref} role="menu" aria-label={label} className={`shape-menu shape-submenu${left ? ' shape-submenu-left' : ''}`}>
      {items.map(item => (
        <button
          key={item.label} type="button" role="menuitem" className="shape-menu-item" data-level="1"
          tabIndex={-1} onClick={() => onChoose(item)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
