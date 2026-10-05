import { BOARD } from '@/components/fretboard/theme';
import { STRINGS } from '@/lib/music';
import { toneAt, toneColor } from './chordDots';
import type { ChordInfo } from './chordTypes';
import { diagramStartFret, type Voicing } from './voicings';

/* Geometry of one small diagram, in SVG units. */
const FRETS_SHOWN = 5;
const CELL = 24;
const STRING_GAP = 16;
const LEFT = 22; // room for × and open-string dots left of the nut
const TOP = 10;
const BOTTOM = 20; // room for the starting fret number
const DOT_R = 7.5;
const WIDTH = LEFT + FRETS_SHOWN * CELL + 6;
const HEIGHT = TOP + 5 * STRING_GAP + BOTTOM;

/** Low E (string 0) at the bottom. */
const stringY = (s: number) => TOP + (5 - s) * STRING_GAP;

interface ChordDiagramProps {
  chord: ChordInfo;
  voicing: Voicing;
}

/**
 * One voicing as a small horizontal fretboard: five frets from
 * `diagramStartFret`, the nut when that is fret 1, × on muted strings,
 * open strings left of the nut. Dots carry the interval; the root is square.
 */
export function ChordDiagram({ chord, voicing }: ChordDiagramProps) {
  const start = diagramStartFret(voicing);
  // Centre of a fretted note's column; open strings sit left of the nut.
  const x = (fret: number) => (fret === 0 ? LEFT / 2 : LEFT + (fret - start + 0.5) * CELL);
  const boardWidth = FRETS_SHOWN * CELL;

  return (
    <svg
      className="shape-diagram" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      aria-hidden="true" focusable="false"
    >
      <rect
        x={LEFT} y={TOP - 5} width={boardWidth} height={5 * STRING_GAP + 10} rx={4}
        style={{ fill: BOARD.fill }}
      />
      {Array.from({ length: FRETS_SHOWN }, (_, i) => (
        <line
          key={i} x1={LEFT + (i + 1) * CELL} x2={LEFT + (i + 1) * CELL}
          y1={TOP - 5} y2={TOP + 5 * STRING_GAP + 5}
          style={{ stroke: BOARD.fret }} strokeWidth={1.5}
        />
      ))}
      {start === 1 && (
        <rect
          x={LEFT - 2} y={TOP - 5} width={4} height={5 * STRING_GAP + 10}
          style={{ fill: BOARD.nut }}
        />
      )}
      {STRINGS.map(s => (
        <line
          key={s} x1={LEFT} x2={LEFT + boardWidth} y1={stringY(s)} y2={stringY(s)}
          style={{ stroke: BOARD.string }} strokeWidth={1.8 - s * 0.2}
        />
      ))}
      <text
        x={x(start)} y={HEIGHT - 5} textAnchor="middle" fontSize={11}
        style={{ fill: BOARD.label }}
      >
        {start}
      </text>
      {voicing.map((fret, s) => {
        if (fret === null) {
          return (
            <text
              key={s} x={LEFT / 2} y={stringY(s)} textAnchor="middle"
              dominantBaseline="central" fontSize={12} style={{ fill: 'var(--danger)' }}
            >
              ×
            </text>
          );
        }
        const tone = toneAt(chord, s, fret);
        const { fill, fg } = toneColor(tone);
        const cx = x(fret);
        const cy = stringY(s);
        return (
          <g key={s}>
            {tone.label === 'R' ? (
              <rect
                x={cx - DOT_R} y={cy - DOT_R} width={2 * DOT_R} height={2 * DOT_R} rx={3}
                style={{ fill, stroke: BOARD.dotRing }} strokeWidth={1.5}
              />
            ) : (
              <circle
                cx={cx} cy={cy} r={DOT_R}
                style={{ fill, stroke: BOARD.dotRing }} strokeWidth={1.5}
              />
            )}
            <text
              x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
              fontSize={tone.label.length > 2 ? 7.5 : 9} fontWeight={700} style={{ fill: fg }}
            >
              {tone.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
