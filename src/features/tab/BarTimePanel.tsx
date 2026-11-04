'use client';

import { useRef } from 'react';
import { usePanelClose, usePanelInside } from './barPanel';
import { NumberField, resetOnDoubleClick } from '@/components/NumberField';
import { pickupUnit } from './barEdits';
import { changesTime, timeAt, type Part, type TimeSignature } from './clip';
import { TimeSignatureFields } from './TimeSignatureFields';

/**
 * The panel over the tab that sets the time signature from one bar on: opened by the palette's
 * time signature button or a press on a drawn time signature. On the first bar it sets the clip's
 * own; on a later bar it starts a change, which "Remove the change" takes away (so does setting it
 * back to the time signature before). The first bar's also has the Pickup field: the Pickup bar's
 * length in beats, 0 for none. A click outside or Esc closes it, Esc giving the keys back to the tab.
 */
export function BarTimePanel({ clip, bar, x, y, onChange, onPickup, onClose }: {
  clip: Part;
  bar: number;
  /** Where the panel's left edge and top go, in the tab's own units. */
  x: number;
  y: number;
  /** The new time signature from this bar on, or null to take a later bar's change away. */
  onChange: (time: TimeSignature | null) => void;
  /** The first bar's Pickup bar set this many ticks long, 0 for none. */
  onPickup: (length: number) => void;
  /** `byKey` when Esc closed it, not a click elsewhere. */
  onClose: (byKey: boolean) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  usePanelInside(boxRef, x);
  const time = timeAt(clip, bar);
  const changed = changesTime(clip, bar);

  usePanelClose(boxRef, onClose);

  const caption = bar === 0 ? 'Time signature' : `Time signature from bar ${bar + 1}`;
  return (
    <div ref={boxRef} className="tab-bar-time card" style={{ left: x, top: y }} role="dialog" aria-label={caption}>
      <span className="tab-bar-time-title">{caption}</span>
      <TimeSignatureFields time={time} onChange={onChange} />
      {bar === 0 && <PickupField clip={clip} time={time} onPickup={onPickup} />}
      {bar > 0 && (
        // Kept in place, only disabled, while the bar has no change of its own, so the panel never changes size.
        <button type="button" className="btn btn-secondary tab-bar-time-remove" disabled={!changed} onClick={() => onChange(null)}>
          Remove the change
        </button>
      )}
    </div>
  );
}

/**
 * Bar 1's Pickup field: whole beats of the time signature, 1 to one less than the bar has, and 0 for
 * none; it drags, and a double-click puts it back to 0. An imported pickup of part of a beat shows
 * its length as it is until the field is changed.
 */
function PickupField({ clip, time, onPickup }: { clip: Part; time: TimeSignature; onPickup: (length: number) => void }) {
  const unit = pickupUnit(time);
  const beats = (clip.bars[0]?.pickup ?? 0) / unit;
  const whole = Number.isInteger(beats);
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- a mouse shortcut only; from the keyboard, type 0
    <span className="tab-time-field" role="group" aria-label="Pickup" onDoubleClick={e => resetOnDoubleClick(e, () => onPickup(0))}>
      <span className="tab-time-caption" aria-hidden="true">Pickup beats</span>
      <NumberField
        value={beats} min={0} max={time.beats - 1} step={1} decimals={whole ? 0 : 2}
        label="Pickup bar, in beats" upLabel="Longer pickup" downLabel="Shorter pickup"
        onChange={typed => onPickup(Math.round(typed) * unit)}
      />
    </span>
  );
}
