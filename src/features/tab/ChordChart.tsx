'use client';

/**
 * The Chord chart (issue #242, spec Q8): under the score head, every chord of the clip that has a
 * shape, once, named over its diagram, as guitar books print the chords a song uses before its first
 * line. Every track's chords together (Q2). Plain ink (Q9). The page draws it as its own SVG; the
 * exported image draws the same group under its head.
 *
 * On the page each chord can be picked and edited as a diagram over the music is (Jeremy, 2026-11-07):
 * a press picks it (blue), a double-click, Enter or the right-click menu's Edit opens its chord editor
 * in the Chords panel, and Esc or a press elsewhere lets it go.
 */
import { useState, type KeyboardEvent } from 'react';
import { ShapeMenu } from '@/components/chords/export/ShapeMenu';
import { menuSpot, useMenuTrigger } from '@/components/chords/export/useMenuTrigger';
import { ChordGrid } from './ChordGrid';
import { GRID_LABEL, GRID_NAME, gridSize, layoutChart, type ChartChord, type ShapedChord } from './chordDiagrams';
import { litLook, PAGE_LOOK, type TabLook } from './tabLook';

/** Room under the chart, before the music. */
export const CHART_GAP = 14;

/** The chart as an SVG group `width` wide, from its top-left; with its height (none for no chords). */
export function chartDrawing(chords: readonly ShapedChord[], width: number, look: TabLook, x = 0, y = 0) {
  const { places, height } = layoutChart(chords, width);
  const drawing = (
    <g data-testid="chord-chart" transform={`translate(${x} ${y})`}>
      {chords.map((chord, i) => (
        <ChordGrid key={`${chord.name}-${i}`} chord={chord} x={places[i].x} y={places[i].y} named look={look} />
      ))}
    </g>
  );
  return { drawing, height };
}

/** The chart on the page, as wide as the drawing under it; `onEdit` opens a chord's editor. */
export function ChordChart({ chords, width, onEdit }: { chords: readonly ChartChord[]; width: number; onEdit: (chord: ChartChord) => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; index: number } | null>(null);
  const menuTrigger = useMenuTrigger<SVGGElement>();
  if (chords.length === 0 || width <= 0) return null;
  const { places, height } = layoutChart(chords, width);
  const edit = (i: number) => {
    setPicked(null);
    onEdit(chords[i]);
  };
  const onKeyDown = (e: KeyboardEvent<SVGGElement>, i: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      edit(i);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setPicked(null);
      e.currentTarget.blur();
    }
  };
  return (
    <>
      <svg
        className="tab-chord-chart" width={width} height={height + CHART_GAP} viewBox={`0 0 ${width} ${height + CHART_GAP}`}
        aria-label="Chord chart" role="group"
      >
        {chords.map((chord, i) => {
          const { width: w, height: h } = gridSize(chord);
          return (
            <g
              key={`${chord.name}-${i}`} role="button" tabIndex={0} aria-label={`${chord.name}, edit`} aria-pressed={picked === i}
              className="tab-chart-chord" data-keep-focus data-testid="chart-chord"
              onClick={() => setPicked(i)} onDoubleClick={() => edit(i)} onKeyDown={e => onKeyDown(e, i)}
              onBlur={() => { if (!menu) setPicked(p => (p === i ? null : p)); }}
              {...menuTrigger.props((trigger, x, y) => {
                setPicked(i);
                setMenu({ ...menuSpot(trigger, x, y), index: i });
              })}
            >
              {/* The whole cell takes the press, the gaps in the diagram too. */}
              <rect x={places[i].x - 4} y={places[i].y} width={w + GRID_LABEL + 4} height={GRID_NAME + h + 4} fill="transparent" />
              <ChordGrid chord={chord} x={places[i].x} y={places[i].y} named look={litLook(PAGE_LOOK, picked === i)} />
            </g>
          );
        })}
      </svg>
      {menu && (
        <ShapeMenu
          x={menu.x} y={menu.y} label="Chord"
          onClose={() => { setMenu(null); setPicked(null); }}
          items={[{ label: 'Edit', onSelect: () => edit(menu.index) }]}
        />
      )}
    </>
  );
}
