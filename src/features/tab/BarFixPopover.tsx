'use client';

import { useRef } from 'react';
import { usePanelClose, usePanelInside } from './barPanel';
import { barFixes, fillWithRests, makePickup, moveExtra } from './barEdits';
import type { Part } from './clip';

/**
 * The small popover a press on an Uneven bar's ⚠ opens, where it was pressed
 * (`docs/specs/2026-11-04-tab-bars-always-full-design.md`): what is wrong, and the one command that
 * fixes it, for every Voice of the Track. An overfull bar has Move extra into next bar, a short one
 * Fill with rests, and a short bar 1 Make pickup bar too. It closes after use, on a press elsewhere or Esc.
 */
export function BarFixPopover({ clip, bar, text, x, y, onFix, onClose }: {
  clip: Part;
  bar: number;
  /** The ⚠'s words. */
  text: string;
  /** Where the popover's left edge and top go, in the tab's own units. */
  x: number;
  y: number;
  /** The clip fixed: null when the fix would put a tuplet across a bar line. */
  onFix: (fixed: Part | null) => void;
  /** `byKey` when Esc closed it, not a press elsewhere. */
  onClose: (byKey: boolean) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  usePanelInside(boxRef, x);
  usePanelClose(boxRef, onClose);
  const fixes = barFixes(clip, bar);
  return (
    <div ref={boxRef} className="tab-bar-time tab-bar-fix card" style={{ left: x, top: y }} role="dialog" aria-label="Fix this bar">
      <span className="tab-bar-fix-text">{text}</span>
      {fixes.over && (
        <button type="button" className="btn btn-secondary" onClick={() => onFix(moveExtra(clip, bar))}>Move extra into next bar</button>
      )}
      {fixes.short && (
        <button type="button" className="btn btn-secondary" onClick={() => onFix(fillWithRests(clip, bar))}>Fill with rests</button>
      )}
      {fixes.pickup && (
        <button type="button" className="btn btn-secondary" onClick={() => onFix(makePickup(clip))}>Make pickup bar</button>
      )}
    </div>
  );
}
