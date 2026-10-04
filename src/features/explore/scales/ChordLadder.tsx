import { useEffect, useRef } from 'react';
import type { ChordIntervals } from './settings';
import {
  chordSpans, describeChord, IntervalTag, toneFill, toneInk, toneLabel,
} from './chordDiagram';
import { prettyNote, type DiatonicChord, type Scale } from './theory';

/** Two octaves, one cell per semitone: every diatonic stack fits. */
const CELLS = 24;
const CELL = 30;
const TILE = 26;
const TILE_H = 34;
const SQUARE = 18;
const PAD = 8;
/** Height of one bracket level above the tiles. */
const LEVEL = 22;

interface ChordLadderProps {
  scale: Scale;
  chord: DiatonicChord;
  intervals: ChordIntervals;
}

/**
 * The scale laid out over two octaves, a cell per semitone: scale notes are
 * tiles and the notes outside it empty squares, so each bracket's width is
 * its interval. The chord's tones are coloured and bracketed.
 */
export function ChordLadder({ scale, chord, intervals }: ChordLadderProps) {
  const spans = chordSpans(chord, intervals);
  const levels = Math.max(...spans.map(s => s.level));
  const top = LEVEL * levels + 36;
  const width = PAD * 2 + CELL * CELLS - (CELL - TILE);
  const height = top + TILE_H + 58;
  const cx = (semi: number) => PAD + semi * CELL + TILE / 2;
  const octaveX = PAD + CELL * 12 - (CELL - TILE) / 2;
  const between = intervals === 'between';

  // On a phone the ladder scrolls sideways; bring the chord's root into view.
  const svgRef = useRef<SVGSVGElement>(null);
  const rootX = PAD + chord.rising[0] * CELL;
  useEffect(() => {
    const svg = svgRef.current;
    const box = svg?.parentElement;
    if (!svg || !box || box.scrollWidth <= box.clientWidth) return;
    box.scrollLeft = (rootX / width) * svg.clientWidth - 16;
  }, [rootX, width]);

  return (
    <svg
      ref={svgRef}
      className="chord-diagram chord-ladder"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={describeChord(chord, intervals)}
    >
      <line
        x1={octaveX} x2={octaveX} y1={top - 6} y2={top + TILE_H + 40}
        stroke="var(--line-strong)" strokeDasharray="3 3"
      />
      <text
        x={octaveX} y={top + TILE_H + 52} textAnchor="middle"
        className="diagram-note" fill="var(--ink-muted)"
      >
        octave
      </text>

      {Array.from({ length: CELLS }, (_, semi) => {
        const x = PAD + semi * CELL;
        const degree = scale.degrees.find(d => d.semis === semi % 12);
        if (!degree) {
          return (
            <rect
              key={semi} x={x + (TILE - SQUARE) / 2} y={top + (TILE_H - SQUARE) / 2}
              width={SQUARE} height={SQUARE} rx={3}
              fill="none" stroke="var(--line-strong)" strokeWidth={1.25}
            />
          );
        }
        const k = chord.rising.indexOf(semi);
        const on = k >= 0;
        return (
          <g key={semi} data-testid={on ? 'ladder-tone' : 'ladder-note'}>
            <rect
              x={x} y={top} width={TILE} height={TILE_H} rx={k === 0 ? 3 : 8}
              fill={on ? toneFill(k) : 'var(--surface-sunken)'}
              stroke={on ? 'none' : 'var(--line)'}
            />
            <text
              x={x + TILE / 2} y={top + 22} textAnchor="middle" className="diagram-name"
              fill={on ? toneInk(k) : 'var(--ink-muted)'}
            >
              {prettyNote(degree.note)}
            </text>
            <text
              x={x + TILE / 2} y={top + TILE_H + 15} textAnchor="middle"
              className="diagram-degree" fill="var(--ink-muted)" opacity={on ? 1 : 0.6}
            >
              {degree.label}
            </text>
            {on && (
              <text
                x={x + TILE / 2} y={top + TILE_H + 30} textAnchor="middle"
                className="diagram-role" fill={toneFill(k)}
              >
                {toneLabel(chord, k)}
              </text>
            )}
          </g>
        );
      })}

      {spans.map(s => {
        // Thirds share their end tones, so pull each in to keep them apart.
        const inset = between ? 3 : 0;
        const a = cx(chord.rising[s.from]) + inset;
        const b = cx(chord.rising[s.to]) - inset;
        const y = top - 4 - LEVEL * s.level;
        return (
          <g key={s.to}>
            <path
              d={`M${a} ${top - 4} V${y} H${b} V${top - 4}`}
              fill="none" stroke={s.colour} strokeWidth={2} strokeLinejoin="round"
            />
            <IntervalTag x={(a + b) / 2} y={y} name={s.name} colour={s.colour} />
          </g>
        );
      })}
    </svg>
  );
}
