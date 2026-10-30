import { ToneKey } from '@/components/chords/ToneKey';
import { Segmented } from '@/components/controls';
import type { ChordInfo } from '@/lib/theory/chords';
import { ChordClock } from './ChordClock';
import { ChordLadder } from './ChordLadder';
import type { ChordIntervals, ChordView } from './settings';
import type { DiatonicChord } from '@/lib/theory/diatonic';
import type { Scale } from '@/lib/theory/scales';

const VIEW_OPTS = [['ladder', 'Ladder'], ['clock', 'Clock']] as const;
const INTERVAL_OPTS = [['root', 'From the root'], ['between', 'Between tones']] as const;

interface ChordOverScaleProps {
  scale: Scale;
  /** With no chord, the scale alone. */
  chord: DiatonicChord | null;
  /** The chord's tones, for the colour key beside the heading. */
  info: ChordInfo | null;
  view: ChordView;
  onView: (view: ChordView) => void;
  intervals: ChordIntervals;
  onIntervals: (intervals: ChordIntervals) => void;
  /** Semitones above the scale's root of the picked root, where the diagrams start. */
  from: number;
}

/**
 * The lower half of the "Diatonic chords" card: the scale as a ladder or a
 * clock, with the selected chord's tones and intervals drawn on it, and
 * the chord's spelling as a colour key beside its heading.
 */
export function ChordOverScale({
  scale, chord, info, view, onView, intervals, onIntervals, from,
}: ChordOverScaleProps) {
  const Diagram = view === 'ladder' ? ChordLadder : ChordClock;
  return (
    <div className="grid gap-3 border-t border-(--line) pt-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
        {/*
          A line to itself below desktop width, where a chord's name and key
          would push the switches down; on a phone the key has a line of its
          own, kept with no chord too.
        */}
        <div className="mr-auto flex h-[52px] basis-full flex-wrap content-start items-center gap-x-4 gap-y-1 sm:h-6 lg:basis-auto">
          <h3 className="m-0 text-[15px] leading-6 whitespace-nowrap" aria-live="polite">
            {chord ? `${chord.symbol} over the scale` : 'Over the scale'}
            {chord && (
              <span className="ml-2 text-[13px] font-normal text-(--ink-muted)">{chord.quality}</span>
            )}
          </h3>
          {info && <div className="max-sm:basis-full"><ToneKey chord={info} /></div>}
        </div>
        <Segmented<ChordView>
          label="Chord diagram" options={VIEW_OPTS} value={view} onChange={onView}
        />
        {/* Always here, so picking a chord moves nothing; it has nothing to name until then. */}
        <Segmented<ChordIntervals>
          label="Intervals" options={INTERVAL_OPTS} value={intervals}
          onChange={onIntervals} disabled={!chord}
        />
      </div>
      <div className={view === 'ladder' ? 'ladder-scroll' : undefined}>
        <Diagram scale={scale} chord={chord} intervals={intervals} from={from} />
      </div>
    </div>
  );
}
