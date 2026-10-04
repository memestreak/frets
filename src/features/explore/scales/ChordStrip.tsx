import { Segmented } from '@/components/controls';
import type { ChordSize, DiatonicChord, NumeralStyle } from './theory';

const SIZE_OPTS = [[3, 'Triads'], [4, 'Sevenths']] as const;
const NUMERAL_OPTS = [['parallel', '♭III style'], ['relative', 'III style']] as const;

interface ChordStripProps {
  chords: DiatonicChord[];
  selected: DiatonicChord | null;
  onSelect: (chord: DiatonicChord | null) => void;
  size: ChordSize;
  onSize: (size: ChordSize) => void;
  numerals: NumeralStyle;
  onNumerals: (style: NumeralStyle) => void;
}

/** A card per diatonic chord; tapping one shows it on the neck. */
export function ChordStrip({
  chords, selected, onSelect, size, onSize, numerals, onNumerals,
}: ChordStripProps) {
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
