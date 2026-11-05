'use client';

import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';

export interface MenuItem {
  label: string;
  onSelect: () => void;
  /** A setting the item turns on and off: shown ticked when on (a `menuitemcheckbox`). */
  checked?: boolean;
  /** Shown but not chosen (`aria-disabled`): it can still take the focus, so the keys find it and its hint. */
  disabled?: boolean;
  /** A tooltip: why a disabled item can't be chosen. */
  hint?: string;
  /** A submenu (its label ends in ›): opened by a press, a hover or →, closed by ← or Esc. Its own `onSelect` is not used. */
  items?: MenuItem[];
}

/** The items a menu's ↑ ↓ move between: its own, not an open submenu's. */
const OWN_ITEMS = ':scope > [role^="menuitem"], :scope > .shape-menu-sub > [role^="menuitem"]';

interface ShapeMenuProps {
  /** Where it opens, in viewport pixels: its top-left corner, kept on screen. */
  x: number;
  y: number;
  label: string;
  items: MenuItem[];
  /** 'end': the menu's right edge goes at x (a menu opened from a button at the right of something). */
  align?: 'start' | 'end';
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
export function ShapeMenu({ x, y, label, items, onClose, align = 'start' }: ShapeMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  /** The open submenu's label, and whether its first item takes the focus (opened from the keys or a press). */
  const [sub, setSub] = useState<{ label: string; focus: boolean } | null>(null);
  const subRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (sub?.focus) subRef.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus();
  }, [sub]);

  // Keep the whole menu on screen, flipping above or left of the point if it must.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const margin = 8;
    setPos({
      left: align === 'end' || x + width + margin > window.innerWidth ? Math.max(margin, x - width) : x,
      top: y + height + margin > window.innerHeight ? Math.max(margin, y - height) : y,
    });
    el.querySelector<HTMLElement>('[role^="menuitem"]')?.focus();
  }, [x, y, align]);

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
    const buttons = [...ref.current!.querySelectorAll<HTMLElement>(OWN_ITEMS)];
    const at = buttons.indexOf(document.activeElement as HTMLElement);
    const focus = (i: number) => {
      setSub(null);
      buttons[(i + buttons.length) % buttons.length]?.focus();
    };
    const opens = buttons[at]?.getAttribute('aria-haspopup') === 'menu' ? buttons[at].dataset.label : undefined;
    switch (e.key) {
      case 'ArrowDown': focus(at + 1); break;
      case 'ArrowUp': focus(at - 1); break;
      case 'Home': focus(0); break;
      case 'End': focus(-1); break;
      case 'ArrowRight': if (opens) setSub({ label: opens, focus: true }); break;
      case 'ArrowLeft': break;
      case 'Escape': case 'Tab': onClose(true); break;
      default: return;
    }
    e.preventDefault();
    e.stopPropagation();
  };

  /** The keys in an open submenu: ↑ ↓ between its items, ← or Esc back to the item that opened it. */
  const onSubKeyDown = (e: React.KeyboardEvent) => {
    const buttons = [...subRef.current!.querySelectorAll<HTMLElement>('[role^="menuitem"]')];
    const at = buttons.indexOf(document.activeElement as HTMLElement);
    const focus = (i: number) => buttons[(i + buttons.length) % buttons.length]?.focus();
    const back = () => {
      const label = sub?.label;
      setSub(null);
      [...ref.current!.querySelectorAll<HTMLElement>(OWN_ITEMS)].find(b => b.dataset.label === label)?.focus();
    };
    switch (e.key) {
      case 'ArrowDown': focus(at + 1); break;
      case 'ArrowUp': focus(at - 1); break;
      case 'Home': focus(0); break;
      case 'End': focus(-1); break;
      case 'ArrowLeft': case 'Escape': back(); break;
      case 'ArrowRight': break;
      case 'Tab': onClose(true); break;
      default: return;
    }
    e.preventDefault();
    e.stopPropagation();
  };

  /** A menu item, which closes the menu and does its thing. A hover lights it alone, as the keys would; on the top menu it shuts a submenu. */
  const choice = (item: MenuItem, checks: boolean, top = false) => (
    <button
      key={item.label} type="button" className="shape-menu-item"
      role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'} aria-checked={item.checked}
      tabIndex={-1} aria-disabled={item.disabled || undefined} title={item.hint}
      onMouseEnter={e => {
        if (top) setSub(null);
        e.currentTarget.focus();
      }}
      onClick={() => {
        if (item.disabled) return;
        onClose(true);
        item.onSelect();
      }}
    >
      {/* A menu with a setting in it keeps a column for the tick, so every label lines up. */}
      {checks && <span className="shape-menu-check" aria-hidden="true">{item.checked ? '✓' : ''}</span>}
      {item.label}
    </button>
  );

  const checks = items.some(item => item.checked !== undefined);
  return (
    <div
      ref={ref} role="menu" aria-label={label} className="shape-menu"
      style={pos} onKeyDown={onKeyDown}
      onContextMenu={e => e.preventDefault()}
      tabIndex={-1}
    >
      {items.map(item => item.items ? (
        // A hover over the item or its submenu keeps the submenu open; the keys open it from the item.
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- the hover only shows what the item's press shows too.
        <div
          key={item.label} className="shape-menu-sub"
          onMouseEnter={() => setSub(s => (s?.label === item.label ? s : { label: item.label, focus: false }))}
          onMouseLeave={() => setSub(s => (s?.label === item.label && !s.focus ? null : s))}
        >
          <button
            type="button" className="shape-menu-item" role="menuitem" aria-haspopup="menu" aria-expanded={sub?.label === item.label}
            data-label={item.label} tabIndex={-1} onClick={() => setSub({ label: item.label, focus: true })}
            onMouseEnter={e => e.currentTarget.focus()}
          >
            {checks && <span className="shape-menu-check" aria-hidden="true" />}
            {item.label}
            <span className="shape-menu-more" aria-hidden="true">›</span>
          </button>
          {sub?.label === item.label && (
            <div ref={subRef} role="menu" aria-label={item.label} className="shape-menu shape-menu-nested" tabIndex={-1} onKeyDown={onSubKeyDown}>
              {item.items.map(child => choice(child, item.items!.some(c => c.checked !== undefined)))}
            </div>
          )}
        </div>
      ) : choice(item, checks, true))}
    </div>
  );
}
