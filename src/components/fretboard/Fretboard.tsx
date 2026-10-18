'use client';

import {
  useEffect, useId, useMemo, useRef, useState, type CSSProperties,
  type KeyboardEvent,
} from 'react';
import {
  BOARD_RADIUS, fretboardGeometry, PAD, SG,
} from '@/lib/fretboardGeometry';
import { STRING_NAMES, STRINGS, type Position } from '@/lib/music';
import { BOARD, type DotColor } from './theme';

export interface FretDot extends Position, DotColor {
  label: string;
  fontSize: number;
  opacity?: number;
  /** Roots are square, every other dot round. */
  shape?: 'circle' | 'square';
  /** Identifies the dot in tests and styles (root, target, hint, wrong…). */
  kind: string;
}

/** A band joining a shape's dots, drawn behind them, with an optional name above the board. */
export interface FretLink {
  points: Position[];
  label?: string;
  opacity?: number;
}

export interface StringStyle {
  color?: string;
  width?: number;
  opacity?: number;
}

interface FretboardProps {
  minFret: number;
  maxFret: number;
  dots: FretDot[];
  /** When set, every cell is a tap target. */
  onCellClick?: (pos: Position) => void;
  /** Cells that no longer accept taps (already tapped). */
  isCellDisabled?: (pos: Position) => boolean;
  stringStyle?: (s: number) => StringStyle;
  /** Fret to bring into view when the board scrolls (phones). */
  scrollToFret?: number | null;
  /** Accessible name when the board is a picture (no `onCellClick`). */
  label?: string;
  /** Frets to outline, both ends included (the Scale lab's position); 0 takes in the open strings. */
  box?: { from: number; to: number } | null;
  /**
   * Frets in play, both ends included. Frets outside it stay drawn, so the
   * board keeps its size, but are shaded and take no taps.
   */
  inPlay?: { from: number; to: number } | null;
  /**
   * Strings a chord shape leaves out. Each fades, with its name, and gets a
   * × where its open-string dot would be when the board starts at the nut.
   */
  mutedStrings?: readonly number[];
  /** Bands joining the dots of each shape (the Triads page's grips). */
  links?: readonly FretLink[];
}

/** How far a muted string and its name fade. */
const MUTED_OPACITY = 0.3;
/** A link's band: faint, and as wide as a dot, so it reads as one shape. */
const LINK_OPACITY = 0.3;
const LINK_WIDTH = 24;
/** Room above the board for the links' names. */
const LINK_LABEL_ROOM = 20;

const cellLabel = (s: number, f: number) => `${STRING_NAMES[s]} string, fret ${f}`;

/**
 * SVG fretboard, low E at the bottom, drawn as a rounded fingerboard fill.
 * The viewBox tracks the fret window; the frame scrolls horizontally on
 * narrow screens instead of shrinking.
 */
export function Fretboard({
  minFret, maxFret, dots, onCellClick, isCellDisabled, stringStyle,
  scrollToFret, label = 'Fretboard', box, inPlay, mutedStrings = [], links = [],
}: FretboardProps) {
  const clipId = useId();
  const stringOpacity = (s: number) =>
    (mutedStrings.includes(s) ? MUTED_OPACITY : stringStyle?.(s).opacity ?? 1);
  const playFrom = inPlay?.from ?? minFret;
  const playTo = inPlay?.to ?? maxFret;
  const isInPlay = (f: number) => f >= playFrom && f <= playTo;
  const headroom = links.some(l => l.label) ? LINK_LABEL_ROOM : 0;
  const g = useMemo(
    () => fretboardGeometry(minFret, maxFret, headroom), [minFret, maxFret, headroom],
  );
  const [focus, setFocus] = useState<Position>({ s: 0, f: minFret });
  const cellRefs = useRef(new Map<string, SVGRectElement>());
  const svgRef = useRef<SVGSVGElement>(null);

  // When the frame scrolls horizontally, center the question's fret.
  useEffect(() => {
    const svg = svgRef.current;
    const frame = svg?.parentElement;
    if (!svg || !frame || scrollToFret == null) return;
    if (frame.scrollWidth <= frame.clientWidth) return;
    const x = (g.cx(scrollToFret) / g.width) * svg.clientWidth;
    frame.scrollLeft = x - frame.clientWidth / 2;
  }, [scrollToFret, g]);
  const focusCell = {
    s: Math.min(Math.max(focus.s, 0), 5),
    f: Math.min(Math.max(focus.f, playFrom), playTo),
  };

  const moveFocus = (e: KeyboardEvent, pos: Position) => {
    const d: Record<string, [number, number]> = {
      ArrowUp: [1, 0], ArrowDown: [-1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
    };
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      // Keep the global Enter/Space handler from treating this as "Next".
      e.stopPropagation();
      if (!isCellDisabled?.(pos)) onCellClick?.(pos);
      return;
    }
    const step = d[e.key];
    if (!step) return;
    e.preventDefault();
    const next = {
      s: Math.min(5, Math.max(0, pos.s + step[0])),
      f: Math.min(playTo, Math.max(playFrom, pos.f + step[1])),
    };
    setFocus(next);
    cellRefs.current.get(`${next.s}:${next.f}`)?.focus();
  };

  const svgStyle = { '--board-w': `${g.width}px` } as CSSProperties;
  const fillBottom = g.fillY + g.fillH;
  const fillRight = g.fillX + g.fillW;
  // Shaded spans left and right of the frets in play, clipped to the fill.
  const shaded = [
    playFrom > minFret && { x: g.fillX, w: g.cellX(playFrom) - g.fillX },
    playTo < maxFret && {
      x: g.cellX(playTo) + g.cellW(playTo),
      w: fillRight - g.cellX(playTo) - g.cellW(playTo),
    },
  ].filter(span => span !== false);

  return (
    <svg
      ref={svgRef}
      className="fretboard"
      viewBox={`0 0 ${g.width} ${g.height}`}
      style={svgStyle}
      onContextMenu={e => e.preventDefault()}
      role={onCellClick ? 'group' : 'img'}
      aria-label={onCellClick ? 'Fretboard: choose a fret' : label}
    >
      <rect
        data-testid="board-fill"
        x={g.fillX} y={g.fillY} width={g.fillW} height={g.fillH}
        rx={BOARD_RADIUS}
        style={{ fill: BOARD.fill }}
      />
      {g.inlays.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={6} style={{ fill: BOARD.inlay }} />
      ))}
      {g.fretLines.map((l, i) => (
        <line
          key={i} x1={l.x} x2={l.x}
          y1={l.nut ? g.fillY + 8 : g.fillY}
          y2={l.nut ? fillBottom - 8 : fillBottom}
          style={{ stroke: l.nut ? BOARD.nut : BOARD.fret }}
          strokeWidth={l.nut ? 5 : 2}
          strokeLinecap={l.nut ? 'round' : undefined}
        />
      ))}
      {STRINGS.map(s => {
        const st = stringStyle?.(s) ?? {};
        return (
          <line
            key={s} x1={g.boardX} x2={g.boardRight} y1={g.cy(s)} y2={g.cy(s)}
            style={{ stroke: st.color ?? BOARD.string }}
            strokeWidth={st.width ?? 2.5 - s * 0.3}
            opacity={stringOpacity(s)}
            data-testid={`string-${s}`}
          />
        );
      })}
      {shaded.length > 0 && (
        <g data-testid="board-shade">
          <clipPath id={clipId}>
            <rect
              x={g.fillX} y={g.fillY} width={g.fillW} height={g.fillH} rx={BOARD_RADIUS}
            />
          </clipPath>
          {shaded.map(span => (
            <rect
              key={span.x} x={span.x} y={g.fillY} width={span.w} height={g.fillH}
              clipPath={`url(#${clipId})`}
              style={{ fill: BOARD.shade, fillOpacity: 0.6 }}
            />
          ))}
        </g>
      )}
      {box && (
        <rect
          data-testid="board-box"
          x={g.cellX(box.from) + 1.5} y={g.fillY + 1.5}
          width={g.cellX(box.to) + g.cellW(box.to) - g.cellX(box.from) - 3} height={g.fillH - 3}
          rx={BOARD_RADIUS - 2}
          style={{ fill: 'none', stroke: BOARD.box }} strokeWidth={3}
        />
      )}
      {links.map((l, i) => {
        const xs = l.points.map(p => g.cx(p.f));
        return (
          <g key={i} opacity={l.opacity ?? 1} data-testid="link" aria-hidden="true">
            <polyline
              points={l.points.map(p => `${g.cx(p.f)},${g.cy(p.s)}`).join(' ')}
              style={{ fill: 'none', stroke: BOARD.link }}
              strokeOpacity={LINK_OPACITY} strokeWidth={LINK_WIDTH}
              strokeLinecap="round" strokeLinejoin="round"
            />
            {l.label && (
              <text
                x={(Math.min(...xs) + Math.max(...xs)) / 2} y={g.fillY - 7}
                textAnchor="middle" fontSize={12} fontWeight={600}
                style={{ fill: BOARD.label, fontFamily: 'var(--font-sans)' }}
              >
                {l.label}
              </text>
            )}
          </g>
        );
      })}
      <g
        style={{ fill: BOARD.label, fontFamily: 'var(--font-sans)' }}
        fontSize={12} fontWeight={500} aria-hidden="true"
      >
        {STRINGS.map(s => (
          <text
            key={s} x={PAD - 4}
            y={g.cy(s)} textAnchor="end" dominantBaseline="middle"
            opacity={stringOpacity(s)}
          >
            {STRING_NAMES[s]}
          </text>
        ))}
        {g.open && mutedStrings.map(s => (
          <text
            key={s} x={g.cx(0)} y={g.cy(s)} textAnchor="middle" dominantBaseline="central"
            fontSize={18} fontWeight={600} data-testid={`muted-${s}`}
          >
            ×
          </text>
        ))}
        {g.fretNumbers.map(f => (
          <text
            key={f.label} x={f.x} y={g.fretNumberY} textAnchor="middle"
            opacity={isInPlay(f.f) ? 1 : 0.4}
          >
            {f.label}
          </text>
        ))}
      </g>
      {/* One group per dot so later dots fully cover earlier ones. */}
      <g
        fontWeight={700} aria-hidden="true"
        style={{ fontFamily: 'var(--font-sans)', pointerEvents: 'none' }}
      >
        {dots.map((d, i) => (
          <g
            key={i} opacity={d.opacity ?? 1}
            data-testid={`dot-${d.kind}`} data-s={d.s} data-f={d.f}
          >
            {d.shape === 'square' ? (
              <rect
                x={g.cx(d.f) - 11} y={g.cy(d.s) - 11} width={22} height={22} rx={5}
                style={{ fill: d.fill, stroke: BOARD.dotRing }} strokeWidth={2}
              />
            ) : (
              <circle
                cx={g.cx(d.f)} cy={g.cy(d.s)} r={12}
                style={{ fill: d.fill, stroke: BOARD.dotRing }} strokeWidth={2}
              />
            )}
            <text
              x={g.cx(d.f)} y={g.cy(d.s)} fontSize={d.fontSize}
              textAnchor="middle" dominantBaseline="central" style={{ fill: d.fg }}
            >
              {d.label}
            </text>
          </g>
        ))}
      </g>
      {onCellClick && STRINGS.map(s => {
        const cells = [];
        for (let f = playFrom; f <= playTo; f++) {
          const pos = { s, f };
          const disabled = isCellDisabled?.(pos) ?? false;
          const isFocus = focusCell.s === s && focusCell.f === f;
          cells.push(
            <rect
              key={`${s}:${f}`}
              ref={el => {
                if (el) cellRefs.current.set(`${s}:${f}`, el);
                else cellRefs.current.delete(`${s}:${f}`);
              }}
              className="fret-cell"
              x={g.cellX(f)} y={g.cy(s) - SG / 2} width={g.cellW(f)} height={SG}
              role="button"
              tabIndex={isFocus ? 0 : -1}
              aria-label={cellLabel(s, f)}
              aria-disabled={disabled || undefined}
              data-testid={`cell-${s}-${f}`}
              onClick={() => { if (!disabled) onCellClick(pos); }}
              onKeyDown={e => moveFocus(e, pos)}
              onFocus={() => setFocus(pos)}
            >
              <title>{cellLabel(s, f)}</title>
            </rect>,
          );
        }
        return cells;
      })}
    </svg>
  );
}
