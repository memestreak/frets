'use client';

/**
 * A small number field with up and down buttons, for the playback footer's speed (Jeremy's ask,
 * 2026-10-26) and the pause between loops. Type a number (it takes effect on Enter or on leaving the
 * field), press the buttons or ↑ ↓ to step it, or press on the number and drag up or down. A press
 * that doesn't move puts the caret in the field to type.
 */
import { useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';

/**
 * A double-click on a number field's row (its label, number or what follows it) puts it back to its
 * usual value (Jeremy, 2026-10-27); not on the step buttons, so two quick presses still step twice.
 * A number being typed is settled first, so the reset is what stays.
 */
export function resetOnDoubleClick(e: MouseEvent<HTMLElement>, reset: () => void) {
  if ((e.target as Element).closest('button')) return;
  const typing = e.currentTarget.querySelector('input');
  if (typing && document.activeElement === typing) typing.blur();
  reset();
}

/** How many pixels of drag move it by one step, and how far a press must move to be a drag, not a click. */
const DRAG_PX_PER_STEP = 10;
const DRAG_THRESHOLD_PX = 3;

export function NumberField({ value, min, max, step, decimals = 0, unit, label, upLabel, downLabel, onChange }: {
  value: number;
  min: number;
  max: number;
  /** How far a button or an arrow key steps it. */
  step: number;
  /** Digits after the point, as shown and as kept. */
  decimals?: number;
  /** Shown after the number, inside the box: `%`, `s`. A long unit goes outside it instead. */
  unit?: string;
  /** The field's accessible name, and the buttons'. */
  label: string;
  upLabel: string;
  downLabel: string;
  onChange: (value: number) => void;
}) {
  const scale = 10 ** decimals;
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * scale) / scale));
  const set = (v: number) => {
    const next = clamp(v);
    if (next !== value) onChange(next);
  };
  // Below zero allowed (a transposition), a value above zero shows its plus sign.
  const signed = min < 0;
  const shown = `${signed && value > 0 ? '+' : ''}${value.toFixed(decimals)}`;
  const digits = decimals > 0 ? '\\d*\\.?\\d*' : '\\d*';
  const pattern = new RegExp(`^${signed ? '[+-]?' : ''}${digits}$`);
  const parse = (text: string) => (/\d/.test(text) && pattern.test(text) ? Number(text) : null);

  const input = useRef<HTMLInputElement>(null);
  // What is being typed; null when the field shows the value itself.
  const [draft, setDraft] = useState<string | null>(null);
  const settle = () => {
    if (draft === null) return;
    setDraft(null);
    const typed = parse(draft);
    if (typed !== null) set(typed);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') settle();
    else if (e.key === 'Escape') setDraft(null);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const from = (draft !== null ? parse(draft) : null) ?? value;
      setDraft(null);
      set(from + (e.key === 'ArrowUp' ? step : -step));
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
    drag.current = { y: e.clientY, from: value, moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLInputElement>) => {
    const d = drag.current;
    if (!d) return;
    const dy = d.y - e.clientY;
    if (!d.moved && Math.abs(dy) < DRAG_THRESHOLD_PX) return;
    d.moved = true;
    // Up raises it, a step every few pixels.
    set(d.from + Math.round(dy / DRAG_PX_PER_STEP) * step);
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) {
      input.current?.focus();
      input.current?.select();
    }
  };

  // Room for the longest value, its sign included.
  const width = Math.max(max.toFixed(decimals).length, min.toFixed(decimals).length) + (signed && max > 0 ? 1 : 0);
  return (
    <span className="tab-number-field">
      <input
        ref={input} type="text" inputMode={signed ? 'text' : decimals > 0 ? 'decimal' : 'numeric'} aria-label={label}
        role="spinbutton" aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}
        value={draft ?? shown} maxLength={width + 1} style={{ width: `${width}ch` }}
        onChange={e => setDraft(e.target.value.replace(decimals > 0 ? (signed ? /[^\d.+-]/g : /[^\d.]/g) : (signed ? /[^\d+-]/g : /\D/g), ''))}
        onBlur={settle} onKeyDown={onKeyDown}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerCancel={() => { drag.current = null; }}
      />
      <span className="tab-number-unit" aria-hidden="true">{unit ?? ''}</span>
      <span className="tab-number-steps">
        <button type="button" aria-label={upLabel} tabIndex={-1} onMouseDown={e => e.preventDefault()} onClick={() => set(value + step)}>
          <svg width={8} height={5} viewBox="0 0 8 5" aria-hidden="true"><path d="M0.5 4.5 4 1l3.5 3.5" fill="none" stroke="currentColor" strokeWidth={1.5} /></svg>
        </button>
        <button type="button" aria-label={downLabel} tabIndex={-1} onMouseDown={e => e.preventDefault()} onClick={() => set(value - step)}>
          <svg width={8} height={5} viewBox="0 0 8 5" aria-hidden="true"><path d="M0.5 0.5 4 4l3.5-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} /></svg>
        </button>
      </span>
    </span>
  );
}
