import { STRINGS } from '@/lib/music';
import { toneAt, toneColor } from './chordDots';
import type { ChordInfo } from '@/lib/chords/chordTypes';
import { DIAGRAM_FRETS, diagramStartFret, type Voicing } from '@/lib/chords/voicings';

/* Geometry of one small diagram, in SVG units. */
const CELL = 24;
const STRING_GAP = 18;
const LEFT = 22; // room for × and open-string rings left of the nut
const TOP = 10;
const BOTTOM = 28; // room for the starting fret number, clear of the last string
const DOT_R = 8.5;
const OPEN_R = 6; // an open string's ring
const BOARD_WIDTH = DIAGRAM_FRETS * CELL;
const BOARD_HEIGHT = 5 * STRING_GAP;
const WIDTH = LEFT + BOARD_WIDTH + 6;
const HEIGHT = TOP + BOARD_HEIGHT + BOTTOM;

/* Plain lines in ink, like a printed chord chart. */
const LINE = 'var(--line-strong)';
const NUT = 'var(--ink)';
const MUTED = 'var(--ink-muted)';

/** Low E (string 0) at the bottom. */
const stringY = (s: number) => TOP + (5 - s) * STRING_GAP;

interface ChordDiagramProps {
  chord: ChordInfo;
  voicing: Voicing;
  /** First fret drawn; by default `diagramStartFret`. The Scale lab starts every diagram at its position. */
  startFret?: number;
}

/**
 * One voicing as a small horizontal chord chart: `DIAGRAM_FRETS` frets from
 * `diagramStartFret`, the nut when that is fret 1 and the fret number
 * otherwise, × on muted strings, a ring on open strings. Dots carry the
 * degree colour and no text (`ToneKey` names the colours); the root is square.
 */
export function ChordDiagram({ chord, voicing, startFret }: ChordDiagramProps) {
  const start = startFret ?? diagramStartFret(voicing);
  // Centre of a fretted note's column; open strings sit left of the nut.
  const x = (fret: number) => (fret === 0 ? LEFT / 2 : LEFT + (fret - start + 0.5) * CELL);

  return (
    <svg
      className="shape-diagram" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      aria-hidden="true" focusable="false"
    >
      {/* Fret lines; the left edge is the nut at fret 1, a plain line elsewhere. */}
      {Array.from({ length: DIAGRAM_FRETS + 1 }, (_, i) => (
        <line
          key={i} x1={LEFT + i * CELL} x2={LEFT + i * CELL}
          y1={TOP} y2={TOP + BOARD_HEIGHT}
          style={{ stroke: LINE }} strokeWidth={1}
        />
      ))}
      {start === 1 && (
        <rect
          x={LEFT - 2} y={TOP - 0.5} width={4} height={BOARD_HEIGHT + 1}
          style={{ fill: NUT }}
        />
      )}
      {STRINGS.map(s => (
        <line
          key={s} x1={LEFT} x2={LEFT + BOARD_WIDTH} y1={stringY(s)} y2={stringY(s)}
          style={{ stroke: LINE }} strokeWidth={1}
        />
      ))}
      {start !== 1 && (
        <text
          x={x(start)} y={HEIGHT - 6} textAnchor="middle" fontSize={11}
          style={{ fill: MUTED }}
        >
          {start}
        </text>
      )}
      {voicing.map((fret, s) => {
        const cy = stringY(s);
        if (fret === null) {
          return (
            <text
              key={s} x={LEFT / 2} y={cy} textAnchor="middle"
              dominantBaseline="central" fontSize={12} style={{ fill: MUTED }}
            >
              ×
            </text>
          );
        }
        const tone = toneAt(chord, s, fret);
        const { fill } = toneColor(tone);
        const isRoot = tone.label === 'R';
        const cx = x(fret);
        if (fret === 0) {
          const ring = { fill: 'none', stroke: fill };
          return isRoot ? (
            <rect
              key={s} x={cx - OPEN_R} y={cy - OPEN_R} width={2 * OPEN_R} height={2 * OPEN_R}
              rx={2} style={ring} strokeWidth={1.75}
            />
          ) : (
            <circle key={s} cx={cx} cy={cy} r={OPEN_R} style={ring} strokeWidth={1.75} />
          );
        }
        return isRoot ? (
          <rect
            key={s} x={cx - DOT_R} y={cy - DOT_R} width={2 * DOT_R} height={2 * DOT_R}
            rx={3} style={{ fill }}
          />
        ) : (
          <circle key={s} cx={cx} cy={cy} r={DOT_R} style={{ fill }} />
        );
      })}
    </svg>
  );
}
