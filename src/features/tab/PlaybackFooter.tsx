'use client';

/**
 * Playback, in a footer under the tab (Jeremy picked it from three mocks, 2026-10-26): a round Play,
 * a line of progress through the clip split into bars (press it to jump there, or to put the cursor
 * there when nothing plays), Loop and Speed. The playhead is drawn
 * over the tab by `Playhead`. The sound is `playback.ts`.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PauseIcon, PlayIcon } from '@/components/icons';
import type { Clip } from './clip';
import { columnCount, placeOf } from './editing';
import { layoutClip } from './layout';
import { MAX_SPEED, MIN_SPEED, TabPlayer, timeline, type PlayerView } from './playback';

/** Whether the playback controls show (the small round button under the tab); hidden at first. */
export const PLAYBACK_KEY = 'frets.tab.playback';

/** The saved choice: shown only when it was saved as shown. */
export function parseShowPlayback(saved: unknown): boolean {
  return saved === true;
}

/** What a Loop repeats: the columns selected when it was turned on, or the whole clip. */
export type Loop = [number, number] | 'whole';

export interface Playback {
  view: PlayerView;
  /** The clip's own tempo where the playhead is (or at the start), before the speed. */
  bpm: number;
  loop: Loop | null;
  speed: number;
  /** Plays from `from` (a column), or pauses. */
  toggle: (from: number) => void;
  /** Loop on (the selection, else the whole clip) or off. */
  toggleLoop: (selection: [number, number] | null) => void;
  setSpeed: (speed: number) => void;
  /** Moves the playing clip to a column; false when nothing is playing. */
  seek: (index: number) => boolean;
  /** Stops, leaving the cursor where it is: when the footer is hidden. */
  stop: () => void;
}

const IDLE: PlayerView = { state: 'idle', column: null };

/**
 * Playback of a clip; any edit stops it, so the next Play plays what is drawn. A pause hands
 * `onPause` the column it stopped on, for the cursor: Play starts from the cursor, so it resumes.
 */
export function usePlayback(clip: Clip, onPause: (column: number) => void): Playback {
  const [view, setView] = useState<PlayerView>(IDLE);
  const [loop, setLoop] = useState<Loop | null>(null);
  const [speed, setSpeedState] = useState(1);
  const player = useRef<TabPlayer | null>(null);
  const update = (change: Partial<PlayerView>) => setView(v => ({ ...v, ...change }));

  useEffect(() => {
    player.current?.stop();
  }, [clip]);
  useEffect(() => () => player.current?.destroy(), []);

  return {
    view,
    bpm: tempoAt(clip, view.column ?? 0),
    loop,
    speed,
    toggle: from => {
      if (view.state === 'playing') {
        // The cursor goes where it stopped, so the next Play goes on from there.
        if (view.column !== null) onPause(view.column);
        return player.current?.pause();
      }
      if (view.state === 'loading') return;
      const start = (p: TabPlayer) => p.play(clip, from, loop, speed);
      if (player.current) return start(player.current);
      update({ state: 'loading' });
      TabPlayer.create(update).then(
        p => {
          player.current = p;
          start(p);
        },
        () => update({ state: 'error' }),
      );
    },
    toggleLoop: selection => {
      const next: Loop | null = loop ? null : selection ?? 'whole';
      setLoop(next);
      player.current?.setLoop(next);
    },
    setSpeed: s => {
      setSpeedState(s);
      player.current?.setSpeed(s);
    },
    seek: index => {
      if (view.state !== 'playing') return false;
      player.current?.seek(index);
      return true;
    },
    stop: () => player.current?.stop(),
  };
}

/** The clip's own tempo at a column: the last \\tempo at or before its bar, else alphaTab's 120. */
function tempoAt(clip: Clip, index: number): number {
  const bar = placeOf(clip, Math.min(index, Math.max(0, columnCount(clip) - 1))).bar;
  let bpm = 120;
  for (let b = 0; b <= bar && b < clip.bars.length; b++) bpm = clip.bars[b].tempo?.bpm ?? bpm;
  return bpm;
}

function LoopIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

/**
 * The row under the tab: a very small round button with a green play triangle (Jeremy, 2026-10-26)
 * that shows the playback controls beside it, and with a plain minus hides them. It stays put either way.
 */
export function PlaybackFooter({ clip, playback, from, selection, onPlace, shown, onShow }: {
  clip: Clip;
  playback: Playback;
  /** Whether the controls show; hidden, only the small button does. */
  shown: boolean;
  onShow: (shown: boolean) => void;
  /** A press on the progress line while nothing plays: the column there, for the cursor. */
  onPlace: (index: number) => void;
  /** The column a Play starts from: the selection's first, else the cursor's. */
  from: number;
  selection: [number, number] | null;
}) {
  const { view, loop, speed } = playback;
  const playing = view.state === 'playing';
  // The line is the clip as written, each bar as long as its time: a repeat goes back along it.
  const time = timeline(clip);
  const total = time.columns.length;
  // Playing, the line fills to the column sounding; stopped, to where Play will start.
  const startsAt = Array.isArray(loop) && (from < loop[0] || from > loop[1]) ? loop[0] : from;
  const upTo = view.column ?? (view.state === 'playing' ? null : startsAt);
  const progress = upTo === null ? 0 : (time.columns[upTo] ?? 0) / Math.max(1, time.total);
  const percent = Math.round(speed * 100);
  const loopTip = loop
    ? 'Loop on: press to play once'
    : selection ? 'Loop the selected notes' : 'Loop the whole clip (select notes to loop just those)';
  const playLabel = view.state === 'loading' ? 'Loading the sound…' : playing ? 'Pause' : 'Play';
  return (
    <div className="tab-playback-row" data-shown={shown}>
      <button
        type="button" className="tab-playback-toggle" aria-label="Playback controls" aria-pressed={shown}
        data-tip={shown ? 'Hide playback' : 'Show playback'} onClick={() => onShow(!shown)}
      >
        {/* Hidden: a green play triangle. Shown: a plain minus, to put them away. */}
        {shown
          ? <svg width={8} height={8} viewBox="0 0 8 8" aria-hidden="true"><path d="M1 4h6" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" /></svg>
          : <svg width={8} height={8} viewBox="0 0 8 8" aria-hidden="true"><path d="M1.5 0.5v7l6-3.5Z" fill="currentColor" /></svg>}
      </button>
      {shown && (
        <div className="tab-playback" aria-label="Playback" role="group">
          <button
            type="button" className="btn btn-primary btn-icon tab-play" aria-label={playLabel} data-tip={`${playLabel} (Space)`}
            disabled={total === 0} onClick={() => playback.toggle(from)}
          >
            {view.state === 'loading' ? <span className="tab-play-spinner" aria-hidden="true" /> : playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <div
            className="tab-progress" role="slider" aria-label="Position" aria-valuemin={0} aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)} tabIndex={-1}
            // The press leaves the focus where it was (or where onPlace puts it).
            onMouseDown={e => e.preventDefault()}
            onPointerDown={e => {
              // The column at the point pressed: while playing, the clip goes there; else the cursor does.
              const box = e.currentTarget.getBoundingClientRect();
              const at = ((e.clientX - box.left) / box.width) * time.total;
              let index = 0;
              while (index + 1 < time.columns.length && time.columns[index + 1] <= at) index++;
              if (!playback.seek(index)) onPlace(index);
            }}
          >
            <div className="tab-progress-done" style={{ width: `${progress * 100}%` }} />
            {time.bars.slice(1).map((start, i) => (
              <div key={i} className="tab-progress-bar" style={{ left: `${(start / Math.max(1, time.total)) * 100}%` }} />
            ))}
          </div>
          <button
            type="button" className="btn btn-secondary btn-icon" aria-label="Loop" aria-pressed={loop !== null} data-tip={loopTip}
            onClick={() => playback.toggleLoop(selection)}
          >
            <LoopIcon />
          </button>
          <label className="tab-speed">
            <span className="text-(--ink-muted)">Speed</span>
            <input
              type="range" min={MIN_SPEED * 100} max={MAX_SPEED * 100} step={5} value={percent} aria-label="Speed"
              onChange={e => playback.setSpeed(Number(e.target.value) / 100)}
            />
            <span className="tab-speed-value">{percent}% · {Math.round(playback.bpm * speed)} bpm</span>
          </label>
          {view.state === 'error' && <span className="text-sm text-(--danger)">The sound didn&apos;t load.</span>}
        </div>
      )}
    </div>
  );
}

/** The playhead on the column sounding and, while a selection loops, a bracket under it, drawn over the tab. */
export function Playhead({ clip, width, playback }: { clip: Clip; width: number; playback: Playback }) {
  const { column } = playback.view;
  const loop = Array.isArray(playback.loop) ? playback.loop : null;
  if (column === null && !loop) return null;
  const layout = layoutClip(clip, width);
  const { rows } = layout;
  const parts: ReactNode[] = [];
  layout.systems.forEach((system, si) => {
    const y = si * rows.height;
    const cols = system.bars.flatMap(b => b.columns);
    if (loop) {
      const inLoop = cols.filter(c => c.index >= loop[0] && c.index <= loop[1]);
      if (inLoop.length > 0) {
        const x0 = inLoop[0].x - inLoop[0].width / 2;
        const last = inLoop[inLoop.length - 1];
        const x1 = last.x + last.width / 2;
        const ly = y + rows.stemBottom + 8;
        parts.push(<path key={`loop-${si}`} d={`M${x0} ${ly - 3} V${ly} H${x1} V${ly - 3}`} fill="none" stroke="var(--primary)" strokeWidth={2} />);
      }
    }
    const head = cols.find(c => c.index === column);
    if (head) {
      const x = head.x - head.width / 2;
      parts.push(
        <g key={`head-${si}`} data-testid="playhead">
          <rect x={x} y={y + rows.staffTop - 10} width={head.width} height={rows.staffBottom - rows.staffTop + 20} fill="var(--primary-soft)" opacity={0.6} />
          <line x1={x} x2={x} y1={y + rows.staffTop - 12} y2={y + rows.staffBottom + 12} stroke="var(--primary)" strokeWidth={2} />
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
