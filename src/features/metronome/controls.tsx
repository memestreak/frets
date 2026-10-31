'use client';

/** The controls every view shares: the head, Start, Tap, the number fields, and the sound. */
import { createContext, useContext, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { NumberField, resetOnDoubleClick } from '@/components/NumberField';
import { showShortcuts } from '@/components/shortcuts/useShortcuts';
import { VolumeKnob } from '@/components/VolumeKnob';
import { usePreferenceSaveProblem } from '@/hooks/usePersist';
import {
  DEFAULT_BEATS, DEFAULT_BPM, MAX_BEATS, MAX_BPM, MIN_BPM, SOUNDS, VOICE_NAMES, clampBpm, withAllSubs, withBeats,
  withSound, type SoundId, type Step,
} from './rhythm';
import { VIEWS, type ViewId } from './storage';
import type { Metronome } from './useMetronome';

/** The view shown, and how to change it, for the switch in every view's head. */
export const ViewChoice = createContext<{ view: ViewId; setView: (view: ViewId) => void }>({ view: 'readout', setView: () => {} });

/**
 * The title, then the view switch (Jeremy, 2026-10-31: in the head, in place of a Settings gear),
 * the ⚠ while the view can't be saved, and the shortcuts' ?.
 */
export function Head({ children }: { children?: ReactNode }) {
  const { view, setView } = useContext(ViewChoice);
  const saveProblem = usePreferenceSaveProblem();
  return (
    <div className="metronome-head">
      <h1 id="metronome-title" className="m-0">Metronome</h1>
      {children}
      <span className="metronome-head-end">
        <div className="seg metronome-views" role="group" aria-label="View">
          {VIEWS.map(([id, name]) => (
            <button key={id} type="button" className="seg-opt" aria-pressed={view === id} onClick={() => setView(id)}>{name}</button>
          ))}
        </div>
        {saveProblem && (
          <span
            className="settings-save-problem" role="img" aria-label={`The view couldn't be saved: ${saveProblem}`}
            title={`The view couldn't be saved: ${saveProblem}`}
          >
            ⚠{'\uFE0E'}
          </span>
        )}
        <button type="button" className="btn btn-secondary btn-icon" aria-label="Shortcuts" data-tip="Shortcuts (?)" onClick={showShortcuts}>
          <span aria-hidden="true" className="shortcuts-button-mark">?</span>
        </button>
      </span>
    </div>
  );
}

/** How far a drag on a tempo moves before it steps it, and the step: 5 bpm, or 1 with Shift. */
const DRAG_PX = 8;
const DRAG_BPM = 5;

/**
 * Drag up or down on a tempo, wherever it is shown, to change it: 5 bpm a step, 1 with Shift held.
 * Spread the result on the element that shows the tempo.
 */
export function useBpmDrag(m: Metronome) {
  const drag = useRef<{ y: number; moved: number } | null>(null);
  const end = () => {
    drag.current = null;
  };
  return {
    onPointerDown: (e: PointerEvent<Element>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { y: e.clientY, moved: 0 };
    },
    onPointerMove: (e: PointerEvent<Element>) => {
      const d = drag.current;
      if (!d) return;
      d.moved += d.y - e.clientY;
      d.y = e.clientY;
      const steps = Math.trunc(d.moved / DRAG_PX);
      if (steps === 0) return;
      d.moved -= steps * DRAG_PX;
      const by = steps * (e.shiftKey ? 1 : DRAG_BPM);
      m.setRhythm(r => ({ ...r, bpm: clampBpm(r.bpm + by) }));
    },
    onPointerUp: end,
    onPointerCancel: end,
  };
}

const PlayIcon = () => <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9.5-5.5z" fill="currentColor" /></svg>;
const StopIcon = () => <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="3" width="10" height="10" rx="1.5" fill="currentColor" /></svg>;

/** Start, a muted green; while running it turns the primary colour and says Stop. */
export function PlayButton({ m, round }: { m: Metronome; round?: boolean }) {
  const name = m.playing ? 'Stop' : 'Start';
  return (
    <button
      type="button" className={`btn metronome-play${m.playing ? ' btn-primary' : ' metronome-start'}${round ? ' metronome-round' : ''}`}
      onClick={m.toggle} aria-label={name} data-tip={`${name} (Space)`}
    >
      {m.playing ? <StopIcon /> : <PlayIcon />}
      {!round && <span>{name}</span>}
    </button>
  );
}

/** Tap tempo: a lighter green than Start, as big, and it pulses on every press. */
export function TapButton({ m, round }: { m: Metronome; round?: boolean }) {
  const [pulse, setPulse] = useState(0);
  const press = () => {
    m.tap();
    setPulse(p => p + 1);
  };
  return (
    <button
      type="button" className={`btn metronome-tap${round ? ' metronome-round' : ''}`}
      data-tip="Tap twice or more in time to set the tempo (T)"
      // On the press, not the release, so the tap lands when the finger does.
      onPointerDown={e => { if (e.button === 0) press(); }}
      onKeyDown={e => { if (e.key === 'Enter') press(); }}
    >
      {pulse > 0 && <span key={pulse} className="metronome-tap-pulse" aria-hidden="true" />}
      Tap
    </button>
  );
}

/** A label, a number field and what follows it, in a row; a double-click on the row puts back `reset`. */
export function Num({ label, value, min, max, dragStep, unit, after, reset, onChange }: {
  label: string; value: number; min: number; max: number; dragStep?: number; unit?: string; after?: ReactNode;
  reset: number; onChange: (v: number) => void;
}) {
  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- a mouse shortcut only; from the keyboard, type the number
    <div className="metronome-field" onDoubleClick={e => resetOnDoubleClick(e, () => onChange(reset))}>
      <span className="text-(--ink-muted)">{label}</span>
      <NumberField value={value} min={min} max={max} step={1} dragStep={dragStep} unit={unit} label={label} upLabel="More" downLabel="Less" onChange={onChange} />
      {after && <span className="text-(--ink-muted)">{after}</span>}
    </div>
  );
}

export function BpmField({ m }: { m: Metronome }) {
  return (
    <Num
      label="Tempo" value={m.rhythm.bpm} min={MIN_BPM} max={MAX_BPM} dragStep={DRAG_BPM} after="bpm" reset={DEFAULT_BPM}
      onChange={bpm => m.setRhythm(r => ({ ...r, bpm }))}
    />
  );
}

export function BeatsField({ m }: { m: Metronome }) {
  return <Num label="Beats" value={m.rhythm.beats} min={1} max={MAX_BEATS} reset={DEFAULT_BEATS} onChange={beats => m.setRhythm(r => withBeats(r, beats))} />;
}

const SUBDIVISIONS: [steps: number, name: string][] = [[1, 'Quarters'], [2, 'Eighths'], [3, 'Triplets'], [4, 'Sixteenths']];

/** Every beat split alike. Nothing is lit when Advanced splits the beats differently. */
export function SubdivisionSeg({ m }: { m: Metronome }) {
  const { subs } = m.rhythm;
  const same = subs.every(n => n === subs[0]) ? subs[0] : null;
  return (
    <div className="seg" role="group" aria-label="Clicks per beat">
      {SUBDIVISIONS.map(([n, name]) => (
        <button key={n} type="button" className="seg-opt" aria-pressed={same === n} onClick={() => m.setRhythm(r => withAllSubs(r, n))}>{name}</button>
      ))}
    </div>
  );
}

export function SoundSelect({ label, value, onChange }: { label: string; value: SoundId | null; onChange: (s: SoundId) => void }) {
  return (
    <select className="input metronome-select" aria-label={label} value={value ?? ''} onChange={e => onChange(e.target.value as SoundId)}>
      {/* Advanced gave the voices different sounds: none of them is the sound. */}
      {value === null && <option value="" disabled>Mixed</option>}
      {SOUNDS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
    </select>
  );
}

/** The sound, every voice at once (Advanced sets each voice's own), and the volume. */
export function SoundControls({ m }: { m: Metronome }) {
  const { voices } = m.rhythm;
  const same = voices.every(v => v.sound === voices[0].sound) ? voices[0].sound : null;
  return (
    <>
      <div className="metronome-field">
        <span className="text-(--ink-muted)" aria-hidden="true">Sound</span>
        <SoundSelect label="Sound" value={same} onChange={sound => { m.setRhythm(r => withSound(r, sound)); m.preview(sound); }} />
      </div>
      <div className="metronome-field">
        <span className="text-(--ink-muted)" id="metronome-volume-label">Volume</span>
        <VolumeKnob value={m.volume} onChange={m.setVolume} labelledBy="metronome-volume-label" />
      </div>
    </>
  );
}

/** The voice a beat starts with, as the beat displays mark it: A, B, C, D or none. */
export const beatVoice = (m: Metronome, beat: number): Step => m.rhythm.steps[beat]?.[0] ?? null;
export const voiceAttr = (v: Step) => (v === null ? 'none' : VOICE_NAMES[v]);

/** Whether the click sounding now is step `step` of beat `beat` (step 0: the beat itself). */
export const isNow = (m: Metronome, beat: number, step = 0) => m.now?.beat === beat && m.now.step === step;
