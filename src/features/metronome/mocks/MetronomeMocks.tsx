'use client';

/**
 * Look mocks for the Metronome page (issue #149), behind ?mock=a/b/c/d. Each is a working
 * metronome (Space starts and stops) so the feel can be judged, not only the look.
 */
import { useEffect, useRef, useState } from 'react';
import { NumberField } from '@/features/tab/NumberField';
import { MAX_BPM, MIN_BPM, tempoName, useMetronome, type Level, type Metronome, type Subdivision } from './engine';
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

const LEVEL_NAME: Record<Level, string> = { accent: 'accented', beat: 'normal', mute: 'silent' };

/** A dot per beat: big for an accent, small for a beat, a ring when silent. Press to change. */
function BeatDots({ m, size = 22 }: { m: Metronome; size?: number }) {
  return (
    <div className="mm-dots" role="group" aria-label="Beats (press to accent or silence)">
      {m.levels.map((level, i) => (
        <button
          key={i} type="button" className="mm-dot" data-level={level} data-on={m.now?.beat === i || undefined}
          style={{ width: size, height: size }}
          aria-label={`Beat ${i + 1}, ${LEVEL_NAME[level]}`} data-tip={`Beat ${i + 1}: ${LEVEL_NAME[level]}`}
          onClick={() => m.cycleLevel(i)}
        />
      ))}
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
          <span className="mm-big-unit">bpm</span>
        </div>
        <button type="button" className="btn btn-ghost mm-step" aria-label="Faster" onClick={() => m.set({ bpm: Math.min(MAX_BPM, m.bpm + 1) })}>+</button>
      </div>
      <p className="mm-tempo-name">{tempoName(m.bpm)}</p>
      <BeatDots m={m} size={26} />
      <div className="mm-row mm-row-center">
        <PlayButton m={m} />
        <TapButton m={m} />
      </div>
      <div className="mm-row mm-row-center mm-row-top-line">
        <BeatsField m={m} />
        <SubdivisionSeg m={m} />
      </div>
    </section>
  );
}

/* — B: Dial, a big tempo knob with the beats round it — */

const DIAL = 280;
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

function Dial() {
  const m = useMetronome();
  const turn = (m.bpm - MIN_BPM) / (MAX_BPM - MIN_BPM);
  const drag = useRef<{ y: number; bpm: number } | null>(null);
  const [kx, ky] = dialPoint(turn, 112);
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
            <path d={dialArc(0, 1, 124)} fill="none" stroke="var(--surface-sunken)" strokeWidth={10} strokeLinecap="round" />
            <path d={dialArc(0, Math.max(0.001, turn), 124)} fill="none" stroke="var(--primary)" strokeWidth={10} strokeLinecap="round" />
            <circle cx={DIAL / 2} cy={DIAL / 2} r={104} fill="var(--surface-raised)" stroke="var(--line-strong)" strokeWidth={1.5} />
            <circle cx={kx} cy={ky} r={5} fill="var(--ink)" />
          </svg>
          <div className="mm-dial-center">
            <span className="mm-big-number">{m.bpm}</span>
            <span className="mm-big-unit">bpm · {tempoName(m.bpm)}</span>
          </div>
        </div>
      </div>
      <BeatDots m={m} size={18} />
      <div className="mm-row mm-row-center">
        <TapButton m={m} />
        <PlayButton m={m} round />
        <BeatsField m={m} />
      </div>
      <div className="mm-row mm-row-center">
        <SubdivisionSeg m={m} />
      </div>
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
          <BeatDots m={m} size={18} />
          <div className="mm-row">
            <PlayButton m={m} />
            <TapButton m={m} />
          </div>
        </div>
      </div>
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
      <div className="mm-bar" role="group" aria-label="Beats (press to accent or silence)">
        {m.levels.map((level, i) => (
          <button
            key={i} type="button" className="mm-tile" data-level={level} onClick={() => m.cycleLevel(i)}
            aria-label={`Beat ${i + 1}, ${LEVEL_NAME[level]}`} data-tip={`Beat ${i + 1}: ${LEVEL_NAME[level]}`}
          >
            <span className="mm-tile-subs">
              {Array.from({ length: m.subdivision }, (_, s) => (
                <span key={s} className="mm-tile-sub" data-first={s === 0 || undefined} data-on={(m.now?.beat === i && m.now.sub === s) || undefined} />
              ))}
            </span>
            <span className="mm-tile-count">{i + 1}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
