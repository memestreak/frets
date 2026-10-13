import Link from 'next/link';
import { useEffect } from 'react';
import { ChordDiagram } from '@/components/chords/ChordDiagram';
import { ToneKey } from '@/components/chords/ToneKey';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { LAST_POSITION } from '@/lib/chords/voicings';
import { libraryHref, positionLabel, type PositionChord } from './positions';
import type { DiatonicChord } from './theory';

interface PositionShapesProps {
  /** One per diatonic chord, in `chords` order (`index`). */
  inPosition: PositionChord[];
  /** Rotate mode's step: tiles keep the picked scale's order. */
  mode: number;
  /** First fret of the position. */
  position: number;
  selected: DiatonicChord | null;
  onSelect: (chord: DiatonicChord | null) => void;
  /** Which of a chord's shapes its tile shows, by chord index; the selected one's is on the neck. */
  shapeIndexOf: (chordIndex: number) => number;
  /** Picks a shape for the selected chord. */
  onShapeIndex: (index: number) => void;
}

/**
 * The shapes in the "Diatonic chords" card: a diagram for every diatonic
 * chord, all in the same five frets, so they read as one hand position.
 * Tapping a shape selects its chord. The selected chord's shapes in the
 * position cycle with ‹ › under it, or ↑ and ↓, and it links to the chord
 * in the Chord library. A tile keeps showing the shape picked for it after
 * its chord is deselected.
 */
export function PositionShapes({
  inPosition, mode, position, selected, onSelect, shapeIndexOf, onShapeIndex,
}: PositionShapesProps) {
  // In the picked scale's order: tile j holds the chord on its jth note.
  const tiles = inPosition.map((_, j) => inPosition[(j - mode + 7) % 7]);
  const current = selected ? inPosition[selected.index] : null;
  const shapeIndex = selected ? shapeIndexOf(selected.index) : 0;
  const shape = current?.shapes[shapeIndex];
  const href = current ? libraryHref(current.info, shape) : null;
  useShapeKeys(current?.shapes.length ?? 0, shapeIndex, onShapeIndex);

  return (
    <>
      <ToneKey chord={(current ?? inPosition[0]).info} />
      <div className="position-grid">
        {tiles.map(({ chord, info, shapes }) => {
          const isSelected = chord.index === selected?.index;
          // Every tile keeps its chord's pick, selected or not.
          const shown = shapes[shapeIndexOf(chord.index)];
          return (
            <div key={chord.index} className="position-tile">
              <button
                type="button" className="shape-btn position-shape"
                data-chord-index={chord.index}
                aria-pressed={isSelected}
                aria-label={`${chord.numeral}, ${chord.symbol}, ${chord.quality}: ${shown ? 'shape' : 'no shape'} in ${positionLabel(position)}`}
                onClick={() => onSelect(isSelected ? null : chord)}
              >
                {shown ? (
                  <ChordDiagram chord={info} voicing={shown} startFret={position} />
                ) : (
                  <span className="position-none">None here</span>
                )}
                <span className="chord-numeral">{chord.numeral}</span>
                <span className="font-bold">{chord.symbol}</span>
              </button>
              {/* As tall as the stepper either way, so selecting moves nothing. */}
              <div className="grid min-h-7 place-items-center">
                {shapes.length > 1 && (isSelected ? (
                  <ShapeStepper index={shapeIndex} total={shapes.length} onStep={onShapeIndex} />
                ) : (
                  <span className="text-[12px] leading-4 text-(--ink-muted)">{shapes.length} shapes</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {/* One line either way, so selecting moves nothing. */}
      {selected && href ? (
        <Link href={href} className="justify-self-start text-[14px] leading-5 font-semibold text-(--primary)">
          {selected.symbol} in the Chord library →
        </Link>
      ) : (
        <p className="m-0 text-[14px] leading-5 text-(--ink-muted)">
          Tap a chord to see it on the neck.
        </p>
      )}
    </>
  );
}

interface PositionStepperProps {
  position: number;
  onPosition: (first: number) => void;
}

/** ‹ Frets 5–9 › in the card header: steps the position one fret. */
export function PositionStepper({ position, onPosition }: PositionStepperProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button" className="btn btn-secondary btn-icon" aria-label="Lower position"
        disabled={position <= 1} onClick={() => onPosition(position - 1)}
      >
        <ChevronLeftIcon />
      </button>
      <span className="min-w-[84px] text-center font-semibold tabular-nums" aria-live="polite">
        {positionLabel(position)}
      </span>
      <button
        type="button" className="btn btn-secondary btn-icon" aria-label="Higher position"
        disabled={position >= LAST_POSITION} onClick={() => onPosition(position + 1)}
      >
        <ChevronRightIcon />
      </button>
    </div>
  );
}

interface ShapeStepperProps {
  index: number;
  total: number;
  onStep: (index: number) => void;
}

/** ‹ 2 of 3 › under the selected tile. */
function ShapeStepper({ index, total, onStep }: ShapeStepperProps) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button" className="btn btn-secondary shape-step" aria-label="Previous shape"
        disabled={index <= 0} onClick={() => onStep(index - 1)}
      >
        ‹
      </button>
      <span className="text-[12px] leading-4 tabular-nums" aria-live="polite">
        {index + 1} of {total}
      </span>
      <button
        type="button" className="btn btn-secondary shape-step" aria-label="Next shape"
        disabled={index >= total - 1} onClick={() => onStep(index + 1)}
      >
        ›
      </button>
    </div>
  );
}

/**
 * ↑ and ↓ anywhere on the page choose the selected chord's previous or
 * next shape, stopping at the ends. Keys a field already used are left alone.
 */
function useShapeKeys(total: number, index: number, onStep: (index: number) => void) {
  useEffect(() => {
    if (total < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if ((e.target as Element | null)?.closest?.('input, select, textarea')) return;
      const next = index + (e.key === 'ArrowDown' ? 1 : -1);
      if (next < 0 || next >= total) return;
      e.preventDefault();
      onStep(next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [total, index, onStep]);
}
