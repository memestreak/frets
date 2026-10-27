'use client';

import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { changesTime, timeAt, type Clip, type TimeSignature } from './clip';
import { TimeSignatureFields } from './TimeSignatureFields';

/**
 * The panel over the tab that sets the time signature from one bar on: opened by the palette's
 * time signature button or a press on a drawn time signature. On the first bar it sets the clip's
 * own; on a later bar it starts a change, which "Remove the change" takes away (so does setting it
 * back to the time signature before). A click outside or Esc closes it, Esc giving the keys back to the tab.
 */
/** Keeps a panel over the tab from running past its right edge: it moves left as far as it must. */
export function usePanelInside(boxRef: RefObject<HTMLDivElement | null>, x: number) {
  useLayoutEffect(() => {
    const box = boxRef.current;
    const room = box?.parentElement?.clientWidth;
    if (!box || !room) return;
    box.style.left = `${Math.max(0, Math.min(x, room - box.offsetWidth))}px`;
  });
}

export function BarTimePanel({ clip, bar, x, y, onChange, onClose }: {
  clip: Clip;
  bar: number;
  /** Where the panel's left edge and top go, in the tab's own units. */
  x: number;
  y: number;
  /** The new time signature from this bar on, or null to take a later bar's change away. */
  onChange: (time: TimeSignature | null) => void;
  /** `byKey` when Esc closed it, not a click elsewhere. */
  onClose: (byKey: boolean) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  usePanelInside(boxRef, x);
  const time = timeAt(clip, bar);
  const changed = changesTime(clip, bar);

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
  }, [onClose]);

  const caption = bar === 0 ? 'Time signature' : `Time signature from bar ${bar + 1}`;
  return (
    <div ref={boxRef} className="tab-bar-time card" style={{ left: x, top: y }} role="dialog" aria-label={caption}>
      <span className="tab-bar-time-title">{caption}</span>
      <TimeSignatureFields time={time} onChange={onChange} />
      {bar > 0 && (
        // Kept in place, only disabled, while the bar has no change of its own, so the panel never changes size.
        <button type="button" className="btn btn-secondary tab-bar-time-remove" disabled={!changed} onClick={() => onChange(null)}>
          Remove the change
        </button>
      )}
    </div>
  );
}
