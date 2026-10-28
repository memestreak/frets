'use client';

/**
 * A small panel opened at a press or under a button (the playback options, the View options): kept
 * on screen, above the spot when there is no room under it, with its first control focused; a press
 * elsewhere, a scroll, a resize or Esc closes it.
 */
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';

export function usePopover({ x, y, align = 'start', focus, onClose }: {
  /** Where it opens, in viewport pixels: its left edge at x ('start') or its right edge ('end'), its top at y. */
  x: number;
  y: number;
  align?: 'start' | 'end';
  /** A selector for the control that takes the focus when it opens; without one, the panel itself takes it. */
  focus?: string;
  /** Closed: `pressedAway` when a press outside closed it, so a press on its own button can leave it closed. */
  onClose: (pressedAway: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const margin = 8;
    const left = align === 'end' ? x - width : x;
    setPos({
      left: Math.max(margin, Math.min(left, window.innerWidth - width - margin)),
      top: y + height + margin > window.innerHeight ? Math.max(margin, y - height) : y,
    });
    (focus ? el.querySelector<HTMLElement>(focus) : el)?.focus();
  }, [x, y, align, focus]);

  const close = useEffectEvent(onClose);
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close(true);
    };
    const { scrollX, scrollY } = window;
    const onScroll = () => {
      if (window.scrollX !== scrollX || window.scrollY !== scrollY) close(false);
    };
    const onResize = () => close(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    window.addEventListener('pointerdown', onPointerDown, { capture: true });
    window.addEventListener('scroll', onScroll, { capture: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, { capture: true });
      window.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return { ref, style: pos };
}
