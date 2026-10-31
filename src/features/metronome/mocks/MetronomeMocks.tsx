'use client';

/**
 * Look mocks for the Metronome page (issue #149), behind ?mock=a/b/c/d. Each is a working
 * metronome (Space starts and stops) so the feel can be judged, not only the look. Advanced is
 * the same in all four.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { CheckBox } from '@/components/settings/fields';
import { NumberField } from '@/features/tab/NumberField';
import { VolumeKnob } from '@/features/tab/VolumeKnob';
import {
  MAX_BPM, MIN_BPM, PRESETS, SOUNDS, VOICE_NAMES, syllable, tempoName, useMetronome,
  type Counting, type Metronome, type SoundId, type Step, type TrainerEnd, type VoiceId,
} from './engine';
import './mocks.css';

const MOCKS = {
  a: 'Readout',
  b: 'Dial',
  c: 'Pendulum',
  d: 'Bar',
} as const;
type MockId = keyof typeof MOCKS;

export default function MetronomeMocks() {
  const [mock, setMock] = useState<MockId>('a');
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
  return (
    <div className="mm">
      <div className="mm-switch seg" role="group" aria-label="Mock">
        {(Object.keys(MOCKS) as MockId[]).map(m => (
          <button key={m} type="button" className="seg-opt" aria-pressed={mock === m} onClick={() => choose(m)}>
            {m.toUpperCase()} · {MOCKS[m]}
          </button>
        ))}
      </div>
      {/* A fresh metronome per mock, so one stops when another is picked. */}
      {mock === 'a' && <Readout />}
      {mock === 'b' && <Dial />}
      {mock === 'c' && <Pendulum />}
      {mock === 'd' && <Bar />}
    </div>
  );
}

/* — shared bits — */

/** The tempo playing now: the trainer or the setlist may have moved it. */
const liveBpm = (m: Metronome) => m.now?.bpm ?? m.bpm;

function PlayButton({ m, round }: { m: Metronome; round?: boolean }) {
  return (
    <button type="button" className={`btn btn-primary mm-play${round ? ' mm-play-round' : ''}`} onClick={m.toggle} aria-label={m.playing ? 'Stop' : 'Start'}>
      {m.playing ? (
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="3" width="10" height="10" rx="1.5" fill="currentColor" /></svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9.5-5.5z" fill="currentColor" /></svg>
      )}
      {!round && <span>{m.playing ? 'Stop' : 'Start'}</span>}
    </button>
  );
}

function TapButton({ m }: { m: Metronome }) {
  return <button type="button" className="btn btn-secondary" onClick={m.tap}>Tap</button>;
}

/** A label, a number field and what follows it, in a row. */
function Num({ label, value, min, max, step = 1, unit, after, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string; after?: ReactNode;
  onChange: (v: number) => void;
}) {
  return (
    <div className="tab-speed">
      {label && <span className="text-(--ink-muted)">{label}</span>}
      <NumberField value={value} min={min} max={max} step={step} unit={unit} label={label || 'Number'} upLabel="More" downLabel="Less" onChange={onChange} />
      {after && <span className="text-(--ink-muted)">{after}</span>}
    </div>
  );
}

function BpmField({ m }: { m: Metronome }) {
  return <Num label="Tempo" value={m.bpm} min={MIN_BPM} max={MAX_BPM} after="bpm" onChange={bpm => m.set({ bpm })} />;
}

function BeatsField({ m }: { m: Metronome }) {
  return <Num label="Beats" value={m.beats} min={1} max={16} onChange={beats => m.set({ beats })} />;
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

/** What to count on the step sounding now, big, when counting is on. */
function CountWord({ m }: { m: Metronome }) {
  const n = m.now;
  const word = n && n.beat >= 0 ? syllable(m.counting, n.beat, n.step, m.subs[n.beat] ?? 1) : '';
  return <p className="mm-count" aria-hidden="true">{word || ' '}</p>;
}

/** The screen's flash on each beat, when Flash is on. */
function Flash({ m }: { m: Metronome }) {
  return m.flashKey > 0 ? <div key={m.flashKey} className="mm-flash" aria-hidden="true" /> : null;
}

/** A's beat display: a big pad per beat that flashes and ripples on its beat, its steps as small dots under it. */
function BeatPads({ m }: { m: Metronome }) {
  return (
    <div className="mm-pads" aria-hidden="true" data-silent={m.now?.silent || undefined}>
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
        <span key={beat} className="mm-dot" data-voice={voiceAttr(beatVoice(m, beat))} data-on={m.now?.beat === beat || undefined} style={{ width: size, height: size }} />
      ))}
    </div>
  );
}

/* — Advanced — */

type AdvancedTab = 'rhythm' | 'tempo' | 'practice' | 'setlist';
const TABS: [AdvancedTab, string][] = [['rhythm', 'Rhythm'], ['tempo', 'Tempo'], ['practice', 'Practice'], ['setlist', 'Setlist']];

/** "Advanced": closed at first; four tabs. */
function Advanced({ m }: { m: Metronome }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<AdvancedTab>('rhythm');
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('advanced') === null) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- screenshots open it from the address
    setOpen(true);
    const t = new URLSearchParams(window.location.search).get('advanced') as AdvancedTab;
    if (TABS.some(([id]) => id === t)) setTab(t);
  }, []);
  return (
    <div className="mm-advanced">
      <button type="button" className="mm-advanced-toggle" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2.5 7.5 6 4 9.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Advanced
      </button>
      {open && (
        <div className="mm-advanced-body">
          <div className="seg mm-tabs" role="group" aria-label="Advanced">
            {TABS.map(([id, name]) => (
              <button key={id} type="button" className="seg-opt" aria-pressed={tab === id} onClick={() => setTab(id)}>{name}</button>
            ))}
          </div>
          {tab === 'rhythm' && <RhythmTab m={m} />}
          {tab === 'tempo' && <TempoTab m={m} />}
          {tab === 'practice' && <PracticeTab m={m} />}
          {tab === 'setlist' && <SetlistTab m={m} />}
        </div>
      )}
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

function Check({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  const id = useId();
  return (
    <span className="mm-check">
      <CheckBox on={on} onChange={onChange} labelledBy={id} />
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- the box itself takes the keys */}
      <span id={id} onClick={() => onChange(!on)}>{label}</span>
    </span>
  );
}

/* Rhythm: meter, the voice grid, swing, the poly layer, presets. */

function RhythmTab({ m }: { m: Metronome }) {
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
          <div className="tab-speed">
            <span className="text-(--ink-muted)">Time</span>
            <NumberField value={m.beats} min={1} max={16} step={1} label="Beats" upLabel="More beats" downLabel="Fewer beats" onChange={beats => { m.set({ beats }); setGroupsText(''); }} />
            <span className="text-(--ink-muted)">/</span>
            <select className="input mm-select-narrow" aria-label="Beat note" value={m.beatUnit} onChange={e => m.set({ beatUnit: Number(e.target.value) as 2 | 4 | 8 | 16 })}>
              {[2, 4, 8, 16].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <label className="tab-speed">
            <span className="text-(--ink-muted)">Groups</span>
            <input
              className="input mm-groups" aria-label="Groups" placeholder="2+2+3" value={groupsText}
              onChange={e => setGroupsText(e.target.value)} onBlur={() => m.setGroups(groupsText)}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            />
          </label>
          <Num label="Swing" value={m.swing} min={50} max={75} unit="%" onChange={swing => m.set({ swing })} />
        </div>
      </Group>
      <Group title="Click pattern" note="Each beat is split into steps; each step plays one voice, A to D, or nothing. Press a cell to put that voice there.">
        <VoiceGrid m={m} />
      </Group>
      <Group title="Polyrhythm" note="A second layer: this many even clicks across the bar, against the beats. 3 across 2 beats is 3 over 2.">
        <div className="mm-row">
          <Num label="" value={m.poly.count} min={0} max={16} after={m.poly.count === 0 ? 'off' : `even clicks across the bar (${m.poly.count} over ${m.beats})`} onChange={count => m.set({ poly: { ...m.poly, count } })} />
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
  const columns = m.subs.map(n => `repeat(${n}, minmax(18px, 1fr))`).join(' ');
  const counting = m.counting === 'none' ? 'numbers' : m.counting;
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
              {b + 1}
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
              <select className="mm-steps" aria-label={`Steps in beat ${b + 1}`} value={n} onChange={e => m.setBeatSubs(b, Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
          ))}
          {m.subs.map((n, b) => Array.from({ length: n }, (_, s) => (
            <div key={`c${b}-${s}`} className="mm-grid-syl">{syllable(counting, b, s, n)}</div>
          )))}
        </div>
      </div>
    </div>
    </>
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

/* Tempo: the trainer, and quick tempo changes. */

const ENDS: [TrainerEnd, string][] = [['hold', 'stay there'], ['restart', 'start over'], ['stop', 'stop']];

function TempoTab({ m }: { m: Metronome }) {
  const t = m.trainer;
  const setT = (patch: Partial<typeof t>) => m.set({ trainer: { ...t, ...patch } });
  return (
    <div className="mm-tab">
      <Group title="Tempo trainer" note="Speeds up (or slows down) in steps as you play, from the tempo above to a target.">
        <Check on={t.on} onChange={on => setT({ on })} label="Change the tempo as I play" />
        <div className="mm-row">
          <span className="text-(--ink-muted)">From {m.bpm} bpm</span>
          <Num label="to" value={t.to} min={MIN_BPM} max={MAX_BPM} after="bpm," onChange={to => setT({ to })} />
          <Num label="by" value={t.by} min={1} max={40} after="bpm" onChange={by => setT({ by })} />
          <Num label="every" value={t.every} min={1} max={64} after="bars, then" onChange={every => setT({ every })} />
          <select className="input mm-select" aria-label="At the target" value={t.end} onChange={e => setT({ end: e.target.value as TrainerEnd })}>
            {ENDS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>
        <TrainerChart m={m} />
      </Group>
      <Group title="Quick changes">
        <div className="mm-row">
          <button type="button" className="btn btn-secondary" onClick={() => m.set({ bpm: Math.max(MIN_BPM, Math.round(m.bpm / 2)) })}>Half</button>
          <button type="button" className="btn btn-secondary" onClick={() => m.set({ bpm: Math.min(MAX_BPM, m.bpm * 2) })}>Double</button>
          <button type="button" className="btn btn-secondary" onClick={() => m.set({ bpm: Math.max(MIN_BPM, m.bpm - 5) })}>−5</button>
          <button type="button" className="btn btn-secondary" onClick={() => m.set({ bpm: Math.min(MAX_BPM, m.bpm + 5) })}>+5</button>
          <TapButton m={m} />
        </div>
      </Group>
    </div>
  );
}

/** The trainer's plan as a staircase: tempo against bars, with where it is now. */
function TrainerChart({ m }: { m: Metronome }) {
  const t = m.trainer;
  const up = t.to >= m.bpm;
  const stepsN = Math.max(1, Math.floor(Math.abs(t.to - m.bpm) / t.by));
  const bars = (stepsN + 1) * t.every;
  const W = 480;
  const H = 90;
  const lo = Math.min(m.bpm, t.to);
  const hi = Math.max(m.bpm, t.to);
  const y = (bpm: number) => H - 10 - ((bpm - lo) / Math.max(1, hi - lo)) * (H - 20);
  const x = (bar: number) => (bar / bars) * W;
  let d = `M0 ${y(m.bpm)}`;
  for (let i = 0; i <= stepsN; i++) {
    const bpm = m.bpm + (up ? 1 : -1) * t.by * i;
    d += ` H${x((i + 1) * t.every)}`;
    if (i < stepsN) d += ` V${y(m.bpm + (up ? 1 : -1) * t.by * (i + 1))}`;
    void bpm;
  }
  const bar = m.now && !m.now.countIn ? m.now.bar % bars : null;
  return (
    <svg className="mm-trainer" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" data-off={!t.on || undefined}>
      <path d={d} fill="none" strokeWidth="2" />
      {bar !== null && t.on && <line x1={x(bar)} x2={x(bar)} y1="0" y2={H} className="mm-trainer-now" />}
      <text x="4" y="12">{hi}</text>
      <text x="4" y={H - 2}>{lo}</text>
      <text x={W - 4} y={H - 2} textAnchor="end">{bars} bars</text>
    </svg>
  );
}

/* Practice: silence, start and stop, counting, feel, tap-along. */

const COUNTINGS: [Counting, string][] = [['none', 'Off'], ['numbers', '1 e & a'], ['takadimi', 'Ta ka di mi']];

function PracticeTab({ m }: { m: Metronome }) {
  return (
    <div className="mm-tab">
      <Group title="Silence" note="For practising your own time: the click drops out and you keep going.">
        <div className="mm-row">
          <Num label="Click for" value={m.playBars} min={1} max={16} after="bars, then silent for" onChange={playBars => m.set({ playBars })} />
          <Num label="" value={m.silentBars} min={0} max={16} after="bars" onChange={silentBars => m.set({ silentBars })} />
        </div>
        <div className="mm-row">
          <Num label="Leave out" value={m.randomMute} min={0} max={90} step={5} unit="%" after="of the clicks at random" onChange={randomMute => m.set({ randomMute })} />
        </div>
      </Group>
      <Group title="Start and stop">
        <div className="mm-row">
          <Num label="Count in" value={m.countIn} min={0} max={4} after="bars" onChange={countIn => m.set({ countIn })} />
          <Num label="Stop after" value={m.stopAfterBars} min={0} max={999} after="bars" onChange={stopAfterBars => m.set({ stopAfterBars })} />
          <Num label="or" value={m.stopAfterMinutes} min={0} max={120} after="minutes" onChange={stopAfterMinutes => m.set({ stopAfterMinutes })} />
        </div>
      </Group>
      <Group title="Counting">
        <div className="mm-row">
          <div className="seg" role="group" aria-label="Counting">
            {COUNTINGS.map(([id, name]) => (
              <button key={id} type="button" className="seg-opt" aria-pressed={m.counting === id} onClick={() => m.set({ counting: id })}>{name}</button>
            ))}
          </div>
          <Check on={m.spoken} onChange={spoken => m.set({ spoken })} label="Say the count aloud" />
        </div>
      </Group>
      <Group title="Feel">
        <div className="mm-row">
          <Check on={m.flash} onChange={flash => m.set({ flash })} label="Flash the screen on each beat" />
          <Check on={m.vibrate} onChange={vibrate => m.set({ vibrate })} label="Vibrate (phones)" />
        </div>
      </Group>
      <Group title="Tap along" note="Tap with the beat (press J, or the pad) and see how early or late each tap was.">
        <Check on={m.tapAlong} onChange={tapAlong => m.set({ tapAlong })} label="Score my timing" />
        {m.tapAlong && <TapAlong m={m} />}
      </Group>
    </div>
  );
}

/** Each tap as a dot on a strip from 100 ms early to 100 ms late, with the average and spread. */
function TapAlong({ m }: { m: Metronome }) {
  const offs = m.taps.map(t => t.offset);
  const mean = offs.length ? offs.reduce((a, b) => a + b, 0) / offs.length : 0;
  const spread = offs.length > 1 ? Math.sqrt(offs.reduce((a, b) => a + (b - mean) ** 2, 0) / (offs.length - 1)) : 0;
  const pos = (ms: number) => `${50 + Math.max(-100, Math.min(100, ms)) / 2}%`;
  return (
    <div className="mm-tapalong">
      <button type="button" className="mm-tap-pad" onPointerDown={m.tapBeat}>Tap (J)</button>
      <div className="mm-tap-strip" aria-hidden="true">
        <span className="mm-tap-zero" />
        {offs.map((o, i) => <span key={i} className="mm-tap-dot" style={{ left: pos(o), opacity: 0.3 + (0.7 * (i + 1)) / offs.length }} />)}
        <span className="mm-tap-label mm-tap-label-left">early</span>
        <span className="mm-tap-label mm-tap-label-right">late</span>
      </div>
      <p className="mm-tap-sum">
        {offs.length === 0 ? 'Start the metronome and tap along.' : (
          <>Average {Math.abs(Math.round(mean))} ms {mean < 0 ? 'early' : 'late'} · spread ±{Math.round(spread)} ms · {offs.length} taps{' '}
            <button type="button" className="btn btn-ghost mm-reset" onClick={m.clearTaps}>Clear</button></>
        )}
      </p>
    </div>
  );
}

/* Setlist: sections played in order, saved settings. */

function SetlistTab({ m }: { m: Metronome }) {
  const [saved, setSaved] = useState(['Warm-up 7/8', 'Clave 3-2 at 90', 'Shuffle ladder 80→120']);
  const setSection = (i: number, patch: Partial<Metronome['sections'][number]>) =>
    m.set({ sections: m.sections.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
  return (
    <div className="mm-tab">
      <Group title="Song" note="Sections played in order, each with its own tempo and beats, for a whole tune.">
        <Check on={m.playSections} onChange={playSections => m.set({ playSections })} label="Play these sections in order" />
        <div className="mm-sections">
          {m.sections.map((s, i) => (
            <div key={i} className="mm-section" data-now={m.now?.section === i || undefined}>
              <input className="input mm-section-name" aria-label="Section name" value={s.name} onChange={e => setSection(i, { name: e.target.value })} />
              <Num label="" value={s.bars} min={1} max={256} after="bars" onChange={bars => setSection(i, { bars })} />
              <Num label="" value={s.bpm} min={MIN_BPM} max={MAX_BPM} after="bpm" onChange={bpm => setSection(i, { bpm })} />
              <Num label="" value={s.beats} min={1} max={16} after="beats" onChange={beats => setSection(i, { beats })} />
              <button type="button" className="btn btn-ghost mm-remove" aria-label={`Remove ${s.name}`} data-tip="Remove" onClick={() => m.set({ sections: m.sections.filter((_, k) => k !== i) })}>×</button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost mm-add" onClick={() => m.set({ sections: [...m.sections, { name: `Section ${m.sections.length + 1}`, bars: 8, bpm: m.bpm, beats: m.beats }] })}>+ Add a section</button>
        </div>
      </Group>
      <Group title="Saved metronomes" note="Everything on this page saved under a name, to come back to.">
        <div className="mm-saved">
          {saved.map(name => <button key={name} type="button" className="mm-saved-item">{name}</button>)}
          <button type="button" className="btn btn-secondary" onClick={() => setSaved(s => [...s, `Saved ${s.length + 1}`])}>Save as…</button>
        </div>
      </Group>
      <Group title="Take it elsewhere">
        <div className="mm-row">
          <button type="button" className="btn btn-secondary">Download click track…</button>
          <button type="button" className="btn btn-secondary">Copy link</button>
        </div>
      </Group>
    </div>
  );
}

/* — A: Readout, the Tuner's sibling — */

function Readout() {
  const m = useMetronome();
  return (
    <section className="card mm-card" aria-labelledby="mm-title">
      <Flash m={m} />
      <h1 id="mm-title" className="m-0">Metronome</h1>
      <div className="mm-readout">
        <button type="button" className="btn btn-ghost mm-step" aria-label="Slower" onClick={() => m.set({ bpm: Math.max(MIN_BPM, m.bpm - 1) })}>−</button>
        <div className="mm-big">
          <span className="mm-big-number">{liveBpm(m)}</span>
          <span className="mm-big-unit">bpm · {tempoName(liveBpm(m))}</span>
        </div>
        <button type="button" className="btn btn-ghost mm-step" aria-label="Faster" onClick={() => m.set({ bpm: Math.min(MAX_BPM, m.bpm + 1) })}>+</button>
      </div>
      <BeatPads m={m} />
      <CountWord m={m} />
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
  const drag = useRef<{ y: number; bpm: number } | null>(null);
  const [kx, ky] = dialPoint(turn, 130);
  const n = m.now;
  const onBeat = n !== null && n.step === 0;
  return (
    <section className="card mm-card" aria-labelledby="mm-title">
      <Flash m={m} />
      <h1 id="mm-title" className="m-0">Metronome</h1>
      <div className="mm-dial-wrap">
        <div
          className="mm-dial" role="slider" tabIndex={0} aria-label="Tempo" aria-valuemin={MIN_BPM} aria-valuemax={MAX_BPM} aria-valuenow={m.bpm}
          onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { y: e.clientY, bpm: m.bpm }; }}
          onPointerMove={e => {
            if (!drag.current) return;
            const next = Math.round(drag.current.bpm + (drag.current.y - e.clientY) / 2);
            m.set({ bpm: Math.min(MAX_BPM, Math.max(MIN_BPM, next)) });
          }}
          onPointerUp={() => { drag.current = null; }}
          onKeyDown={e => {
            const by = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
            if (by === undefined) return;
            e.preventDefault();
            m.set({ bpm: Math.min(MAX_BPM, Math.max(MIN_BPM, m.bpm + by)) });
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
      <CountWord m={m} />
      <div className="mm-row mm-row-center">
        <TapButton m={m} />
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
  const bpm = liveBpm(m);
  // The arm leans to one side on even beats, the other on odd ones, swinging across in one beat.
  const lean = !m.playing || !m.now ? 0 : m.now.beat % 2 === 0 ? 24 : -24;
  // The weight sits lower on the arm the faster the tempo, as on a real one.
  const turn = (Math.min(300, bpm) - 30) / 270;
  const weightY = 56 + turn * 170;
  const marks = [40, 60, 80, 120, 160, 200, 240, 280];
  return (
    <section className="card mm-card mm-card-wide" aria-labelledby="mm-title">
      <Flash m={m} />
      <h1 id="mm-title" className="m-0">Metronome</h1>
      <div className="mm-pendulum-layout">
        <svg className="mm-pyramid" width="220" height="300" viewBox="0 0 220 300" aria-hidden="true">
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
      <Flash m={m} />
      <div className="mm-bar-head">
        <h1 id="mm-title" className="m-0">Metronome</h1>
        <span className="mm-bar-name">{tempoName(liveBpm(m))}</span>
      </div>
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
