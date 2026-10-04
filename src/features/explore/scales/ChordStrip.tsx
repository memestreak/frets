import { Segmented } from '@/components/controls';
import { ChordClock } from './ChordClock';
import { ChordLadder } from './ChordLadder';
import type { ChordIntervals, ChordView } from './settings';
import type { ChordSize, DiatonicChord, NumeralStyle, Scale } from './theory';

const SIZE_OPTS = [[3, 'Triads'], [4, 'Sevenths']] as const;
const NUMERAL_OPTS = [['parallel', '♭III style'], ['relative', 'III style']] as const;
const VIEW_OPTS = [['ladder', 'Ladder'], ['clock', 'Clock']] as const;
const INTERVAL_OPTS = [['root', 'From the root'], ['between', 'Between tones']] as const;

interface ChordStripProps {
  scale: Scale;
  chords: DiatonicChord[];
  selected: DiatonicChord | null;
  onSelect: (chord: DiatonicChord | null) => void;
  size: ChordSize;
  onSize: (size: ChordSize) => void;
  numerals: NumeralStyle;
  onNumerals: (style: NumeralStyle) => void;
  view: ChordView;
  onView: (view: ChordView) => void;
  intervals: ChordIntervals;
  onIntervals: (intervals: ChordIntervals) => void;
}

/**
 * A card per diatonic chord; tapping one shows it on the neck and draws it
 * against the scale as a ladder or a clock.
 */
export function ChordStrip({
  scale, chords, selected, onSelect, size, onSize, numerals, onNumerals,
  view, onView, intervals, onIntervals,
}: ChordStripProps) {
  const Diagram = view === 'ladder' ? ChordLadder : ChordClock;
  return (
    <section className="card gap-4" aria-labelledby="chords-h">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
        <h2 id="chords-h" className="m-0 mr-auto text-[17px] leading-6">
          Chords in this scale
        </h2>
        <Segmented<ChordSize> label="Chord size" options={SIZE_OPTS} value={size} onChange={onSize} />
        <Segmented<NumeralStyle>
          label="Numeral style" options={NUMERAL_OPTS} value={numerals} onChange={onNumerals}
        />
      </div>
      {chords.length ? (
        <>
          <div className="chord-strip">
            {chords.map(c => (
              <button
                key={c.index}
                type="button"
                className="chord-card"
                aria-label={`${c.numeral}, ${c.symbol}, ${c.quality}`}
                aria-pressed={c.index === selected?.index}
                onClick={() => onSelect(c.index === selected?.index ? null : c)}
              >
                <span className="chord-numeral">{c.numeral}</span>
                <span className="font-bold">{c.symbol}</span>
                <span className="text-[12px] leading-4 text-(--ink-muted)">{c.quality}</span>
              </button>
            ))}
          </div>
          {selected && (
            <div className="grid gap-3">
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2.5">
                <Segmented<ChordView>
                  label="Chord diagram" options={VIEW_OPTS} value={view} onChange={onView}
                />
                <Segmented<ChordIntervals>
                  label="Intervals" options={INTERVAL_OPTS} value={intervals}
                  onChange={onIntervals}
                />
              </div>
              <div className={view === 'ladder' ? 'ladder-scroll' : undefined}>
                <Diagram scale={scale} chord={selected} intervals={intervals} />
              </div>
            </div>
          )}
          <p className="m-0 text-[13px] text-(--ink-muted)">
            {selected
              ? `Showing ${selected.symbol} over the scale. Tap it again to see the whole scale.`
              : 'Tap a chord to see its tones over the scale.'}
          </p>
        </>
      ) : (
        <p className="m-0 text-[13px] text-(--ink-muted)">
          Chords are stacked in thirds, so only seven-note scales have them.
        </p>
      )}
    </section>
  );
}
