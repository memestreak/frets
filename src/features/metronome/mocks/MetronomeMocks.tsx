'use client';

/**
 * Look mocks for the Metronome page (issue #149), behind ?mock=a/b/c/d. Each is a working
 * metronome (Space starts and stops) so the feel can be judged, not only the look.
 */
import { useEffect, useRef, useState } from 'react';
import { NumberField } from '@/features/tab/NumberField';
import { VolumeKnob } from '@/features/tab/VolumeKnob';
import { defaultLevels, MAX_BPM, MIN_BPM, SOUNDS, tempoName, useMetronome, type Level, type Metronome, type SoundId, type Subdivision } from './engine';
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

function BpmField({ m }: { m: Metronome }) {
  return (
    <div className="tab-speed">
      <span className="text-(--ink-muted)">Tempo</span>
      <NumberField value={m.bpm} min={MIN_BPM} max={MAX_BPM} step={1} label="Tempo (bpm)" upLabel="Faster" downLabel="Slower" onChange={bpm => m.set({ bpm })} />
      <span className="text-(--ink-muted)">bpm</span>
    </div>
  );
}

function BeatsField({ m }: { m: Metronome }) {
  return (
    <div className="tab-speed">
      <span className="text-(--ink-muted)">Beats</span>
      <NumberField value={m.beats} min={1} max={12} step={1} label="Beats in a bar" upLabel="More beats" downLabel="Fewer beats" onChange={beats => m.set({ beats })} />
    </div>
  );
}

const SUBDIVISIONS: [Subdivision, string][] = [[1, 'Quarters'], [2, 'Eighths'], [3, 'Triplets'], [4, 'Sixteenths']];

function SubdivisionSeg({ m }: { m: Metronome }) {
  return (
    <div className="seg" role="group" aria-label="Clicks per beat">
      {SUBDIVISIONS.map(([s, name]) => (
        <button key={s} type="button" className="seg-opt" aria-pressed={m.subdivision === s} onClick={() => m.set({ subdivision: s })}>{name}</button>
      ))}
    </div>
  );
}

const LEVEL_NAME: Record<Level, string> = { accent: 'accented', beat: 'normal', soft: 'soft', mute: 'silent' };

/** The sound and its volume. */
function SoundControls({ m }: { m: Metronome }) {
  return (
    <>
      <label className="tab-speed">
        <span className="text-(--ink-muted)">Sound</span>
        <select className="input mm-select" value={m.sound} onChange={e => m.setSound(e.target.value as SoundId)}>
          {SOUNDS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </label>
      <div className="tab-volume">
        <span className="text-(--ink-muted)" id="mm-volume-label">Volume</span>
        <VolumeKnob value={m.volume} onChange={volume => m.set({ volume })} labelledBy="mm-volume-label" />
      </div>
    </>
  );
}

/** Whether a click is the one sounding now. */
const isNow = (m: Metronome, beat: number, sub: number) => m.now?.beat === beat && m.now.sub === sub;

/** The pattern: a tile per click, grouped by beat; press one to cycle accent, normal, soft, silent. */
function PatternGrid({ m }: { m: Metronome }) {
  return (
    <div className="mm-pattern" role="group" aria-label="Pattern (press a click to change it)">
      {Array.from({ length: m.beats }, (_, beat) => (
        <div key={beat} className="mm-pattern-beat">
          <div className="mm-pattern-clicks">
            {Array.from({ length: m.subdivision }, (_, sub) => {
              const i = beat * m.subdivision + sub;
              const level = m.levels[i];
              return (
                <button
                  key={sub} type="button" className="mm-cell" data-level={level} data-on={isNow(m, beat, sub) || undefined}
                  aria-label={`Beat ${beat + 1}${m.subdivision > 1 ? `, click ${sub + 1}` : ''}: ${LEVEL_NAME[level]}`}
                  data-tip={LEVEL_NAME[level]} onClick={() => m.cycleLevel(i)}
                ><span /></button>
              );
            })}
          </div>
          <span className="mm-pattern-count">{beat + 1}</span>
        </div>
      ))}
    </div>
  );
}

/** "Advanced": the pattern, and silent bars for practising time. Closed at first. */
function Advanced({ m, pattern = true }: { m: Metronome; pattern?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mm-advanced">
      <button type="button" className="mm-advanced-toggle" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2.5 7.5 6 4 9.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Advanced
      </button>
      {open && (
        <div className="mm-advanced-body">
          {pattern && (
            <div className="mm-advanced-section">
              <div className="mm-advanced-head">
                <span className="text-(--ink-muted)">Pattern</span>
                <button type="button" className="btn btn-ghost mm-reset" onClick={() => m.set({ levels: defaultLevels(m.beats, m.subdivision) })}>Reset</button>
              </div>
              <PatternGrid m={m} />
            </div>
          )}
          <div className="mm-row">
            <div className="tab-speed">
              <span className="text-(--ink-muted)">Click for</span>
              <NumberField value={m.playBars} min={1} max={16} step={1} label="Bars that click" upLabel="More" downLabel="Fewer" onChange={playBars => m.set({ playBars })} />
              <span className="text-(--ink-muted)">bars, then silent for</span>
              <NumberField value={m.silentBars} min={0} max={16} step={1} label="Silent bars" upLabel="More" downLabel="Fewer" onChange={silentBars => m.set({ silentBars })} />
              <span className="text-(--ink-muted)">bars</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** A small dot per beat, its size from the beat's level (C). */
function BeatDots({ m, size = 22 }: { m: Metronome; size?: number }) {
  return (
    <div className="mm-dots" aria-hidden="true">
      {Array.from({ length: m.beats }, (_, beat) => (
        <span key={beat} className="mm-dot" data-level={m.levels[beat * m.subdivision]} data-on={m.now?.beat === beat || undefined} style={{ width: size, height: size }} />
      ))}
    </div>
  );
}

/** A's beat display: a big pad per beat that flashes and ripples on its beat, with the clicks between beats as small dots under it. */
function BeatPads({ m }: { m: Metronome }) {
  return (
    <div className="mm-pads" aria-hidden="true" data-silent={m.now?.silent || undefined}>
      {Array.from({ length: m.beats }, (_, beat) => {
        const on = m.now?.beat === beat && m.now.sub === 0;
        return (
          <div key={beat} className="mm-pad-col">
            <span className="mm-pad" data-level={m.levels[beat * m.subdivision]} data-on={on || undefined} data-lit={m.now?.beat === beat || undefined}>
              {/* A new key each time the beat comes round restarts the ripple. */}
              {on && <span key={`${m.now!.bar}`} className="mm-ripple" />}
            </span>
            <span className="mm-pad-subs">
              {m.subdivision > 1 && Array.from({ length: m.subdivision }, (_, sub) => (
                <span key={sub} className="mm-pad-sub" data-level={m.levels[beat * m.subdivision + sub]} data-on={isNow(m, beat, sub) || undefined} />
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* — A: Readout, the Tuner's sibling — */

function Readout() {
  const m = useMetronome();
  return (
    <section className="card mm-card" aria-labelledby="mm-title">
      <h1 id="mm-title" className="m-0">Metronome</h1>
      <div className="mm-readout">
        <button type="button" className="btn btn-ghost mm-step" aria-label="Slower" onClick={() => m.set({ bpm: Math.max(MIN_BPM, m.bpm - 1) })}>−</button>
        <div className="mm-big">
          <span className="mm-big-number">{m.bpm}</span>
          <span className="mm-big-unit">bpm · {tempoName(m.bpm)}</span>
        </div>
        <button type="button" className="btn btn-ghost mm-step" aria-label="Faster" onClick={() => m.set({ bpm: Math.min(MAX_BPM, m.bpm + 1) })}>+</button>
      </div>
      <BeatPads m={m} />
      <div className="mm-row mm-row-center">
        <PlayButton m={m} />
        <TapButton m={m} />
      </div>
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
  const turn = (m.bpm - MIN_BPM) / (MAX_BPM - MIN_BPM);
  const drag = useRef<{ y: number; bpm: number } | null>(null);
  const [kx, ky] = dialPoint(turn, 130);
  return (
    <section className="card mm-card" aria-labelledby="mm-title">
      <h1 id="mm-title" className="m-0">Metronome</h1>
      <div className="mm-dial-wrap">
        <div
          className="mm-dial" role="slider" tabIndex={0} aria-label="Tempo" aria-valuemin={MIN_BPM} aria-valuemax={MAX_BPM} aria-valuenow={m.bpm}
          onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { y: e.clientY, bpm: m.bpm }; }}
          onPointerMove={e => {
            if (!drag.current) return;
            const bpm = Math.round(drag.current.bpm + (drag.current.y - e.clientY) / 2);
            m.set({ bpm: Math.min(MAX_BPM, Math.max(MIN_BPM, bpm)) });
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
            {/* The beat ring: a segment per beat, all the way round, lit on its beat. */}
            {Array.from({ length: m.beats }, (_, beat) => {
              const level = m.levels[beat * m.subdivision];
              const lit = m.now?.beat === beat;
              const span = 360 / m.beats;
              const gap = Math.min(6, span / 4);
              return (
                <path
                  key={beat} d={ringArc(beat * span + gap / 2, (beat + 1) * span - gap / 2, 158)} fill="none"
                  className="mm-ring-seg" data-level={level} data-on={lit || undefined}
                  strokeWidth={level === 'accent' ? 16 : 10}
                />
              );
            })}
            <path d={dialArc(0, 1, 130)} fill="none" stroke="var(--surface-sunken)" strokeWidth={6} strokeLinecap="round" />
            <path d={dialArc(0, Math.max(0.001, turn), 130)} fill="none" stroke="var(--ink-muted)" strokeWidth={6} strokeLinecap="round" />
            <circle cx={DIAL / 2} cy={DIAL / 2} r={114} className="mm-dial-face" data-on={(m.now && m.now.sub === 0) || undefined} data-accent={(m.now && m.now.sub === 0 && m.levels[m.now.beat * m.subdivision] === 'accent') || undefined} />
            <circle cx={kx} cy={ky} r={5} fill="var(--ink)" />
          </svg>
          <div className="mm-dial-center">
            <span className="mm-big-number">{m.bpm}</span>
            <span className="mm-big-unit">bpm · {tempoName(m.bpm)}</span>
          </div>
        </div>
      </div>
      <div className="mm-row mm-row-center">
        <TapButton m={m} />
        <PlayButton m={m} round />
        <BeatsField m={m} />
      </div>
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
  // The arm leans to one side on even beats, the other on odd ones, swinging across in one beat.
  const side = m.now ? (m.now.beat * m.subdivision + m.now.sub) / m.subdivision : 0;
  const lean = !m.playing ? 0 : Math.floor(side) % 2 === 0 ? 24 : -24;
  // The weight sits lower on the arm the faster the tempo, as on a real one.
  const turn = (m.bpm - MIN_BPM) / (MAX_BPM - MIN_BPM);
  const weightY = 56 + turn * 170;
  const marks = [40, 60, 80, 120, 160, 200, 240, 280];
  return (
    <section className="card mm-card mm-card-wide" aria-labelledby="mm-title">
      <h1 id="mm-title" className="m-0">Metronome</h1>
      <div className="mm-pendulum-layout">
        <svg className="mm-pyramid" width="220" height="300" viewBox="0 0 220 300" aria-hidden="true">
          <path d="M80 12 L140 12 L196 292 L24 292 Z" fill="var(--fretboard)" />
          <path d="M90 30 L130 30 L166 236 L54 236 Z" fill="var(--surface-sunken)" opacity="0.12" />
          {marks.map(b => {
            const y = 56 + ((b - MIN_BPM) / (MAX_BPM - MIN_BPM)) * 170;
            return (
              <g key={b}>
                <line x1="118" x2="128" y1={y} y2={y} stroke="var(--fret-wire)" strokeWidth="1.5" />
                <text x="132" y={y + 3.5} fontSize="10" fill="var(--string)" fontFamily="var(--font-sans)">{b}</text>
              </g>
            );
          })}
          <g
            className="mm-arm"
            style={{ transform: `rotate(${lean}deg)`, transitionDuration: `${60 / m.bpm}s` }}
          >
            <line x1="110" y1="250" x2="110" y2="34" stroke="var(--nut)" strokeWidth="3" strokeLinecap="round" />
            <path d={`M100 ${weightY - 8} L120 ${weightY - 8} L116 ${weightY + 8} L104 ${weightY + 8} Z`} fill="var(--primary)" />
          </g>
          <circle cx="110" cy="250" r="6" fill="var(--fret-wire)" />
        </svg>
        <div className="mm-side">
          <p className="mm-tempo-name m-0">{tempoName(m.bpm)}</p>
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
      <div className="mm-bar-head">
        <h1 id="mm-title" className="m-0">Metronome</h1>
        <span className="mm-bar-name">{tempoName(m.bpm)}</span>
      </div>
      <div className="mm-row mm-row-top-line">
        <PlayButton m={m} />
        <BpmField m={m} />
        <TapButton m={m} />
        <BeatsField m={m} />
        <SubdivisionSeg m={m} />
      </div>
      <div className="mm-bar-pattern">
        <PatternGrid m={m} />
      </div>
      <div className="mm-row mm-row-top-line">
        <SoundControls m={m} />
      </div>
      {/* D's tiles are the pattern already, so Advanced holds only the silent bars. */}
      <Advanced m={m} pattern={false} />
    </section>
  );
}
