'use client';

/**
 * A tempo (Jeremy, 2026-10-29): bpm in a small number field (typed, stepped with its buttons or ↑ ↓,
 * or dragged), a Tap button that takes the tempo from a few taps in a row (T taps too), and an
 * optional label ("Slowly"). Opened by a press on the tempo in the score's head (the first bar's) or
 * by the Tempo tool or a picked tempo's Edit (a later bar's). The drawing follows what is set; Enter
 * or a press away keeps it as one undo step, Esc puts it back. It opens with the focus on itself: a
 * digit types the bpm, ↑ ↓ step it, T taps.
 */
import { useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { setTempo } from './barEdits';
import { DEFAULT_BPM, MAX_BPM, MIN_BPM, type Part, type Tempo } from './clip';
import { NumberField, resetOnDoubleClick } from './NumberField';
import { addTap, tapBpm } from './tapTempo';
import { usePopover } from './usePopover';

/** The tempo in effect at a bar: the last one set at or before it, else alphaTab's 120. */
export function tempoFrom(clip: Part, bar: number): Tempo {
  for (let b = Math.min(bar, clip.bars.length - 1); b >= 0; b--) {
    const tempo = clip.bars[b].tempo;
    if (tempo) return tempo;
  }
  return { bpm: DEFAULT_BPM };
}

export function TempoPanel({ clip, bar, x, y, onChange, onDone }: {
  /** The clip as it was when the panel opened. */
  clip: Part;
  /** The bar the tempo starts at. */
  bar: number;
  x: number;
  y: number;
  /** The clip with the tempo as set so far, shown while the panel is open. */
  onChange: (clip: Part) => void;
  /** Closed: the clip to keep, or null to put it back as it was (Esc). */
  onDone: (clip: Part | null) => void;
}) {
  const start = clip.bars[bar]?.tempo ?? { bpm: tempoFrom(clip, bar).bpm };
  const [bpm, setBpm] = useState(start.bpm);
  const [label, setLabel] = useState(start.label ?? '');

  // Nothing changed keeps the clip as it was: opening and closing the panel isn't an edit.
  const latest = useRef(clip);
  const show = (next: { bpm?: number; label?: string }) => {
    const b = next.bpm ?? bpm;
    const l = (next.label ?? label).trim();
    latest.current = setTempo(clip, bar, l ? { bpm: b, label: l } : { bpm: b });
    onChange(latest.current);
  };
  const setNumber = (b: number) => {
    setBpm(b);
    show({ bpm: b });
  };

  // The presses of the run of taps so far, in milliseconds.
  const taps = useRef<number[]>([]);
  const tap = () => {
    taps.current = addTap(taps.current, performance.now());
    const tapped = tapBpm(taps.current);
    if (tapped !== null && tapped !== bpm) setNumber(tapped);
  };

  const done = useRef(false);
  const finish = (keep: boolean) => {
    if (done.current) return;
    done.current = true;
    onDone(keep ? latest.current : null);
  };
  // The panel itself takes the focus, not the bpm field, so a press on the number drags it at once
  // (a focused number field takes a press as the caret's). A digit typed goes into the field.
  const { ref, style } = usePopover({ x, y, onClose: () => finish(true) });
  const bpmInput = () => ref.current?.querySelector<HTMLInputElement>('input[role="spinbutton"]');
  const labelRef = useRef<HTMLInputElement>(null);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // The page's own keys (Space plays) stay out of the panel.
    e.stopPropagation();
    const typing = e.target instanceof HTMLInputElement;
    const onPanel = e.target === ref.current;
    if (e.key === 'Enter' && (typing || onPanel)) finish(true);
    // A digit starts typing the bpm afresh; the key itself lands in the field.
    else if (onPanel && /^\d$/.test(e.key)) {
      bpmInput()?.focus();
      bpmInput()?.select();
    }
    else if (onPanel && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      setNumber(Math.min(MAX_BPM, Math.max(MIN_BPM, bpm + (e.key === 'ArrowUp' ? 1 : -1))));
    }
    else if (e.key === 'Escape') finish(false);
    // T taps, but not in the label, where it is a letter.
    else if ((e.key === 't' || e.key === 'T') && !e.repeat && !e.ctrlKey && !e.metaKey && e.target !== labelRef.current) {
      e.preventDefault();
      tap();
    }
  };

  return createPortal(
    // Its keys are the fields' own: Enter keeps, Esc puts back, T taps.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div ref={ref} role="dialog" aria-label="Tempo" className="shape-menu tab-head-panel tab-tempo-panel" style={style} tabIndex={-1} onKeyDown={onKeyDown}>
      <span className="tab-time-caption">Tempo</span>
      <div className="tab-tempo-row">
        {/* A double-click on the number or "bpm" puts it back to 120, as other number fields do. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- a mouse shortcut only; from the keyboard, type 120 */}
        <div className="tab-speed" role="group" aria-label="Beats per minute" onDoubleClick={e => resetOnDoubleClick(e, () => setNumber(DEFAULT_BPM))}>
          <NumberField
            value={bpm} min={MIN_BPM} max={MAX_BPM} step={1}
            label="Tempo (bpm)" upLabel="Faster" downLabel="Slower" onChange={setNumber}
          />
          <span className="text-(--ink-muted)">bpm</span>
        </div>
        {/* Timed from the press, not the release, so the beat is where the finger lands. */}
        <button
          type="button" className="btn btn-secondary tab-tap"
          onPointerDown={e => { if (e.button === 0) tap(); }}
          onKeyDown={e => {
            if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
              e.preventDefault();
              e.stopPropagation();
              tap();
            }
          }}
        >
          Tap
        </button>
      </div>
      <label className="grid gap-1.5">
        <span className="tab-time-caption">Label (optional)</span>
        <input
          ref={labelRef} className="input tab-tempo-label" aria-label="Label (optional)" placeholder="Slowly" value={label} maxLength={40}
          onChange={e => { setLabel(e.target.value); show({ label: e.target.value }); }}
        />
      </label>
    </div>,
    document.body,
  );
}
