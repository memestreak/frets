'use client';

/**
 * The playback footer's speed, as a percentage of the clip's own tempo (Jeremy's ask, 2026-10-26):
 * a number field with up and down buttons. Type a number (it takes effect on Enter or on leaving the
 * field), press the buttons or ↑ ↓ to step it, or press on the number and drag up or down. A press
 * that doesn't move puts the caret in the field to type.
 */
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

/** How far a button or an arrow key steps it, and how many pixels of drag move it by 1%. */
const STEP = 5;
const DRAG_PX_PER_PERCENT = 2;
/** A press that moves less than this is a click, not a drag. */
const DRAG_THRESHOLD_PX = 3;

export function SpeedField({ percent, min, max, onChange }: {
  /** The speed now, a whole percent. */
  percent: number;
  min: number;
  max: number;
  onChange: (percent: number) => void;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v)));
  const set = (v: number) => {
    const next = clamp(v);
    if (next !== percent) onChange(next);
  };

  const input = useRef<HTMLInputElement>(null);
  // What is being typed; null when the field shows the speed itself.
  const [draft, setDraft] = useState<string | null>(null);
  const settle = () => {
    if (draft === null) return;
    setDraft(null);
    if (/^\d+$/.test(draft)) set(Number(draft));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') settle();
    else if (e.key === 'Escape') setDraft(null);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const from = draft !== null && /^\d+$/.test(draft) ? Number(draft) : percent;
      setDraft(null);
      set(from + (e.key === 'ArrowUp' ? STEP : -STEP));
    }
  };

  // A press on the number: dragging up or down changes it; a press that stays put starts typing.
  const drag = useRef<{ y: number; from: number; moved: boolean } | null>(null);
  const typing = () => document.activeElement === input.current;
  const onPointerDown = (e: PointerEvent<HTMLInputElement>) => {
    if (typing() || e.button !== 0) return;
    // Keep the caret out (and no text selected) until we know it is a click.
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, from: percent, moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLInputElement>) => {
    const d = drag.current;
    if (!d) return;
    const dy = d.y - e.clientY;
    if (!d.moved && Math.abs(dy) < DRAG_THRESHOLD_PX) return;
    d.moved = true;
    // Up raises it.
    set(d.from + dy / DRAG_PX_PER_PERCENT);
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) {
      input.current?.focus();
      input.current?.select();
    }
  };

  return (
    <span className="tab-speed-field">
      <input
        ref={input} type="text" inputMode="numeric" aria-label="Speed (percent)"
        role="spinbutton" aria-valuemin={min} aria-valuemax={max} aria-valuenow={percent}
        value={draft ?? String(percent)} maxLength={String(max).length}
        onChange={e => setDraft(e.target.value.replace(/\D/g, ''))}
        onBlur={settle} onKeyDown={onKeyDown}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerCancel={() => { drag.current = null; }}
      />
      <span className="tab-speed-unit" aria-hidden="true">%</span>
      <span className="tab-speed-steps">
        <button type="button" aria-label="Faster" tabIndex={-1} onMouseDown={e => e.preventDefault()} onClick={() => set(percent + STEP)}>
          <svg width={8} height={5} viewBox="0 0 8 5" aria-hidden="true"><path d="M0.5 4.5 4 1l3.5 3.5" fill="none" stroke="currentColor" strokeWidth={1.5} /></svg>
        </button>
        <button type="button" aria-label="Slower" tabIndex={-1} onMouseDown={e => e.preventDefault()} onClick={() => set(percent - STEP)}>
          <svg width={8} height={5} viewBox="0 0 8 5" aria-hidden="true"><path d="M0.5 0.5 4 4l3.5-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} /></svg>
        </button>
      </span>
    </span>
  );
}
