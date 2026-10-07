import { useId, type KeyboardEvent } from 'react';
import { DEGREES } from '@/components/fretboard/theme';
import {
  ALL_CELLS, cellId, cellName, keySignature, signatureTip,
  type Cell, type Ring, type WheelModel,
} from './circle';

/*
 * Draws a circle-of-fifths model: three rings of twelve cells, C at the top,
 * then any arrows, mode names round the rim and key signatures outside it.
 * It knows no music theory; `circle.ts` says what each cell shows.
 */

/** Inner and outer radius of each ring, in viewBox units. */
const RADII: Record<Ring, [number, number]> = { major: [120, 163], minor: [82, 120], dim: [52, 82] };
const NAME_SIZE: Record<Ring, number> = { major: 15, minor: 12, dim: 9.5 };
/** What the wheel alone needs round the rings. */
const BARE_HALF = 172;
/** On-screen width of 2 × BARE_HALF units: the rings keep this size as staves add room. */
const BARE_WIDTH = 560;

/** Angle of a spoke (or a point between spokes), clockwise from the top. */
const angle = (spoke: number) => ((spoke * 30 - 90) * Math.PI) / 180;
const point = (spoke: number, r: number): [number, number] =>
  [r * Math.cos(angle(spoke)), r * Math.sin(angle(spoke))];

function sector(spoke: number, [r0, r1]: [number, number]): string {
  const [x0, y0] = point(spoke - 0.5, r1);
  const [x1, y1] = point(spoke + 0.5, r1);
  const [x2, y2] = point(spoke + 0.5, r0);
  const [x3, y3] = point(spoke - 0.5, r0);
  return `M${x0} ${y0}A${r1} ${r1} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 0 0 ${x3} ${y3}Z`;
}

const middleOf = ({ ring, spoke }: Cell) => point(spoke, (RADII[ring][0] + RADII[ring][1]) / 2);

/**
 * How far a box of this size, centred on a spoke, reaches along the spoke
 * from its centre: placing it that far past a radius keeps it clear of it.
 */
const reach = (spoke: number, width: number, height: number) =>
  Math.abs(Math.cos(angle(spoke))) * (width / 2) + Math.abs(Math.sin(angle(spoke))) * (height / 2);

// Mode names round the rim. Their room is sized for the longest name on
// every spoke, so the staves outside them never move as the names do.
const RIM_FONT = 11.5;
const RIM_HEIGHT = 14;
const RIM_WIDEST = 'Mixolydian'.length * RIM_FONT * 0.6;
const rimWidth = (text: string) => text.length * RIM_FONT * 0.6;

// Key signatures: a small treble staff per spoke. Steps count up from the
// bottom line (E4 = 0), so the top line, F5, is 8.
const SHARP_STEPS = [8, 5, 9, 6, 3, 7, 4];
const FLAT_STEPS = [4, 7, 3, 6, 2, 5, 1];
const STEP = 2.4;
const ACCIDENTAL_GAP = 7.5;
const STAFF_HEIGHT = 32;
const staffWidth = (accidentals: number) => 14 + accidentals * ACCIDENTAL_GAP;

/**
 * Where each spoke's staff sits, and the viewBox's half-width and
 * half-height: just enough for the rings, rim labels and staves shown.
 */
function layout(rim: boolean, staves: boolean) {
  const rimOut = (spoke: number) => BARE_HALF + (rim ? 2 * reach(spoke, RIM_WIDEST, RIM_HEIGHT) : 0);
  let halfX = BARE_HALF;
  let halfY = BARE_HALF;
  const grow = ([x, y]: [number, number], width: number, height: number) => {
    halfX = Math.max(halfX, Math.abs(x) + width / 2 + 2);
    halfY = Math.max(halfY, Math.abs(y) + height / 2 + 2);
  };
  const staffAt = Array.from({ length: 12 }, (_, spoke) => {
    const w = staffWidth(keySignature(spoke).notes.length);
    const at = point(spoke, rimOut(spoke) + 2 + reach(spoke, w, STAFF_HEIGHT));
    if (rim) grow(point(spoke, BARE_HALF + reach(spoke, RIM_WIDEST, RIM_HEIGHT)), RIM_WIDEST, RIM_HEIGHT);
    if (staves) grow(at, w, STAFF_HEIGHT);
    return at;
  });
  return { staffAt, halfX: Math.ceil(halfX), halfY: Math.ceil(halfY) };
}

/** Enter or Space acts like a click on a focusable SVG part. */
const onActivate = (go: () => void) => (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    go();
  }
};

interface CircleWheelProps {
  model: WheelModel;
  /** Draw each spoke's key signature outside the rim. */
  signatures: boolean;
  /** The rings whose cells can be picked. */
  pickable: readonly Ring[];
  onPick: (cell: Cell) => void;
  /** A rim label was picked, by its index in `model.rim`. */
  onRim?: (index: number) => void;
}

export function CircleWheel({ model, signatures, pickable, onPick, onRim }: CircleWheelProps) {
  const arrowId = `${useId()}-arrow`;
  const { staffAt, halfX, halfY } = layout(model.rim.length > 0, signatures);
  const tonic = model.tonic && cellId(model.tonic);

  return (
    <svg
      className="cof-wheel"
      viewBox={`${-halfX} ${-halfY} ${2 * halfX} ${2 * halfY}`}
      style={{ maxWidth: Math.round((BARE_WIDTH * halfX) / BARE_HALF), aspectRatio: `${halfX} / ${halfY}` }}
      role="group"
      aria-label="Circle of fifths"
    >
      <defs>
        <marker
          id={arrowId} viewBox="0 0 10 10" refX={8} refY={5}
          markerWidth={6} markerHeight={6} orient="auto-start-reverse"
        >
          <path d="M0 0L10 5L0 10z" className="cof-arrow-head" />
        </marker>
      </defs>

      {ALL_CELLS.map(cell => {
        const id = cellId(cell);
        const look = model.cells.get(id) ?? {};
        const canPick = pickable.includes(cell.ring);
        const fill = look.fill ? DEGREES[look.fill - 1] : null;
        const [cx, cy] = middleOf(cell);
        const size = NAME_SIZE[cell.ring];
        const dim = cell.ring === 'dim';
        const ink = fill ? { fill: `var(--on-degree-${fill})` } : undefined;
        const name = cellName(cell);
        const classes = ['cof-cell', `cof-${cell.ring}`];
        if (look.edge) classes.push('cof-edge');
        if (look.ring) classes.push(`cof-ring-${look.ring}`);
        if (canPick) classes.push('cof-pickable');
        return (
          <g
            key={id}
            className={classes.join(' ')}
            data-cell={id}
            data-tip={look.tip}
            {...(canPick ? {
              role: 'button',
              tabIndex: 0,
              'aria-pressed': id === tonic,
              onClick: () => onPick(cell),
              onKeyDown: onActivate(() => onPick(cell)),
            } : {})}
            aria-label={look.numeral ? `${name}, ${look.numeral}` : name}
          >
            <path
              d={sector(cell.spoke, RADII[cell.ring])}
              style={{
                fill: fill ? `var(--degree-${fill})` : undefined,
                stroke: look.edge ? `var(--degree-${DEGREES[look.edge - 1]})` : undefined,
              }}
            />
            <text
              x={cx}
              y={cy + (look.numeral ? (dim ? -1 : -2) : size * 0.35)}
              textAnchor="middle" fontSize={size} fontWeight={dim ? 500 : 600} style={ink}
            >
              {name}
            </text>
            {look.numeral && (
              <text
                className="cof-numeral" x={cx} y={cy + (dim ? 8 : 10)}
                textAnchor="middle" fontSize={dim ? 8 : 9.5} style={ink}
              >
                {look.numeral}
              </text>
            )}
          </g>
        );
      })}

      {model.arrows.map(a => {
        const [x0, y0] = middleOf(a.from);
        const [x1, y1] = middleOf(a.to);
        // Bend each arrow to one side of the straight line between the cells.
        const cx = (x0 + x1) / 2 - (y1 - y0) * 0.25;
        const cy = (y0 + y1) / 2 + (x1 - x0) * 0.25;
        // Start and end short of the cells' middles, clear of their names.
        const toward = (x: number, y: number, by: number): [number, number] => {
          const len = Math.hypot(cx - x, cy - y) || 1;
          return [x + ((cx - x) / len) * by, y + ((cy - y) / len) * by];
        };
        const [sx, sy] = toward(x0, y0, 14);
        const [ex, ey] = toward(x1, y1, 15);
        const d = `M${sx} ${sy}Q${cx} ${cy} ${ex} ${ey}`;
        return (
          <g key={`${cellId(a.from)}>${cellId(a.to)}`} data-tip={a.tip}>
            <path className="cof-arrow" d={d} markerEnd={`url(#${arrowId})`} />
            <path className="cof-arrow-hit" d={d} />
          </g>
        );
      })}

      {model.rim.map((label, i) => {
        const r = BARE_HALF + reach(label.spoke, rimWidth(label.text), RIM_HEIGHT);
        const [x, y] = point(label.spoke, r);
        const pick = () => onRim?.(i);
        return (
          <text
            key={label.text}
            className="cof-rim"
            x={x} y={y + 4} textAnchor="middle" fontSize={RIM_FONT}
            role="button" tabIndex={0} aria-pressed={label.current}
            data-tip={label.tip}
            onClick={pick}
            onKeyDown={onActivate(pick)}
          >
            {label.text}
          </text>
        );
      })}

      {signatures && staffAt.map(([cx, cy], spoke) => {
        const { sharps, notes } = keySignature(spoke);
        const w = staffWidth(notes.length);
        const x0 = cx - w / 2;
        const yOf = (step: number) => cy + 4 * STEP - step * STEP;
        return (
          <g
            key={spoke}
            className={`cof-staff${spoke === model.homeSpoke ? ' cof-staff-home' : ''}`}
            data-tip={signatureTip(spoke)}
            data-testid={`staff-${spoke}`}
          >
            <rect className="cof-staff-hit" x={x0 - 4} y={cy - STAFF_HEIGHT / 2} width={w + 8} height={STAFF_HEIGHT} />
            {[0, 2, 4, 6, 8].map(step => (
              <line key={step} className="cof-staff-line" x1={x0} x2={x0 + w} y1={yOf(step)} y2={yOf(step)} />
            ))}
            {notes.map((_, i) => (
              <text
                key={i}
                className="cof-accidental"
                x={x0 + 8 + i * ACCIDENTAL_GAP}
                y={yOf((sharps ? SHARP_STEPS : FLAT_STEPS)[i]) + (sharps ? 5 : 2.5)}
                textAnchor="middle" fontSize={14}
              >
                {sharps ? '♯' : '♭'}
              </text>
            ))}
          </g>
        );
      })}

      <text className="cof-centre" x={0} y={-2} textAnchor="middle" fontSize={15}>{model.centre[0]}</text>
      <text className="cof-centre-sub" x={0} y={13} textAnchor="middle" fontSize={10}>{model.centre[1]}</text>
    </svg>
  );
}
