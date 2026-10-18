import { useCallback, useEffect } from 'react';
import { ChordDiagram } from '@/components/chords/ChordDiagram';
import { ToneKey } from '@/components/chords/ToneKey';
import { useShapeExport } from '@/components/chords/export/useShapeExport';
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
  /** Picks a shape for a chord, by chord index. */
  onShapeIndex: (chordIndex: number, index: number) => void;
}

/**
 * The shapes in the "Diatonic chords" card: a diagram for every diatonic
 * chord, all in the same five frets, so they read as one hand position.
 * Tapping a shape selects its chord. Every tile cycles its chord's shapes
 * with ‹ › under it, selected or not; the selected chord's also cycle with
 * ↑ and ↓, and its shape is the one on the neck. The shapes' menu
 * (right-click, long press, Shift+F10) opens the chord on the Chords page,
 * on the tile's shape, or copies or exports the shape.
 */
export function PositionShapes({
  inPosition, mode, position, selected, onSelect, shapeIndexOf, onShapeIndex,
}: PositionShapesProps) {
  const shapeExport = useShapeExport();
  // In the picked scale's order: tile j holds the chord on its jth note.
  const tiles = inPosition.map((_, j) => inPosition[(j - mode + 7) % 7]);
  const current = selected ? inPosition[selected.index] : null;
  const shapeIndex = selected ? shapeIndexOf(selected.index) : 0;
  useShapeKeys(
    current?.shapes.length ?? 0, shapeIndex,
    useCallback(i => { if (selected) onShapeIndex(selected.index, i); }, [selected, onShapeIndex]),
  );

  return (
    <>
      <ToneKey chord={(current ?? inPosition[0]).info} />
      <div className="position-grid">
        {tiles.map(({ chord, info, shapes }) => {
          const isSelected = chord.index === selected?.index;
          // Every tile keeps its chord's pick, selected or not.
          const index = shapeIndexOf(chord.index);
          const shown = shapes[index];
          const href = libraryHref(info, shown);
          const menuItems = href ? [{ label: 'Open in Chords', onSelect: () => openInNewTab(href) }] : [];
          return (
            <div key={chord.index} className="position-tile">
              <button
                {...(shown && shapeExport.triggerProps(
                  { chord: info, voicing: shown, name: chord.symbol }, { drag: true, items: menuItems },
                ))}
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
              {/* As tall as the stepper either way, so a tile's shape count moves nothing. */}
              <div className="grid min-h-7 place-items-center">
                {shapes.length > 1 ? (
                  <ShapeStepper
                    chord={chord.symbol} index={index} total={shapes.length}
                    onStep={i => onShapeIndex(chord.index, i)}
                  />
                ) : shapes.length === 1 && (
                  <span className="text-[12px] leading-4 text-(--ink-muted)">1 shape</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="m-0 text-[14px] leading-5 text-(--ink-muted)">
        Tap a chord to see it on the neck. Right-click or long-press one to open it in Chords or copy it.
      </p>
      {shapeExport.ui}
    </>
  );
}

/** Opens a page of the app in a new tab, leaving the Scale lab as it is. */
function openInNewTab(href: string) {
  window.open(href, '_blank', 'noopener');
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
  /** The chord's symbol, naming the buttons. */
  chord: string;
  index: number;
  total: number;
  onStep: (index: number) => void;
}

/** ‹ 2 of 3 › under a tile, wrapping round at the ends. */
function ShapeStepper({ chord, index, total, onStep }: ShapeStepperProps) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button" className="btn btn-secondary shape-step" aria-label={`Previous ${chord} shape`}
        onClick={() => onStep((index - 1 + total) % total)}
      >
        ‹
      </button>
      <span className="text-[12px] leading-4 tabular-nums" aria-live="polite">
        {index + 1} of {total}
      </span>
      <button
        type="button" className="btn btn-secondary shape-step" aria-label={`Next ${chord} shape`}
        onClick={() => onStep((index + 1) % total)}
      >
        ›
      </button>
    </div>
  );
}

/**
 * ↑ and ↓ anywhere on the page choose the selected chord's previous or
 * next shape, wrapping round at the ends. Keys a field already used are left alone.
 */
function useShapeKeys(total: number, index: number, onStep: (index: number) => void) {
  useEffect(() => {
    if (total < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if ((e.target as Element | null)?.closest?.('input, select, textarea')) return;
      e.preventDefault();
      onStep((index + (e.key === 'ArrowDown' ? 1 : -1) + total) % total);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [total, index, onStep]);
}
