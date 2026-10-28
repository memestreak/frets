'use client';

/** What the bar panels over the tab (the time and key signature panels) share. */
import { useEffect, useLayoutEffect, type RefObject } from 'react';

/** Keeps a panel over the tab from running past its right edge: it moves left as far as it must. */
export function usePanelInside(boxRef: RefObject<HTMLDivElement | null>, x: number) {
  useLayoutEffect(() => {
    const box = boxRef.current;
    const room = box?.parentElement?.clientWidth;
    if (!box || !room) return;
    box.style.left = `${Math.max(0, Math.min(x, room - box.offsetWidth))}px`;
  });
}

/** Closes a panel on a press outside it, or on Esc (`byKey`, so the keys go back to the tab). */
export function usePanelClose(boxRef: RefObject<HTMLDivElement | null>, onClose: (byKey: boolean) => void) {
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) onClose(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(true);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [boxRef, onClose]);
}
