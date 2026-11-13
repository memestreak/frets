'use client';

import { useEffect, useRef, useState } from 'react';
import { usePanelClose, usePanelInside } from './barPanel';
import { TUPLETS } from './clip';

/** How long after a 1 a second digit makes 10, 11 or 12. */
const SECOND_DIGIT_MS = 1000;

/**
 * The Tuplet panel `;` opens at the cursor (`docs/specs/2026-11-04-tab-tuplets-grace-rest-design.md`, Q16):
 * the Tuplet button's choices, kept to the keyboard. A digit picks its tuplet (1 then 0, 1 or 2 for 10 to 12),
 * ↑ ↓ (or ← →) move through them and Enter picks, Esc or a press elsewhere closes it. It lets go after use.
 */
export function TupletPanel({ x, y, current, onPick, onClose }: {
  /** Where its left edge and top go, in the tab's own units. */
  x: number;
  y: number;
  /** The tuplet lit: the cursor's, or Tuplet entry's. */
  current: number | null;
  onPick: (n: number | null) => void;
  /** `byKey` when Esc closed it, not a press elsewhere. */
  onClose: (byKey: boolean) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const choices: (number | null)[] = [...TUPLETS, null];
  // ↑ ↓ start from the lit tuplet, or the first.
  const [active, setActive] = useState(current === null ? 0 : Math.max(0, choices.indexOf(current)));
  const one = useRef<number | null>(null);
  usePanelInside(boxRef, x);
  usePanelClose(boxRef, onClose);
  // The keys come here while it is open, and go back to the tab when it closes.
  useEffect(() => boxRef.current?.focus({ preventScroll: true }), []);

  const onKeyDown = (e: KeyboardEvent) => {
    const { key } = e;
    if (key === 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    const step = key === 'ArrowDown' || key === 'ArrowRight' ? 1 : key === 'ArrowUp' || key === 'ArrowLeft' ? -1 : 0;
    if (step) setActive(i => (i + step + choices.length) % choices.length);
    else if (key === 'Enter') onPick(choices[active]);
    else if (/^[0-9]$/.test(key)) {
      const digit = Number(key);
      const before = one.current;
      one.current = null;
      if (before !== null && e.timeStamp - before < SECOND_DIGIT_MS && TUPLETS.includes(10 + digit)) onPick(10 + digit);
      else if (digit === 1) one.current = e.timeStamp;
      else if (TUPLETS.includes(digit)) onPick(digit);
    }
  };

  // Listened for on the panel itself, so the keys it takes never reach the tab under it.
  const keyRef = useRef(onKeyDown);
  useEffect(() => { keyRef.current = onKeyDown; });
  useEffect(() => {
    const box = boxRef.current;
    const listen = (e: KeyboardEvent) => keyRef.current(e);
    box?.addEventListener('keydown', listen);
    return () => box?.removeEventListener('keydown', listen);
  }, []);

  return (
    <div
      ref={boxRef} className="tab-bar-time tab-tuplet-panel card" style={{ left: x, top: y }} role="dialog" aria-label="Tuplet"
      tabIndex={-1}
    >
      <span className="tab-bar-time-title">Tuplet</span>
      <span className="seg" role="group" aria-label="Tuplet choices">
        {choices.map((choice, i) => (
          <button
            key={choice ?? 'none'} type="button" tabIndex={-1}
            className={`seg-opt tab-panel-choice${i === active ? ' tab-panel-active' : ''}`} aria-pressed={choice === current}
            onMouseDown={e => e.preventDefault()} onClick={() => onPick(choice)}
          >
            {choice === null ? 'None' : choice}
          </button>
        ))}
      </span>
    </div>
  );
}
