import { useEffect } from 'react';
import { Segmented } from '@/components/controls';
import { ChordClock } from './ChordClock';
import { ChordLadder } from './ChordLadder';
import type { ChordIntervals, ChordView } from './settings';
import type { ChordSize, DiatonicChord, Scale } from './theory';

const SIZE_OPTS = [[3, 'Triads'], [4, 'Sevenths']] as const;
const VIEW_OPTS = [['ladder', 'Ladder'], ['clock', 'Clock']] as const;
const INTERVAL_OPTS = [['root', 'From the root'], ['between', 'Between tones']] as const;

interface ChordStripProps {
  scale: Scale;
  chords: DiatonicChord[];
  selected: DiatonicChord | null;
  onSelect: (chord: DiatonicChord | null) => void;
  size: ChordSize;
  onSize: (size: ChordSize) => void;
  view: ChordView;
  onView: (view: ChordView) => void;
  intervals: ChordIntervals;
  onIntervals: (intervals: ChordIntervals) => void;
  /**
   * Rotate mode's step: the cards keep the picked scale's order and its
   * root stays where the ladder and clock start, so the tonic moves along.
   */
  mode: number;
  /** Semitones above the scale's root of the picked root. */
  from: number;
}

/**
 * A card per diatonic chord, and the scale as a ladder or a clock. Tapping a
 * card shows the chord on the neck and draws it against the scale.
 */
export function ChordStrip({
  scale, chords, selected, onSelect, size, onSize,
  view, onView, intervals, onIntervals, mode, from,
}: ChordStripProps) {
  const Diagram = view === 'ladder' ? ChordLadder : ChordClock;
  // In the picked scale's order: card j holds the chord on its jth note.
  const cards = chords.map((_, j) => chords[(j - mode + 7) % 7]);

  // With a chord selected, ← and → step through the chords, wrapping round.
  useEffect(() => {
    if (!selected || !chords.length) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      // Leave the arrows to fields that use them, like the scale list.
      if ((e.target as Element | null)?.closest?.('input, select, textarea')) return;
      e.preventDefault();
      const step = e.key === 'ArrowRight' ? 1 : -1;
      const next = chords[(selected.index + step + chords.length) % chords.length];
      onSelect(next);
      // Keep focus and the strip's scroll with the selection.
      const card = document.querySelector<HTMLElement>(`[data-chord-index="${next.index}"]`);
      if (document.activeElement?.classList.contains('chord-card')) card?.focus();
      card?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, chords, onSelect]);
  return (
    <section className="card gap-4" aria-labelledby="chords-h">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
        <h2 id="chords-h" className="m-0 mr-auto text-[17px] leading-6">
          Chords in this scale
        </h2>
        <Segmented<ChordSize> label="Chord size" options={SIZE_OPTS} value={size} onChange={onSize} />
      </div>
      {chords.length ? (
        <>
          <div className="chord-strip">
            {cards.map(c => (
              <button
                key={c.index}
                type="button"
                className="chord-card"
                data-chord-index={c.index}
                aria-label={`${c.numeral}, ${c.symbol}, ${c.quality}`}
                aria-pressed={c.index === selected?.index}
                onClick={() => onSelect(c.index === selected?.index ? null : c)}
              >
                <span className={`chord-numeral${c.index === 0 ? ' text-(--degree-root)' : ''}`}>
                  {c.numeral}
                </span>
                <span className="font-bold">{c.symbol}</span>
                <span className="text-[12px] leading-4 text-(--ink-muted)">{c.quality}</span>
              </button>
            ))}
          </div>
          <div className="grid gap-3">
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2.5">
              <Segmented<ChordView>
                label="Chord diagram" options={VIEW_OPTS} value={view} onChange={onView}
              />
              {selected && (
                <Segmented<ChordIntervals>
                  label="Intervals" options={INTERVAL_OPTS} value={intervals}
                  onChange={onIntervals}
                />
              )}
            </div>
            <div className={view === 'ladder' ? 'ladder-scroll' : undefined}>
              <Diagram scale={scale} chord={selected} intervals={intervals} from={from} />
            </div>
          </div>
          <p className="m-0 text-[13px] text-(--ink-muted)">
            {selected
              ? `Showing ${selected.symbol} over the scale. ← and → step through the chords; tap it again to see the whole scale.`
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
