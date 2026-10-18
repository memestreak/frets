import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ChordDiagram } from '@/components/chords/ChordDiagram';
import { ToneKey } from '@/components/chords/ToneKey';
import { ArrowUpRightIcon, ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
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

type Mock = 'a' | 'b' | 'c';

/** MOCK: which layout ?mock= asks for; A unless it names another. */
function useMock(): Mock {
  const [mock] = useState<Mock>(() => {
    const m = new URLSearchParams(window.location.search).get('mock');
    return m === 'b' || m === 'c' ? m : 'a';
  });
  return mock;
}

/** MOCK: the switcher bar pinned to the foot of the page. */
function MockBar({ mock }: { mock: Mock }) {
  const opts: [Mock, string][] = [['a', 'A · Link under'], ['b', 'B · Icon beside'], ['c', 'C · Name links']];
  return (
    <nav aria-label="Mocks" className="mock-bar">
      {opts.map(([m, label]) => (
        <a key={m} href={`?mock=${m}`} aria-current={m === mock ? 'page' : undefined}>{label}</a>
      ))}
    </nav>
  );
}

/**
 * The shapes in the "Diatonic chords" card: a diagram for every diatonic
 * chord, all in the same five frets, so they read as one hand position.
 * Tapping a shape selects its chord. Every tile cycles its chord's shapes
 * with ‹ › under it and links to the chord on the Chords page; the selected
 * chord's shapes also cycle with ↑ and ↓.
 */
export function PositionShapes({
  inPosition, mode, position, selected, onSelect, shapeIndexOf, onShapeIndex,
}: PositionShapesProps) {
  const mock = useMock();
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
          const step = (i: number) => onShapeIndex(chord.index, i);
          const stepper = shapes.length > 1 ? (
            <ShapeStepper index={index} total={shapes.length} onStep={step} quiet={mock === 'b'} />
          ) : (
            <span className="text-[12px] leading-4 text-(--ink-muted)">
              {shapes.length ? '1 shape' : ''}
            </span>
          );
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
                {mock !== 'c' && <span className="font-bold">{chord.symbol}</span>}
              </button>
              {mock === 'c' && (
                href ? (
                  <Link href={href} className="tile-name-link" title={`${chord.symbol} on the Chords page`}>
                    {chord.symbol}
                  </Link>
                ) : <span className="font-bold leading-[18px]">{chord.symbol}</span>
              )}
              {mock === 'b' ? (
                <div className="flex min-h-7 items-center gap-0.5">
                  {stepper}
                  {href && (
                    <Link
                      href={href} className="tile-icon-link"
                      aria-label={`${chord.symbol} on the Chords page`} title={`${chord.symbol} on the Chords page`}
                    >
                      <ArrowUpRightIcon />
                    </Link>
                  )}
                </div>
              ) : (
                <div className="grid min-h-7 place-items-center">{stepper}</div>
              )}
              {mock === 'a' && (
                <div className="grid min-h-5 place-items-center">
                  {href && (
                    <Link href={href} className="text-[12px] leading-4 font-semibold text-(--primary)">
                      Open in Chords →
                    </Link>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="m-0 text-[14px] leading-5 text-(--ink-muted)">
        Tap a chord to see it on the neck.
      </p>
      <MockBar mock={mock} />
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
  /** MOCK: borderless arrows. */
  quiet?: boolean;
}

/** ‹ 2 of 3 › under a tile. */
function ShapeStepper({ index, total, onStep, quiet }: ShapeStepperProps) {
  const cls = `btn ${quiet ? 'shape-step-quiet' : 'btn-secondary'} shape-step`;
  return (
    <div className={`flex items-center ${quiet ? '' : 'gap-1'}`}>
      <button
        type="button" className={cls} aria-label="Previous shape"
        disabled={index <= 0} onClick={() => onStep(index - 1)}
      >
        ‹
      </button>
      <span className="text-[12px] leading-4 tabular-nums" aria-live="polite">
        {quiet ? `${index + 1}/${total}` : `${index + 1} of ${total}`}
      </span>
      <button
        type="button" className={cls} aria-label="Next shape"
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
