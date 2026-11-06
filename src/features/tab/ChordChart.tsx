/**
 * The Chord chart (issue #242, spec Q8): under the score head, every chord of the clip that has a
 * shape, once, named over its diagram, as guitar books print the chords a song uses before its first
 * line. Every track's chords together (Q2). Plain ink (Q9). The page draws it as its own SVG; the
 * exported image draws the same group under its head.
 */
import { ChordGrid } from './ChordGrid';
import { layoutChart, type DiagramTurn, type ShapedChord } from './chordDiagrams';
import { PAGE_LOOK, type TabLook } from './tabLook';

/** Room under the chart, before the music. */
export const CHART_GAP = 14;

/** The chart as an SVG group `width` wide, from its top-left; with its height (none for no chords). */
export function chartDrawing(chords: readonly ShapedChord[], width: number, turn: DiagramTurn, look: TabLook, x = 0, y = 0) {
  const { places, height } = layoutChart(chords, width, turn);
  const drawing = (
    <g data-testid="chord-chart" transform={`translate(${x} ${y})`}>
      {chords.map((chord, i) => (
        <ChordGrid key={`${chord.name}-${i}`} chord={chord} turn={turn} x={places[i].x} y={places[i].y} named look={look} />
      ))}
    </g>
  );
  return { drawing, height };
}

/** The chart on the page, as wide as the drawing under it. */
export function ChordChart({ chords, width, turn }: { chords: readonly ShapedChord[]; width: number; turn: DiagramTurn }) {
  if (chords.length === 0 || width <= 0) return null;
  const { drawing, height } = chartDrawing(chords, width, turn, PAGE_LOOK);
  return (
    <svg
      className="tab-chord-chart" width={width} height={height + CHART_GAP} viewBox={`0 0 ${width} ${height + CHART_GAP}`}
      role="img" aria-label={`Chord chart: ${chords.map(c => c.name).join(', ')}`}
    >
      {drawing}
    </svg>
  );
}
