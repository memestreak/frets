/**
 * The line as the Tab MCP App shows it (#340, `docs/specs/2026-11-04-show-tab-mcp-app-design.md`): the
 * Tab page's own drawing (`TabClip`, the playhead, the loop bracket and its handles) and sound
 * (`usePlayback`), with a row of controls under it: Play, Loop, the bpm, Staff | Tab | Both, and Open in
 * Frets. Nothing is edited or saved; the loop points are the one thing the user moves on the music
 * (`docs/specs/2026-11-05-show-tab-loop-points-design.md`).
 */
import { useEffect, useMemo, useState } from 'react';
import { NumberField, resetOnDoubleClick } from '@/components/NumberField';
import { PlayIcon } from '@/components/icons';
import { useLetGoAfterUse } from '@/hooks/useLetGoAfterUse';
import { useSpaceKey } from '@/hooks/useSpaceKey';
import { writePart } from '../alphatex';
import { DEFAULT_BPM, type Part } from '../clip';
import { DEFAULT_FX } from '../effects';
import { layoutClip, type Parts } from '../layout';
import { LoopHandles, LoopIcon, Playhead, StopIcon, usePlayback, type Loop } from '../PlaybackFooter';
import { DEFAULT_SOUND, MAX_SPEED, MIN_SPEED } from '../playback';
import { shareLink } from '../shareLink';
import { TabClip } from '../TabClip';
import { useWidth } from '../useWidth';
import type { LoopPoints } from './lineJson';
import { SITE } from './register';
import type { View } from './tool';

/** The switch's choices, in the Tab page's order. */
const VIEWS: readonly { view: View; label: string }[] = [
  { view: 'staff', label: 'Staff' },
  { view: 'tab', label: 'Tab' },
  { view: 'both', label: 'Both' },
];

/** The volume the line plays at: the Tab page's Volume knob is left out, the host's own volume stands. */
const VOLUME = 0.8;

/** What the user changed that the model should hear about: the bpm, and the loop points, if any. */
export interface Heard {
  bpm: number;
  loop: LoopPoints | null;
}

/**
 * L anywhere in the frame calls `onPress`, as on the Tab page, except while typing in a field (the
 * bpm). Held down, it calls once.
 */
function useLoopKey(onPress: () => void) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'l' || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if ((e.target as Element | null)?.closest?.('input, select, textarea')) return;
      e.preventDefault();
      if (!e.repeat) onPress();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onPress]);
}

export function ChatTab({ part, view: asked, loop: askedLoop, onOpen, onHeard }: {
  part: Part;
  /** How the call asked for it to be drawn; the switch starts there. */
  view: View;
  /** The loop points the call set, or null. */
  loop: LoopPoints | null;
  /** Opens a link outside the chat (the host's `openLink`). */
  onOpen: (url: string) => void;
  /** The bpm or the loop changed. */
  onHeard: (heard: Heard) => void;
}) {
  const [view, setView] = useState<View>(asked);
  // A new call's view replaces the switch's.
  const [wasAsked, setWasAsked] = useState(asked);
  if (asked !== wasAsked) {
    setWasAsked(asked);
    setView(asked);
  }
  const [ref, width] = useWidth();
  const parts: Parts = view;
  const layout = useMemo(() => (width > 0 ? layoutClip(part, width, parts) : null), [part, width, parts]);
  const playback = usePlayback(part, DEFAULT_SOUND, VOLUME, {
    loopPause: 0, transpose: 0, metronome: false, countIn: false, countInBars: 1, clickVolume: 0.8,
    effects: DEFAULT_FX, onStopAt: () => {},
  });
  const { view: player, loop, speed } = playback;
  const playing = player.state === 'playing';
  useSpaceKey(() => playback.toggle(0));
  useLetGoAfterUse();

  // A new line comes with its own loop points, or none, in place of the user's.
  const { setLoopPoints } = playback;
  useEffect(() => {
    setLoopPoints(askedLoop);
    // setLoopPoints is made afresh on every draw; only a new line sets them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [part, askedLoop]);

  // Loop always puts the bracket over the whole line, so both its ends are there to drag in.
  const columns = part.bars.reduce((n, b) => n + b.columns.length, 0);
  const toggleLoop = () => setLoopPoints(loop ? null : [0, columns - 1]);
  useLoopKey(toggleLoop);

  const clipBpm = part.bars[0]?.tempo?.bpm ?? DEFAULT_BPM;
  const bpm = Math.round(clipBpm * speed);
  // The chat sets only points, never 'whole'.
  useEffect(() => onHeard({ bpm, loop: Array.isArray(loop) ? loop : null }), [bpm, loop, onHeard]);

  // The link Open in Frets opens: the line as the Tab page's own `#tabz=`.
  const [link, setLink] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void shareLink(SITE, writePart(part)).then(url => live && setLink(url));
    return () => {
      live = false;
    };
  }, [part]);

  const playLabel = player.state === 'loading' ? 'Loading the sound…' : playing ? 'Stop' : 'Play';
  return (
    <section className="card chat-tab" aria-label="Staff and tab">
      <div ref={ref} className="chat-tab-music relative">
        {layout && <Playhead clip={part} layout={layout} width={width} playback={playback} mark={null} layer="under" />}
        {layout && <TabClip clip={part} layout={layout} width={width} parts={parts} title={`The line, drawn as ${VIEWS.find(v => v.view === view)!.label.toLowerCase()}`} />}
        {layout && <Playhead clip={part} layout={layout} width={width} playback={playback} mark={null} layer="over" />}
        {layout && <LoopHandles layout={layout} width={width} playback={playback} />}
      </div>
      <div className="chat-tab-row">
        <button
          type="button" className="btn btn-icon tab-play" aria-label={playLabel} aria-pressed={playing} data-tip={`${playLabel} (Space)`}
          onClick={() => playback.toggle(0)}
        >
          {player.state === 'loading' ? <span className="tab-play-spinner" aria-hidden="true" /> : playing ? <StopIcon /> : <PlayIcon />}
        </button>
        <button
          type="button" className="btn btn-secondary btn-toggle btn-icon" aria-label="Loop" aria-pressed={loop !== null}
          data-tip={loop ? 'Clear the loop points (L)' : 'Loop the line (L). Drag the ends of the bracket to loop part of it'}
          onMouseDown={e => e.preventDefault()} onClick={toggleLoop}
        >
          <LoopIcon />
        </button>
        {/* A double-click on the field or "bpm" puts the line's own tempo back. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- a mouse shortcut only; from the keyboard, type the tempo */}
        <div className="tab-speed" role="group" aria-label="Tempo" onDoubleClick={e => resetOnDoubleClick(e, () => playback.setSpeed(1))}>
          <NumberField
            value={bpm} min={Math.ceil(clipBpm * MIN_SPEED)} max={Math.floor(clipBpm * MAX_SPEED)} step={5} dragStep={1}
            label="Tempo (bpm)" upLabel="Faster" downLabel="Slower" onChange={b => playback.setSpeed(b / clipBpm)}
          />
          <span className="text-(--ink-muted)">bpm</span>
        </div>
        {player.state === 'error' && <span className="text-sm text-(--danger)">The sound didn&apos;t load.</span>}
        <div className="seg chat-tab-views" role="group" aria-label="Show">
          {VIEWS.map(v => (
            <button key={v.view} type="button" className="seg-opt" aria-pressed={view === v.view} onClick={() => setView(v.view)}>{v.label}</button>
          ))}
        </div>
        <button type="button" className="btn btn-ghost chat-tab-open" disabled={!link} onClick={() => link && onOpen(link)}>
          Open in Frets
        </button>
      </div>
    </section>
  );
}

export type { Loop };
