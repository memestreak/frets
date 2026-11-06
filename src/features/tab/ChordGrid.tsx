/**
 * One chord diagram as the drawn clip prints it (issue #242): plain ink, as books print them, the nut
 * thick when the diagram starts at fret 1, else its first fret named beside it ("5fr"); × over a string
 * not played and ○ over an open one. Upright (strings up and down, nut on top, low E on the left) or
 * lying (strings across, nut on the left, low E at the bottom, as the Chords page has them). An SVG
 * group, so the page, the chart and the exported image all draw it the same.
 */
import { prettyChord } from './layout';
import {
  GRID_FRET, GRID_LABEL, GRID_MARKS, GRID_NAME, GRID_STRING, gridFrets, gridSize,
  type DiagramTurn, type ShapedChord,
} from './chordDiagrams';
import type { TabLook } from './tabLook';

const DOT_R = 3.4;
const OPEN_R = 2.6;

export function ChordGrid({ chord, turn, x, y, scale = 1, named = false, look }: {
  chord: ShapedChord;
  turn: DiagramTurn;
  /** The board's top-left (the name's band over it when named), in the drawing's units. */
  x: number;
  y: number;
  scale?: number;
  /** The chord's name over the board, as the chart prints it. */
  named?: boolean;
  look: TabLook;
}) {
  const frets = gridFrets(chord);
  const { width } = gridSize(chord, turn);
  const top = named ? GRID_NAME : 0;
  const along = frets * GRID_FRET;
  const across = 5 * GRID_STRING;
  const parts: React.ReactNode[] = [];
  const line = { stroke: look.ink, strokeWidth: 0.8 };
  if (named) {
    const board = turn === 'upright' ? across : along;
    const left = turn === 'upright' ? 0 : GRID_MARKS;
    parts.push(
      <text key="name" x={left + board / 2} y={GRID_NAME - 5} fontSize={11} fontWeight={700} textAnchor="middle" fill={look.ink}>
        {prettyChord(chord.name)}
      </text>,
    );
  }
  if (turn === 'upright') {
    const nut = top + GRID_MARKS;
    const sx = (s: number) => s * GRID_STRING;
    const fy = (f: number) => nut + (f - chord.start + 0.5) * GRID_FRET;
    for (let k = 0; k <= frets; k++) parts.push(<line key={`f${k}`} x1={0} x2={across} y1={nut + k * GRID_FRET} y2={nut + k * GRID_FRET} {...line} />);
    for (let s = 0; s < 6; s++) parts.push(<line key={`s${s}`} x1={sx(s)} x2={sx(s)} y1={nut} y2={nut + along} {...line} />);
    if (chord.start === 1) parts.push(<rect key="nut" x={-0.4} y={nut - 2.6} width={across + 0.8} height={2.6} fill={look.ink} />);
    else parts.push(<text key="start" x={across + DOT_R + 2.5} y={fy(chord.start) + 3} fontSize={8} fill={look.ink}>{`${chord.start}fr`}</text>);
    chord.shape.forEach((fret, s) => {
      const markY = top + GRID_MARKS / 2 - 1;
      if (fret === null) parts.push(<Cross key={`m${s}`} x={sx(s)} y={markY} ink={look.ink} />);
      else if (fret === 0) parts.push(<circle key={`m${s}`} cx={sx(s)} cy={markY} r={OPEN_R} fill="none" stroke={look.ink} strokeWidth={0.9} />);
      else parts.push(<circle key={`m${s}`} cx={sx(s)} cy={fy(fret)} r={DOT_R} fill={look.ink} />);
    });
  } else {
    const nut = GRID_MARKS;
    const sy = (s: number) => top + (5 - s) * GRID_STRING;
    const fx = (f: number) => nut + (f - chord.start + 0.5) * GRID_FRET;
    for (let k = 0; k <= frets; k++) parts.push(<line key={`f${k}`} x1={nut + k * GRID_FRET} x2={nut + k * GRID_FRET} y1={top} y2={top + across} {...line} />);
    for (let s = 0; s < 6; s++) parts.push(<line key={`s${s}`} x1={nut} x2={nut + along} y1={sy(s)} y2={sy(s)} {...line} />);
    if (chord.start === 1) parts.push(<rect key="nut" x={nut - 2.6} y={top - 0.4} width={2.6} height={across + 0.8} fill={look.ink} />);
    else parts.push(<text key="start" x={fx(chord.start)} y={top + across + GRID_LABEL - 5} fontSize={8} textAnchor="middle" fill={look.ink}>{`${chord.start}fr`}</text>);
    chord.shape.forEach((fret, s) => {
      const markX = GRID_MARKS / 2 - 1;
      if (fret === null) parts.push(<Cross key={`m${s}`} x={markX} y={sy(s)} ink={look.ink} />);
      else if (fret === 0) parts.push(<circle key={`m${s}`} cx={markX} cy={sy(s)} r={OPEN_R} fill="none" stroke={look.ink} strokeWidth={0.9} />);
      else parts.push(<circle key={`m${s}`} cx={fx(fret)} cy={sy(s)} r={DOT_R} fill={look.ink} />);
    });
  }
  return (
    <g transform={`translate(${x} ${y})${scale !== 1 ? ` scale(${scale})` : ''}`} data-testid="chord-grid" data-chord={chord.name} data-width={width}>
      {parts}
    </g>
  );
}

/** A string not played: a small ×. */
function Cross({ x, y, ink }: { x: number; y: number; ink: string }) {
  const r = 2.3;
  return <path d={`M${x - r} ${y - r}L${x + r} ${y + r}M${x + r} ${y - r}L${x - r} ${y + r}`} stroke={ink} strokeWidth={0.9} />;
}
