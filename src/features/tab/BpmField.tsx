'use client';

/**
 * The bpm playback runs at, for the Tab page's Speed and the show_tab app's tempo (issue #373): a
 * number field and, after it, the word "bpm", which is also a Tap button: it reads "Tap" on hover
 * (Jeremy, 2026-11-05). Two taps or more in time set the bpm (`src/lib/tapTempo.ts`); each press gives
 * and flashes, as the Metronome's Tap does. Neither changes the clip's own tempo.
 */
import { useRef } from 'react';
import { NumberField } from '@/components/NumberField';
import { useTapPulse } from '@/components/TapPulse';
import { addTap, tapBpm, type BpmRange } from '@/lib/tapTempo';
import { MAX_BPM } from './clip';

/** A run of taps' state, kept by whoever also taps from a key (show_tab's T). */
export function useTapTempo(range: BpmRange, onTempo: (bpm: number) => void) {
  const taps = useRef<number[]>([]);
  return () => {
    taps.current = addTap(taps.current, performance.now(), range);
    const tapped = tapBpm(taps.current, range);
    if (tapped !== null) onTempo(tapped);
  };
}

/**
 * A percentage for a caption under a `BpmField`, always as wide as the widest the synthesizer plays
 * ("800%"), so the caption keeps its width from 83% to 100% (Jeremy, 2026-11-05).
 */
export function SpeedPercent({ speed }: { speed: number }) {
  return (
    <span className="tab-caption-value tab-speed-percent">
      <span>{Math.round(speed * 100)}%</span>
    </span>
  );
}

export function BpmField({ bpm, range, label, tap, tip, onChange }: {
  /** The bpm shown, a whole number. */
  bpm: number;
  /** The field's and Tap's range, in whole bpm. */
  range: BpmRange;
  /** The field's accessible name. */
  label: string;
  /** One tap, from `useTapTempo`. */
  tap: () => void;
  /** Tap's tip. */
  tip: string;
  onChange: (bpm: number) => void;
}) {
  const { pulse, flash } = useTapPulse();
  const press = () => {
    tap();
    pulse();
  };
  return (
    <div className="tab-bpm">
      <NumberField
        value={bpm} min={range.min} max={range.max} step={5} dragStep={1} chars={String(MAX_BPM).length}
        label={label} upLabel="Faster" downLabel="Slower" onChange={onChange}
      />
      {/* Timed from the press, not the release, so the beat is where the finger lands. */}
      <button
        type="button" className="btn btn-secondary tab-bpm-tap tap-press" aria-label="Tap tempo" data-tip={tip}
        // A press leaves the focus where it was (on the Tab page, the tab).
        onMouseDown={e => e.preventDefault()}
        onPointerDown={e => { if (e.button === 0) press(); }}
        // Enter on the focused button taps; Space plays, as everywhere else.
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.repeat) {
            e.preventDefault();
            press();
          }
        }}
      >
        {flash}
        {/* Both words take the same cell, so the button is as wide as the wider and nothing moves. */}
        <span className="tab-bpm-word" aria-hidden="true">bpm</span>
        <span className="tab-bpm-word tab-bpm-hover" aria-hidden="true">Tap</span>
      </button>
    </div>
  );
}
