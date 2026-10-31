'use client';

/**
 * Advanced: the rhythm in full, the same under every view, and closed at first. Rhythm only
 * (Jeremy, 2026-10-31): the meter and presets, the click pattern's voices A to D, and a polyrhythm.
 */
import { useRef, useState, type ReactNode } from 'react';
import { VolumeKnob } from '@/components/VolumeKnob';
import { letGoOfFields } from '@/hooks/useLetGoAfterUse';
import { Num, SoundSelect, isNow } from './controls';
import {
  DEFAULT_POLY_COUNT, MAX_POLY, MAX_STEPS, MAX_SWING, MIN_SWING, PRESETS, RESET_LEVEL, VOICE_NAMES, countSyllable,
  groupStarts, parseGroups, toggleCell, withBeatSubs, withGroups, withPreset, withSwing, withVoice, type Poly, type VoiceId,
} from './rhythm';
import type { Metronome } from './useMetronomeCore';

export function Advanced({ m }: { m: Metronome }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="metronome-advanced">
      <button type="button" className="metronome-advanced-toggle" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M4 2.5 7.5 6 4 9.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Advanced
      </button>
      {open && (
        <div className="metronome-advanced-body">
          <Group title="Meter"><Meter m={m} /></Group>
          <Group title="Click pattern" note="Each beat is split into steps; each step plays one voice, A to D, or nothing. Press a cell to put that voice there.">
            <VoiceGrid m={m} />
          </Group>
          <Group
            title="Polyrhythm" note="A second layer: this many even clicks across the bar, against the beats. 3 across 2 beats is 3 over 2."
            aside={<PolySwitch m={m} />}
          >
            <Polyrhythm m={m} />
          </Group>
        </div>
      )}
    </div>
  );
}

function Group({ title, note, aside, children }: { title: string; note?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="metronome-group">
      <div className="metronome-group-head">
        <h2 className="metronome-group-title">
          {title}
          {note && <span className="metronome-group-note" data-tip={note} aria-label={note} role="img"> ⓘ</span>}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** The voices' and the polyrhythm's columns, named once over each (#270). */
const ColumnNames = () => (
  <>
    <span />
    <span className="metronome-col-name">Sound</span>
    <span className="metronome-col-name">Pitch</span>
    <span className="metronome-col-name metronome-col-knob">Volume</span>
  </>
);

/** High or low: the sound's accent sample or its plain one. */
function PitchButton({ high, label, disabled, onChange }: { high: boolean; label: string; disabled?: boolean; onChange: (high: boolean) => void }) {
  return (
    <button
      type="button" className="metronome-pitch" aria-pressed={high} disabled={disabled}
      aria-label={`${label} pitch: ${high ? 'high' : 'low'}`}
      data-tip={high ? 'High (press for low)' : 'Low (press for high)'}
      onClick={() => onChange(!high)}
    >{high ? 'High' : 'Low'}</button>
  );
}

/** A preset, how the beats group (2+2+3) and the swing. The beats are in the main controls (#270). */
function Meter({ m }: { m: Metronome }) {
  // The groups as typed, taken on Enter or on leaving the field.
  const [draft, setDraft] = useState<string | null>(null);
  const settle = () => {
    if (draft === null) return;
    m.setRhythm(r => withGroups(r, parseGroups(draft)));
    setDraft(null);
  };
  return (
    <div className="metronome-row">
      <label className="metronome-field">
        <span className="text-(--ink-muted)">Preset</span>
        <select
          className="input metronome-select" aria-label="Preset" value=""
          onChange={e => {
            const [g, i] = e.target.value.split(':').map(Number);
            m.setRhythm(r => withPreset(r, PRESETS[g].items[i]));
          }}
        >
          <option value="" disabled>Choose…</option>
          {PRESETS.map((p, g) => (
            <optgroup key={p.group} label={p.group}>
              {p.items.map((item, i) => <option key={item.name} value={`${g}:${i}`}>{item.name}</option>)}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="metronome-field">
        <span className="text-(--ink-muted)">Groups</span>
        <input
          className="input metronome-groups" aria-label="Groups" placeholder="2+2+3"
          value={draft ?? m.rhythm.groups.join('+')}
          onChange={e => setDraft(e.target.value)} onBlur={settle}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        />
      </label>
      <Num
        label="Swing" value={m.rhythm.swing} min={MIN_SWING} max={MAX_SWING} unit="%" reset={MIN_SWING}
        onChange={swing => m.setRhythm(r => withSwing(r, swing))}
      />
    </div>
  );
}

/** The grid, after REAPER's click pattern: a row per voice (its sound, pitch and level), a column per step. */
function VoiceGrid({ m }: { m: Metronome }) {
  const { subs, steps, voices, groups } = m.rhythm;
  const starts = groupStarts(groups);
  const controls = (v: VoiceId, name: string) => (
    <>
      <SoundSelect
        label={`Voice ${name} sound`} value={voices[v].sound}
        onChange={sound => { m.setRhythm(r => withVoice(r, v, { sound })); m.preview(sound, voices[v].high, voices[v].level); }}
      />
      <PitchButton high={voices[v].high} label={`Voice ${name}`} onChange={high => m.setRhythm(r => withVoice(r, v, { high }))} />
      <VolumeKnob
        value={voices[v].level} onChange={level => m.setRhythm(r => withVoice(r, v, { level }))} labelledBy={`metronome-voice-${v}`}
        name={`${name} volume`} reset={RESET_LEVEL}
      />
    </>
  );
  return (
    <>
      {/* On a phone the voices' controls are a list above the grid, and the grid's rows are only lettered. */}
      <div className="metronome-voice-list metronome-cols">
        <ColumnNames />
        {VOICE_NAMES.map((name, v) => (
          <div key={name} className="metronome-voice"><span className="metronome-voice-name">{name}</span>{controls(v as VoiceId, name)}</div>
        ))}
      </div>
      <div className="metronome-grid-wrap">
        <div className="metronome-voices metronome-cols">
          <ColumnNames />
          {VOICE_NAMES.map((name, v) => (
            <div key={name} className="metronome-voice">
              <span className="metronome-voice-name">{name}</span>
              <span className="metronome-voice-controls">{controls(v as VoiceId, name)}</span>
              <span id={`metronome-voice-${v}`} className="sr-only">Voice {name} volume</span>
            </div>
          ))}
        </div>
        <div className="metronome-grid-scroll">
          <div className="metronome-grid" style={{ gridTemplateColumns: subs.map(n => `repeat(${n}, minmax(22px, 1fr))`).join(' ') }}>
            {subs.map((n, b) => (
              <div key={`head${b}`} className="metronome-grid-beat" style={{ gridColumn: `span ${n}` }} data-group-start={(groups.length > 0 && starts.has(b)) || undefined}>
                <span>{b + 1}</span>
              </div>
            ))}
            {VOICE_NAMES.map((name, v) => subs.map((n, b) => Array.from({ length: n }, (_, s) => {
              const here = steps[b]?.[s] === v;
              return (
                <button
                  key={`${v}-${b}-${s}`} type="button" className="metronome-grid-cell"
                  data-beat-start={s === 0 || undefined} data-now={isNow(m, b, s) || undefined}
                  aria-label={`Beat ${b + 1} step ${s + 1}, voice ${name}`} aria-pressed={here}
                  onClick={() => m.setRhythm(r => toggleCell(r, b, s, v as VoiceId))}
                >
                  {here && <span className="metronome-grid-dot" data-voice={name} />}
                </button>
              );
            })))}
            {/* Under each beat: how many steps it has, then how they are counted. */}
            {subs.map((n, b) => (
              <div key={`foot${b}`} className="metronome-grid-foot" style={{ gridColumn: `span ${n}` }}>
                <DragNumber label={`Steps in beat ${b + 1}`} value={n} min={1} max={MAX_STEPS} reset={1} onChange={k => m.setRhythm(r => withBeatSubs(r, b, k))} />
              </div>
            ))}
            {subs.map((n, b) => Array.from({ length: n }, (_, s) => (
              <div key={`count${b}-${s}`} className="metronome-grid-count">{countSyllable(b, s, n)}</div>
            )))}
          </div>
        </div>
      </div>
    </>
  );
}

const DRAG_PX = 10;

/**
 * A small number with no buttons, for the grid's tight rows: drag up or down, ↑ ↓, or a double-click
 * to put it back.
 */
function DragNumber({ label, value, min, max, reset, onChange }: {
  label: string; value: number; min: number; max: number; reset: number; onChange: (v: number) => void;
}) {
  const drag = useRef<{ y: number; moved: number } | null>(null);
  const set = (v: number) => {
    const next = Math.min(max, Math.max(min, v));
    if (next !== value) onChange(next);
  };
  const end = () => {
    drag.current = null;
  };
  return (
    <span
      className="metronome-dragnum" role="spinbutton" tabIndex={0} aria-label={label}
      aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} data-tip={`${label}: drag up or down`}
      onPointerDown={e => {
        e.preventDefault();
        letGoOfFields();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { y: e.clientY, moved: 0 };
      }}
      onPointerMove={e => {
        const d = drag.current;
        if (!d) return;
        d.moved += d.y - e.clientY;
        d.y = e.clientY;
        const steps = Math.trunc(d.moved / DRAG_PX);
        if (steps === 0) return;
        d.moved -= steps * DRAG_PX;
        set(value + steps);
      }}
      onPointerUp={end} onPointerCancel={end}
      onDoubleClick={() => set(reset)}
      onKeyDown={e => {
        const by = ({ ArrowUp: 1, ArrowDown: -1 } as Record<string, number>)[e.key];
        if (by === undefined) return;
        e.preventDefault();
        set(value + by);
      }}
    >{value}</span>
  );
}

/** The polyrhythm on or off: a switch by its title (#270; "a slider that turns it on and off"). */
function PolySwitch({ m }: { m: Metronome }) {
  const { on } = m.rhythm.poly;
  return (
    <button
      type="button" role="switch" aria-checked={on} aria-label="Polyrhythm" className="metronome-switch"
      data-tip={on ? 'Polyrhythm on (press for off)' : 'Polyrhythm off (press for on)'}
      onClick={() => m.setRhythm(r => ({ ...r, poly: { ...r.poly, on: !r.poly.on } }))}
    >
      <span className="metronome-switch-thumb" aria-hidden="true" />
    </button>
  );
}

/**
 * The polyrhythm's sound, pitch and volume, in the voices' columns, then its count, and its clicks
 * against the beats. Off, all of it stays where it is, greyed out (#270).
 */
function Polyrhythm({ m }: { m: Metronome }) {
  const { poly, beats } = m.rhythm;
  const off = !poly.on;
  const setPoly = (patch: Partial<Poly>) => m.setRhythm(r => ({ ...r, poly: { ...r.poly, ...patch } }));
  return (
    <div className="metronome-poly-body" data-off={off || undefined}>
      <div className="metronome-cols metronome-poly-controls">
        <ColumnNames />
        <span className="metronome-col-name metronome-poly-clicks-name">Clicks</span>
        <span />
        <SoundSelect
          label="Polyrhythm sound" value={poly.sound} disabled={off}
          onChange={sound => { setPoly({ sound }); m.preview(sound, poly.high, poly.level); }}
        />
        <PitchButton high={poly.high} label="Polyrhythm" disabled={off} onChange={high => setPoly({ high })} />
        <span id="metronome-poly-label" className="sr-only">Polyrhythm volume</span>
        <VolumeKnob
          value={poly.level} onChange={level => setPoly({ level })} labelledBy="metronome-poly-label" name="Volume"
          reset={RESET_LEVEL} disabled={off}
        />
        <div className="metronome-poly-clicks">
          <Num
            label="Clicks" hideLabel value={poly.count} min={1} max={MAX_POLY} reset={DEFAULT_POLY_COUNT} disabled={off}
            after={`across the bar (${poly.count} over ${beats})`} onChange={count => setPoly({ count })}
          />
        </div>
      </div>
      <div className="metronome-poly" aria-hidden="true">
        <div className="metronome-poly-row">
          {Array.from({ length: beats }, (_, i) => (
            <span key={i} className="metronome-poly-mark" style={{ left: `${(i / beats) * 100}%` }} data-on={(!off && isNow(m, i)) || undefined} />
          ))}
        </div>
        <div className="metronome-poly-row">
          {Array.from({ length: poly.count }, (_, i) => (
            <span
              key={i} className="metronome-poly-mark metronome-poly-mark-alt" style={{ left: `${(i / poly.count) * 100}%` }}
              data-on={(!off && m.playing && m.now?.poly === i) || undefined}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
