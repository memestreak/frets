import { STRINGS } from '@/lib/music';
import { toneAt, toneColor } from './chordDots';
import type { DotColor } from '@/components/fretboard/theme';
import type { ChordInfo, ChordTone } from '@/lib/chords/chordTypes';
import { DIAGRAM_FRETS, diagramStartFret, type Voicing } from '@/lib/chords/voicings';

/* Geometry of one small diagram, in SVG units. */
const CELL = 24;
const STRING_GAP = 18;
const LEFT = 22; // room for × and open-string rings left of the nut
const TOP = 10;
const TITLE = 26; // band above the board for the chord name, when drawn
const BOTTOM = 28; // room for the starting fret number, clear of the last string
const DOT_R = 8.5;
const OPEN_R = 6; // an open string's ring
const BOARD_HEIGHT = 5 * STRING_GAP;

/** How a diagram is coloured and what text it carries. */
export interface DiagramLook {
  /** Fret and string lines. */
  line: string;
  /** The nut and the title. */
  ink: string;
  /** ×, and the starting fret number. */
  muted: string;
  /** A tone's dot fill, and the colour of its label. */
  tone: (tone: ChordTone) => DotColor;
  /** The interval inside each fretted dot. */
  labels: boolean;
  /** Drawn above the board; none when empty. */
  title?: string;
}

/** The pages' look: plain lines in ink, like a printed chord chart, following the theme. */
export const PAGE_LOOK: DiagramLook = {
  line: 'var(--line-strong)',
  ink: 'var(--ink)',
  muted: 'var(--ink-muted)',
  tone: toneColor,
  labels: false,
};

interface ChordDiagramProps {
  chord: ChordInfo;
  voicing: Voicing;
  /** First fret drawn; by default `diagramStartFret`. The Scale lab starts every diagram at its position. */
  startFret?: number;
  /** By default `PAGE_LOOK`; an export passes concrete colours. */
  look?: DiagramLook;
}

/**
 * One voicing as a small horizontal chord chart: `DIAGRAM_FRETS` frets from
 * `diagramStartFret` (more for a shape that reaches further, as one tapped
 * on the Chord lab's neck may), the nut when that is fret 1 and the fret number
 * otherwise, × on muted strings, a ring on open strings. On the pages, dots
 * carry the degree colour and no text (`ToneKey` names the colours); the
 * root is square.
 */
export function ChordDiagram({ chord, voicing, startFret, look = PAGE_LOOK }: ChordDiagramProps) {
  const start = startFret ?? diagramStartFret(voicing);
  const frets = Math.max(DIAGRAM_FRETS, ...voicing.map(f => (f ? f - start + 1 : 0)));
  const boardWidth = frets * CELL;
  const width = LEFT + boardWidth + 6;
  const top = TOP + (look.title ? TITLE : 0);
  const height = top + BOARD_HEIGHT + BOTTOM;
  // Centre of a fretted note's column; open strings sit left of the nut.
  const x = (fret: number) => (fret === 0 ? LEFT / 2 : LEFT + (fret - start + 0.5) * CELL);
  /** Low E (string 0) at the bottom. */
  const stringY = (s: number) => top + (5 - s) * STRING_GAP;

  return (
    <svg
      className="shape-diagram" viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true" focusable="false"
    >
      {look.title && (
        <text
          x={LEFT + boardWidth / 2} y={TOP + 13} textAnchor="middle"
          fontSize={17} fontWeight={700} style={{ fill: look.ink }}
        >
          {look.title}
        </text>
      )}
      {/* Fret lines; the left edge is the nut at fret 1, a plain line elsewhere. */}
      {Array.from({ length: frets + 1 }, (_, i) => (
        <line
          key={i} x1={LEFT + i * CELL} x2={LEFT + i * CELL}
          y1={top} y2={top + BOARD_HEIGHT}
          style={{ stroke: look.line }} strokeWidth={1}
        />
      ))}
      {start === 1 && (
        <rect
          x={LEFT - 2} y={top - 0.5} width={4} height={BOARD_HEIGHT + 1}
          style={{ fill: look.ink }}
        />
      )}
      {STRINGS.map(s => (
        <line
          key={s} x1={LEFT} x2={LEFT + boardWidth} y1={stringY(s)} y2={stringY(s)}
          style={{ stroke: look.line }} strokeWidth={1}
        />
      ))}
      {start !== 1 && (
        <text
          x={x(start)} y={height - 6} textAnchor="middle" fontSize={11}
          style={{ fill: look.muted }}
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
              dominantBaseline="central" fontSize={12} style={{ fill: look.muted }}
            >
              ×
            </text>
          );
        }
        const tone = toneAt(chord, s, fret);
        const { fill, fg } = look.tone(tone);
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
        return (
          <g key={s}>
            {isRoot ? (
              <rect
                x={cx - DOT_R} y={cy - DOT_R} width={2 * DOT_R} height={2 * DOT_R}
                rx={3} style={{ fill }}
              />
            ) : (
              <circle cx={cx} cy={cy} r={DOT_R} style={{ fill }} />
            )}
            {look.labels && (
              <text
                x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
                fontSize={tone.label.length > 2 ? 7 : 8.5} fontWeight={700}
                style={{ fill: fg }}
              >
                {tone.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
