'use client';

import { useRef, useState } from 'react';
import { usePanelClose, usePanelInside } from './barPanel';
import { NumberField, resetOnDoubleClick } from '@/components/NumberField';
import { pickupUnit } from './barEdits';
import { changesTime, defaultGroupCounts, groupCountsAt, hasOwnGroups, isGroupingOf, timeAt, type Part, type TimeSignature } from './clip';
import { TimeSignatureFields } from './TimeSignatureFields';

/**
 * The panel over the tab that sets the time signature from one bar on: opened by the palette's
 * time signature button or a press on a drawn time signature. On the first bar it sets the clip's
 * own; on a later bar it starts a change, which "Remove the change" takes away (so does setting it
 * back to the time signature before). The first bar's also has the Pickup field: the Pickup bar's
 * length in beats, 0 for none. A time signature of five beats or more, or one with Beat groups of its
 * own, has the Beat groups field (`docs/specs/2026-11-04-tab-beat-groups-beams-design.md`). A click
 * outside or Esc closes it, Esc giving the keys back to the tab.
 */
export function BarTimePanel({ clip, bar, x, y, onChange, onPickup, onGroups, onClose }: {
  clip: Part;
  bar: number;
  /** Where the panel's left edge and top go, in the tab's own units. */
  x: number;
  y: number;
  /** The new time signature from this bar on, or null to take a later bar's change away. */
  onChange: (time: TimeSignature | null) => void;
  /** The first bar's Pickup bar set this many ticks long, 0 for none. */
  onPickup: (length: number) => void;
  /** Beat groups set from this bar on, counted in the time signature's lower number; null for its default. */
  onGroups: (counts: number[] | null) => void;
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
      {(time.beats >= 5 || hasOwnGroups(clip, bar)) && (
        <BeatGroupsField key={`${time.beats}/${time.value}`} counts={groupCountsAt(clip, bar)} time={time} onGroups={onGroups} />
      )}
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
 * The Beat groups field (spec Q3): the grouping in use as `2+2+3`, counted in the time signature's lower
 * number. Enter or leaving it applies what was typed; one that doesn't add up isn't applied and gets a
 * small red ⚠ whose tip says why, the text kept as typed. A double-click puts back the default.
 */
function BeatGroupsField({ counts, time, onGroups }: { counts: number[]; time: TimeSignature; onGroups: (counts: number[] | null) => void }) {
  const shown = counts.join('+');
  // What is being typed; null when the field shows the groups in use.
  const [draft, setDraft] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const settle = () => {
    if (draft === null) return;
    const typed = draft.split('+').map(part => part.trim());
    const parsed = typed.map(Number);
    if (typed.some(part => !/^\d+$/.test(part)) || !isGroupingOf(parsed, time)) {
      const sum = parsed.every(Number.isFinite) ? parsed.reduce((a, b) => a + b, 0) : null;
      setProblem(sum === null || typed.some(part => !/^\d+$/.test(part))
        ? `Type whole numbers joined by +, such as ${defaultGroupCounts(time).join('+')}`
        : `Adds up to ${sum}; the bar has ${time.beats}`);
      return;
    }
    setDraft(null);
    setProblem(null);
    if (parsed.join('+') !== shown) onGroups(parsed);
  };
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- a mouse shortcut only; from the keyboard, type the default
    <span className="tab-time-field" role="group" aria-label="Beat groups" onDoubleClick={e => resetOnDoubleClick(e, () => {
      setDraft(null);
      setProblem(null);
      onGroups(null);
    })}>
      <span className="tab-time-caption" aria-hidden="true">Beat groups</span>
      <span className="tab-groups-row">
        <input
          className="input tab-groups-input" aria-label="Beat groups" aria-invalid={problem !== null || undefined}
          value={draft ?? shown} spellCheck={false} autoComplete="off"
          onChange={e => {
            setDraft(e.target.value);
            setProblem(null);
          }}
          onBlur={settle}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              settle();
            }
          }}
        />
        {problem && (
          <span className="tab-groups-problem" data-tip={problem} data-testid="beat-groups-problem">
            <svg viewBox="0 0 14 13" width={13} height={12} aria-hidden="true">
              <path d="M7 1 L13 12 L1 12 Z" fill="currentColor" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
              <text x={7} y={10.6} fontSize={8} fontWeight={800} fill="var(--surface-raised)" textAnchor="middle">!</text>
            </svg>
            <span className="sr-only">{problem}</span>
          </span>
        )}
      </span>
    </span>
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
