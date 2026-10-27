'use client';

/**
 * Playback, in a footer under the tab (Jeremy picked it from three mocks, 2026-10-26): a round Play
 * (from the cursor, else from the start), Loop (sets the loop points), Speed, Volume and Sound. The
 * playhead and the loop points are drawn over the tab by `Playhead`. The sound is `playback.ts`.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PauseIcon, PlayIcon } from '@/components/icons';
import type { Clip } from './clip';
import { columnCount, placeOf } from './editing';
import { layoutClip } from './layout';
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
  /** Plays from `from` (a column), or pauses. */
  toggle: (from: number) => void;
  /**
   * Loop pressed: with notes selected, the loop points go round them (pressed again on the same
   * notes, they go); with none, round the whole clip, or off when there are some.
   */
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
export function usePlayback(clip: Clip, sound: Sound, volume: number, onPause: (column: number) => void): Playback {
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
    player.current?.setSound(sound);
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
      if (view.state === 'playing') {
        // The cursor goes where it stopped, so the next Play goes on from there.
        if (view.column !== null) onPause(view.column);
        return player.current?.pause();
      }
      if (view.state === 'loading') return;
      const start = (p: TabPlayer) => p.play(clip, from, loop, speed, sound);
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
  const playLabel = view.state === 'loading' ? 'Loading the sound…' : playing ? 'Pause' : 'Play';
  return (
    <div className="tab-playback-row">
      {/* The divider: the button at its left end, the line (only with the controls) just short of it. */}
      <div className="tab-playback-rule">
        <button
          type="button" className="tab-playback-toggle" aria-label="Playback controls" aria-pressed={shown}
          data-tip={shown ? 'Hide playback' : 'Show playback'} onClick={() => onShow(!shown)}
        >
          {/* Hidden: a green play triangle. Shown: a plain minus, to put them away. */}
          {shown
            ? <svg width={8} height={8} viewBox="0 0 8 8" aria-hidden="true"><path d="M1 4h6" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" /></svg>
            : <svg width={8} height={8} viewBox="0 0 8 8" aria-hidden="true"><path d="M1.5 0.5v7l6-3.5Z" fill="currentColor" /></svg>}
        </button>
        {shown && <span className="tab-playback-line" aria-hidden="true" />}
      </div>
      {shown && (
        <div className="tab-playback" aria-label="Playback" role="group">
          <button
            type="button" className="btn btn-primary btn-icon tab-play" aria-label={playLabel} data-tip={`${playLabel} (Space)`}
            disabled={total === 0}
            // A press leaves the focus (and so the cursor) on the tab.
            onMouseDown={e => e.preventDefault()} onClick={() => playback.toggle(from)}
          >
            {view.state === 'loading' ? <span className="tab-play-spinner" aria-hidden="true" /> : playing ? <PauseIcon /> : <PlayIcon />}
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
export function Playhead({ clip, width, playback, mark }: { clip: Clip; width: number; playback: Playback; mark: number | null }) {
  const { column } = playback.view;
  const loop = Array.isArray(playback.loop) ? playback.loop : null;
  const idleMark = playback.view.state === 'playing' ? null : mark;
  if (column === null && !loop && idleMark === null) return null;
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
    const marked = idleMark === null ? undefined : cols.find(c => c.index === idleMark);
    if (marked) {
      const x = marked.x - marked.width / 2;
      parts.push(
        <line
          key={`mark-${si}`} data-testid="play-mark" x1={x} x2={x} y1={y + rows.staffTop - 12} y2={y + rows.staffBottom + 12}
          stroke="var(--primary)" strokeWidth={2}
        />,
      );
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
