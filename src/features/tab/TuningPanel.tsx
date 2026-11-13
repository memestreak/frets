'use client';

/**
 * The tuning (issue #203), opened by a press on the tuning in the score's head, or on the space where
 * it would go when the guitar is in standard tuning: the common tunings, then each string, lowest
 * first, its note picked on the shared piano `KeyPicker`; then the capo (issue #463,
 * `docs/specs/2026-11-13-tab-capo-in-tuning-design.md`). Every change is one undo step and keeps the
 * frets (`tuning.ts`); a capo change keeps the tuning, and the tuning keeps the capo.
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { KeyPicker } from '@/components/KeyPicker';
import { prettyNote } from '@/lib/theory/notes';
import { MAX_CAPO, STRING_COUNT, type Part } from './clip';
import { setCapo } from './barEdits';
import { CapoNeck, type CapoLook } from './CapoNeck';
import { fretWords } from './credits';
import { presetOf, stringNote, TUNING_PRESETS, withStringNote, withTuning } from './tuning';
import { usePanel } from './usePanel';

export function TuningPanel({ clip, x, y, capoLook = 'a', onChange, onClose }: {
  clip: Part;
  /** The capo picture's look, while Jeremy picks one (`CAPO_LOOK_MOCK`). */
  capoLook?: CapoLook;
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
      <CapoPicker tuning={clip.tuning} capo={clip.capo ?? 0} look={capoLook} onCapo={capo => onChange(setCapo(clip, capo === 0 ? null : capo))} />
    </div>,
    document.body,
  );
}

/**
 * The capo (issue #463): a dropdown, None first, then the 1st to the 12th fret; with a capo on, the
 * neck under it shows where, and a press on a fret moves it there. Each choice is one undo step.
 */
function CapoPicker({ tuning, capo, look, onCapo }: {
  tuning: readonly string[];
  capo: number;
  look: CapoLook;
  onCapo: (capo: number) => void;
}) {
  const set = (next: number) => {
    if (next !== capo) onCapo(next);
  };
  return (
    <>
      <label className="tab-time-caption" htmlFor="tab-capo">Capo</label>
      <select id="tab-capo" className="input tab-capo-pick" value={capo} onChange={e => set(Number(e.target.value))}>
        <option value={0}>None</option>
        {Array.from({ length: MAX_CAPO }, (_, k) => k + 1).map(f => <option key={f} value={f}>{fretWords(f)}</option>)}
      </select>
      {capo > 0 && <CapoNeck tuning={tuning} capo={capo} look={look} onCapo={set} />}
    </>
  );
}
