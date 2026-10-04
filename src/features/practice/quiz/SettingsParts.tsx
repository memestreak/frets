'use client';

import { useState, type ChangeEvent, type ReactNode } from 'react';

/** `.field` with a group label. */
export function Field(
  { label, note, children }: { label: string; note?: string; children: ReactNode },
) {
  return (
    <div className="field" role="group" aria-label={label}>
      <span className="field-label">{label}</span>
      {children}
      {note && <p className="text-muted mt-1.5 mb-0 text-[12px]">{note}</p>}
    </div>
  );
}

interface FretInputProps {
  value: number;
  min: number;
  max: number;
  label: string;
  onCommit: (value: number) => void;
}

/**
 * Number input that commits on blur, Enter or the spinner arrows, so typing
 * "12" doesn't briefly apply "1" and reshuffle the window.
 */
export function FretInput({ value, min, max, label, onCommit }: FretInputProps) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (raw: string) => {
    setDraft(null);
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n !== value) onCommit(n);
  };
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const native = e.nativeEvent as InputEvent;
    // Spinner clicks and arrow keys carry no inputType: apply immediately.
    if (!native.inputType) commit(e.target.value);
    else setDraft(e.target.value);
  };

  return (
    <input
      className="input w-[72px]"
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={draft ?? String(value)}
      aria-label={label}
      onChange={onChange}
      onBlur={e => commit(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') commit(e.currentTarget.value);
        if (e.key === 'Escape') setDraft(null);
      }}
    />
  );
}

/** Two fret inputs joined by "to". */
export function FretPair({ children }: { children: ReactNode }) {
  return <div className="fret-pair flex items-center gap-2">{children}</div>;
}

export interface PerItemRow {
  label: string;
  pct: number | null;
}

/** Per-interval / per-note accuracy bars. */
export function PerItemStats({ rows, labelWidth }: { rows: PerItemRow[]; labelWidth: number }) {
  return (
    <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-5 gap-y-1.5 p-0 text-[12px]">
      {rows.map(r => (
        <li
          key={r.label}
          className="grid items-center gap-2"
          style={{ gridTemplateColumns: `${labelWidth}px minmax(0,1fr) 36px` }}
        >
          <span className="text-[14px] font-semibold">
            {r.label}
          </span>
          <span
            className="relative block h-[5px] overflow-hidden rounded-full bg-(--surface-sunken)"
            role="meter"
            aria-label={`${r.label} accuracy`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={r.pct ?? 0}
          >
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-(--primary)"
              style={{ width: `${r.pct ?? 0}%` }}
            />
          </span>
          <span className="text-muted text-right tabular-nums">
            {r.pct == null ? '—' : `${r.pct}%`}
          </span>
        </li>
      ))}
    </ul>
  );
}
