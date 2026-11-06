/**
 * One chord diagram as the drawn clip prints it (issue #242), upright as books print them: strings up
 * and down with low E on the left, the nut on top, plain ink. The nut is thick when the diagram starts at
 * fret 1, else its first fret is named beside it ("5fr"); × over a string not played and ○ over an open
 * one. An SVG group, so the page, the chart and the exported image all draw it the same.
 */
import type { ReactNode } from 'react';
import { prettyChord } from './layout';
import { GRID_FRET, GRID_MARKS, GRID_NAME, GRID_STRING, gridFrets, type ShapedChord } from './chordDiagrams';
import type { TabLook } from './tabLook';

const DOT_R = 3.4;
const OPEN_R = 2.6;

export function ChordGrid({ chord, x, y, scale = 1, named = false, look }: {
  chord: ShapedChord;
  /** The board's top-left (the name's band over it when named), in the drawing's units. */
  x: number;
  y: number;
  scale?: number;
  /** The chord's name over the board, as the chart prints it. */
  named?: boolean;
  look: TabLook;
}) {
  const frets = gridFrets(chord);
  const across = 5 * GRID_STRING;
  const nut = (named ? GRID_NAME : 0) + GRID_MARKS;
  const along = frets * GRID_FRET;
  const sx = (s: number) => s * GRID_STRING;
  const fy = (f: number) => nut + (f - chord.start + 0.5) * GRID_FRET;
  const markY = nut - GRID_MARKS / 2 - 1;
  const line = { stroke: look.ink, strokeWidth: 0.8 };
  const parts: ReactNode[] = [];
  if (named) {
    parts.push(
      <text key="name" x={across / 2} y={GRID_NAME - 5} fontSize={11} fontWeight={700} textAnchor="middle" fill={look.ink}>
        {prettyChord(chord.name)}
      </text>,
    );
  }
  for (let k = 0; k <= frets; k++) parts.push(<line key={`f${k}`} x1={0} x2={across} y1={nut + k * GRID_FRET} y2={nut + k * GRID_FRET} {...line} />);
  for (let s = 0; s < 6; s++) parts.push(<line key={`s${s}`} x1={sx(s)} x2={sx(s)} y1={nut} y2={nut + along} {...line} />);
  if (chord.start === 1) parts.push(<rect key="nut" x={-0.4} y={nut - 2.6} width={across + 0.8} height={2.6} fill={look.ink} />);
  else parts.push(<text key="start" x={across + DOT_R + 2.5} y={fy(chord.start) + 3} fontSize={8} fill={look.ink}>{`${chord.start}fr`}</text>);
  chord.shape.forEach((fret, s) => {
    if (fret === null) parts.push(<Cross key={`m${s}`} x={sx(s)} y={markY} ink={look.ink} />);
    else if (fret === 0) parts.push(<circle key={`m${s}`} cx={sx(s)} cy={markY} r={OPEN_R} fill="none" stroke={look.ink} strokeWidth={0.9} />);
    else parts.push(<circle key={`m${s}`} cx={sx(s)} cy={fy(fret)} r={DOT_R} fill={look.ink} />);
  });
  return (
    <g transform={`translate(${x} ${y})${scale !== 1 ? ` scale(${scale})` : ''}`} data-testid="chord-grid" data-chord={chord.name}>
      {parts}
    </g>
  );
}

/** A string not played: a small ×. */
function Cross({ x, y, ink }: { x: number; y: number; ink: string }) {
  const r = 2.3;
  return <path d={`M${x - r} ${y - r}L${x + r} ${y + r}M${x + r} ${y - r}L${x - r} ${y + r}`} stroke={ink} strokeWidth={0.9} />;
}
