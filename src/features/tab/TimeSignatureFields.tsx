'use client';

import { useState, type KeyboardEvent } from 'react';
import { MAX_BEATS, TIME_VALUES, type TimeSignature, type TimeValue } from './clip';

/**
 * A time signature's two fields, in the panel a press on a drawn one opens (`BarTimePanel`): the beats in a bar, 1 to 32, as a − / + stepper round a field (a typed count takes effect on Enter or on
 * leaving it; ↑ ↓ step it at once), and the beat's note value, 2 to 32.
 */
export function TimeSignatureFields({ time, onChange }: {
  time: TimeSignature;
  onChange: (time: TimeSignature) => void;
}) {
  const setBeats = (beats: number) => {
    const clamped = Math.min(MAX_BEATS, Math.max(1, beats));
    if (clamped !== time.beats) onChange({ ...time, beats: clamped });
  };
  const setValue = (value: TimeValue) => {
    if (value !== time.value) onChange({ ...time, value });
  };
  return (
    <>
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
    </>
  );
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
