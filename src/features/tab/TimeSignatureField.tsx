'use client';

import { useEffect, useEffectEvent, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDownIcon } from '@/components/icons';
import { COMMON_TIME, MAX_BEATS, TIME_VALUES, type TimeSignature, type TimeValue } from './clip';

/** MOCK: the three looks Jeremy is choosing between (?mock=a, b or c). */
export type TimeLook = 'a' | 'b' | 'c';

/**
 * The time signature under the clip's name, where it is also set: the beats in a bar (1 to 32)
 * over the beat's note value (2, 4, 8, 16 or 32). Typing a count takes effect on Enter or on
 * leaving the field; ↑ and ↓ step it at once. A double-click anywhere on it goes back to 4/4.
 * Each change is one undo step.
 */
export function TimeSignatureField({ time, onChange, look }: {
  time: TimeSignature;
  onChange: (time: TimeSignature) => void;
  look: TimeLook;
}) {
  const setBeats = (beats: number) => {
    const clamped = Math.min(MAX_BEATS, Math.max(1, beats));
    if (clamped !== time.beats) onChange({ ...time, beats: clamped });
  };
  /** The next note value up or down the list, staying at its ends. */
  const stepValue = (by: 1 | -1) => {
    const at = TIME_VALUES.indexOf(time.value) + by;
    if (at >= 0 && at < TIME_VALUES.length) onChange({ ...time, value: TIME_VALUES[at] });
  };
  const setValue = (value: TimeValue) => { if (value !== time.value) onChange({ ...time, value }); };

  const reset = useEffectEvent(() => {
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

  const beats = <BeatsInput beats={time.beats} onBeats={setBeats} />;
  const group = { ref: groupRef, role: 'group', 'aria-label': 'Time signature', 'data-tip': 'Double-click for 4/4' };

  if (look === 'a') {
    // A: an engraved time signature, the two numbers stacked, each with a small up / down pair.
    return (
      <span className="ts-a" {...group}>
        <span className="ts-a-row">
          {beats}
          <Steps less="Fewer beats" more="More beats" onStep={by => setBeats(time.beats + by)} />
        </span>
        <span className="ts-a-rule" aria-hidden="true" />
        <span className="ts-a-row">
          <output className="ts-a-num" aria-label="Beat note value">{time.value}</output>
          <Steps less="Longer beat" more="Shorter beat" onStep={stepValue} />
        </span>
      </span>
    );
  }
  if (look === 'b') {
    // B: two steppers on a sunken track, beats over value written as a fraction.
    return (
      <span className="ts-b" {...group}>
        <span className="ts-b-label" aria-hidden="true">Time</span>
        <span className="ts-b-track">
          <button type="button" className="ts-b-step" aria-label="Fewer beats" onClick={() => setBeats(time.beats - 1)}>−</button>
          {beats}
          <button type="button" className="ts-b-step" aria-label="More beats" onClick={() => setBeats(time.beats + 1)}>+</button>
        </span>
        <span className="ts-b-slash" aria-hidden="true">/</span>
        <span className="ts-b-track">
          <button type="button" className="ts-b-step" aria-label="Longer beat" onClick={() => stepValue(-1)}>−</button>
          <output className="ts-b-num" aria-label="Beat note value">{time.value}</output>
          <button type="button" className="ts-b-step" aria-label="Shorter beat" onClick={() => stepValue(1)}>+</button>
        </span>
      </span>
    );
  }
  // C: the stacked numbers on a small raised button that opens a panel with both choices.
  return <PopoverLook time={time} group={group} beats={beats} onBeats={setBeats} onValue={setValue} />;
}

function PopoverLook({ time, group, beats, onBeats, onValue }: {
  time: TimeSignature;
  group: Record<string, unknown>;
  beats: React.ReactNode;
  onBeats: (beats: number) => void;
  onValue: (value: TimeValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <span className="ts-c" ref={boxRef}>
      <span {...group}>
        <button type="button" className="ts-c-button" aria-expanded={open} aria-label={`Time signature ${time.beats}/${time.value}`} onClick={() => setOpen(o => !o)}>
          <span className="ts-c-stack" aria-hidden="true"><span>{time.beats}</span><span>{time.value}</span></span>
          <ChevronDownIcon />
        </button>
      </span>
      {open && (
        <span className="ts-c-panel card" role="dialog" aria-label="Time signature">
          <span className="ts-c-field">
            <span className="ts-c-caption">Beats in a bar</span>
            <span className="ts-b-track">
              <button type="button" className="ts-b-step" aria-label="Fewer beats" onClick={() => onBeats(time.beats - 1)}>−</button>
              {beats}
              <button type="button" className="ts-b-step" aria-label="More beats" onClick={() => onBeats(time.beats + 1)}>+</button>
            </span>
          </span>
          <span className="ts-c-field">
            <span className="ts-c-caption">Beat</span>
            <span className="seg" role="group" aria-label="Beat note value">
              {TIME_VALUES.map(v => (
                <button key={v} type="button" className="seg-opt ts-c-opt" aria-pressed={v === time.value} onClick={() => onValue(v)}>{v}</button>
              ))}
            </span>
          </span>
        </span>
      )}
    </span>
  );
}

/** A small ▲ / ▼ pair. */
function Steps({ less, more, onStep }: { less: string; more: string; onStep: (by: 1 | -1) => void }) {
  return (
    <span className="ts-a-steps">
      <button type="button" aria-label={more} onClick={() => onStep(1)}>
        <svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 5 L5 1 L9 5" /></svg>
      </button>
      <button type="button" aria-label={less} onClick={() => onStep(-1)}>
        <svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1 L5 5 L9 1" /></svg>
      </button>
    </span>
  );
}

/** The count as a small text field: a typed count takes effect on Enter or blur; ↑ ↓ step it. */
function BeatsInput({ beats, onBeats }: { beats: number; onBeats: (beats: number) => void }) {
  // What is being typed; null when the field shows the clip's own count.
  const [draft, setDraft] = useState<string | null>(null);
  const settle = () => {
    if (draft === null) return;
    const typed = Number(draft);
    setDraft(null);
    if (draft !== '' && Number.isInteger(typed) && typed >= 1 && typed <= MAX_BEATS) onBeats(typed);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') settle();
    else if (e.key === 'Escape') setDraft(null);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const from = draft !== null && /^\d+$/.test(draft) ? Number(draft) : beats;
      setDraft(null);
      onBeats(from + (e.key === 'ArrowUp' ? 1 : -1));
    }
  };
  return (
    <input
      className="ts-beats" type="text" inputMode="numeric" aria-label="Beats in a bar"
      value={draft ?? String(beats)} maxLength={2}
      onChange={e => setDraft(e.target.value.replace(/\D/g, ''))}
      onBlur={settle} onKeyDown={onKeyDown}
    />
  );
}
