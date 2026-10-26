'use client';

import { useRef } from 'react';
import { ChevronDownIcon } from '@/components/icons';
import { MAX_CAPO } from './clip';
import { CountInput, usePanel } from './TimeSignatureField';

/**
 * The capo, beside the time signature under the clip's name, where it is also set: a raised button
 * saying "Capo 3" (or "No capo") that opens a panel with the capo's fret, 0 to 12 on a − / +
 * stepper round a field; 0 is no capo. Each change is one undo step.
 */
export function CapoField({ capo, onChange }: {
  capo: number | undefined;
  onChange: (capo: number | null) => void;
}) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = usePanel(boxRef, buttonRef);
  const fret = capo ?? 0;
  const set = (next: number) => {
    const clamped = Math.min(MAX_CAPO, Math.max(0, next));
    if (clamped !== fret) onChange(clamped === 0 ? null : clamped);
  };

  return (
    <span className="tab-time" ref={boxRef}>
      <button
        ref={buttonRef} type="button" className="tab-time-button tab-capo-button" aria-expanded={open}
        aria-label={capo ? `Capo on fret ${capo}` : 'No capo'} onClick={() => setOpen(o => !o)}
      >
        <span aria-hidden="true">{capo ? `Capo ${capo}` : 'No capo'}</span>
        <ChevronDownIcon />
      </button>
      {open && (
        <span className="tab-time-panel card" role="dialog" aria-label="Capo">
          <span className="tab-time-field">
            <span className="tab-time-caption">Capo on fret (0 for none)</span>
            <span className="tab-time-stepper">
              <button type="button" aria-label="Capo lower" onClick={() => set(fret - 1)}>−</button>
              <CountInput value={fret} min={0} max={MAX_CAPO} label="Capo fret" onValue={set} />
              <button type="button" aria-label="Capo higher" onClick={() => set(fret + 1)}>+</button>
            </span>
          </span>
        </span>
      )}
    </span>
  );
}
