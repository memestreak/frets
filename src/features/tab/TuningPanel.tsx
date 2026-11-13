'use client';

/**
 * The tuning (issue #203), opened by a press on the tuning in the score's head, or on the space where
 * it would go when the guitar is in standard tuning: the common tunings in a dropdown, then each
 * string, lowest first, a picked one's note set on the shared piano `KeyPicker` (shown only while a
 * string is picked); then the capo (issue #463,
 * `docs/specs/2026-11-13-tab-capo-in-tuning-design.md`). Every change is one undo step and keeps the
 * frets (`tuning.ts`); a capo change keeps the tuning, and the tuning keeps the capo.
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { KeyPicker } from '@/components/KeyPicker';
import { prettyNote } from '@/lib/theory/notes';
import { MAX_CAPO, STRING_COUNT, type Part } from './clip';
import { setCapo } from './barEdits';
import { CapoNeck } from './CapoNeck';
import { fretWords } from './credits';
import { presetOf, stringNote, TUNING_PRESETS, withStringNote, withTuning } from './tuning';
import { usePanel } from './usePanel';

export function TuningPanel({ clip, x, y, onChange, onClose }: {
  clip: Part;
  x: number;
  y: number;
  onChange: (clip: Part) => void;
  onClose: () => void;
}) {
  // The string whose note the piano picks, counted from the low E (0); none picked, no piano.
  const [low, setLow] = useState<number | null>(null);
  const { ref, style } = usePanel({ x, y, focus: '#tab-tuning', onClose });
  const preset = presetOf(clip.tuning);
  const lows = Array.from({ length: STRING_COUNT }, (_, s) => s);

  return createPortal(
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- it only keeps the page's keys out
    <div
      ref={ref} role="dialog" aria-label="Tuning" className="shape-menu tab-head-panel tab-tuning-panel" style={style} tabIndex={-1}
      // The page's own keys (Space plays, the arrows move the playback line) stay out of the panel; undo and Esc go through.
      // Esc lets a picked string go first, hiding the piano; with none picked it closes the panel.
      onKeyDown={e => {
        if (e.key === 'Escape' && low !== null) {
          setLow(null);
          e.stopPropagation();
        } else if (e.key !== 'Escape' && !e.ctrlKey && !e.metaKey) e.stopPropagation();
      }}
      // A press elsewhere in the panel lets the picked string go (`2026-11-01-deselect-design.md`).
      onPointerDown={e => {
        if (!(e.target as Element).closest('.tab-tuning-string, .tab-tuning-piano')) setLow(null);
      }}
    >
      {/* Three sections, each under a header of its own (Jeremy, 2026-11-13). */}
      <div className="tab-panel-section">
        <label className="settings-pane-heading" htmlFor="tab-tuning">Tuning</label>
        <select
          id="tab-tuning" className="input tab-panel-pick" value={preset?.name ?? ''}
          onChange={e => { const p = TUNING_PRESETS.find(t => t.name === e.target.value); if (p) onChange(withTuning(clip, p.notes)); }}
        >
          {/* Only while the strings are tuned as no preset is. */}
          {!preset && <option value="" disabled>Custom</option>}
          {TUNING_PRESETS.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
      </div>
      <div className="tab-panel-section">
        <span className="settings-pane-heading">Strings</span>
        <div className="seg" role="group" aria-label="String">
          {lows.map(s => (
            <button
              key={s} type="button" className="seg-opt tab-tuning-string" aria-pressed={s === low} onClick={() => setLow(s === low ? null : s)}
              aria-label={`String ${STRING_COUNT - s}: ${prettyNote(stringNote(clip.tuning, s))}`}
            >
              <span className="score-string" aria-hidden="true">{STRING_COUNT - s}</span>
              {prettyNote(stringNote(clip.tuning, s))}
            </button>
          ))}
        </div>
        {low !== null && (
          <div className="tab-tuning-piano">
            <KeyPicker
              label={`String ${STRING_COUNT - low}`} value={stringNote(clip.tuning, low)}
              onPick={note => onChange(withStringNote(clip, low, note))}
            />
          </div>
        )}
      </div>
      <CapoPicker tuning={clip.tuning} capo={clip.capo ?? 0} onCapo={capo => onChange(setCapo(clip, capo === 0 ? null : capo))} />
    </div>,
    document.body,
  );
}

/**
 * The capo (issue #463): a dropdown, None first, then the 1st to the 12th fret; the neck under it,
 * always shown, draws where, and a press on a fret puts the capo there. Each choice is one undo step.
 */
function CapoPicker({ tuning, capo, onCapo }: {
  tuning: readonly string[];
  capo: number;
  onCapo: (capo: number) => void;
}) {
  const set = (next: number) => {
    if (next !== capo) onCapo(next);
  };
  return (
    <div className="tab-panel-section">
      <label className="settings-pane-heading" htmlFor="tab-capo">Capo</label>
      <select id="tab-capo" className="input tab-panel-pick" value={capo} onChange={e => set(Number(e.target.value))}>
        <option value={0}>None</option>
        {Array.from({ length: MAX_CAPO }, (_, k) => k + 1).map(f => <option key={f} value={f}>{fretWords(f)}</option>)}
      </select>
      <CapoNeck tuning={tuning} capo={capo} onCapo={set} />
    </div>
  );
}
