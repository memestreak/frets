'use client';

/**
 * The tuning (issue #203), opened by a press on the tuning in the score's head, or on the space where
 * it would go when the guitar is in standard tuning: the common tunings, then each string, lowest
 * first, its note picked on the shared piano `KeyPicker`. Every change is one undo step and keeps the
 * frets (`tuning.ts`).
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { KeyPicker } from '@/components/KeyPicker';
import { prettyNote } from '@/lib/theory/notes';
import { STRING_COUNT, type Part } from './clip';
import { presetOf, stringNote, TUNING_PRESETS, withStringNote, withTuning } from './tuning';
import { usePopover } from './usePopover';

export function TuningPanel({ clip, x, y, onChange, onClose }: {
  clip: Part;
  x: number;
  y: number;
  onChange: (clip: Part) => void;
  onClose: () => void;
}) {
  // The string whose note the piano picks, counted from the low E (0).
  const [low, setLow] = useState(0);
  const { ref, style } = usePopover({ x, y, focus: '[aria-pressed="true"]', onClose });
  const preset = presetOf(clip.tuning);
  const lows = Array.from({ length: STRING_COUNT }, (_, s) => s);

  return createPortal(
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- it only keeps the page's keys out
    <div
      ref={ref} role="dialog" aria-label="Tuning" className="shape-menu tab-head-panel tab-tuning-panel" style={style} tabIndex={-1}
      // The page's own keys (Space plays, the arrows move the playback line) stay out of the panel; undo and Esc go through.
      onKeyDown={e => { if (e.key !== 'Escape' && !e.ctrlKey && !e.metaKey) e.stopPropagation(); }}
    >
      <span className="tab-time-caption">Tuning: {preset?.name ?? 'Custom'}</span>
      <div className="seg tab-tuning-presets" role="group" aria-label="Tunings">
        {TUNING_PRESETS.map(p => (
          <button key={p.name} type="button" className="seg-opt" aria-pressed={p === preset} onClick={() => onChange(withTuning(clip, p.notes))}>
            {p.name}
          </button>
        ))}
      </div>
      <span className="tab-time-caption">Strings</span>
      <div className="seg" role="group" aria-label="String">
        {lows.map(s => (
          <button
            key={s} type="button" className="seg-opt tab-tuning-string" aria-pressed={s === low} onClick={() => setLow(s)}
            aria-label={`String ${STRING_COUNT - s}: ${prettyNote(stringNote(clip.tuning, s))}`}
          >
            <span className="score-string" aria-hidden="true">{STRING_COUNT - s}</span>
            {prettyNote(stringNote(clip.tuning, s))}
          </button>
        ))}
      </div>
      <KeyPicker
        label={`String ${STRING_COUNT - low}`} value={stringNote(clip.tuning, low)}
        onPick={note => onChange(withStringNote(clip, low, note))}
      />
    </div>,
    document.body,
  );
}
