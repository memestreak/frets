'use client';

/**
 * Look mocks for the Metronome page (issue #149), behind ?mock=a/b/c/d. Each is a working
 * metronome (Space starts and stops) so the feel can be judged, not only the look. Advanced is
 * the same in all four.
 */
import { createContext, useContext, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { HoverTips } from '@/components/HoverTips';
import { GearIcon } from '@/components/icons';
import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { choiceField } from '@/components/settings/fields';
import { useGeneralGroup } from '@/components/settings/general';
import { section, type SettingsGroup } from '@/components/settings/types';
import { NumberField, resetOnDoubleClick } from '@/features/tab/NumberField';
import { VolumeKnob } from '@/features/tab/VolumeKnob';
import {
  MAX_BEATS, MAX_BPM, MIN_BPM, PRESETS, SOUNDS, VOICE_NAMES, syllable, tempoName, useMetronome,
  type Metronome, type SoundId, type Step, type VoiceId,
} from './engine';
import './mocks.css';

const MOCKS = {
  a: 'Readout',
  b: 'Dial',
  c: 'Pendulum',
  d: 'Bar',
} as const;
type MockId = keyof typeof MOCKS;

/** Opens Settings, from the gear by each view's title. */
const OpenSettings = createContext<() => void>(() => {});

interface Display extends Record<string, unknown> {
  view: MockId;
}

export default function MetronomeMocks() {
  const [mock, setMock] = useState<MockId>('a');
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get('mock');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once after hydration (static export)
    if (m && m in MOCKS) setMock(m as MockId);
  }, []);
  const choose = (m: MockId) => {
    setMock(m);
    const url = new URL(window.location.href);
    url.searchParams.set('mock', m);
    window.history.replaceState(null, '', url);
  };
  // The view is a preference: Settings › Metronome › Display (frets.metronome.display on the real page).
  const metronomeGroup: SettingsGroup = {
    id: 'metronome', name: 'Metronome',
    sections: [section<Display>({
      id: 'display', name: 'Display', value: { view: mock }, defaults: { view: 'a' },
      save: v => choose(v.view),
      fields: [choiceField<Display, 'view', MockId>('view', 'View', (Object.keys(MOCKS) as MockId[]).map(id => [id, MOCKS[id]] as const))],
    })],
  };
  const groups = [useGeneralGroup(), metronomeGroup];
  return (
    <OpenSettings.Provider value={() => setSettingsOpen(true)}>
      <HoverTips>
        <div className="mm">
          <div className="mm-switch seg" role="group" aria-label="Mock">
            {(Object.keys(MOCKS) as MockId[]).map(m => (
              <button key={m} type="button" className="seg-opt" aria-pressed={mock === m} onClick={() => choose(m)}>
                {m.toUpperCase()} · {MOCKS[m]}
              </button>
            ))}
          </div>
          {/* A fresh metronome per view, so one stops when another is picked. */}
          {mock === 'a' && <Readout />}
          {mock === 'b' && <Dial />}
          {mock === 'c' && <Pendulum />}
          {mock === 'd' && <Bar />}
        </div>
      </HoverTips>
      <SettingsDialog groups={groups} open={settingsOpen} at={{ group: 'metronome', section: 'display' }} onClose={() => setSettingsOpen(false)} />
    </OpenSettings.Provider>
  );
}

/* — shared bits — */

/** The title, with the gear for Settings at the row's end. */
function Head({ children }: { children?: ReactNode }) {
  const open = useContext(OpenSettings);
  return (
    <div className="mm-head">
      <h1 id="mm-title" className="m-0">Metronome</h1>
      <span className="mm-head-end">
        {children}
        <button type="button" className="btn btn-secondary btn-icon" aria-label="Settings" data-tip="Settings" onClick={open}><GearIcon /></button>
      </span>
    </div>
  );
}

/**
 * Drag up or down on a tempo to change it, wherever it is shown: 5 bpm a step, 1 with Shift held.
 * Spread on the element that shows it.
 */
function useBpmDrag(m: Metronome) {
  const drag = useRef<{ y: number; acc: number } | null>(null);
  const PX = 8;
  return {
    onPointerDown: (e: PointerEvent<Element>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { y: e.clientY, acc: 0 };
    },
    onPointerMove: (e: PointerEvent<Element>) => {
      const d = drag.current;
      if (!d) return;
      d.acc += d.y - e.clientY;
      d.y = e.clientY;
      const steps = Math.trunc(d.acc / PX);
      if (steps === 0) return;
      d.acc -= steps * PX;
      const by = steps * (e.shiftKey ? 1 : 5);
      m.set({ bpm: Math.min(MAX_BPM, Math.max(MIN_BPM, m.bpm + by)) });
    },
    onPointerUp: () => { drag.current = null; },
    onPointerCancel: () => { drag.current = null; },
  };
}

/** The tempo playing now: the trainer or the song may have moved it. */
const liveBpm = (m: Metronome) => m.now?.bpm ?? m.bpm;

function PlayButton({ m, round }: { m: Metronome; round?: boolean }) {
  return (
    <button
      type="button" className={`btn mm-play${m.playing ? ' btn-primary' : ' mm-start'}${round ? ' mm-play-round' : ''}`}
      onClick={m.toggle} aria-label={m.playing ? 'Stop' : 'Start'} data-tip={m.playing ? 'Stop (Space)' : 'Start (Space)'}
    >
      {m.playing ? (
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="3" width="10" height="10" rx="1.5" fill="currentColor" /></svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9.5-5.5z" fill="currentColor" /></svg>
      )}
      {!round && <span>{m.playing ? 'Stop' : 'Start'}</span>}
    </button>
  );
}

/** Tap tempo: green, lighter than Start, and it pulses on every press. */
function TapButton({ m, round }: { m: Metronome; round?: boolean }) {
  const [pulse, setPulse] = useState(0);
  const press = () => { m.tap(); setPulse(p => p + 1); };
  return (
    <button
      type="button" className={`btn mm-tap${round ? ' mm-play-round' : ''}`} data-tip="Tap twice or more in time to set the tempo"
      onPointerDown={press} onKeyDown={e => { if (e.key === 'Enter') press(); }}
    >
      {pulse > 0 && <span key={pulse} className="mm-tap-pulse" aria-hidden="true" />}
      Tap
    </button>
  );
}


/** A label, a number field and what follows it, in a row. */
function Num({ label, value, min, max, step = 1, dragStep, unit, after, reset, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; dragStep?: number; unit?: string; after?: ReactNode;
  /** Its usual value: a double-click on the row puts it back. */
  reset?: number;
  onChange: (v: number) => void;
}) {
  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- a mouse shortcut only; from the keyboard, type the number
    <div className="tab-speed" onDoubleClick={reset === undefined ? undefined : e => resetOnDoubleClick(e, () => onChange(reset))}>
      {label && <span className="text-(--ink-muted)">{label}</span>}
      <NumberField value={value} min={min} max={max} step={step} dragStep={dragStep} unit={unit} label={label || 'Number'} upLabel="More" downLabel="Less" onChange={onChange} />
      {after && <span className="text-(--ink-muted)">{after}</span>}
    </div>
  );
}

function BpmField({ m }: { m: Metronome }) {
  return <Num label="Tempo" value={m.bpm} min={MIN_BPM} max={MAX_BPM} dragStep={5} after="bpm" reset={120} onChange={bpm => m.set({ bpm })} />;
}

function BeatsField({ m }: { m: Metronome }) {
  return <Num label="Beats" value={m.beats} min={1} max={MAX_BEATS} reset={4} onChange={beats => m.set({ beats })} />;
}

const SUBDIVISIONS: [number, string][] = [[1, 'Quarters'], [2, 'Eighths'], [3, 'Triplets'], [4, 'Sixteenths']];

/** Every beat split alike; nothing lit when the beats are split differently (Advanced). */
function SubdivisionSeg({ m }: { m: Metronome }) {
  const same = m.subs.every(n => n === m.subs[0]) ? m.subs[0] : null;
  return (
    <div className="seg" role="group" aria-label="Clicks per beat">
      {SUBDIVISIONS.map(([n, name]) => (
        <button key={n} type="button" className="seg-opt" aria-pressed={same === n} onClick={() => m.setAllSubs(n)}>{name}</button>
      ))}
    </div>
  );
}

function SoundSelect({ value, onChange, label }: { value: SoundId; onChange: (s: SoundId) => void; label: string }) {
  return (
    <select className="input mm-select" aria-label={label} value={value} onChange={e => onChange(e.target.value as SoundId)}>
      {SOUNDS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
    </select>
  );
}

/** The sound (every voice at once) and the volume. Advanced sets each voice's own. */
function SoundControls({ m }: { m: Metronome }) {
  const same = m.voices.every(v => v.sound === m.voices[0].sound);
  return (
    <>
      <label className="tab-speed">
        <span className="text-(--ink-muted)">Sound</span>
        {same ? <SoundSelect label="Sound" value={m.voices[0].sound} onChange={m.setSound} /> : (
          <select className="input mm-select" aria-label="Sound" value="mixed" onChange={e => m.setSound(e.target.value as SoundId)}>
            <option value="mixed" disabled>Mixed</option>
            {SOUNDS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        )}
      </label>
      <div className="tab-volume">
        <span className="text-(--ink-muted)" id="mm-volume-label">Volume</span>
        <VolumeKnob value={m.volume} onChange={volume => m.set({ volume })} labelledBy="mm-volume-label" />
      </div>
    </>
  );
}

/** The voice a beat starts with, for the main view's beat marks. */
const beatVoice = (m: Metronome, beat: number): Step => m.steps[beat]?.[0] ?? null;
const voiceAttr = (v: Step) => (v === null ? 'none' : VOICE_NAMES[v]);

/** Bar, time and what is going on, under the readout. Quiet; empty while stopped. */
function Status({ m }: { m: Metronome }) {
  const n = m.now;
  if (!m.playing || !n) return <p className="mm-status">&nbsp;</p>;
  const t = Math.floor(m.elapsed);
  const parts = [
    n.countIn ? `Count-in ${n.beat + 1}` : `Bar ${n.bar + 1}`,
    `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`,
  ];
  if (n.silent) parts.push('silent');
  if (n.section !== null) parts.push(m.sections[n.section]?.name ?? '');
  return <p className="mm-status">{parts.join(' · ')}</p>;
}

/** A's beat display: a big pad per beat that flashes and ripples on its beat, its steps as small dots under it. */
function BeatPads({ m }: { m: Metronome }) {
  return (
    // One row up to 16 beats, then two even rows, so the pads stay big enough to see from a stand.
    <div
      className="mm-pads" aria-hidden="true" data-silent={m.now?.silent || undefined}
      style={{ gridTemplateColumns: `repeat(${m.beats <= 16 ? m.beats : Math.ceil(m.beats / 2)}, minmax(0, 52px))`, columnGap: m.beats <= 8 ? 18 : 8 }}
    >
      {Array.from({ length: m.beats }, (_, beat) => {
        const on = m.now?.beat === beat && m.now.step === 0;
        const n = m.subs[beat] ?? 1;
        return (
          <div key={beat} className="mm-pad-col">
            <span className="mm-pad" data-voice={voiceAttr(beatVoice(m, beat))} data-on={on || undefined}>
              {on && <span key={`${m.now!.bar}`} className="mm-ripple" />}
            </span>
            <span className="mm-pad-subs">
              {n > 1 && Array.from({ length: n }, (_, s) => (
                <span key={s} className="mm-pad-sub" data-voice={voiceAttr(m.steps[beat]?.[s] ?? null)} data-on={(m.now?.beat === beat && m.now.step === s) || undefined} />
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** A small dot per beat (C). */
function BeatDots({ m, size = 22 }: { m: Metronome; size?: number }) {
  return (
    <div className="mm-dots" aria-hidden="true">
      {Array.from({ length: m.beats }, (_, beat) => (
        <span key={beat} className="mm-dot" data-voice={voiceAttr(beatVoice(m, beat))} data-on={m.now?.beat === beat || undefined} style={{ width: size }} />
      ))}
    </div>
  );
}

/* — Advanced — */

/** "Advanced": the rhythm in full. Closed at first. */
function Advanced({ m }: { m: Metronome }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- screenshots open it from the address
    if (new URLSearchParams(window.location.search).has('advanced')) setOpen(true);
  }, []);
  return (
    <div className="mm-advanced">
      <button type="button" className="mm-advanced-toggle" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2.5 7.5 6 4 9.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Advanced
      </button>
      {open && <div className="mm-advanced-body"><Rhythm m={m} /></div>}
    </div>
  );
}

function Group({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <section className="mm-group">
      <h3 className="mm-group-title">{title}{note && <span className="mm-group-note" data-tip={note}> ⓘ</span>}</h3>
      {children}
    </section>
  );
}

/* Rhythm: meter, the voice grid, swing, the poly layer, presets. */

function Rhythm({ m }: { m: Metronome }) {
  const [groupsText, setGroupsText] = useState(m.groups.join('+'));
  return (
    <div className="mm-tab">
      <Group title="Meter">
        <div className="mm-row">
          <label className="tab-speed">
            <span className="text-(--ink-muted)">Preset</span>
            <select
              className="input mm-select" aria-label="Preset" value=""
              onChange={e => {
                const [g, i] = e.target.value.split(':').map(Number);
                const make = PRESETS[g].items[i][1];
                m.applyPreset(make);
                setGroupsText(make().groups.join('+'));
              }}
            >
              <option value="" disabled>Choose…</option>
              {PRESETS.map((p, g) => (
                <optgroup key={p.group} label={p.group}>
                  {p.items.map(([name], i) => <option key={name} value={`${g}:${i}`}>{name}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <Num label="Beats" value={m.beats} min={1} max={MAX_BEATS} reset={4} onChange={beats => { m.set({ beats }); setGroupsText(''); }} />
          <label className="tab-speed">
            <span className="text-(--ink-muted)">Groups</span>
            <input
              className="input mm-groups" aria-label="Groups" placeholder="2+2+3" value={groupsText}
              onChange={e => setGroupsText(e.target.value)} onBlur={() => m.setGroups(groupsText)}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            />
          </label>
          <Num label="Swing" value={m.swing} min={50} max={75} unit="%" reset={50} onChange={swing => m.set({ swing })} />
        </div>
      </Group>
      <Group title="Click pattern" note="Each beat is split into steps; each step plays one voice, A to D, or nothing. Press a cell to put that voice there.">
        <VoiceGrid m={m} />
      </Group>
      <Group title="Polyrhythm" note="A second layer: this many even clicks across the bar, against the beats. 3 across 2 beats is 3 over 2.">
        <div className="mm-row">
          <Num label="" value={m.poly.count} min={0} max={16} reset={0} after={m.poly.count === 0 ? 'off' : `even clicks across the bar (${m.poly.count} over ${m.beats})`} onChange={count => m.set({ poly: { ...m.poly, count } })} />
          <SoundSelect label="Polyrhythm sound" value={m.poly.sound} onChange={sound => m.set({ poly: { ...m.poly, sound } })} />
          <VolumeKnob value={m.poly.level} onChange={level => m.set({ poly: { ...m.poly, level } })} labelledBy="mm-poly-label" name="Level" />
          <span id="mm-poly-label" className="sr-only">Polyrhythm level</span>
        </div>
        {m.poly.count > 0 && <PolyStrip m={m} />}
      </Group>
    </div>
  );
}

/** The grid: a row per voice (its sound, pitch and level), a column per step, beats split by lines. */
function VoiceGrid({ m }: { m: Metronome }) {
  const columns = m.subs.map(n => `repeat(${n}, minmax(22px, 1fr))`).join(' ');
  const controls = (v: number, name: string) => (
    <>
      <SoundSelect label={`Voice ${name} sound`} value={m.voices[v].sound} onChange={sound => m.setVoice(v as VoiceId, { sound })} />
      <button
        type="button" className="mm-pitch" aria-pressed={m.voices[v].high}
        data-tip={m.voices[v].high ? 'High (press for low)' : 'Low (press for high)'}
        onClick={() => m.setVoice(v as VoiceId, { high: !m.voices[v].high })}
      >{m.voices[v].high ? 'High' : 'Low'}</button>
      <VolumeKnob value={m.voices[v].level} onChange={level => m.setVoice(v as VoiceId, { level })} labelledBy={`mm-voice-${v}`} name={`${name} level`} />
    </>
  );
  return (
    <>
    {/* A phone: the voices' controls as a list above the grid, the grid's rows only lettered. */}
    <div className="mm-voice-list">
      {VOICE_NAMES.map((name, v) => (
        <div key={name} className="mm-voice"><span className="mm-voice-name">{name}</span>{controls(v, name)}</div>
      ))}
    </div>
    <div className="mm-grid-wrap">
      <div className="mm-voices">
        <div className="mm-voice-head" />
        {VOICE_NAMES.map((name, v) => (
          <div key={name} className="mm-voice">
            <span className="mm-voice-name">{name}</span>
            <span className="mm-voice-controls">{controls(v, name)}</span>
            <span id={`mm-voice-${v}`} className="sr-only">Voice {name} level</span>
          </div>
        ))}
        <div className="mm-voice-foot" />
      </div>
      <div className="mm-grid-scroll">
        <div className="mm-grid" style={{ gridTemplateColumns: columns }}>
          {/* Beat numbers, each over its steps. */}
          {m.subs.map((n, b) => (
            <div key={`h${b}`} className="mm-grid-beat" style={{ gridColumn: `span ${n}` }} data-group-start={m.groups.length > 0 && groupStarts(m.groups).has(b) || undefined}>
              <span>{b + 1}</span>
            </div>
          ))}
          {VOICE_NAMES.map((name, v) => m.subs.map((n, b) => Array.from({ length: n }, (_, s) => {
            const here = m.steps[b]?.[s] === v;
            const now = m.now?.beat === b && m.now.step === s;
            return (
              <button
                key={`${v}-${b}-${s}`} type="button" className="mm-grid-cell"
                data-beat-start={s === 0 || undefined} data-now={now || undefined}
                aria-label={`Beat ${b + 1} step ${s + 1}, voice ${name}${here ? ' (on)' : ''}`}
                aria-pressed={here} onClick={() => m.toggleCell(b, s, v as VoiceId)}
              >
                {here && <span className="mm-grid-dot" data-voice={name} />}
              </button>
            );
          })))}
          {/* Under each beat: how many steps it has, then the counting for them. */}
          {m.subs.map((n, b) => (
            <div key={`f${b}`} className="mm-grid-foot" style={{ gridColumn: `span ${n}` }}>
              <DragNumber label={`Steps in beat ${b + 1}`} value={n} min={1} max={8} reset={1} onChange={k => m.setBeatSubs(b, k)} />
            </div>
          ))}
          {m.subs.map((n, b) => Array.from({ length: n }, (_, s) => (
            <div key={`c${b}-${s}`} className="mm-grid-syl">{syllable('numbers', b, s, n)}</div>
          )))}
        </div>
      </div>
    </div>
    </>
  );
}

/**
 * A small number with no buttons, for tight rows (steps in a beat): drag up or down, the arrow keys,
 * or a double-click to put it back.
 */
function DragNumber({ label, value, min, max, reset, onChange }: {
  label: string; value: number; min: number; max: number; reset: number; onChange: (v: number) => void;
}) {
  const drag = useRef<{ y: number; acc: number } | null>(null);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <span
      className="mm-dragnum" role="spinbutton" tabIndex={0} aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}
      data-tip={`${label}: drag up or down`}
      onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = { y: e.clientY, acc: 0 }; }}
      onPointerMove={e => {
        const d = drag.current;
        if (!d) return;
        d.acc += d.y - e.clientY;
        d.y = e.clientY;
        const steps = Math.trunc(d.acc / 10);
        if (steps === 0) return;
        d.acc -= steps * 10;
        const next = clamp(value + steps);
        if (next !== value) onChange(next);
      }}
      onPointerUp={() => { drag.current = null; }}
      onPointerCancel={() => { drag.current = null; }}
      onDoubleClick={() => onChange(reset)}
      onKeyDown={e => {
        const by = { ArrowUp: 1, ArrowDown: -1 }[e.key];
        if (by === undefined) return;
        e.preventDefault();
        onChange(clamp(value + by));
      }}
    >{value}</span>
  );
}

function groupStarts(groups: number[]): Set<number> {
  const out = new Set<number>();
  let at = 0;
  for (const g of groups) { out.add(at); at += g; }
  return out;
}

/** The poly layer against the beats, as two rows of marks across the bar. */
function PolyStrip({ m }: { m: Metronome }) {
  return (
    <div className="mm-poly" aria-hidden="true">
      <div className="mm-poly-row">
        {Array.from({ length: m.beats }, (_, i) => (
          <span key={i} className="mm-poly-mark" style={{ left: `${(i / m.beats) * 100}%` }} data-on={m.now?.beat === i || undefined} />
        ))}
      </div>
      <div className="mm-poly-row">
        {Array.from({ length: m.poly.count }, (_, i) => (
          <span key={i} className="mm-poly-mark mm-poly-mark-alt" style={{ left: `${(i / m.poly.count) * 100}%` }} data-on={m.now?.poly === i || undefined} />
        ))}
      </div>
    </div>
  );
}

/* — A: Readout, the Tuner's sibling — */

function Readout() {
  const m = useMetronome();
  const drag = useBpmDrag(m);
  return (
    <section className="card mm-card" aria-labelledby="mm-title">
      <Head />
      <BeatPads m={m} />
      <div className="mm-readout">
        <button type="button" className="btn btn-ghost mm-step" aria-label="Slower" onClick={() => m.set({ bpm: Math.max(MIN_BPM, m.bpm - 1) })}>−</button>
        <div className="mm-big mm-bpm-drag" data-tip="Drag up or down: 5 bpm a step, 1 with Shift" {...drag}>
          <span className="mm-big-number">{liveBpm(m)}</span>
          <span className="mm-big-unit">bpm · {tempoName(liveBpm(m))}</span>
        </div>
        <button type="button" className="btn btn-ghost mm-step" aria-label="Faster" onClick={() => m.set({ bpm: Math.min(MAX_BPM, m.bpm + 1) })}>+</button>
      </div>
      <div className="mm-row mm-row-center">
        <PlayButton m={m} />
        <TapButton m={m} />
      </div>
      <Status m={m} />
      <div className="mm-row mm-row-center mm-row-top-line">
        <BeatsField m={m} />
        <SubdivisionSeg m={m} />
      </div>
      <div className="mm-row mm-row-center">
        <SoundControls m={m} />
      </div>
      <Advanced m={m} />
    </section>
  );
}

/* — B: Dial, a big tempo knob with the beats round it — */

const DIAL = 340;
const SWEEP = 280;

function dialPoint(turn: number, r: number): [number, number] {
  const rad = ((-SWEEP / 2 + turn * SWEEP - 90) * Math.PI) / 180;
  return [DIAL / 2 + r * Math.cos(rad), DIAL / 2 + r * Math.sin(rad)];
}
function dialArc(from: number, to: number, r: number) {
  const [x0, y0] = dialPoint(from, r);
  const [x1, y1] = dialPoint(to, r);
  return `M${x0} ${y0} A${r} ${r} 0 ${(to - from) * SWEEP > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}
/** An arc of the full circle round the dial, in degrees clockwise from the top. */
function ringArc(from: number, to: number, r: number) {
  const at = (deg: number) => [DIAL / 2 + r * Math.sin((deg * Math.PI) / 180), DIAL / 2 - r * Math.cos((deg * Math.PI) / 180)];
  const [x0, y0] = at(from);
  const [x1, y1] = at(to);
  return `M${x0} ${y0} A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

function Dial() {
  const m = useMetronome();
  const bpm = liveBpm(m);
  const turn = (bpm - MIN_BPM) / (MAX_BPM - MIN_BPM);
  const drag = useBpmDrag(m);
  const [kx, ky] = dialPoint(turn, 130);
  const n = m.now;
  const onBeat = n !== null && n.step === 0;
  return (
    <section className="card mm-card" aria-labelledby="mm-title">
      <Head />
      <div className="mm-dial-wrap">
        <div
          className="mm-dial" role="slider" tabIndex={0} aria-label="Tempo" aria-valuemin={MIN_BPM} aria-valuemax={MAX_BPM} aria-valuenow={m.bpm}
          {...drag}
          onKeyDown={e => {
            const by = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
            if (by === undefined) return;
            e.preventDefault();
            m.set({ bpm: Math.min(MAX_BPM, Math.max(MIN_BPM, m.bpm + by * (e.shiftKey ? 1 : 5))) });
          }}
        >
          <svg width={DIAL} height={DIAL} viewBox={`0 0 ${DIAL} ${DIAL}`} aria-hidden="true">
            {Array.from({ length: m.beats }, (_, beat) => {
              const voice = voiceAttr(beatVoice(m, beat));
              const span = 360 / m.beats;
              const gap = Math.min(6, span / 4);
              return (
                <path
                  key={beat} d={ringArc(beat * span + gap / 2, (beat + 1) * span - gap / 2, 158)} fill="none"
                  className="mm-ring-seg" data-voice={voice} data-on={n?.beat === beat || undefined}
                  strokeWidth={voice === 'A' ? 16 : 10}
                />
              );
            })}
            <path d={dialArc(0, 1, 130)} fill="none" stroke="var(--surface-sunken)" strokeWidth={6} strokeLinecap="round" />
            <path d={dialArc(0, Math.max(0.001, turn), 130)} fill="none" stroke="var(--ink-muted)" strokeWidth={6} strokeLinecap="round" />
            <circle
              cx={DIAL / 2} cy={DIAL / 2} r={114} className="mm-dial-face" data-on={onBeat || undefined}
              data-accent={(onBeat && beatVoice(m, n!.beat) === 0) || undefined}
            />
            <circle cx={kx} cy={ky} r={5} fill="var(--ink)" />
          </svg>
          <div className="mm-dial-center">
            <span className="mm-big-number">{bpm}</span>
            <span className="mm-big-unit">bpm · {tempoName(bpm)}</span>
          </div>
        </div>
      </div>
      <div className="mm-row mm-row-center">
        <TapButton m={m} round />
        <PlayButton m={m} round />
        <BeatsField m={m} />
      </div>
      <Status m={m} />
      <div className="mm-row mm-row-center">
        <SubdivisionSeg m={m} />
      </div>
      <div className="mm-row mm-row-center mm-row-top-line">
        <SoundControls m={m} />
      </div>
      <Advanced m={m} />
    </section>
  );
}

/* — C: Pendulum, the wooden pyramid metronome — */

function Pendulum() {
  const m = useMetronome();
  const drag = useBpmDrag(m);
  const bpm = liveBpm(m);
  // The arm leans to one side on even beats, the other on odd ones, swinging across in one beat.
  const lean = !m.playing || !m.now ? 0 : m.now.beat % 2 === 0 ? 24 : -24;
  // The weight sits lower on the arm the faster the tempo, as on a real one.
  const turn = (Math.min(300, bpm) - 30) / 270;
  const weightY = 56 + turn * 170;
  const marks = [40, 60, 80, 120, 160, 200, 240, 280];
  return (
    <section className="card mm-card mm-card-wide" aria-labelledby="mm-title">
      <Head />
      <div className="mm-pendulum-layout">
        <svg className="mm-pyramid mm-bpm-drag" width="220" height="300" viewBox="0 0 220 300" aria-hidden="true" {...drag}>
          <path d="M80 12 L140 12 L196 292 L24 292 Z" fill="var(--fretboard)" />
          <path d="M90 30 L130 30 L166 236 L54 236 Z" fill="var(--surface-sunken)" opacity="0.12" />
          {marks.map(b => {
            const y = 56 + ((b - 30) / 270) * 170;
            return (
              <g key={b}>
                <line x1="118" x2="128" y1={y} y2={y} stroke="var(--fret-wire)" strokeWidth="1.5" />
                <text x="132" y={y + 3.5} fontSize="10" fill="var(--string)" fontFamily="var(--font-sans)">{b}</text>
              </g>
            );
          })}
          <g className="mm-arm" style={{ transform: `rotate(${lean}deg)`, transitionDuration: `${60 / bpm}s` }}>
            <line x1="110" y1="250" x2="110" y2="34" stroke="var(--nut)" strokeWidth="3" strokeLinecap="round" />
            <path d={`M100 ${weightY - 8} L120 ${weightY - 8} L116 ${weightY + 8} L104 ${weightY + 8} Z`} fill="var(--primary)" />
          </g>
          <circle cx="110" cy="250" r="6" fill="var(--fret-wire)" />
        </svg>
        <div className="mm-side">
          <p className="mm-tempo-name m-0">{tempoName(bpm)}</p>
          <BpmField m={m} />
          <BeatsField m={m} />
          <SubdivisionSeg m={m} />
          <div className="mm-row">
            <SoundControls m={m} />
          </div>
          <BeatDots m={m} size={18} />
          <div className="mm-row">
            <PlayButton m={m} />
            <TapButton m={m} />
          </div>
          <Status m={m} />
        </div>
      </div>
      <Advanced m={m} />
    </section>
  );
}

/* — D: Bar, the whole bar as tiles, a tool like Tab's footer — */

function Bar() {
  const m = useMetronome();
  return (
    <section className="card mm-card mm-card-wide" aria-labelledby="mm-title">
      <Head><span className="mm-bar-name">{tempoName(liveBpm(m))}</span></Head>
      <div className="mm-row mm-row-top-line">
        <PlayButton m={m} />
        <BpmField m={m} />
        <TapButton m={m} />
        <BeatsField m={m} />
        <SubdivisionSeg m={m} />
      </div>
      <div className="mm-pattern" role="group" aria-label="Steps (press to change the voice)">
        {m.subs.map((n, beat) => (
          <div key={beat} className="mm-pattern-beat">
            <div className="mm-pattern-clicks">
              {Array.from({ length: n }, (_, s) => {
                const v = m.steps[beat]?.[s] ?? null;
                return (
                  <button
                    key={s} type="button" className="mm-cell" data-voice={voiceAttr(v)}
                    data-on={(m.now?.beat === beat && m.now.step === s) || undefined}
                    aria-label={`Beat ${beat + 1} step ${s + 1}: ${v === null ? 'silent' : `voice ${VOICE_NAMES[v]}`}`}
                    data-tip={v === null ? 'Silent' : `Voice ${VOICE_NAMES[v]}`} onClick={() => m.cycleCell(beat, s)}
                  ><span /></button>
                );
              })}
            </div>
            <span className="mm-pattern-count">{beat + 1}</span>
          </div>
        ))}
      </div>
      <Status m={m} />
      <div className="mm-row mm-row-top-line">
        <SoundControls m={m} />
      </div>
      <Advanced m={m} />
    </section>
  );
}
