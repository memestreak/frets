import { useEffect, useRef, useState, type ReactNode } from 'react';

/** How long the mouse rests on something before its tip shows. */
export const TIP_DELAY_MS = 1000;
/** Room kept between the tip and the window's edges. */
const MARGIN = 8;

interface Tip {
  text: string;
  /** Where the tip's top-left corner goes, in window coordinates. */
  x: number;
  y: number;
}

/**
 * Anything inside with a `data-tip` explains itself: resting the mouse on
 * it for a second shows the tip by the pointer, and reaching it with the
 * keyboard shows it under it at once. A press hides it. Touch screens get
 * no tips.
 */
export function HoverTips({ children }: { children: ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    let timer: number | undefined;
    // The element whose tip is pending or showing, so moving within it does nothing.
    let current: Element | null = null;
    const tipOf = (target: EventTarget | null) =>
      (target instanceof Element ? target.closest('[data-tip]') : null);

    const hide = () => {
      window.clearTimeout(timer);
      current = null;
      setTip(null);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const el = tipOf(e.target);
      if (el === current) return;
      hide();
      const text = el?.getAttribute('data-tip');
      if (!el || !text) return;
      current = el;
      const { clientX: x, clientY: y } = e;
      timer = window.setTimeout(() => setTip({ text, x: x + 14, y: y + 18 }), TIP_DELAY_MS);
    };
    const onFocus = (e: FocusEvent) => {
      const el = tipOf(e.target);
      const text = el?.getAttribute('data-tip');
      if (!el || !text || !(e.target as Element).matches(':focus-visible')) return hide();
      current = el;
      const r = el.getBoundingClientRect();
      setTip({ text, x: r.left, y: r.bottom + 6 });
    };

    box.addEventListener('pointermove', onMove);
    box.addEventListener('pointerleave', hide);
    box.addEventListener('pointerdown', hide);
    box.addEventListener('focusin', onFocus);
    box.addEventListener('focusout', hide);
    window.addEventListener('scroll', hide, true);
    return () => {
      window.clearTimeout(timer);
      box.removeEventListener('pointermove', onMove);
      box.removeEventListener('pointerleave', hide);
      box.removeEventListener('pointerdown', hide);
      box.removeEventListener('focusin', onFocus);
      box.removeEventListener('focusout', hide);
      window.removeEventListener('scroll', hide, true);
    };
  }, []);

  // Keep the tip inside the window once its size is known; above the
  // pointer when there is no room below.
  useEffect(() => {
    const el = tipRef.current;
    if (!el || !tip) return;
    const r = el.getBoundingClientRect();
    const left = Math.max(MARGIN, Math.min(tip.x, window.innerWidth - r.width - MARGIN));
    const top = tip.y + r.height > window.innerHeight - MARGIN ? tip.y - r.height - 28 : tip.y;
    el.style.left = `${left}px`;
    el.style.top = `${Math.max(MARGIN, top)}px`;
  }, [tip]);

  return (
    <div ref={boxRef}>
      {children}
      {tip && (
        <div ref={tipRef} className="cof-tip" role="tooltip" style={{ left: tip.x, top: tip.y }}>
          {tip.text}
        </div>
      )}
    </div>
  );
}
