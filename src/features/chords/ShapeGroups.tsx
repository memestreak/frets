import { useEffect } from 'react';
import { ChordDiagram } from '@/components/chords/ChordDiagram';
import { ToneKey } from '@/components/chords/ToneKey';
import type { ChordInfo } from '@/lib/theory/chords';
import type { ShapeExportTriggerProps } from '@/components/chords/export/useShapeExport';
import { shapeCaption, shapeKey, type Shape, type Shapes } from '@/lib/chords/shapes';

interface ShapeGroupsProps {
  chord: ChordInfo;
  shapes: Shapes;
  /** Moveable shows every shape rather than the best few. */
  showAll: boolean;
  onShowAll: (showAll: boolean) => void;
  /** `shapeKey` of the shape on the neck. */
  selectedKey: string | null;
  onSelect: (shape: Shape) => void;
  /** Opens the export menu on a shape (`useShapeExport`, owned by the page). */
  exportProps: (shape: Shape) => ShapeExportTriggerProps;
}

/**
 * The Open and Moveable groups of diagrams, five per line (three on
 * phones), under a key to the dot colours. Under Moveable, a
 * link switches between the best few and every shape. ← and → select the
 * previous or next shape, in the order shown. Right-click, a long press or
 * Shift+F10 on a shape opens its export menu; with a mouse, a shape can be
 * dragged out as an image.
 */
export function ShapeGroups({
  chord, shapes, showAll, onShowAll, selectedKey, onSelect, exportProps,
}: ShapeGroupsProps) {
  const { open, moveable, allMoveable } = shapes;
  const hasMore = allMoveable.length > moveable.length;
  const name = chord.symbol || 'these notes';
  const shown = [...open, ...(showAll ? allMoveable : moveable)];
  useArrowSteps(shown, selectedKey, onSelect);
  return (
    <div className="grid gap-5">
      <ToneKey chord={chord} />
      <ShapeGroup
        title="Open" chord={chord} shapes={open}
        emptyText={`No open shape for ${name}.`}
        selectedKey={selectedKey} onSelect={onSelect} triggerProps={exportProps}
      />
      <ShapeGroup
        title="Moveable" chord={chord} shapes={showAll ? allMoveable : moveable}
        emptyText={`No moveable shape for ${name}.`}
        selectedKey={selectedKey} onSelect={onSelect} triggerProps={exportProps}
      />
      {hasMore && (
        <button
          type="button" className="btn btn-ghost justify-self-start"
          onClick={() => onShowAll(!showAll)}
        >
          {showAll ? 'Show the best few' : `Show all ${allMoveable.length} shapes`}
        </button>
      )}
    </div>
  );
}

interface ShapeGroupProps {
  title: string;
  chord: ChordInfo;
  shapes: Shape[];
  emptyText: string;
  selectedKey: string | null;
  onSelect: (shape: Shape) => void;
  triggerProps: (shape: Shape) => ShapeExportTriggerProps;
}

/** A titled group of diagram buttons, or a line saying there are none. */
function ShapeGroup({
  title, chord, shapes, emptyText, selectedKey, onSelect, triggerProps,
}: ShapeGroupProps) {
  return (
    <section className="grid gap-2" aria-label={`${title} shapes`}>
      <h2 className="m-0 text-[17px] leading-6">{title}</h2>
      {shapes.length ? (
        <div className="shape-grid">
          {shapes.map((v, i) => (
            <button
              key={shapeKey(v)} type="button" className="shape-btn"
              aria-pressed={shapeKey(v) === selectedKey}
              aria-label={`${title} shape ${i + 1}: ${shapeCaption(v)}`}
              data-shape={shapeKey(v)}
              onClick={() => onSelect(v)}
              {...triggerProps(v)}
            >
              <ChordDiagram chord={chord} shape={v} />
            </button>
          ))}
        </div>
      ) : (
        <p className="m-0 text-(--ink-muted)">{emptyText}</p>
      )}
    </section>
  );
}

/**
 * ← and → anywhere on the page select the previous or next shape in
 * `shapes`, stopping at the ends; with no shape selected, → selects the
 * first. Keys a field or the fretboard already used are left alone.
 */
function useArrowSteps(
  shapes: Shape[], selectedKey: string | null, onSelect: (shape: Shape) => void,
) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if ((e.target as Element | null)?.closest?.('input, select, textarea, dialog, [role="menu"]')) return;
      const index = shapes.findIndex(v => shapeKey(v) === selectedKey);
      const next = shapes[e.key === 'ArrowRight' ? index + 1 : index - 1];
      if (!next) return;
      e.preventDefault();
      onSelect(next);
      // Keep focus and scroll with the selection.
      const btn = document.querySelector<HTMLElement>(`[data-shape="${shapeKey(next)}"]`);
      const focused = document.activeElement as HTMLElement | null;
      if (focused?.classList.contains('shape-btn')) btn?.focus();
      // Off the ‹ › just clicked, so the browser draws no focus ring there.
      else if (focused?.closest('.mode-steps')) focused.blur();
      btn?.scrollIntoView?.({ block: 'nearest' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shapes, selectedKey, onSelect]);
}
