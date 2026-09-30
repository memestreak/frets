'use client';

import type { PointerEvent, ReactNode } from 'react';
import { Corners } from '../Blueprint';
import { Keycap } from '../controls';
import { EyeIcon } from '../icons';

export interface LegendItem {
  label: string;
  color: string;
  shape: 'circle' | 'square';
}

interface BoardFrameProps {
  legend: LegendItem[];
  hint: boolean;
  onHint: (on: boolean) => void;
  /** Label shown on the hint button while it is held. */
  hintActiveLabel: string;
  children: ReactNode;
}

/** Blueprint frame around the fretboard, with legend and hold-for-hint. */
export function BoardFrame({
  legend, hint, onHint, hintActiveLabel, children,
}: BoardFrameProps) {
  const down = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    onHint(true);
  };
  const up = () => onHint(false);

  return (
    <section className="blueprint board-frame">
      <Corners />
      <div className="board-scroll">{children}</div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2.5">
        <ul className="m-0 flex list-none items-center gap-3.5 p-0 text-[13px] text-[color-mix(in_srgb,var(--color-text)_70%,transparent)]">
          {legend.map(item => (
            <li key={item.label} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block size-3"
                style={{
                  background: item.color,
                  borderRadius: item.shape === 'circle' ? '50%' : 0,
                }}
              />
              {item.label}
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="btn btn-primary blueprint hint-btn"
          aria-pressed={hint}
          onPointerDown={down}
          onPointerUp={up}
          onPointerLeave={up}
          onPointerCancel={up}
          onContextMenu={e => e.preventDefault()}
          onKeyDown={e => {
            // Space/Enter act as a momentary hold, like the H key.
            if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
              e.preventDefault();
              e.stopPropagation();
              onHint(true);
            }
          }}
          onKeyUp={e => {
            if (e.key === ' ' || e.key === 'Enter') onHint(false);
          }}
        >
          <Corners />
          <EyeIcon />
          {hint ? hintActiveLabel : 'Hold for hint'}
          <Keycap>H</Keycap>
        </button>
      </div>
    </section>
  );
}
