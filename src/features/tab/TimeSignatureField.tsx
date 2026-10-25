'use client';

import { useEffect, useEffectEvent, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDownIcon } from '@/components/icons';
import { COMMON_TIME, MAX_BEATS, TIME_VALUES, type TimeSignature, type TimeValue } from './clip';

/**
 * The time signature under the clip's name, where it is also set: the beats in a bar (1 to 32)
 * over the beat's note value (2, 4, 8, 16 or 32). It looks like the muted text round it, each part
 * underlined with dots. Typing a count takes effect on Enter or on leaving the field; ↑ and ↓ step
 * it at once. A double-click anywhere on it goes back to 4/4. Each change is one undo step.
 */
export function TimeSignatureField({ time, onChange }: {
  time: TimeSignature;
  onChange: (time: TimeSignature) => void;
}) {
  // What is being typed into the beats field; null when the field shows the clip's own count.
  const [draft, setDraft] = useState<string | null>(null);

  const setBeats = (beats: number) => {
    setDraft(null);
    const clamped = Math.min(MAX_BEATS, Math.max(1, beats));
    if (clamped !== time.beats) onChange({ ...time, beats: clamped });
  };
  /** Takes the typed count, or puts the clip's back when it isn't one. */
  const settle = () => {
    if (draft === null) return;
    const typed = Number(draft);
    if (draft !== '' && Number.isInteger(typed) && typed >= 1 && typed <= MAX_BEATS) setBeats(typed);
    else setDraft(null);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') settle();
    else if (e.key === 'Escape') setDraft(null);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const from = draft !== null && /^\d+$/.test(draft) ? Number(draft) : time.beats;
      setBeats(from + (e.key === 'ArrowUp' ? 1 : -1));
    }
  };
  const reset = useEffectEvent(() => {
    setDraft(null);
    if (time.beats !== COMMON_TIME.beats || time.value !== COMMON_TIME.value) onChange(COMMON_TIME);
  });
  // A double-click anywhere on the group, its fields included, resets it. It is a mouse shortcut
  // beside the fields, so it is listened for directly rather than making the group a control.
  const groupRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const onDoubleClick = () => reset();
    group.addEventListener('dblclick', onDoubleClick);
    return () => group.removeEventListener('dblclick', onDoubleClick);
  }, []);

  return (
    <span className="tab-time" role="group" aria-label="Time signature" ref={groupRef} data-tip="Double-click for 4/4">
      <input
        className="tab-time-beats" type="text" inputMode="numeric" aria-label="Beats in a bar"
        value={draft ?? String(time.beats)} maxLength={2}
        onChange={e => setDraft(e.target.value.replace(/\D/g, ''))}
        onBlur={settle} onKeyDown={onKeyDown}
      />
      <span aria-hidden="true">/</span>
      <span className="tab-time-value">
        <select
          aria-label="Beat note value" value={time.value}
          onChange={e => onChange({ ...time, value: Number(e.target.value) as TimeValue })}
        >
          {TIME_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <ChevronDownIcon />
      </span>
    </span>
  );
}
