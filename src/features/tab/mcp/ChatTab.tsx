/**
 * The line as the Tab MCP App shows it (#340, `docs/specs/2026-11-04-show-tab-mcp-app-design.md`): the
 * Tab page's own drawing (`TabClip`, the playhead, the loop bracket and its handles) and sound
 * (`usePlayback`), with a row of controls under it: Play, Loop, the bpm and Tap, Staff | Tab | Both, and
 * Open in Frets. Nothing is edited or saved; the loop points are the one thing the user moves on the music
 * (`docs/specs/2026-11-05-show-tab-loop-points-design.md`). The user can select columns, as on the Tab page,
 * only to loop them (`docs/specs/2026-11-05-show-tab-selection-design.md`).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { NumberField, resetOnDoubleClick } from '@/components/NumberField';
import { PlayIcon } from '@/components/icons';
import { useTapPulse } from '@/components/TapPulse';
import { KEEPS_SELECTION, useDeselect } from '@/hooks/useDeselect';
import { useLetGoAfterUse } from '@/hooks/useLetGoAfterUse';
import { useSpaceKey } from '@/hooks/useSpaceKey';
import { addTap, tapBpm, type BpmRange } from '@/lib/tapTempo';
import { writePart } from '../alphatex';
import { DEFAULT_BPM, MAX_BPM, MIN_BPM, type Part } from '../clip';
import { barSelection, growSelection, indexOf, selectedRange, type Selection } from '../editing';
import { DEFAULT_FX } from '../effects';
import type { Hit } from '../hitTest';
import { isWholeBarRest, layoutClip, type Parts } from '../layout';
import { LoopHandles, LoopIcon, Playhead, StopIcon, usePlayback, type Loop } from '../PlaybackFooter';
import { DEFAULT_SOUND } from '../playback';
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

/**
 * The bpm field's and Tap's range: every tempo Frets writes, whatever the line's own (Jeremy, 2026-11-05),
 * not the Tab page's Speed range of a quarter to 1.5 times it.
 */
const BPM_RANGE: BpmRange = { min: MIN_BPM, max: MAX_BPM };

/** The volume the line plays at: the Tab page's Volume knob is left out, the host's own volume stands. */
const VOLUME = 0.8;

/** A press on the drawing keeps the selection: the drawing says itself what the press selects or lets go. */
const KEEPS = `${KEEPS_SELECTION}, .chat-tab-music svg`;

/** What the user changed that the model should hear about: the bpm, and the loop points, if any. */
export interface Heard {
  bpm: number;
  loop: LoopPoints | null;
}

/**
 * A letter key anywhere in the frame calls `onPress`, as on the Tab page (L loops, T taps), except while
 * typing in a field (the bpm). Held down, it calls once.
 */
function useLetterKey(letter: string, onPress: () => void) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== letter || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if ((e.target as Element | null)?.closest?.('input, select, textarea')) return;
      e.preventDefault();
      if (!e.repeat) onPress();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [letter, onPress]);
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
  /** The selected columns, counted across the line from 0, as on the Tab page; only Loop uses them. */
  const [selection, setSelection] = useState<Selection | null>(null);
  // A new line lets the selection go.
  const [selectedIn, setSelectedIn] = useState(part);
  if (part !== selectedIn) {
    setSelectedIn(part);
    setSelection(null);
  }
  const selected = selection ? selectedRange(selection) : null;
  const [ref, width] = useWidth();
  const parts: Parts = view;
  const layout = useMemo(() => (width > 0 ? layoutClip(part, width, parts) : null), [part, width, parts]);
  const playback = usePlayback(part, DEFAULT_SOUND, VOLUME, {
    loopPause: 0, transpose: 0, metronome: false, countIn: false, countInBars: 1, clickVolume: 0.8,
    effects: DEFAULT_FX, onStopAt: () => {},
  });
  const { view: player, loop, speed } = playback;
  const playing = player.state === 'playing';
  useLetGoAfterUse();

  // A new line comes with its own loop points, or none, in place of the user's.
  const { setLoopPoints } = playback;
  useEffect(() => {
    setLoopPoints(askedLoop);
    // setLoopPoints is made afresh on every draw; only a new line sets them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [part, askedLoop]);

  /**
   * A press selects the columns it lands on; with Shift it grows the selection to them, or trims it from
   * the nearer end when inside it, as the Tab page's does (`growSelection`, issue #366).
   */
  const select = (from: number, to: number, extend: boolean) =>
    setSelection(extend && selection ? growSelection(selection, selection.focus, from, to) : { anchor: from, focus: to });
  /**
   * A press on a note selects its column; one beside the notes (a blank string, a line or space) selects
   * its bar, as on the Tab page. With Shift, either grows the selection to the column pressed.
   */
  const pickColumn = (at: { bar: number; column: number }, onNote: boolean, extend: boolean) => {
    if (part.bars[at.bar].columns.length === 0) return;
    const index = indexOf(part, at.bar, at.column);
    if (onNote || extend) select(index, index, extend);
    else setSelection(barSelection(part, at.bar));
  };
  /** A rest is taken in whole: every rest of a Whole-bar rest, every bar of a multi-bar rest. */
  const pickRest = ({ bar, column, lastBar }: { bar: number; column: number; lastBar?: number }, extend: boolean) => {
    const whole = lastBar !== undefined || isWholeBarRest(part, bar);
    const end = lastBar ?? bar;
    select(indexOf(part, bar, whole ? 0 : column), whole ? indexOf(part, end, part.bars[end].columns.length - 1) : indexOf(part, bar, column), extend);
  };
  const letGo = () => setSelection(null);
  useDeselect(selection !== null, letGo, { keep: KEEPS });

  /**
   * Loop, the button or L: with columns selected, the loop points go round them and the selection goes, as
   * on the Tab page (#365; pressed on the loop's own columns, they go). With none, they go, or the bracket
   * goes over the whole line, so both its ends are there to drag in.
   */
  const columns = part.bars.reduce((n, b) => n + b.columns.length, 0);
  const sameAsLoop = selected !== null && Array.isArray(loop) && loop[0] === selected[0] && loop[1] === selected[1];
  const toggleLoop = () => {
    if (selected) {
      setLoopPoints(sameAsLoop ? null : selected);
      setSelection(null);
    } else setLoopPoints(loop ? null : [0, columns - 1]);
  };
  useLetterKey('l', toggleLoop);
  // Play starts at the selection, else at the loop points' start, as on the Tab page.
  const playFrom = selected ? selected[0] : Array.isArray(loop) ? loop[0] : 0;
  useSpaceKey(() => playback.toggle(playFrom));

  const clipBpm = part.bars[0]?.tempo?.bpm ?? DEFAULT_BPM;
  const bpm = Math.round(clipBpm * speed);

  // Tap tempo, as in the Tab page's tempo panel: the press times of the run of taps so far.
  const taps = useRef<number[]>([]);
  const tap = () => {
    taps.current = addTap(taps.current, performance.now(), BPM_RANGE);
    const tapped = tapBpm(taps.current, BPM_RANGE);
    if (tapped !== null) playback.setSpeed(tapped / clipBpm);
  };
  useLetterKey('t', tap);
  // The button gives and flashes on each press, as the Metronome's Tap does.
  const { pulse, flash } = useTapPulse();
  const pressTap = () => {
    tap();
    pulse();
  };
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
        {layout && (
          <TabClip
            clip={part} layout={layout} width={width} parts={parts} title={`The line, drawn as ${VIEWS.find(v => v.view === view)!.label.toLowerCase()}`}
            highlight={{ cursor: null, range: selected, boxed: true }}
            onPick={(hit: Hit, extend) => pickColumn(hit, !!part.bars[hit.bar].columns[hit.column]?.notes[hit.string], extend)}
            onPickStaff={(hit, extend) => pickColumn(hit, hit.string !== null, extend)} onPickRhythm={pickRest} onMiss={letGo}
          />
        )}
        {layout && <Playhead clip={part} layout={layout} width={width} playback={playback} mark={null} layer="over" />}
        {layout && <LoopHandles layout={layout} width={width} playback={playback} />}
      </div>
      <div className="chat-tab-row">
        <button
          type="button" className="btn btn-icon tab-play" aria-label={playLabel} aria-pressed={playing} data-tip={`${playLabel} (Space)`}
          onClick={() => playback.toggle(playFrom)}
        >
          {player.state === 'loading' ? <span className="tab-play-spinner" aria-hidden="true" /> : playing ? <StopIcon /> : <PlayIcon />}
        </button>
        <button
          type="button" className="btn btn-secondary btn-toggle btn-icon" aria-label="Loop" aria-pressed={loop !== null}
          data-tip={selected && !sameAsLoop ? 'Loop the selected notes (L)'
            : loop ? 'Clear the loop points (L)' : 'Loop the line (L). Select notes, or drag the ends of the bracket, to loop part of it'}
          onMouseDown={e => e.preventDefault()} onClick={toggleLoop}
        >
          <LoopIcon />
        </button>
        {/* A double-click on the field or "bpm" puts the line's own tempo back. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- a mouse shortcut only; from the keyboard, type the tempo */}
        <div className="tab-speed" role="group" aria-label="Tempo" onDoubleClick={e => resetOnDoubleClick(e, () => playback.setSpeed(1))}>
          <NumberField
            value={bpm} min={BPM_RANGE.min} max={BPM_RANGE.max} step={5} dragStep={1}
            label="Tempo (bpm)" upLabel="Faster" downLabel="Slower" onChange={b => playback.setSpeed(b / clipBpm)}
          />
          <span className="text-(--ink-muted)">bpm</span>
        </div>
        {/* Timed from the press, not the release, so the beat is where the finger lands. */}
        <button
          type="button" className="btn btn-secondary tab-tap tap-press" data-tip="Tap twice or more in time to set the bpm (T)"
          onMouseDown={e => e.preventDefault()}
          onPointerDown={e => { if (e.button === 0) pressTap(); }}
          // Enter on the focused button taps; Space plays, as everywhere in the frame (useSpaceKey).
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.repeat) {
              e.preventDefault();
              pressTap();
            }
          }}
        >
          {flash}
          Tap
        </button>
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
