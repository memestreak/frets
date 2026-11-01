'use client';

/**
 * Playback, in a footer under the tab (Jeremy picked it from three mocks, 2026-10-26): a round Play
 * (from the cursor, else from the start), Loop (sets the loop points), Hear notes, Metronome (its
 * right-click menu: count-in and click volume), Speed, Transpose, Volume and Sound. The
 * playhead and the loop points are drawn over the tab by `Playhead`. The sound is `playback.ts`.
 */
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react';
import { PlayIcon } from '@/components/icons';
import type { Part } from './clip';
import { columnCount, placeOf } from './editing';
import { layoutClip, type Layout, type Parts } from './layout';
import { columnAt } from './hitTest';
import { NumberField, resetOnDoubleClick } from '@/components/NumberField';
import { MAX_LOOP_PAUSE, MIN_LOOP_PAUSE, PlaybackOptions, type PlaybackOptionValues } from './PlaybackOptions';
import { ClickOptions } from './ClickOptions';
import { VolumeKnob } from '@/components/VolumeKnob';
import { MAX_COUNT_IN_BARS, MAX_SPEED, MIN_SPEED, SOUND_FAMILIES, TabPlayer, type HeardPosition, type PlayerView, type Sound } from './playback';
import { heardEffects, type FxSettings } from './effects';
import { sameMusic } from './clipState';
import { FxButton } from './FxButton';

/**
 * Tab › Playback, saved: whether the controls show (shown at first, Jeremy 2026-10-28), the volume,
 * the transposition, Hear notes and Play's right-click options. The sound is the clip's.
 */
export const PLAYBACK_KEY = 'frets.tab.playback';

export interface PlaybackSettings extends PlaybackOptionValues {
  /** Whether the controls show, from the small round button under the tab; shown until it is pressed. */
  shown: boolean;
  /** The volume knob, 0 (silent) to 1 (full). */
  volume: number;
  /** Semitones playback is moved by, up or down, from the field after Speed; 0 plays as written. The tab is unchanged. */
  transpose: number;
  /** Each note entered sounds its column (Jeremy, 2026-10-27), from the toggle beside Loop. */
  hearNotes: boolean;
}

/** How far playback may be transposed, in semitones either way: an octave. */
export const MAX_TRANSPOSE = 12;

export const DEFAULT_PLAYBACK: PlaybackSettings = {
  shown: true, volume: 1, transpose: 0, hearNotes: false,
  stopAtPlayhead: false, stopAtRegionEnd: false, loopPause: false, loopPauseSeconds: 1,
};

/** A saved object's fields, or none. */
const fieldsOf = (saved: unknown) => (typeof saved === 'object' && saved !== null ? (saved as Record<string, unknown>) : {});
/** A share of full, 0 to 1. */
const isLevel = (v: unknown): v is number => typeof v === 'number' && v >= 0 && v <= 1;

/** The saved settings, each field checked; anything missing or wrong takes its default. */
export function parsePlaybackSettings(saved: unknown): PlaybackSettings {
  const fields = fieldsOf(saved);
  const d = DEFAULT_PLAYBACK;
  return {
    shown: fields.shown !== false,
    volume: isLevel(fields.volume) ? fields.volume : d.volume,
    transpose: Number.isInteger(fields.transpose) && Math.abs(fields.transpose as number) <= MAX_TRANSPOSE ? fields.transpose as number : d.transpose,
    hearNotes: fields.hearNotes === true,
    stopAtPlayhead: fields.stopAtPlayhead === true,
    stopAtRegionEnd: fields.stopAtRegionEnd === true,
    loopPause: fields.loopPause === true,
    loopPauseSeconds: typeof fields.loopPauseSeconds === 'number' && fields.loopPauseSeconds >= MIN_LOOP_PAUSE
      && fields.loopPauseSeconds <= MAX_LOOP_PAUSE ? fields.loopPauseSeconds : d.loopPauseSeconds,
  };
}

/** Tab › Metronome, saved: the toggle after Hear notes, and its right-click menu (G4: its own section). */
export const METRONOME_KEY = 'frets.tab.metronome';

export interface MetronomeSettings {
  /** The metronome clicks while the clip plays (issue #148). */
  on: boolean;
  /** Play counts in first, `countInBars` bars (1 to 4) of clicks. */
  countIn: boolean;
  countInBars: number;
  /** How loud the clicks are, 0 to 1, under the Volume knob. */
  clickVolume: number;
}

export const DEFAULT_METRONOME: MetronomeSettings = { on: false, countIn: false, countInBars: 1, clickVolume: 0.8 };

export function parseMetronome(saved: unknown): MetronomeSettings {
  const fields = fieldsOf(saved);
  const d = DEFAULT_METRONOME;
  return {
    on: fields.on === true,
    countIn: fields.countIn === true,
    countInBars: Number.isInteger(fields.countInBars) && (fields.countInBars as number) >= 1 && (fields.countInBars as number) <= MAX_COUNT_IN_BARS
      ? fields.countInBars as number : d.countInBars,
    clickVolume: isLevel(fields.clickVolume) ? fields.clickVolume : d.clickVolume,
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
  /** Plays from `from` (a column), or stops; `until`, a column, stops playback at its end. */
  toggle: (from: number, until?: number | null) => void;
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
  /** Sounds a note alone once the edit that put it there has drawn: "Hear notes as you enter them". */
  hear: (bar: number, column: number, string: number) => void;
  /** Where the music heard now is, read each frame by the playhead; null when nothing plays. */
  heardPosition: () => HeardPosition | null;
}

const IDLE: PlayerView = { state: 'idle', column: null };

/**
 * Playback of a clip; any edit stops it, so the next Play plays what is drawn. Stop leaves the cursor,
 * the selection and the playback line as they were before Play (Jeremy, 2026-10-27; it had been a pause
 * that put the line where it stopped), so Play again starts from the same place.
 */
export function usePlayback(clip: Part, sound: Sound, volume: number, { loopPause, transpose, metronome, countIn, countInBars, clickVolume, effects, onStopAt }: {
  /** The rest between loops, in seconds; 0 loops straight round. */
  loopPause: number;
  /** Semitones everything heard is moved by. */
  transpose: number;
  /** The metronome's clicks, the count-in before Play (and its bars), and their volume (0 to 1). */
  metronome: boolean;
  countIn: boolean;
  countInBars: number;
  clickVolume: number;
  /** Distortion and reverb as set, heard at once. */
  effects: FxSettings;
  /** Stop pressed (or Space) while playing, with the column the playhead was on. */
  onStopAt: (column: number) => void;
}): Playback {
  const [view, setView] = useState<PlayerView>(IDLE);
  const [loop, setLoop] = useState<Loop | null>(null);
  const [speed, setSpeedState] = useState(1);
  const player = useRef<TabPlayer | null>(null);
  // The player reports the column about ten times a second; the page draws again only when it changes.
  const update = (change: Partial<PlayerView>) =>
    setView(v => (Object.entries(change).every(([k, value]) => v[k as keyof PlayerView] === value) ? v : { ...v, ...change }));

  // An edit stops playback; new FX or a new sound, set on the clip, are heard as it plays on.
  const music = useRef(clip);
  useEffect(() => {
    if (!sameMusic(music.current, clip)) player.current?.stop();
    music.current = clip;
  }, [clip]);
  useEffect(() => () => player.current?.destroy(), []);
  // A new sound takes over at once, even mid-play.
  useEffect(() => {
    player.current?.setSound(sound).catch(() => undefined);
  }, [sound]);
  useEffect(() => {
    player.current?.setVolume(volume);
  }, [volume]);
  useEffect(() => {
    player.current?.setLoopPause(loopPause);
  }, [loopPause]);
  useEffect(() => {
    player.current?.setTranspose(transpose);
  }, [transpose]);
  useEffect(() => {
    player.current?.setMetronome(metronome);
  }, [metronome]);
  useEffect(() => {
    player.current?.setCountIn(countIn, countInBars);
  }, [countIn, countInBars]);
  useEffect(() => {
    player.current?.setClickVolume(clickVolume);
  }, [clickVolume]);
  // What the FX switches leave heard.
  const heardFx = useMemo(() => heardEffects(effects), [effects]);
  useEffect(() => {
    player.current?.setEffects(heardFx);
  }, [heardFx]);

  /** The player, made once; its AudioContext starts on the first Play. */
  const making = useRef<Promise<TabPlayer> | null>(null);
  const playerNow = () => {
    making.current ??= TabPlayer.create(update).then(p => {
      player.current = p;
      p.setVolume(volume);
      p.setLoopPause(loopPause);
      p.setTranspose(transpose);
      p.setMetronome(metronome);
      p.setCountIn(countIn, countInBars);
      p.setClickVolume(clickVolume);
      p.setEffects(heardFx);
      return p;
    });
    return making.current;
  };

  // The sound loads in the background once the page has drawn, and again whenever it changes, so a
  // Play finds it ready. A player that fails to load is made again on the next Play.
  useEffect(() => {
    const timer = setTimeout(() => {
      playerNow().then(p => p.preload(sound), () => {
        making.current = null;
      });
    }, 0);
    return () => clearTimeout(timer);
    // Only the sound starts a load; the player picks up the other settings when it is made.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sound]);

  // A note to hear, asked for by an edit: heard after the edit's own clip has drawn (and stopped
  // any playing), and again for each ask, even when the edit changed nothing.
  const [heard, setHeard] = useState<{ bar: number; column: number; string: number; n: number } | null>(null);
  const hearing = useRef(0);
  useEffect(() => {
    if (!heard) return;
    playerNow().then(p => p.hear(clip, heard.bar, heard.column, heard.string, sound)).catch(() => undefined);
    // Only a new ask sounds; the clip and sound are the ones it was asked with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heard]);

  return {
    view,
    bpm: tempoAt(clip, view.column ?? 0),
    loop,
    speed,
    toggle: (from, until = null) => {
      if (view.state === 'playing') {
        player.current?.halt();
        if (view.column !== null) onStopAt(view.column);
        return;
      }
      if (view.state === 'loading') return;
      const start = (p: TabPlayer) => p.play(clip, from, loop, speed, sound, until).catch(() => update({ state: 'error' }));
      if (player.current) return start(player.current);
      update({ state: 'loading' });
      playerNow().then(start, () => {
        making.current = null;
        update({ state: 'error' });
      });
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
    hear: (bar, column, string) => setHeard({ bar, column, string, n: ++hearing.current }),
    heardPosition: () => player.current?.heardPosition() ?? null,
  };
}

/** The clip's own tempo at a column: the last \\tempo at or before its bar, else alphaTab's 120. */
function tempoAt(clip: Part, index: number): number {
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

/** An ear: each note entered is heard. */
/** A music note sounding: a quarter note with three sound waves to its right, like a speaker's. */
function NoteSoundIcon() {
  return (
    <svg width={20} height={20} viewBox="1 2.5 20 20" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <ellipse cx={4.6} cy={17.6} rx={2.6} ry={2} transform="rotate(-20 4.6 17.6)" fill="currentColor" stroke="none" />
      <path d="M7 17V5.5" />
      <path d="M12.6 10.3a2.6 2.6 0 0 1 0 3.4" />
      <path d="M14.8 8.1a5.7 5.7 0 0 1 0 7.8" />
      <path d="M17 5.9a8.8 8.8 0 0 1 0 12.2" />
    </svg>
  );
}

/** A metronome: its body, and the pendulum swung to one side. */
function MetronomeIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.5 3h5l4.5 18h-14Z" /><path d="M7 16h10" /><path d="m12 16 5.5-10" />
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
/** How many characters the track's name shows in the footer, its ellipsis included. */
export const TRACK_LABEL_LENGTH = 10;

/**
 * The track's name as the footer labels its Sound and FX (Jeremy, 2026-10-30): cut to
 * `TRACK_LABEL_LENGTH` characters with an ellipsis; an unnamed track is "Track <n>".
 */
export function trackLabel(name: string, index: number): string {
  const full = name.trim() || `Track ${index + 1}`;
  const chars = [...full];
  return chars.length <= TRACK_LABEL_LENGTH ? full : `${chars.slice(0, TRACK_LABEL_LENGTH - 1).join('')}…`;
}

export function PlaybackFooter({ clip, playback, from, until, selection, shown, onShow, track, sound, onSound, soundNote, volume, onVolume, hearNotes, onHearNotes, transpose, onTranspose, effects, onEffects, options, onOptions, metronome, onMetronome, countIn, onCountIn, countInBars, onCountInBars, clickVolume, onClickVolume }: {
  clip: Part;
  playback: Playback;
  /** The track shown and played: its name ('' for none) and place, which label its Sound and FX. */
  track: { name: string; index: number };
  /** The sound the clip plays in, picked at the end of the controls. */
  sound: Sound;
  onSound: (sound: Sound) => void;
  /** Why the sound isn't the one the clip names, when Frets doesn't have that one (`substituteNote`). */
  soundNote: string | null;
  /** The volume, 0 to 1, turned on the knob between Speed and Sound. */
  volume: number;
  onVolume: (volume: number) => void;
  /** Whether the controls show; hidden, only the small button does. */
  shown: boolean;
  onShow: (shown: boolean) => void;
  /** The column a Play starts from: the selection's first, else the cursor's, else the first. */
  from: number;
  /** The column a Play stops at the end of, or null to play on: "Stop playback at region end". */
  until: number | null;
  selection: [number, number] | null;
  /** Whether each note entered sounds, the toggle after Loop. */
  hearNotes: boolean;
  onHearNotes: (on: boolean) => void;
  /** Semitones playback is moved by, the field after Speed. */
  transpose: number;
  onTranspose: (semitones: number) => void;
  /** Distortion and reverb, from the FX button after Sound. */
  effects: FxSettings;
  onEffects: (effects: FxSettings) => void;
  /** The options a right-click on Play opens. */
  options: PlaybackOptionValues;
  onOptions: (options: PlaybackOptionValues) => void;
  /** The metronome toggle after Hear notes; its right-click menu sets the count-in and the clicks' volume. */
  metronome: boolean;
  onMetronome: (on: boolean) => void;
  countIn: boolean;
  onCountIn: (on: boolean) => void;
  countInBars: number;
  onCountInBars: (bars: number) => void;
  clickVolume: number;
  onClickVolume: (volume: number) => void;
}) {
  const label = trackLabel(track.name, track.index);
  const fullName = track.name.trim() || `Track ${track.index + 1}`;
  // Where the options menu opened; null while it is shut. Likewise the clicks' menu.
  const [optionsAt, setOptionsAt] = useState<{ x: number; y: number } | null>(null);
  const [clickOptionsAt, setClickOptionsAt] = useState<{ x: number; y: number } | null>(null);
  const openClickOptions = (e: ReactMouseEvent) => {
    e.preventDefault();
    setClickOptionsAt({ x: e.clientX, y: e.clientY });
  };
  const row = useRef<HTMLDivElement>(null);
  const { view, loop, speed } = playback;
  const playing = view.state === 'playing';
  const total = columnCount(clip);
  const percent = Math.round(speed * 100);
  const sameAsLoop = Array.isArray(loop) && selection !== null && loop[0] === selection[0] && loop[1] === selection[1];
  const loopTip = selection && !sameAsLoop
    ? 'Loop the selected notes'
    : loop ? 'Clear the loop points' : 'Loop the whole clip (select notes to loop just those)';
  const playLabel = view.state === 'loading' ? 'Loading the sound…' : playing ? 'Stop' : 'Play';
  useReleaseFocusOnPressOutside(row);
  return (
    <div className="tab-playback-row" ref={row}>
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
            type="button" className="btn btn-icon tab-play" aria-label={playLabel} aria-pressed={playing} data-tip={`${playLabel} (Space). Right-click for options`}
            disabled={total === 0}
            // A press leaves the focus (and so the cursor) on the tab.
            onMouseDown={e => e.preventDefault()} onClick={() => playback.toggle(from, until)}
            onContextMenu={e => {
              e.preventDefault();
              setOptionsAt({ x: e.clientX, y: e.clientY });
            }}
          >
            {view.state === 'loading' ? <span className="tab-play-spinner" aria-hidden="true" /> : playing ? <StopIcon /> : <PlayIcon />}
          </button>
          <button
            type="button" className="btn btn-secondary btn-toggle btn-icon" aria-label="Loop" aria-pressed={loop !== null} data-tip={loopTip}
            onMouseDown={e => e.preventDefault()} onClick={() => playback.toggleLoop(selection)}
          >
            <LoopIcon />
          </button>
          <button
            type="button" className="btn btn-secondary btn-toggle btn-icon" aria-label="Hear notes as you enter them" aria-pressed={hearNotes}
            data-tip="Hear notes as you enter them" onMouseDown={e => e.preventDefault()} onClick={() => onHearNotes(!hearNotes)}
          >
            <NoteSoundIcon />
          </button>
          <button
            type="button" className="btn btn-secondary btn-toggle btn-icon" aria-label="Metronome" aria-pressed={metronome}
            data-tip="Metronome. Right-click for count-in and click volume" onMouseDown={e => e.preventDefault()} onClick={() => onMetronome(!metronome)}
            onContextMenu={openClickOptions}
          >
            <MetronomeIcon />
          </button>
          {/* A double-click on the label, the number or the bpm resets the speed to 100%. */}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- a mouse shortcut only; from the keyboard, type 100 */}
          <div className="tab-speed" role="group" aria-label="Speed" onDoubleClick={e => resetOnDoubleClick(e, () => playback.setSpeed(1))}>
            <span className="text-(--ink-muted)">Speed</span>
            <NumberField
              value={percent} min={MIN_SPEED * 100} max={MAX_SPEED * 100} step={5} unit="%"
              label="Speed (percent)" upLabel="Faster" downLabel="Slower" onChange={p => playback.setSpeed(p / 100)}
            />
            <span className="tab-speed-value">{Math.round(playback.bpm * speed)} bpm</span>
          </div>
          {/* A double-click on the label, the number or "semitones" puts it back to 0. */}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- a mouse shortcut only; from the keyboard, type 0 */}
          <div className="tab-speed" role="group" aria-label="Transpose" onDoubleClick={e => resetOnDoubleClick(e, () => onTranspose(0))}>
            <span className="text-(--ink-muted)">Transpose</span>
            <NumberField
              value={transpose} min={-MAX_TRANSPOSE} max={MAX_TRANSPOSE} step={1}
              label="Transpose (semitones)" upLabel="Transpose up" downLabel="Transpose down" onChange={onTranspose}
            />
            <span className="text-(--ink-muted)">semitones</span>
          </div>
          {/* The track's own: its Sound and FX in one thin box, labelled with its name (Jeremy, 2026-10-30). */}
          <div className="tab-track-box" role="group" aria-label={`Track: ${track.name.trim() || `Track ${track.index + 1}`}`}>
          <label className="tab-sound">
            <span className="tab-track-name" data-tip={label === fullName ? undefined : fullName}>{label}</span>
            {/* A sound picked, the list lets go of the focus (`useLetGoAfterUse`), so Space plays again (Jeremy, 2026-10-28). */}
            <select className="input" aria-label="Sound" value={sound} onChange={e => onSound(Number(e.target.value))}>
              {SOUND_FAMILIES.map(([family, sounds]) => (
                <optgroup key={family} label={family}>
                  {sounds.map(([program, name]) => <option key={program} value={program}>{name}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          {soundNote && <span className="tab-sound-note" role="img" aria-label={soundNote} data-tip={soundNote}>⚠</span>}
          <FxButton fx={effects} onFx={onEffects} />
          </div>
          {view.state === 'error' && <span className="text-sm text-(--danger)">The sound didn&apos;t load.</span>}
          {/* At the row's far right (Jeremy, 2026-10-28). */}
          <div className="tab-volume tab-volume-end">
            <span className="text-(--ink-muted)" id="tab-volume-label">Volume</span>
            <VolumeKnob value={volume} onChange={onVolume} labelledBy="tab-volume-label" />
          </div>
        </div>
      )}
      {optionsAt && (
        <PlaybackOptions x={optionsAt.x} y={optionsAt.y} values={options} onChange={onOptions} onClose={() => setOptionsAt(null)} />
      )}
      {clickOptionsAt && (
        <ClickOptions x={clickOptionsAt.x} y={clickOptionsAt.y} countIn={countIn} onCountIn={onCountIn} bars={countInBars} onBars={onCountInBars} volume={clickVolume} onVolume={onClickVolume} onClose={() => setClickOptionsAt(null)} />
      )}
    </div>
  );
}

/**
 * A press outside the footer takes the focus off its field or Sound list, so Space plays again
 * (Jeremy, 2026-10-28). The browser does this itself, except on a press the tab keeps from taking
 * the focus (placing the playback line, or blank space), which left the list focused.
 */
function useReleaseFocusOnPressOutside(row: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const onPress = (e: PointerEvent) => {
      const focused = document.activeElement;
      const footer = row.current;
      if (!footer || !(focused instanceof HTMLElement) || !footer.contains(focused)) return;
      if (footer.contains(e.target as Node)) return;
      focused.blur();
    };
    document.addEventListener('pointerdown', onPress, { capture: true });
    return () => document.removeEventListener('pointerdown', onPress, { capture: true });
  }, [row]);
}

/**
 * Drawn over the tab: the playhead on the column sounding; while nothing plays, a plain line where
 * Play will start when that was set by a press above or below the staff (`mark`); and under loop
 * points, a bracket.
 */
export function Playhead({ clip, width, parts, playback, mark, markOnly = false, layer }: {
  clip: Part; width: number; parts: Parts; playback: Playback; mark: number | null;
  /** Only the line between columns: the playback controls are hidden, so no playhead or loop bracket. */
  markOnly?: boolean;
  /**
   * Drawn twice: `under` the tab, the loop bracket; `over` it, the lines, so a selection's band never
   * hides them (Jeremy, 2026-10-28).
   */
  layer: 'under' | 'over';
}) {
  const under = layer === 'under';
  const heard = useHeardPosition(playback, !markOnly && playback.view.state === 'playing');
  const layout = useMemo(() => layoutClip(clip, width, parts), [clip, width, parts]);
  const column = heard?.column ?? null;
  const loop = !markOnly && Array.isArray(playback.loop) ? playback.loop : null;
  const idleMark = playback.view.state === 'playing' ? null : mark;
  if (column === null && !loop && idleMark === null) return null;
  const out: ReactNode[] = [];
  layout.systems.forEach((system, si) => {
    const { rows, top: y } = system;
    const cols = system.bars.flatMap(b => b.columns);
    if (loop && under) {
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
    // The line goes before its column, or after the clip's last column when it is past the end.
    const marked = idleMark === null ? undefined : cols.find(c => c.index === idleMark);
    const total = clip.bars.reduce((n, b) => n + b.columns.length, 0);
    const end = idleMark === total ? cols.find(c => c.index === total - 1) : undefined;
    if ((marked || end) && !under) {
      const x = marked ? marked.start : end!.start + end!.width;
      out.push(
        <line
          key={`mark-${si}`} data-testid="play-mark" x1={x} x2={x} y1={y + rows.bandTop - 2} y2={y + rows.bandBottom + 2}
          stroke="var(--playhead)" strokeWidth={2}
        />,
      );
    }
    const at = cols.findIndex(c => c.index === column);
    const head = at < 0 ? undefined : cols[at];
    if (head && heard) {
      // The line glides through the note's room as it sounds, to the next note's on the same line
      // (issue #167); it is all playback draws, with no band on the note (Jeremy, 2026-10-28).
      const next = cols[at + 1];
      const x = head.start + heard.through * ((next ? next.start : head.start + head.width) - head.start);
      if (!under) {
        out.push(
          <line
            key={`head-${si}`} data-testid="playhead" x1={x} x2={x} y1={y + rows.bandTop - 2} y2={y + rows.bandBottom + 2}
            stroke="var(--playhead)" strokeWidth={2}
          />,
        );
      }
    }
  });
  return (
    <svg className="pointer-events-none absolute left-0 top-0" width={width} height={layout.height} aria-hidden="true">
      {out}
    </svg>
  );
}

/** Where the music heard is, read once a frame while `active` (the clip is playing); null otherwise. */
function useHeardPosition(playback: Playback, active: boolean): HeardPosition | null {
  const [heard, setHeard] = useState<HeardPosition | null>(null);
  // The latest reader, so the frame loop needn't restart each time the page draws.
  const read = useRef(playback.heardPosition);
  useEffect(() => {
    read.current = playback.heardPosition;
  });
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const tick = () => {
      const next = read.current();
      setHeard(h => (h && next && h.column === next.column && h.through === next.through ? h : next));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      setHeard(null);
    };
  }, [active]);
  return active ? heard : null;
}

/** Where the loop bracket is drawn on a system: its two ends and its height. */
function loopBracket(layout: Layout, loop: [number, number]): { system: number; x0: number; x1: number; y: number; start: boolean; end: boolean }[] {
  const out: { system: number; x0: number; x1: number; y: number; start: boolean; end: boolean }[] = [];
  layout.systems.forEach((system, si) => {
    const inLoop = system.bars.flatMap(b => b.columns).filter(c => c.index >= loop[0] && c.index <= loop[1]);
    if (inLoop.length === 0) return;
    const first = inLoop[0];
    const last = inLoop[inLoop.length - 1];
    out.push({
      system: si,
      x0: first.start,
      x1: last.start + last.width,
      y: system.top + system.rows.loopY,
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
export function LoopHandles({ clip, width, parts, playback }: { clip: Part; width: number; parts: Parts; playback: Playback }) {
  const drag = useRef<'start' | 'end' | null>(null);
  const loop = Array.isArray(playback.loop) ? playback.loop : null;
  if (!loop) return null;
  const layout = layoutClip(clip, width, parts);
  const onMove = (e: ReactPointerEvent<SVGRectElement>) => {
    if (!drag.current) return;
    const box = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    // From screen pixels to the drawing's units, at any size the page draws it.
    const scale = box.width > 0 ? width / box.width : 1;
    const column = columnAt(layout, (e.clientX - box.left) * scale, (e.clientY - box.top) * scale);
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
