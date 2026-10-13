import { Segmented } from '@/components/controls';
import { ChordClock } from './ChordClock';
import { ChordLadder } from './ChordLadder';
import type { ChordIntervals, ChordView } from './settings';
import type { DiatonicChord, Scale } from './theory';

const VIEW_OPTS = [['ladder', 'Ladder'], ['clock', 'Clock']] as const;
const INTERVAL_OPTS = [['root', 'From the root'], ['between', 'Between tones']] as const;

interface ChordOverScaleProps {
  scale: Scale;
  /** With no chord, the scale alone. */
  chord: DiatonicChord | null;
  view: ChordView;
  onView: (view: ChordView) => void;
  intervals: ChordIntervals;
  onIntervals: (intervals: ChordIntervals) => void;
  /** Semitones above the scale's root of the picked root, where the diagrams start. */
  from: number;
}

/**
 * The lower half of the "Diatonic chords" card: the scale as a ladder or a
 * clock, with the selected chord's tones and intervals drawn on it.
 */
export function ChordOverScale({
  scale, chord, view, onView, intervals, onIntervals, from,
}: ChordOverScaleProps) {
  const Diagram = view === 'ladder' ? ChordLadder : ChordClock;
  return (
    <div className="grid gap-3 border-t border-(--line) pt-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
        {/* A line to itself on a phone, where a chord's name would push the switches down. */}
        <h3 className="m-0 mr-auto h-6 basis-full text-[15px] leading-6 whitespace-nowrap sm:basis-auto" aria-live="polite">
          {chord ? `${chord.symbol} over the scale` : 'Over the scale'}
          {chord && (
            <span className="ml-2 text-[13px] font-normal text-(--ink-muted)">{chord.quality}</span>
          )}
        </h3>
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
