import { useEffect, useRef, useState, type ReactNode } from 'react';

/** What tapping a note gives you, named with its proper term. */
const RELATIVE = 'Same notes, new root: a relative mode.';
/** Half the tooltip's widest, to keep it on screen beside the strip's ends. */
const HALF_TIP = 130;
/** How long the pointer rests on a note before its tooltip shows. */
export const TIP_DELAY_MS = 1000;

interface StripTipProps {
  /** False when the strip has no notes to tap (not a seven-note scale). */
  enabled: boolean;
  /** The scale shown; a new one (a note was tapped) hides the tooltip. */
  shown: string;
  children: ReactNode;
}

/**
 * Wraps the scale strip. Resting a mouse on a tappable note for a second,
 * or reaching it with the keyboard, shows a tooltip above it naming the mode
 * it rotates to. Touch screens cannot hover, so there a line under the strip
 * says the same instead.
 */
export function StripTip({ enabled, shown, children }: StripTipProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ label: string; x: number; y: number } | null>(null);
  // The tooltip described the scale before; drop it as the strip changes.
  const [tipFor, setTipFor] = useState(shown);
  if (tipFor !== shown) {
    setTipFor(shown);
    setTip(null);
  }

  // Listens on the wrapper rather than on each note, which the strip draws.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    // A pending mouse tooltip, and whether one is up: once it is, moving to
    // the next note swaps it at once rather than waiting again.
    let timer: number | undefined;
    let showing = false;
    // The note under the event, if it is one the strip lets you tap.
    const show = (target: EventTarget | null) => {
      const note = (target as Element | null)?.closest('.tap');
      const label = note?.getAttribute('aria-label');
      if (!note || !label) return hide();
      showing = true;
      const n = note.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      const centre = Math.min(
        Math.max(n.left + n.width / 2, HALF_TIP + 8),
        window.innerWidth - HALF_TIP - 8,
      );
      setTip({ label, x: centre - b.left, y: n.top - b.top });
    };
    const onOver = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      window.clearTimeout(timer);
      if (showing) return show(e.target);
      const target = e.target;
      timer = window.setTimeout(() => show(target), TIP_DELAY_MS);
    };
    const onFocus = (e: FocusEvent) => {
      if ((e.target as Element).matches(':focus-visible')) show(e.target);
    };
    function hide() {
      window.clearTimeout(timer);
      showing = false;
      setTip(null);
    }
    box.addEventListener('pointerover', onOver);
    box.addEventListener('pointerleave', hide);
    box.addEventListener('focusin', onFocus);
    box.addEventListener('focusout', hide);
    // Tapping a note changes the scale; the next hover waits again.
    box.addEventListener('pointerdown', hide);
    return () => {
      window.clearTimeout(timer);
      box.removeEventListener('pointerdown', hide);
      box.removeEventListener('pointerover', onOver);
      box.removeEventListener('pointerleave', hide);
      box.removeEventListener('focusin', onFocus);
      box.removeEventListener('focusout', hide);
    };
  }, [enabled]);

  if (!enabled) return <>{children}</>;
  return (
    <div>
      <div ref={boxRef} className="relative">
        {children}
        {tip && (
          <div className="strip-tip" style={{ left: tip.x, top: tip.y }} role="tooltip">
            <div className="font-semibold">{tip.label}</div>
            <div className="strip-tip-note">{RELATIVE}</div>
          </div>
        )}
      </div>
      <p className="strip-touch-hint m-0 mt-1 text-[13px] leading-5 text-(--ink-muted)">
        Tap a note to make it the root. {RELATIVE}
      </p>
    </div>
  );
}
