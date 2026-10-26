'use client';

import {
  useEffect, useRef, useState, type Dispatch, type KeyboardEvent, type RefObject, type SetStateAction,
} from 'react';
import { ChevronDownIcon } from '@/components/icons';
import { MAX_BEATS, TIME_VALUES, type TimeSignature, type TimeValue } from './clip';

/**
 * The time signature under the clip's name, where it is also set: a small raised button showing
 * the two numbers stacked, as on a staff, which opens a panel with the beats in a bar (1 to 32,
 * a − / + stepper round a field) and the beat's note value (2, 4, 8, 16 or 32). A typed count
 * takes effect on Enter or on leaving the field; ↑ and ↓ step it at once. A click outside or Esc
 * closes the panel. Each change is one undo step.
 */
export function TimeSignatureField({ time, onChange }: {
  time: TimeSignature;
  onChange: (time: TimeSignature) => void;
}) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = usePanel(boxRef, buttonRef);

  const setBeats = (beats: number) => {
    const clamped = Math.min(MAX_BEATS, Math.max(1, beats));
    if (clamped !== time.beats) onChange({ ...time, beats: clamped });
  };
  const setValue = (value: TimeValue) => {
    if (value !== time.value) onChange({ ...time, value });
  };

  return (
    <span className="tab-time" ref={boxRef}>
      <button
        ref={buttonRef} type="button" className="tab-time-button" aria-expanded={open}
        aria-label={`Time signature ${time.beats}/${time.value}`} onClick={() => setOpen(o => !o)}
      >
        <span className="tab-time-stack" aria-hidden="true"><span>{time.beats}</span><span>{time.value}</span></span>
        <ChevronDownIcon />
      </button>
      {open && (
        <span className="tab-time-panel card" role="dialog" aria-label="Time signature">
          <span className="tab-time-field">
            <span className="tab-time-caption">Beats in a bar</span>
            <span className="tab-time-stepper">
              <button type="button" aria-label="Fewer beats" onClick={() => setBeats(time.beats - 1)}>−</button>
              <CountInput value={time.beats} min={1} max={MAX_BEATS} label="Beats in a bar" onValue={setBeats} />
              <button type="button" aria-label="More beats" onClick={() => setBeats(time.beats + 1)}>+</button>
            </span>
          </span>
          <span className="tab-time-field">
            <span className="tab-time-caption">Beat</span>
            <span className="seg" role="group" aria-label="Beat note value">
              {TIME_VALUES.map(v => (
                <button key={v} type="button" className="seg-opt tab-time-value" aria-pressed={v === time.value} onClick={() => setValue(v)}>
                  {v}
                </button>
              ))}
            </span>
          </span>
        </span>
      )}
    </span>
  );
}

/**
 * Whether a button's panel is open, for the raised buttons under the clip's name (time signature,
 * capo): a click outside the box holding both, or Esc, closes it, Esc putting the focus back on the
 * button so the keyboard isn't lost.
 */
export function usePanel(
  boxRef: RefObject<HTMLElement | null>, buttonRef: RefObject<HTMLButtonElement | null>,
): [boolean, Dispatch<SetStateAction<boolean>>] {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (boxRef.current?.contains(document.activeElement)) buttonRef.current?.focus();
      setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, boxRef, buttonRef]);
  return [open, setOpen];
}

/** A count as a small text field: a typed count from `min` to `max` takes effect on Enter or blur; ↑ ↓ step it. */
export function CountInput({ value, min, max, label, onValue }: {
  value: number;
  min: number;
  max: number;
  label: string;
  onValue: (value: number) => void;
}) {
  // What is being typed; null when the field shows the clip's own count.
  const [draft, setDraft] = useState<string | null>(null);
  const settle = () => {
    if (draft === null) return;
    const typed = Number(draft);
    setDraft(null);
    if (draft !== '' && Number.isInteger(typed) && typed >= min && typed <= max) onValue(typed);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') settle();
    else if (e.key === 'Escape') setDraft(null);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const from = draft !== null && /^\d+$/.test(draft) ? Number(draft) : value;
      setDraft(null);
      onValue(from + (e.key === 'ArrowUp' ? 1 : -1));
    }
  };
  return (
    <input
      type="text" inputMode="numeric" aria-label={label}
      value={draft ?? String(value)} maxLength={String(max).length}
      onChange={e => setDraft(e.target.value.replace(/\D/g, ''))}
      onBlur={settle} onKeyDown={onKeyDown}
    />
  );
}
