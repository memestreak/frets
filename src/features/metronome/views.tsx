'use client';

/**
 * The Metronome's four views, picked by the switch in each one's head. Each shows the beat at the
 * top, in a box that keeps its size whatever the beats, so nothing else moves (Jeremy, 2026-10-31).
 * Advanced is the same under all four.
 */
import { useRef, type PointerEvent } from 'react';
import { letGoOfFields } from '@/hooks/useLetGoAfterUse';
import { Advanced } from './Advanced';
import {
  BeatsField, BpmField, DRAG_BPM, Head, PlayButton, SoundControls, TapButton, beatVoice, isNow,
  useBpmDrag, voiceAttr,
} from './controls';
import { MAX_BPM, MIN_BPM, VOICE_NAMES, clampBpm, cycleCell, tempoName } from './rhythm';
import type { ViewId } from './storage';
import type { Metronome } from './useMetronome';

export function MetronomeView({ view, m }: { view: ViewId; m: Metronome }) {
  switch (view) {
    case 'readout': return <Readout m={m} />;
    case 'dial': return <Dial m={m} />;
    case 'pendulum': return <Pendulum m={m} />;
    case 'bar': return <Bar m={m} />;
  }
}

/* — Readout: big pads over the big tempo, the Tuner's sibling — */

/** Up to this many beats the pads share one row; past it, two. */
const ONE_ROW_BEATS = 16;

/** A pad per beat that flashes and ripples on its beat, its steps as small dots under it. */
function BeatPads({ m }: { m: Metronome }) {
  const { beats, subs, steps } = m.rhythm;
  const columns = beats <= ONE_ROW_BEATS ? beats : Math.ceil(beats / 2);
  const size = beats <= ONE_ROW_BEATS ? 52 : 28;
  return (
    <div
      className="metronome-pads" aria-hidden="true"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, ${size}px))`, columnGap: beats <= 8 ? 18 : 8 }}
    >
      {Array.from({ length: beats }, (_, beat) => {
        const on = isNow(m, beat);
        const n = subs[beat] ?? 1;
        return (
          <div key={beat} className="metronome-pad-col">
            <span className="metronome-pad" data-voice={voiceAttr(beatVoice(m, beat))} data-on={on || undefined}>
              {on && <span key={m.now!.bar} className="metronome-ripple" />}
            </span>
            <span className="metronome-pad-steps">
              {n > 1 && Array.from({ length: n }, (_, s) => (
                <span key={s} className="metronome-pad-step" data-voice={voiceAttr(steps[beat]?.[s] ?? null)} data-on={isNow(m, beat, s) || undefined} />
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Readout({ m }: { m: Metronome }) {
  const drag = useBpmDrag(m);
  const { bpm } = m.rhythm;
  const nudge = (by: number) => m.setRhythm(r => ({ ...r, bpm: clampBpm(r.bpm + by) }));
  return (
    <section className="card metronome-card" aria-labelledby="metronome-title">
      <Head />
      <BeatPads m={m} />
      <div className="metronome-readout">
        <button type="button" className="btn btn-ghost metronome-nudge" aria-label="Slower" data-tip="1 bpm slower" onClick={() => nudge(-1)}>−</button>
        <div
          className="metronome-big metronome-bpm-drag" role="slider" tabIndex={0} aria-label="Tempo"
          aria-valuemin={MIN_BPM} aria-valuemax={MAX_BPM} aria-valuenow={bpm} aria-valuetext={`${bpm} bpm`}
          data-tip="Drag up or down: 5 bpm a step, 1 with Shift" {...drag}
          onKeyDown={e => {
            const by = ({ ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 } as Record<string, number>)[e.key];
            if (by === undefined) return;
            e.preventDefault();
            nudge(by * (e.shiftKey ? 1 : 5));
          }}
        >
          <span className="metronome-big-number">{bpm}</span>
          <span className="metronome-big-unit">bpm · {tempoName(bpm)}</span>
        </div>
        <button type="button" className="btn btn-ghost metronome-nudge" aria-label="Faster" data-tip="1 bpm faster" onClick={() => nudge(1)}>+</button>
      </div>
      <div className="metronome-row metronome-center">
        <PlayButton m={m} />
        <TapButton m={m} />
      </div>
      <div className="metronome-row metronome-center metronome-rule">
        <BeatsField m={m} />
      </div>
      <div className="metronome-row metronome-center">
        <SoundControls m={m} />
      </div>
      <Advanced m={m} />
    </section>
  );
}

/* — Dial: a big tempo knob with the beats round it — */

const DIAL = 340;
/** How far round the tempo's arc goes, in degrees, with the gap at the bottom. */
const SWEEP = 280;
const RING_R = 158;
const ARC_R = 130;

/** A point on the tempo's arc, at a turn of 0 (slowest) to 1 (fastest). */
function dialPoint(turn: number, r: number): [number, number] {
  const rad = ((-SWEEP / 2 + turn * SWEEP - 90) * Math.PI) / 180;
  return [DIAL / 2 + r * Math.cos(rad), DIAL / 2 + r * Math.sin(rad)];
}

function dialArc(from: number, to: number, r: number) {
  const [x0, y0] = dialPoint(from, r);
  const [x1, y1] = dialPoint(to, r);
  return `M${x0} ${y0} A${r} ${r} 0 ${(to - from) * SWEEP > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

/** An arc of the whole circle round the dial, in degrees clockwise from the top. */
function ringArc(from: number, to: number, r: number) {
  const at = (deg: number) => [DIAL / 2 + r * Math.sin((deg * Math.PI) / 180), DIAL / 2 - r * Math.cos((deg * Math.PI) / 180)];
  const [x0, y0] = at(from);
  const [x1, y1] = at(to);
  return `M${x0} ${y0} A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

function Dial({ m }: { m: Metronome }) {
  const { bpm, beats } = m.rhythm;
  const turn = (bpm - MIN_BPM) / (MAX_BPM - MIN_BPM);
  const drag = useBpmDrag(m);
  const [kx, ky] = dialPoint(turn, ARC_R);
  const n = m.now;
  const onBeat = n !== null && n.beat >= 0 && n.step === 0;
  const span = 360 / beats;
  const gap = Math.min(6, span / 4);
  return (
    <section className="card metronome-card" aria-labelledby="metronome-title">
      <Head />
      <div className="metronome-dial-wrap">
        <div
          className="metronome-dial metronome-bpm-drag" role="slider" tabIndex={0} aria-label="Tempo"
          aria-valuemin={MIN_BPM} aria-valuemax={MAX_BPM} aria-valuenow={bpm} aria-valuetext={`${bpm} bpm`}
          data-tip="Drag up or down: 5 bpm a step, 1 with Shift" {...drag}
          onKeyDown={e => {
            const by = ({ ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 } as Record<string, number>)[e.key];
            if (by === undefined) return;
            e.preventDefault();
            m.setRhythm(r => ({ ...r, bpm: clampBpm(r.bpm + by * (e.shiftKey ? 1 : 5)) }));
          }}
        >
          <svg width={DIAL} height={DIAL} viewBox={`0 0 ${DIAL} ${DIAL}`} aria-hidden="true">
            {Array.from({ length: beats }, (_, beat) => {
              const voice = voiceAttr(beatVoice(m, beat));
              return (
                <path
                  key={beat} d={ringArc(beat * span + gap / 2, (beat + 1) * span - gap / 2, RING_R)} fill="none"
                  className="metronome-ring" data-voice={voice} data-on={n?.beat === beat || undefined}
                  strokeWidth={voice === 'A' ? 16 : 10}
                />
              );
            })}
            <path d={dialArc(0, 1, ARC_R)} fill="none" stroke="var(--surface-sunken)" strokeWidth={6} strokeLinecap="round" />
            <path d={dialArc(0, Math.max(0.001, turn), ARC_R)} fill="none" stroke="var(--ink-muted)" strokeWidth={6} strokeLinecap="round" />
            <circle
              cx={DIAL / 2} cy={DIAL / 2} r={114} className="metronome-dial-face" data-on={onBeat || undefined}
              data-accent={(onBeat && beatVoice(m, n!.beat) === 0) || undefined}
            />
            <circle cx={kx} cy={ky} r={5} fill="var(--ink)" />
          </svg>
          <div className="metronome-dial-center">
            <span className="metronome-big-number">{bpm}</span>
            <span className="metronome-big-unit">bpm · {tempoName(bpm)}</span>
          </div>
        </div>
      </div>
      <div className="metronome-row metronome-center">
        <PlayButton m={m} round />
        <TapButton m={m} round />
        <BeatsField m={m} />
      </div>
      <div className="metronome-row metronome-center metronome-rule">
        <SoundControls m={m} />
      </div>
      <Advanced m={m} />
    </section>
  );
}

/* — Pendulum: the wooden pyramid metronome, the beats beside it — */

/**
 * The scale, and where the weight sits for a tempo: lower the faster, as on a real one. The scale runs
 * the whole tempo range, so the weight can show, and reach, every tempo.
 */
const PENDULUM_MARKS = [40, 80, 120, 160, 200, 240, 280, 320, 360, 400];
const WEIGHT_TOP = 56;
const WEIGHT_BOTTOM = 226;
const weightY = (bpm: number) => WEIGHT_TOP + ((Math.min(MAX_BPM, Math.max(MIN_BPM, bpm)) - MIN_BPM) / (MAX_BPM - MIN_BPM)) * (WEIGHT_BOTTOM - WEIGHT_TOP);
const bpmAt = (y: number) => MIN_BPM + ((y - WEIGHT_TOP) / (WEIGHT_BOTTOM - WEIGHT_TOP)) * (MAX_BPM - MIN_BPM);
/** Where the scale's ticks start: just right of the arm, so the labels stay on the lighter panel. */
const SCALE_X = 113;
/** The arm's pivot, in the drawing's units. */
const PIVOT_X = 110;
const PIVOT_Y = 250;
/** The drawing's height, in its own units. */
const PYRAMID_H = 300;
/** How far the arm leans each way, in degrees. */
const LEAN = 24;

/**
 * Press the weight and drag it: it stays under the pointer, and the tempo is where it sits (#270),
 * to 5 bpm, or to 1 with Shift. It is measured along the arm, so it follows even while the arm swings.
 */
function useWeightDrag(m: Metronome) {
  /** How far below the weight's middle it was pressed, so it doesn't jump to the pointer. */
  const drag = useRef<{ offset: number } | null>(null);
  /** The pointer's distance up the arm from the pivot, as a height on the scale. */
  const armY = (e: PointerEvent<Element>) => {
    const svg = (e.currentTarget as SVGElement).ownerSVGElement;
    const box = svg?.getBoundingClientRect();
    if (!box || box.height === 0) return null;
    const scale = PYRAMID_H / box.height;
    const x = (e.clientX - box.left) * scale;
    const y = (e.clientY - box.top) * scale;
    return PIVOT_Y - Math.hypot(x - PIVOT_X, y - PIVOT_Y);
  };
  const end = () => {
    drag.current = null;
  };
  return {
    onPointerDown: (e: PointerEvent<Element>) => {
      if (e.button !== 0) return;
      const y = armY(e);
      if (y === null) return;
      e.preventDefault();
      letGoOfFields();
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { offset: y - weightY(m.rhythm.bpm) };
    },
    onPointerMove: (e: PointerEvent<Element>) => {
      const d = drag.current;
      const y = d && armY(e);
      if (!d || y === null) return;
      const step = e.shiftKey ? 1 : DRAG_BPM;
      const bpm = clampBpm(Math.round(bpmAt(y - d.offset) / step) * step);
      m.setRhythm(r => (r.bpm === bpm ? r : { ...r, bpm }));
    },
    onPointerUp: end,
    onPointerCancel: end,
  };
}

/** A dot per beat, four to a row, in a box beside the pendulum. */
function BeatDots({ m }: { m: Metronome }) {
  return (
    <div className="metronome-dots" aria-hidden="true">
      {Array.from({ length: m.rhythm.beats }, (_, beat) => (
        <span key={beat} className="metronome-dot" data-voice={voiceAttr(beatVoice(m, beat))} data-on={m.now?.beat === beat || undefined} />
      ))}
    </div>
  );
}

function Pendulum({ m }: { m: Metronome }) {
  const drag = useWeightDrag(m);
  const { bpm } = m.rhythm;
  // The arm leans one way on even beats and the other on odd ones, swinging across in one beat.
  const lean = !m.now || m.now.beat < 0 ? 0 : m.now.beat % 2 === 0 ? LEAN : -LEAN;
  const y = weightY(bpm);
  return (
    <section className="card metronome-card" aria-labelledby="metronome-title">
      <Head />
      <div className="metronome-pendulum">
        <svg className="metronome-pyramid" width="220" height="300" viewBox="0 0 220 300" role="group" aria-label="Pendulum">
          <path d="M80 12 L140 12 L196 292 L24 292 Z" fill="var(--fretboard)" />
          <path d="M90 30 L130 30 L166 236 L54 236 Z" fill="var(--surface-sunken)" opacity="0.12" />
          {PENDULUM_MARKS.map(b => (
            <g key={b}>
              <line x1={SCALE_X} x2={SCALE_X + 5} y1={weightY(b)} y2={weightY(b)} stroke="var(--fret-wire)" strokeWidth="1.5" />
              <text x={SCALE_X + 8} y={weightY(b) + 3.5} fontSize="10" fill="var(--string)" fontFamily="var(--font-sans)">{b}</text>
            </g>
          ))}
          <g className="metronome-arm" style={{ transform: `rotate(${lean}deg)`, transitionDuration: `${60 / bpm}s` }}>
            <line x1="110" y1="250" x2="110" y2="34" stroke="var(--nut)" strokeWidth="3" strokeLinecap="round" />
            {/* The weight, with room round it to press (±16px). */}
            <g
              className="metronome-weight" role="slider" tabIndex={0} aria-label="Tempo"
              aria-valuemin={MIN_BPM} aria-valuemax={MAX_BPM} aria-valuenow={bpm} aria-valuetext={`${bpm} bpm`}
              data-tip="Drag the weight: down is faster (Shift: 1 bpm steps)" {...drag}
              onKeyDown={e => {
                const by = ({ ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 } as Record<string, number>)[e.key];
                if (by === undefined) return;
                e.preventDefault();
                m.setRhythm(r => ({ ...r, bpm: clampBpm(r.bpm + by * (e.shiftKey ? 1 : DRAG_BPM)) }));
              }}
            >
              <rect x={84} y={y - 24} width={52} height={48} fill="transparent" />
              <path d={`M100 ${y - 8} L120 ${y - 8} L116 ${y + 8} L104 ${y + 8} Z`} fill="var(--primary)" />
            </g>
          </g>
          <circle cx="110" cy="250" r="6" fill="var(--fret-wire)" />
        </svg>
        <BeatDots m={m} />
      </div>
      <p className="metronome-tempo-name metronome-center m-0">{tempoName(bpm)}</p>
      <div className="metronome-row metronome-center">
        <PlayButton m={m} />
        <TapButton m={m} />
      </div>
      <div className="metronome-row metronome-center metronome-rule">
        <BpmField m={m} />
        <BeatsField m={m} />
      </div>
      <div className="metronome-row metronome-center">
        <SoundControls m={m} />
      </div>
      <Advanced m={m} />
    </section>
  );
}

/* — Bar: the whole bar as tiles, each a step, its height its voice — */

function Bar({ m }: { m: Metronome }) {
  const { subs, steps, bpm } = m.rhythm;
  return (
    <section className="card metronome-card" aria-labelledby="metronome-title">
      <Head><span className="metronome-tempo-name">{tempoName(bpm)}</span></Head>
      <div className="metronome-tiles" role="group" aria-label="Steps (press to change the voice)">
        {subs.map((n, beat) => (
          <div key={beat} className="metronome-tiles-beat">
            <div className="metronome-tiles-steps">
              {Array.from({ length: n }, (_, s) => {
                const v = steps[beat]?.[s] ?? null;
                const name = v === null ? 'silent' : `voice ${VOICE_NAMES[v]}`;
                return (
                  <button
                    key={s} type="button" className="metronome-tile" data-voice={voiceAttr(v)} data-on={isNow(m, beat, s) || undefined}
                    aria-label={`Beat ${beat + 1} step ${s + 1}: ${name}`} data-tip={v === null ? 'Silent' : `Voice ${VOICE_NAMES[v]}`}
                    onClick={() => m.setRhythm(r => cycleCell(r, beat, s))}
                  ><span /></button>
                );
              })}
            </div>
            {/* Past 16 beats, every fourth is numbered, so the numbers fit a phone. */}
            <span className="metronome-tiles-count">{subs.length <= ONE_ROW_BEATS || beat % 4 === 0 ? beat + 1 : ''}</span>
          </div>
        ))}
      </div>
      <div className="metronome-row">
        <PlayButton m={m} />
        <TapButton m={m} />
        <BpmField m={m} />
        <BeatsField m={m} />
      </div>
      <div className="metronome-row metronome-rule">
        <SoundControls m={m} />
      </div>
      <Advanced m={m} />
    </section>
  );
}
