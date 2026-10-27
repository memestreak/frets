'use client';

/**
 * Playback, in a footer under the tab (Jeremy picked it from three mocks, 2026-10-26): a round Play
 * (from the cursor, else from the start), Loop (sets the loop points), Speed, Volume and Sound. The
 * playhead and the loop points are drawn over the tab by `Playhead`. The sound is `playback.ts`.
 */
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { PlayIcon } from '@/components/icons';
import type { Clip } from './clip';
import { columnCount, placeOf } from './editing';
import { columnAt, layoutClip, type Layout, type Parts } from './layout';
import { SpeedField } from './SpeedField';
import { VolumeKnob } from './VolumeKnob';
import { DEFAULT_SOUND, isSound, MAX_SPEED, MIN_SPEED, SOUND_FAMILIES, TabPlayer, type PlayerView, type Sound } from './playback';

/** The saved playback settings: whether the controls show (hidden at first), the sound and the volume. */
export const PLAYBACK_KEY = 'frets.tab.playback';

export interface PlaybackSettings {
  /** Whether the controls show, from the small round button under the tab. */
  shown: boolean;
  /** The General MIDI program the clip plays in. */
  sound: Sound;
  /** The volume knob, 0 (silent) to 1 (full). */
  volume: number;
}

/** The saved settings, each field checked; anything missing or wrong takes its default. */
export function parsePlaybackSettings(saved: unknown): PlaybackSettings {
  const fields = typeof saved === 'object' && saved !== null ? (saved as Record<string, unknown>) : {};
  return {
    shown: fields.shown === true,
    sound: isSound(fields.sound) ? fields.sound : DEFAULT_SOUND,
    volume: typeof fields.volume === 'number' && fields.volume >= 0 && fields.volume <= 1 ? fields.volume : 1,
  };
}

/** The loop points: the columns selected when Loop was pressed, or the whole clip. */
export type Loop = [number, number] | 'whole';

export interface Playback {
  view: PlayerView;
  /** The clip's own tempo where the playhead is (or at the start), before the speed. */
  bpm: number;
  loop: Loop | null;
  speed: number;
  /** Plays from `from` (a column), or stops. */
  toggle: (from: number) => void;
  /**
   * Loop pressed: with notes selected, the loop points go round them (pressed again on the same
   * notes, they go); with none, round the whole clip, or off when there are some.
   */
  toggleLoop: (selection: [number, number] | null) => void;
  /** Moves the loop points, as dragging an end of their bracket does. */
  setLoopPoints: (points: [number, number]) => void;
  setSpeed: (speed: number) => void;
  /** Moves the playing clip to a column; false when nothing is playing. */
  seek: (index: number) => boolean;
  /** Stops, leaving the cursor where it is: when the footer is hidden. */
  stop: () => void;
}

const IDLE: PlayerView = { state: 'idle', column: null };

/**
 * Playback of a clip; any edit stops it, so the next Play plays what is drawn. Stop leaves the cursor,
 * the selection and the playback line as they were before Play (Jeremy, 2026-10-27; it had been a pause
 * that put the line where it stopped), so Play again starts from the same place.
 */
export function usePlayback(clip: Clip, sound: Sound, volume: number): Playback {
  const [view, setView] = useState<PlayerView>(IDLE);
  const [loop, setLoop] = useState<Loop | null>(null);
  const [speed, setSpeedState] = useState(1);
  const player = useRef<TabPlayer | null>(null);
  const update = (change: Partial<PlayerView>) => setView(v => ({ ...v, ...change }));

  useEffect(() => {
    player.current?.stop();
  }, [clip]);
  useEffect(() => () => player.current?.destroy(), []);
  // A new sound takes over at once, even mid-play.
  useEffect(() => {
    player.current?.setSound(sound).catch(() => undefined);
  }, [sound]);
  useEffect(() => {
    player.current?.setVolume(volume);
  }, [volume]);

  return {
    view,
    bpm: tempoAt(clip, view.column ?? 0),
    loop,
    speed,
    toggle: from => {
      if (view.state === 'playing') return player.current?.halt();
      if (view.state === 'loading') return;
      const start = (p: TabPlayer) => p.play(clip, from, loop, speed, sound).catch(() => update({ state: 'error' }));
      if (player.current) return start(player.current);
      update({ state: 'loading' });
      TabPlayer.create(update).then(
        p => {
          player.current = p;
          p.setVolume(volume);
          start(p);
        },
        () => update({ state: 'error' }),
      );
    },
    toggleLoop: selection => {
      const same = Array.isArray(loop) && selection !== null && loop[0] === selection[0] && loop[1] === selection[1];
      const next: Loop | null = selection && !same ? selection : loop ? null : 'whole';
      setLoop(next);
      player.current?.setLoop(next);
    },
    setLoopPoints: points => {
      setLoop(points);
      player.current?.setLoop(points);
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

/** The stop square on the Play button while playing. */
function StopIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden="true">
      <rect x={1.5} y={1.5} width={9} height={9} rx={1} fill="currentColor" />
    </svg>
  );
}

function LoopIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

/**
 * The row under the tab: a very small round button with a play triangle (Jeremy, 2026-10-26; not green, 2026-10-27)
 * that shows the playback controls beside it, and with a plain minus hides them. It stays put either way.
 */
export function PlaybackFooter({ clip, playback, from, selection, shown, onShow, sound, onSound, volume, onVolume }: {
  clip: Clip;
  playback: Playback;
  /** The sound the clip plays in, picked at the end of the controls. */
  sound: Sound;
  onSound: (sound: Sound) => void;
  /** The volume, 0 to 1, turned on the knob between Speed and Sound. */
  volume: number;
  onVolume: (volume: number) => void;
  /** Whether the controls show; hidden, only the small button does. */
  shown: boolean;
  onShow: (shown: boolean) => void;
  /** The column a Play starts from: the selection's first, else the cursor's, else the first. */
  from: number;
  selection: [number, number] | null;
}) {
  const { view, loop, speed } = playback;
  const playing = view.state === 'playing';
  const total = columnCount(clip);
  const percent = Math.round(speed * 100);
  const sameAsLoop = Array.isArray(loop) && selection !== null && loop[0] === selection[0] && loop[1] === selection[1];
  const loopTip = selection && !sameAsLoop
    ? 'Loop the selected notes'
    : loop ? 'Clear the loop points' : 'Loop the whole clip (select notes to loop just those)';
  const playLabel = view.state === 'loading' ? 'Loading the sound…' : playing ? 'Stop' : 'Play';
  return (
    <div className="tab-playback-row">
      {/* The divider: the button at its left end, the line (only with the controls) just short of it. */}
      <div className="tab-playback-rule">
        <button
          type="button" className="tab-playback-toggle" aria-label="Playback controls" aria-pressed={shown}
          data-tip={shown ? 'Hide playback' : 'Show playback'} onClick={() => onShow(!shown)}
        >
          {/* Hidden: a play triangle. Shown: a plain minus, to put them away. */}
          {shown
            ? <svg width={8} height={8} viewBox="0 0 8 8" aria-hidden="true"><path d="M1 4h6" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" /></svg>
            : <svg width={8} height={8} viewBox="0 0 8 8" aria-hidden="true"><path d="M1.5 0.5v7l6-3.5Z" fill="currentColor" /></svg>}
        </button>
        {shown ? <span className="tab-playback-line" aria-hidden="true" /> : <span className="flex-1" />}
      </div>
      {shown && (
        <div className="tab-playback" aria-label="Playback" role="group">
          <button
            type="button" className="btn btn-icon tab-play" aria-label={playLabel} aria-pressed={playing} data-tip={`${playLabel} (Space)`}
            disabled={total === 0}
            // A press leaves the focus (and so the cursor) on the tab.
            onMouseDown={e => e.preventDefault()} onClick={() => playback.toggle(from)}
          >
            {view.state === 'loading' ? <span className="tab-play-spinner" aria-hidden="true" /> : playing ? <StopIcon /> : <PlayIcon />}
          </button>
          <button
            type="button" className="btn btn-secondary btn-toggle btn-icon" aria-label="Loop" aria-pressed={loop !== null} data-tip={loopTip}
            onMouseDown={e => e.preventDefault()} onClick={() => playback.toggleLoop(selection)}
          >
            <LoopIcon />
          </button>
          <div className="tab-speed">
            <span className="text-(--ink-muted)">Speed</span>
            <SpeedField percent={percent} min={MIN_SPEED * 100} max={MAX_SPEED * 100} onChange={p => playback.setSpeed(p / 100)} />
            <span className="tab-speed-value">{Math.round(playback.bpm * speed)} bpm</span>
          </div>
          <div className="tab-volume">
            <span className="text-(--ink-muted)" id="tab-volume-label">Volume</span>
            <VolumeKnob value={volume} onChange={onVolume} labelledBy="tab-volume-label" />
          </div>
          <label className="tab-sound">
            <span className="text-(--ink-muted)">Sound</span>
            <select className="input" aria-label="Sound" value={sound} onChange={e => onSound(Number(e.target.value))}>
              {SOUND_FAMILIES.map(([family, sounds]) => (
                <optgroup key={family} label={family}>
                  {sounds.map(([program, name]) => <option key={program} value={program}>{name}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          {view.state === 'error' && <span className="text-sm text-(--danger)">The sound didn&apos;t load.</span>}
        </div>
      )}
    </div>
  );
}

/**
 * Drawn over the tab: the playhead on the column sounding; while nothing plays, a plain line where
 * Play will start when that was set by a press above or below the staff (`mark`); and under loop
 * points, a bracket.
 */
export function Playhead({ clip, width, parts, playback, mark }: { clip: Clip; width: number; parts: Parts; playback: Playback; mark: number | null }) {
  const { column } = playback.view;
  const loop = Array.isArray(playback.loop) ? playback.loop : null;
  const idleMark = playback.view.state === 'playing' ? null : mark;
  if (column === null && !loop && idleMark === null) return null;
  const layout = layoutClip(clip, width, parts);
  const { rows } = layout;
  const out: ReactNode[] = [];
  layout.systems.forEach((system, si) => {
    const y = si * rows.height;
    const cols = system.bars.flatMap(b => b.columns);
    if (loop) {
      // The bracket, its ends a little taller: they are the handles `LoopHandles` drags.
      for (const b of loopBracket(layout, loop).filter(b => b.system === si)) {
        out.push(
          <path
            key={`loop-${si}`} d={`M${b.x0} ${b.y - (b.start ? 8 : 0)} V${b.y} H${b.x1} V${b.y - (b.end ? 8 : 0)}`}
            fill="none" stroke="var(--primary)" strokeWidth={2}
          />,
        );
      }
    }
    const marked = idleMark === null ? undefined : cols.find(c => c.index === idleMark);
    if (marked) {
      const x = marked.x - marked.width / 2;
      out.push(
        <line
          key={`mark-${si}`} data-testid="play-mark" x1={x} x2={x} y1={y + rows.bandTop - 2} y2={y + rows.bandBottom + 2}
          stroke="var(--primary)" strokeWidth={2}
        />,
      );
    }
    const head = cols.find(c => c.index === column);
    if (head) {
      const x = head.x - head.width / 2;
      out.push(
        <g key={`head-${si}`} data-testid="playhead">
          <rect x={x} y={y + rows.bandTop} width={head.width} height={rows.bandBottom - rows.bandTop} fill="var(--primary-soft)" opacity={0.6} />
          <line x1={x} x2={x} y1={y + rows.bandTop - 2} y2={y + rows.bandBottom + 2} stroke="var(--primary)" strokeWidth={2} />
        </g>,
      );
    }
  });
  return (
    <svg className="pointer-events-none absolute left-0 top-0" width={width} height={layout.height} aria-hidden="true">
      {out}
    </svg>
  );
}

/** Where the loop bracket is drawn on a system: its two ends and its height. */
function loopBracket(layout: Layout, loop: [number, number]): { system: number; x0: number; x1: number; y: number; start: boolean; end: boolean }[] {
  const { rows } = layout;
  const out: { system: number; x0: number; x1: number; y: number; start: boolean; end: boolean }[] = [];
  layout.systems.forEach((system, si) => {
    const inLoop = system.bars.flatMap(b => b.columns).filter(c => c.index >= loop[0] && c.index <= loop[1]);
    if (inLoop.length === 0) return;
    const first = inLoop[0];
    const last = inLoop[inLoop.length - 1];
    out.push({
      system: si,
      x0: first.x - first.width / 2,
      x1: last.x + last.width / 2,
      y: si * rows.height + rows.loopY,
      start: first.index === loop[0],
      end: last.index === loop[1],
    });
  });
  return out;
}

/**
 * The ends of the loop bracket as handles over the tab: drag either one forwards or backwards to
 * move that loop point, a column at a time (Jeremy, 2026-10-27). The start never passes the end.
 */
export function LoopHandles({ clip, width, parts, playback }: { clip: Clip; width: number; parts: Parts; playback: Playback }) {
  const drag = useRef<'start' | 'end' | null>(null);
  const loop = Array.isArray(playback.loop) ? playback.loop : null;
  if (!loop) return null;
  const layout = layoutClip(clip, width, parts);
  const onMove = (e: PointerEvent<SVGRectElement>) => {
    if (!drag.current) return;
    const box = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const column = columnAt(layout, e.clientX - box.left, e.clientY - box.top);
    if (column === null) return;
    const next: [number, number] = drag.current === 'start' ? [Math.min(column, loop[1]), loop[1]] : [loop[0], Math.max(column, loop[0])];
    if (next[0] !== loop[0] || next[1] !== loop[1]) playback.setLoopPoints(next);
  };
  const handle = (which: 'start' | 'end', x: number, y: number) => (
    <rect
      key={which} data-testid={`loop-${which}`} x={x - 8} y={y - 22} width={16} height={30} fill="transparent"
      className="tab-loop-handle" aria-hidden="true"
      onPointerDown={e => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = which;
      }}
      onPointerMove={onMove}
      onPointerUp={() => { drag.current = null; }}
      onPointerCancel={() => { drag.current = null; }}
    />
  );
  return (
    <svg className="pointer-events-none absolute left-0 top-0" width={width} height={layout.height} aria-hidden="true">
      {loopBracket(layout, loop).flatMap(b => [
        ...(b.start ? [handle('start', b.x0, b.y)] : []),
        ...(b.end ? [handle('end', b.x1, b.y)] : []),
      ])}
    </svg>
  );
}
