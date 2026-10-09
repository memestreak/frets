'use client';

import type { ReactNode } from 'react';
import { Keycap } from '@/components/controls';
import { EyeIcon } from '@/components/icons';

export interface LegendItem {
  label: string;
  color: string;
  shape: 'circle' | 'square';
}

interface BoardFrameProps {
  legend: LegendItem[];
  hint: boolean;
  onToggleHint: () => void;
  children: ReactNode;
}

/** Card around the fretboard, with legend and hint toggle. */
export function BoardFrame({
  legend, hint, onToggleHint, children,
}: BoardFrameProps) {
  return (
    <section className="card board-frame">
      <div className="board-scroll">{children}</div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2.5">
        <ul className="m-0 flex list-none items-center gap-3.5 p-0 text-[13px] text-(--ink-muted)">
          {legend.map(item => (
            <li key={item.label} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block size-3 border border-(--line-strong)"
                style={{
                  background: item.color,
                  borderRadius: item.shape === 'circle' ? '50%' : 3,
                }}
              />
              {item.label}
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="btn btn-primary hint-btn"
          aria-pressed={hint}
          onClick={onToggleHint}
        >
          <EyeIcon />
          Hint
          <Keycap>Space</Keycap>
        </button>
      </div>
    </section>
  );
}
