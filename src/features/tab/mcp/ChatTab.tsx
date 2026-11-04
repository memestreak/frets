/**
 * The line as the Tab MCP App shows it (#340, `docs/specs/2026-11-04-show-tab-mcp-app-design.md`): the
 * Tab page's own drawing (`TabClip`, the playhead) and sound (`usePlayback`), with a row of controls
 * under it: Play, Loop, the bpm, Staff | Tab | Both, and Open in Frets. Nothing is edited or saved.
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
import { LoopIcon, Playhead, StopIcon, usePlayback, type Loop } from '../PlaybackFooter';
import { DEFAULT_SOUND, MAX_SPEED, MIN_SPEED } from '../playback';
import { shareLink } from '../shareLink';
import { TabClip } from '../TabClip';
import { useWidth } from '../useWidth';
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

/** What the user changed that the model should hear about: the bpm, and whether it loops. */
export interface Heard {
  bpm: number;
  loop: boolean;
}

export function ChatTab({ part, view: asked, onOpen, onHeard }: {
  part: Part;
  /** How the call asked for it to be drawn; the switch starts there. */
  view: View;
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

  const clipBpm = part.bars[0]?.tempo?.bpm ?? DEFAULT_BPM;
  const bpm = Math.round(clipBpm * speed);
  useEffect(() => onHeard({ bpm, loop: loop !== null }), [bpm, loop, onHeard]);

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
  const toggleLoop = () => playback.toggleLoop(null);
  return (
    <section className="card chat-tab" aria-label="Staff and tab">
      <div ref={ref} className="chat-tab-music relative">
        {layout && <Playhead clip={part} layout={layout} width={width} playback={playback} mark={null} layer="under" />}
        {layout && <TabClip clip={part} layout={layout} width={width} parts={parts} title={`The line, drawn as ${VIEWS.find(v => v.view === view)!.label.toLowerCase()}`} />}
        {layout && <Playhead clip={part} layout={layout} width={width} playback={playback} mark={null} layer="over" />}
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
          data-tip={loop ? 'Stop looping' : 'Loop the line'} onClick={toggleLoop}
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
