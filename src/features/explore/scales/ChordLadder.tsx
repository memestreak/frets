import { useEffect, useRef } from 'react';
import type { ChordIntervals } from './settings';
import {
  chordSpans, degreeFill, degreeInk, degreeLabel, describeChord, describeScale,
  IntervalTag, toneFill, toneInk, toneLabel,
} from './chordDiagram';
import { prettyNote, type DiatonicChord, type Scale } from './theory';

const CELL = 30;
const TILE = 26;
const TILE_H = 34;
const SQUARE = 18;
const PAD = 8;
/** Height of one bracket level above the tiles. */
const LEVEL = 22;

interface ChordLadderProps {
  scale: Scale;
  /** With no chord, the scale's notes in their degree colours. */
  chord: DiatonicChord | null;
  intervals: ChordIntervals;
  /**
   * Two octaves fit every diatonic stack; one draws the scale from root to
   * root, closing on the octave.
   */
  octaves?: 1 | 2;
  /**
   * Semitones above the scale's root where the ladder starts, 0–11: after
   * Rotate mode it stays on the picked scale and the root moves.
   */
  from?: number;
}

/**
 * The scale laid out over two octaves, a cell per semitone: scale notes are
 * tiles and the notes outside it empty squares, so each bracket's width is
 * its interval. A chord's tones are coloured and bracketed; without one,
 * every scale note takes its degree colour.
 */
export function ChordLadder({
  scale, chord, intervals, octaves = 2, from = 0,
}: ChordLadderProps) {
  const cells = octaves === 2 ? 24 : 13;
  const spans = chord ? chordSpans(chord, intervals) : [];
  const levels = Math.max(0, ...spans.map(s => s.level));
  const top = levels ? LEVEL * levels + 36 : 12;
  const width = PAD * 2 + CELL * cells - (CELL - TILE);
  // Room under the tiles for degrees, chord roles and the octave mark.
  const height = top + TILE_H + (chord ? 58 : octaves === 2 ? 44 : 22);
  const cx = (semi: number) => PAD + semi * CELL + TILE / 2;
  const octaveX = PAD + CELL * 12 - (CELL - TILE) / 2;
  const octaveY = top + TILE_H + (chord ? 52 : 38);
  const between = intervals === 'between';

  // On a phone the ladder scrolls sideways; bring the chord's root into view.
  const svgRef = useRef<SVGSVGElement>(null);
  // Each chord tone's cell: the chord keeps its place above the strip's
  // first note, so after Rotate mode it sits where it did before.
  const at = chord
    ? chord.rising.map(r => r - from + (chord.rising[0] < from ? 12 : 0))
    : [];
  const rootX = PAD + (at[0] ?? 0) * CELL;
  useEffect(() => {
    const svg = svgRef.current;
    const box = svg?.parentElement;
    if (!svg || !box || box.scrollWidth <= box.clientWidth) return;
    box.scrollLeft = (rootX / width) * svg.clientWidth - 16;
  }, [rootX, width]);

  return (
    <svg
      ref={svgRef}
      className={`chord-diagram ${octaves === 2 ? 'chord-ladder' : 'scale-strip'}`}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={chord ? describeChord(chord, intervals) : describeScale(scale)}
    >
      {octaves === 2 && (
        <>
          <line
            x1={octaveX} x2={octaveX} y1={top - 6} y2={octaveY - 12}
            stroke="var(--line-strong)" strokeDasharray="3 3"
          />
          <text
            x={octaveX} y={octaveY} textAnchor="middle"
            className="diagram-note" fill="var(--ink-muted)"
          >
            octave
          </text>
        </>
      )}

      {Array.from({ length: cells }, (_, semi) => {
        const x = PAD + semi * CELL;
        const degree = scale.degrees.find(d => d.semis === (semi + from) % 12);
        if (!degree) {
          return (
            <rect
              key={semi} x={x + (TILE - SQUARE) / 2} y={top + (TILE_H - SQUARE) / 2}
              width={SQUARE} height={SQUARE} rx={3}
              fill="none" stroke="var(--line-strong)" strokeWidth={1.25}
            />
          );
        }
        const k = chord ? at.indexOf(semi) : -1;
        const on = k >= 0;
        // Without a chord every note is coloured, the root squarer.
        const fill = chord ? (on ? toneFill(k) : 'var(--surface-sunken)') : degreeFill(degree);
        const ink = chord ? (on ? toneInk(k) : 'var(--ink-muted)') : degreeInk(degree);
        const root = chord ? k === 0 : degree.semis === 0;
        return (
          <g key={semi} data-testid={on ? 'ladder-tone' : 'ladder-note'}>
            <rect
              x={x} y={top} width={TILE} height={TILE_H} rx={root ? 3 : 8}
              fill={fill} stroke={chord && !on ? 'var(--line)' : 'none'}
            />
            <text
              x={x + TILE / 2} y={top + 22} textAnchor="middle" className="diagram-name"
              fill={ink}
            >
              {prettyNote(degree.note)}
            </text>
            <text
              x={x + TILE / 2} y={top + TILE_H + 15} textAnchor="middle"
              className="diagram-degree" fill="var(--ink-muted)"
              opacity={chord && !on ? 0.6 : 1}
            >
              {chord ? degree.label : degreeLabel(degree)}
            </text>
            {chord && on && (
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

      {chord && spans.map(s => {
        // Thirds share their end tones, so pull each in to keep them apart.
        const inset = between ? 3 : 0;
        const a = cx(at[s.from]) + inset;
        const b = cx(at[s.to]) - inset;
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
