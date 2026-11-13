'use client';

/**
 * The tuning (issue #203), opened by a press on the tuning in the score's head, or on the space where
 * it would go when the guitar is in standard tuning: the common tunings, then each string, lowest
 * first, its note picked on the shared piano `KeyPicker`; then the capo (issue #463,
 * `docs/specs/2026-11-13-tab-capo-in-tuning-design.md`). Every change is one undo step and keeps the
 * frets (`tuning.ts`); a capo change keeps the tuning, and the tuning keeps the capo.
 */
import { useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { KeyPicker } from '@/components/KeyPicker';
import { prettyNote } from '@/lib/theory/notes';
import { MAX_CAPO, STRING_COUNT, type Part } from './clip';
import { setCapo } from './barEdits';
import { presetOf, stringNote, TUNING_PRESETS, withStringNote, withTuning } from './tuning';
import { usePanel } from './usePanel';

export function TuningPanel({ clip, x, y, onChange, onClose }: {
  clip: Part;
  x: number;
  y: number;
  onChange: (clip: Part) => void;
  onClose: () => void;
}) {
  // The string whose note the piano picks, counted from the low E (0).
  const [low, setLow] = useState(0);
  const { ref, style } = usePanel({ x, y, focus: '[aria-pressed="true"]', onClose });
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
      <CapoStepper capo={clip.capo ?? 0} onCapo={capo => onChange(setCapo(clip, capo === 0 ? null : capo))} />
    </div>,
    document.body,
  );
}

/**
 * The capo as a − / + stepper round a field (issue #463): 0 is no capo, and the field then reads None.
 * − and +, and ↑ ↓ in the field, apply at once. A typed fret applies on Enter or on leaving the field,
 * as one undo step (past 12 is 12, empty or 0 is none); Esc leaves the capo as it was, as the time
 * signature's count does.
 */
function CapoStepper({ capo, onCapo }: { capo: number; onCapo: (capo: number) => void }) {
  // What is being typed; null when the field shows the clip's own capo. The ref sees it at once, so a
  // blur right after Enter or Esc (the panel closing) doesn't apply it again.
  const [draft, setDraftState] = useState<string | null>(null);
  const pending = useRef<string | null>(null);
  const setDraft = (value: string | null) => {
    pending.current = value;
    setDraftState(value);
  };
  const set = (next: number) => {
    const clamped = Math.min(MAX_CAPO, Math.max(0, next));
    if (clamped !== capo) onCapo(clamped);
  };
  const settle = () => {
    const typed = pending.current;
    if (typed === null) return;
    setDraft(null);
    set(typed === '' ? 0 : Number(typed));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') settle();
    // Esc goes on to close the panel too, as in the panel's other fields.
    else if (e.key === 'Escape') setDraft(null);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      // From what is typed, if it is a number, as the time signature's count steps.
      const typed = pending.current;
      const from = typed !== null && /^\d+$/.test(typed) ? Math.min(MAX_CAPO, Number(typed)) : capo;
      setDraft(null);
      set(from + (e.key === 'ArrowUp' ? 1 : -1));
    }
  };
  const shown = draft ?? (capo === 0 ? 'None' : String(capo));
  return (
    <>
      <span className="tab-time-caption">Capo</span>
      <span className="tab-time-stepper tab-capo-stepper">
        <button type="button" aria-label="Capo down a fret" disabled={capo === 0} onClick={() => set(capo - 1)}>−</button>
        <input
          type="text" inputMode="numeric" aria-label="Capo"
          value={shown}
          onFocus={e => e.currentTarget.select()}
          onChange={e => setDraft(e.target.value.replace(/\D/g, '').slice(0, 2))}
          onBlur={settle} onKeyDown={onKeyDown}
        />
        <button type="button" aria-label="Capo up a fret" disabled={capo === MAX_CAPO} onClick={() => set(capo + 1)}>+</button>
      </span>
    </>
  );
}
