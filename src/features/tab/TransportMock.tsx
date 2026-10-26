'use client';

/**
 * MOCKS ONLY (/tab?mock=a|b|c): three ways to lay out a playback transport. The playhead moves at the
 * tempo through the columns, but nothing sounds yet; the chosen design gets the real alphaTab synth.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { PauseIcon, PlayIcon } from '@/components/icons';
import { ticks, WHOLE, type Clip } from './clip';
import { layoutClip } from './layout';

export type MockVariant = 'a' | 'b' | 'c';

const MOCKS: { id: MockVariant; label: string }[] = [
  { id: 'a', label: 'A · Bar over the tab' },
  { id: 'b', label: 'B · Footer in the card' },
  { id: 'c', label: 'C · Play in the header' },
];

/** The mock named in the URL's ?mock=, or null. */
export function useMockVariant(): [MockVariant | null, (v: MockVariant) => void] {
  const [variant, setVariant] = useState<MockVariant | null>(() => {
    const v = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('mock');
    return v === 'a' || v === 'b' || v === 'c' ? v : null;
  });
  const choose = (v: MockVariant) => {
    const url = new URL(window.location.href);
    url.searchParams.set('mock', v);
    window.history.replaceState(null, '', url);
    setVariant(v);
  };
  return [variant, choose];
}

export function MockSwitcher({ variant, onChoose }: { variant: MockVariant; onChoose: (v: MockVariant) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-(--radius-md) border border-dashed border-(--line-strong) px-3 py-2">
      <span className="text-sm text-(--ink-muted)">Playback mock (silent: the playhead moves, no sound yet)</span>
      <div className="seg" role="group" aria-label="Mock">
        {MOCKS.map(m => (
          <button key={m.id} type="button" className="seg-opt" aria-pressed={variant === m.id} onClick={() => onChoose(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* — the pretend playback: a playhead stepping through the columns at the tempo — */

export interface Playback {
  playing: boolean;
  /** The column the playhead is on, by its place in the whole clip; null when stopped. */
  at: number | null;
  loop: boolean;
  /** The columns the loop repeats: the selection when Loop was turned on, else null for the whole clip. */
  loopRange: [number, number] | null;
  /** The tempo now: the clip's own at the playhead (or its first), times the speed. */
  bpm: number;
  /** The clip's own tempo there, which 100% plays at. */
  baseBpm: number;
  toggle: () => void;
  stop: () => void;
  setLoop: (on: boolean) => void;
  /** Sets the speed so the tempo shown becomes this. */
  setBpm: (bpm: number) => void;
}

/** Each column's own tempo, from the last \tempo at or before its bar (120 when none). */
function columnTempos(clip: Clip): number[] {
  let bpm = 120;
  return clip.bars.flatMap(bar => {
    if (bar.tempo) bpm = bar.tempo.bpm;
    return bar.columns.map(() => bpm);
  });
}

export function usePlayback(clip: Clip, selection: [number, number] | null, start: number): Playback {
  const columns = clip.bars.flatMap(b => b.columns);
  const tempos = columnTempos(clip);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState<number | null>(null);
  const [loopRange, setLoopRange] = useState<[number, number] | null>(null);
  const [loop, setLoopOn] = useState(false);
  const [speed, setSpeed] = useState(1);
  const baseBpm = tempos[at ?? 0] ?? 120;
  const bpm = Math.round(baseBpm * speed);
  const [from, to] = loop && loopRange ? loopRange : [0, columns.length - 1];

  useEffect(() => {
    if (!playing || at === null) return;
    const column = columns[at];
    const ms = column ? (ticks(column.duration) / (WHOLE / 4)) * (60000 / ((tempos[at] ?? 120) * speed)) : 0;
    const timer = window.setTimeout(() => {
      if (at < to) setAt(at + 1);
      else if (loop) setAt(from);
      else {
        setPlaying(false);
        setAt(null);
      }
    }, column?.grace ? 30 : ms);
    return () => window.clearTimeout(timer);
  }, [playing, at, columns, tempos, from, to, loop, speed]);

  return {
    playing, at, loop, loopRange: loop ? loopRange : null, bpm, baseBpm,
    toggle: () => {
      if (playing) return setPlaying(false);
      if (at === null) setAt(loop && loopRange ? loopRange[0] : selection ? selection[0] : start);
      setPlaying(true);
    },
    stop: () => {
      setPlaying(false);
      setAt(null);
    },
    setLoop: on => {
      setLoopOn(on);
      setLoopRange(on ? selection : null);
    },
    setBpm: b => setSpeed(Math.max(0.25, Math.min(2, b / baseBpm))),
  };
}

/** The playhead and, while looping a selection, the loop's span, drawn over the tab. */
export function PlayheadOverlay({ clip, width, playback }: { clip: Clip; width: number; playback: Playback }) {
  const layout = layoutClip(clip, width);
  const { rows } = layout;
  const parts: ReactNode[] = [];
  layout.systems.forEach((system, si) => {
    const y = si * rows.height;
    const cols = system.bars.flatMap(b => b.columns);
    const loop = playback.loopRange;
    if (loop) {
      const inLoop = cols.filter(c => c.index >= loop[0] && c.index <= loop[1]);
      if (inLoop.length > 0) {
        const x0 = inLoop[0].x - inLoop[0].width / 2;
        const last = inLoop[inLoop.length - 1];
        const x1 = last.x + last.width / 2;
        const ly = y + rows.stemBottom + 8;
        parts.push(
          <path key={`loop-${si}`} d={`M${x0} ${ly - 3} V${ly} H${x1} V${ly - 3}`} fill="none" stroke="var(--primary)" strokeWidth={2} />,
        );
      }
    }
    const head = cols.find(c => c.index === playback.at);
    if (head) {
      parts.push(
        <g key={`head-${si}`}>
          <rect x={head.x - head.width / 2} y={y + rows.staffTop - 10} width={head.width} height={rows.staffBottom - rows.staffTop + 20} fill="var(--primary-soft)" opacity={0.6} />
          <line x1={head.x - head.width / 2} x2={head.x - head.width / 2} y1={y + rows.staffTop - 12} y2={y + rows.staffBottom + 12} stroke="var(--primary)" strokeWidth={2} />
        </g>,
      );
    }
  });
  return (
    <svg className="pointer-events-none absolute left-0 top-0" width={width} height={layout.height} aria-hidden="true">
      {parts}
    </svg>
  );
}

/* — the three layouts — */

function LoopIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
  );
}

function PlayButton({ playback, className = 'btn btn-primary btn-icon' }: { playback: Playback; className?: string }) {
  return (
    <button type="button" className={className} aria-label={playback.playing ? 'Pause' : 'Play'} title={playback.playing ? 'Pause (Space)' : 'Play (Space)'} onClick={playback.toggle}>
      {playback.playing ? <PauseIcon /> : <PlayIcon />}
    </button>
  );
}

function LoopButton({ playback, selection, label = true }: { playback: Playback; selection: [number, number] | null; label?: boolean }) {
  const tip = selection ? 'Loop the selected notes' : 'Loop the whole clip (select notes to loop just those)';
  return (
    <button
      type="button" className={label ? 'seg-opt' : 'btn btn-secondary btn-icon'} aria-pressed={playback.loop}
      title={tip} aria-label="Loop" onClick={() => playback.setLoop(!playback.loop)}
    >
      <LoopIcon />{label && 'Loop'}
    </button>
  );
}

function TempoStepper({ playback }: { playback: Playback }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Tempo">
      <button type="button" className="btn btn-secondary btn-icon" aria-label="Slower" onClick={() => playback.setBpm(playback.bpm - 5)}>−</button>
      <span className="w-[64px] text-center text-sm font-semibold tabular-nums">{playback.bpm} bpm</span>
      <button type="button" className="btn btn-secondary btn-icon" aria-label="Faster" onClick={() => playback.setBpm(playback.bpm + 5)}>+</button>
    </div>
  );
}

function Position({ clip, playback }: { clip: Clip; playback: Playback }) {
  let bar = 1;
  if (playback.at !== null) {
    let n = playback.at;
    for (let b = 0; b < clip.bars.length; b++) {
      if (n < clip.bars[b].columns.length) { bar = b + 1; break; }
      n -= clip.bars[b].columns.length;
    }
  }
  return <span className="w-[88px] text-sm text-(--ink-muted) tabular-nums">Bar {bar} of {clip.bars.length}</span>;
}

/** A: a slim bar of its own between the palette and the tab. */
export function TransportBarA({ clip, playback, selection }: { clip: Clip; playback: Playback; selection: [number, number] | null }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="Playback">
      <div className="flex items-center gap-2">
        <PlayButton playback={playback} />
        <button type="button" className="btn btn-secondary btn-icon" aria-label="Stop" title="Stop, back to the start" onClick={playback.stop}><StopIcon /></button>
      </div>
      <div className="seg"><LoopButton playback={playback} selection={selection} /></div>
      <TempoStepper playback={playback} />
      <Position clip={clip} playback={playback} />
    </div>
  );
}

/** B: a footer inside the card under the tab: progress through the bars, and speed as a percentage. */
export function TransportFooterB({ clip, playback, selection }: { clip: Clip; playback: Playback; selection: [number, number] | null }) {
  const total = clip.bars.reduce((n, b) => n + b.columns.length, 0);
  const done = playback.at === null ? 0 : (playback.at + 1) / Math.max(1, total);
  const speed = Math.round((playback.bpm / playback.baseBpm) * 100);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-(--line) pt-3" aria-label="Playback">
      <PlayButton playback={playback} className="btn btn-primary btn-icon rounded-full" />
      <div className="relative h-2 min-w-[160px] flex-1 overflow-hidden rounded-full bg-(--surface-sunken)" aria-hidden="true">
        <div className="h-full bg-(--primary)" style={{ width: `${done * 100}%` }} />
        {clip.bars.slice(1).map((_, i) => {
          const before = clip.bars.slice(0, i + 1).reduce((n, b) => n + b.columns.length, 0);
          return <div key={i} className="absolute top-0 h-full w-px bg-(--line-strong)" style={{ left: `${(before / total) * 100}%` }} />;
        })}
      </div>
      <LoopButton playback={playback} selection={selection} label={false} />
      <label className="flex items-center gap-2 text-sm">
        <span className="text-(--ink-muted)">Speed</span>
        <input
          type="range" className="accent-(--primary)" min={25} max={150} step={5} value={speed} aria-label="Speed"
          onChange={e => playback.setBpm(Math.round((playback.baseBpm * Number(e.target.value)) / 100))}
        />
        <span className="w-[104px] font-semibold tabular-nums">{speed}% · {playback.bpm} bpm</span>
      </label>
    </div>
  );
}

/** C: one Play button in the header; loop and tempo in a small panel beside it. */
export function TransportHeaderC({ playback, selection }: { playback: Playback; selection: [number, number] | null }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex items-center gap-1">
      <PlayButton playback={playback} />
      <button type="button" className="btn btn-secondary" aria-expanded={open} onClick={() => setOpen(!open)}>
        {playback.loop ? <LoopIcon /> : null}{playback.bpm} bpm ▾
      </button>
      {open && (
        <div className="card absolute left-0 top-[calc(100%+6px)] z-10 grid w-[240px] gap-3 p-3 shadow-lg">
          <div>
            <span className="field-label">Loop</span>
            <div className="seg">
              <button type="button" className="seg-opt" aria-pressed={!playback.loop} onClick={() => playback.setLoop(false)}>Off</button>
              <button type="button" className="seg-opt" aria-pressed={playback.loop} onClick={() => playback.setLoop(true)}>
                {selection ? 'Selection' : 'Whole clip'}
              </button>
            </div>
          </div>
          <div>
            <span className="field-label">Tempo</span>
            <TempoStepper playback={playback} />
          </div>
        </div>
      )}
    </div>
  );
}
