// A bar's lines and repeat signs, the time signature's numbers, and the bracket joining staff and tab, drawn by `TabClip`.
import { repeatCountText, REPEAT_COUNT_SIZE } from './barLines';
import type { TimeSignature } from './clip';
import { stringY, type PlacedBar, type Rows } from './layout';
import { sameWord, type WordHit } from './layoutText';
import { GLYPHS } from './smufl';
import { BAR_DASHES, TimeBrackets } from './StaffDrawing';
import { litLook, type TabLook } from './tabLook';

/** A time signature's two numbers, close together round the staff's middle. */
export function TimeNumbers({ time, x, rows, look, brackets = false }: { time: TimeSignature; x: number; rows: Rows; look: TabLook; brackets?: boolean }) {
  const middle = (rows.staffTop + rows.staffBottom) / 2;
  return (
    <g fontSize={20} fontWeight={700} fill={look.ink} textAnchor="middle" data-testid="time-signature">
      <text x={x} y={middle - 2}>{time.beats}</text>
      <text x={x} y={middle + 16}>{time.value}</text>
      {brackets && <TimeBrackets x={x} middle={middle + 2} height={44} look={look} />}
    </g>
  );
}

export function BarDrawing({ bar, rows, look: plain, final, word }: { bar: PlacedBar; rows: Rows; look: TabLook; final: boolean; word: WordHit | null }) {
  const { x0, x1 } = bar;
  // A picked repeat sign, count or double bar is drawn in the selection's blue (issue #276).
  const lookOf = (kind: 'repeatStart' | 'repeatEnd' | 'repeatCount' | 'doubleBar') => litLook(plain, sameWord(word, { kind, bar: bar.index }));
  const dots = (x: number, look: TabLook) => [1.5, 3.5].map(k => (
    <circle key={`${x}-${k}`} cx={x} cy={stringY(rows, k)} r={2.2} fill={look.ink} />
  ));
  const vertical = (x: number, w: number, look: TabLook, dashed = false) => (
    <line x1={x} x2={x} y1={rows.staffTop} y2={rows.staffBottom} stroke={look.ink} strokeWidth={w} strokeDasharray={dashed ? BAR_DASHES : undefined} />
  );
  const thickEnd = final || bar.bar.repeatEnd !== undefined;
  const end = bar.bar.repeatEnd !== undefined ? lookOf('repeatEnd') : plain;
  return (
    <g>
      {bar.bar.repeatStart && (() => {
        const look = lookOf('repeatStart');
        return (
          <g data-testid="repeat-start" data-selected={look !== plain || undefined}>
            {vertical(x0 + 2, 3, look)}
            {vertical(x0 + 7, 1, look)}
            {dots(x0 + 12, look)}
          </g>
        );
      })()}
      {thickEnd ? (
        <g data-selected={end !== plain || undefined}>
          {vertical(x1 - 6, 1, end)}
          {vertical(x1 - 1.5, 3, end)}
          {bar.bar.repeatEnd !== undefined && <g data-testid="repeat-end">{dots(x1 - 11, end)}</g>}
        </g>
      ) : bar.bar.doubleBar ? (
        <g data-testid="double-bar" data-selected={lookOf('doubleBar') !== plain || undefined}>{vertical(x1 - 4, 1, lookOf('doubleBar'))}{vertical(x1, 1, lookOf('doubleBar'))}</g>
      ) : bar.restRun && !bar.restRun.last ? null : vertical(x1, 1, plain, bar.bar.freeTime)}
      {bar.bar.repeatEnd !== undefined && bar.bar.repeatEnd !== 2 && (
        <text
          x={x1} y={rows.endings! + 6} fontSize={REPEAT_COUNT_SIZE} fontWeight={700} fill={lookOf('repeatCount').ink} textAnchor="end"
          data-testid="repeat-count" data-selected={lookOf('repeatCount') !== plain || undefined}
        >
          {repeatCountText(bar.bar.repeatEnd)}
        </text>
      )}
    </g>
  );
}

/**
 * The staff and the tab of one guitar joined as one part (Jeremy, 2026-10-27): a square bracket in
 * front, its ends curling over the lines, and the opening line drawn through both.
 */
export function StaffJoin({ x, top, bottom, look }: { x: number; top: number; bottom: number; look: TabLook }) {
  const bar = x - BRACKET_GAP - BRACKET_THICKNESS;
  return (
    <g data-testid="staff-join">
      <rect x={bar} y={top} width={BRACKET_THICKNESS} height={bottom - top} fill={look.ink} />
      <path d={GLYPHS.bracketTop.d} transform={`translate(${bar} ${top}) scale(${BRACKET_SCALE})`} fill={look.ink} />
      <path d={GLYPHS.bracketBottom.d} transform={`translate(${bar} ${bottom}) scale(${BRACKET_SCALE})`} fill={look.ink} />
      <line x1={x} x2={x} y1={top} y2={bottom} stroke={look.ink} strokeWidth={1.5} />
    </g>
  );
}

/** The bracket's bar, a little thinner than Bravura's half a staff space (Jeremy), and its gap before the lines. */
const BRACKET_THICKNESS = 3.5;
const BRACKET_GAP = 4;
/** Bravura draws the ends for a bar half a space thick; they are scaled to meet this one. */
const BRACKET_SCALE = BRACKET_THICKNESS * 2;
