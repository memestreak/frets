import { useEffect } from 'react';
import { ToneKey } from '@/components/chords/ToneKey';
import { Segmented, ToggleButton } from '@/components/controls';
import { ChordOverScale } from './ChordOverScale';
import { PositionShapes, PositionStepper } from './PositionShapes';
import type { PositionChord } from './positions';
import type { ChordIntervals, ChordView } from './settings';
import type { ChordSize, DiatonicChord, Scale } from './theory';

const SIZE_OPTS = [[3, 'Triads'], [4, 'Sevenths']] as const;

interface DiatonicChordsProps {
  scale: Scale;
  /** Empty unless the scale has seven notes. */
  chords: DiatonicChord[];
  /** One per chord, in `chords` order (`index`). */
  inPosition: PositionChord[];
  selected: DiatonicChord | null;
  onSelect: (chord: DiatonicChord | null) => void;
  size: ChordSize;
  onSize: (size: ChordSize) => void;
  /** First fret of the position. */
  position: number;
  onPosition: (first: number) => void;
  /** Which of a chord's shapes its tile shows, by chord index. */
  shapeIndexOf: (chordIndex: number) => number;
  /** Picks a shape for a chord, by chord index. */
  onShapeIndex: (chordIndex: number, index: number) => void;
  /** The neck shows every chord tone around the shape. */
  arpeggio: boolean;
  onArpeggio: (on: boolean) => void;
  view: ChordView;
  onView: (view: ChordView) => void;
  intervals: ChordIntervals;
  onIntervals: (intervals: ChordIntervals) => void;
  /**
   * Rotate mode's step: the tiles keep the picked scale's order and its
   * root stays where the ladder and clock start, so the tonic moves along.
   */
  mode: number;
  /** Semitones above the scale's root of the picked root. */
  from: number;
}

/**
 * The "Diatonic chords" card, the one place the scale's chords are listed:
 * the header names the dot colours (the chord's spelling) between the title
 * and the controls, then each chord as a guitar shape in the same five frets (`PositionShapes`), and
 * under them the selected chord drawn against the scale (`ChordOverScale`).
 * Tapping a shape selects its chord; ← and → step through the chords.
 */
export function DiatonicChords({
  scale, chords, inPosition, selected, onSelect, size, onSize, position, onPosition,
  shapeIndexOf, onShapeIndex, arpeggio, onArpeggio, view, onView, intervals, onIntervals,
  mode, from,
}: DiatonicChordsProps) {
  useChordKeys(chords, selected, onSelect);
  return (
    <section className="card gap-4" aria-labelledby="chords-h">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
        <h2 id="chords-h" className="m-0 text-[17px] leading-6">Diatonic chords</h2>
        {chords.length > 0 && (
          <>
            {/* The selected chord's spelling (the first chord's until one is picked), centred in the gap. */}
            <div className="mx-auto">
              <ToneKey chord={(selected ? inPosition[selected.index] : inPosition[0]).info} />
            </div>
            <Segmented<ChordSize> label="Chord size" options={SIZE_OPTS} value={size} onChange={onSize} />
            <ToggleButton
              pressed={arpeggio} disabled={!selected} onClick={() => onArpeggio(!arpeggio)}
              title={selected ? undefined : 'Pick a chord first'}
            >
              Arpeggio
            </ToggleButton>
            <PositionStepper position={position} onPosition={onPosition} />
          </>
        )}
      </div>
      {chords.length ? (
        <>
          <PositionShapes
            inPosition={inPosition} mode={mode} position={position}
            selected={selected} onSelect={onSelect}
            shapeIndexOf={shapeIndexOf} onShapeIndex={onShapeIndex}
          />
          <ChordOverScale
            scale={scale} chord={selected} view={view} onView={onView}
            intervals={intervals} onIntervals={onIntervals} from={from}
          />
        </>
      ) : (
        <p className="m-0 text-[13px] text-(--ink-muted)">
          Chords are stacked in thirds, so only seven-note scales have them.
        </p>
      )}
    </section>
  );
}

/**
 * With a chord selected, ← and → anywhere on the page select the previous
 * or next chord, wrapping round. Keys a field already used are left alone.
 */
function useChordKeys(
  chords: DiatonicChord[],
  selected: DiatonicChord | null,
  onSelect: (chord: DiatonicChord) => void,
) {
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
      // Keep focus with the selection.
      const tile = document.querySelector<HTMLElement>(`[data-chord-index="${next.index}"]`);
      if (document.activeElement?.hasAttribute('data-chord-index')) tile?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, chords, onSelect]);
}
