import { useId, type KeyboardEvent } from 'react';
import { DEGREES } from '@/components/fretboard/theme';
import {
  ALL_CELLS, cellId, cellName, keySignature, signatureTip,
  type Cell, type Ring, type RingNote, type WheelModel,
} from './circle';

/*
 * Draws a circle-of-fifths model: three rings of twelve cells, C at the top,
 * then any arrows, the ring of notes round the outside (its lit run, the
 * root's pin and mode names along it), in the Advanced view only, and key
 * signatures outside that. It knows no music theory; `circle.ts` says
 * what each part shows.
 */

/** Inner and outer radius of each ring, in viewBox units. */
const RADII: Record<Ring, [number, number]> = { major: [120, 163], minor: [82, 120], dim: [52, 82] };
const NAME_SIZE: Record<Ring, number> = { major: 15, minor: 12, dim: 9.5 };
/** The ring of notes, outside the chords. */
const NOTE_RING: [number, number] = [167, 193];
const NOTE_SIZE = 11.5;
const PIN_RADIUS = 10.5;
/** Mode names curve along the ring, just outside it. */
const LABEL_SIZE = 10;
const LABEL_RADIUS = NOTE_RING[1] + 3;
/** What the three rings of chords need, with a margin. */
const RINGS_HALF = 172;
/** What the wheel needs with the ring of notes and its mode names. */
const RING_HALF = LABEL_RADIUS + LABEL_SIZE + 4;
/** Largest on-screen width of 2 × RINGS_HALF units: the rings keep this size as more is drawn round them. */
const RINGS_WIDTH = 600;

/** Angle of a spoke (or a point between spokes), clockwise from the top. */
const angle = (spoke: number) => ((spoke * 30 - 90) * Math.PI) / 180;
const point = (spoke: number, r: number): [number, number] =>
  [r * Math.cos(angle(spoke)), r * Math.sin(angle(spoke))];

/** A band between two radii, clockwise from one angle to another, in spokes. */
function band(from: number, to: number, [r0, r1]: [number, number]): string {
  const [x0, y0] = point(from, r1);
  const [x1, y1] = point(to, r1);
  const [x2, y2] = point(to, r0);
  const [x3, y3] = point(from, r0);
  const large = to - from > 6 ? 1 : 0;
  return `M${x0} ${y0}A${r1} ${r1} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 ${large} 0 ${x3} ${y3}Z`;
}

/** One spoke's cell of a ring. */
const sector = (spoke: number, radii: [number, number]) => band(spoke - 0.5, spoke + 0.5, radii);

/** The ring of notes' lit run for a key on `home`: the spoke before it and the five after. */
const run = (home: number, grow = 0) =>
  band(home - 1.5, home + 5.5, [NOTE_RING[0] - grow, NOTE_RING[1] + grow]);

const middleOf = ({ ring, spoke }: Cell) => point(spoke, (RADII[ring][0] + RADII[ring][1]) / 2);

/**
 * How far a box of this size, centred on a spoke, reaches along the spoke
 * from its centre: placing it that far past a radius keeps it clear of it.
 */
const reach = (spoke: number, width: number, height: number) =>
  Math.abs(Math.cos(angle(spoke))) * (width / 2) + Math.abs(Math.sin(angle(spoke))) * (height / 2);

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
 * half-height: just enough for the wheel and the staves shown.
 */
function layout(ring: boolean, staves: boolean) {
  const bare = ring ? RING_HALF : RINGS_HALF;
  let halfX = bare;
  let halfY = bare;
  const staffAt = Array.from({ length: 12 }, (_, spoke) => {
    const w = staffWidth(keySignature(spoke).notes.length);
    const at = point(spoke, bare + reach(spoke, w, STAFF_HEIGHT));
    if (staves) {
      halfX = Math.max(halfX, Math.abs(at[0]) + w / 2 + 2);
      halfY = Math.max(halfY, Math.abs(at[1]) + STAFF_HEIGHT / 2 + 2);
    }
    return at;
  });
  return { staffAt, halfX: Math.ceil(halfX), halfY: Math.ceil(halfY) };
}

/**
 * The arc a mode name is written along, one spoke wide. On the lower half
 * it runs the other way, a line further out, so the name reads upright.
 */
function labelArc(spoke: number): string {
  const lower = spoke > 3 && spoke < 9;
  const r = lower ? LABEL_RADIUS + LABEL_SIZE * 0.75 : LABEL_RADIUS;
  const [a, b] = lower ? [spoke + 0.5, spoke - 0.5] : [spoke - 0.5, spoke + 0.5];
  const [x0, y0] = point(a, r);
  const [x1, y1] = point(b, r);
  return `M${x0} ${y0}A${r} ${r} 0 0 ${lower ? 0 : 1} ${x1} ${y1}`;
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
  /** A ring note with a `pick` was picked. */
  onNote?: (note: RingNote) => void;
  /** Outline, dashed, the run a key on this spoke would light: a preview. */
  preview?: number | null;
}

export function CircleWheel({ model, signatures, pickable, onPick, onNote, preview = null }: CircleWheelProps) {
  const id = useId();
  const arrowId = `${id}-arrow`;
  const { staffAt, halfX, halfY } = layout(model.notes.length > 0, signatures);
  const tonic = model.tonic && cellId(model.tonic);

  return (
    <svg
      className="cof-wheel"
      viewBox={`${-halfX} ${-halfY} ${2 * halfX} ${2 * halfY}`}
      style={{ maxWidth: Math.round((RINGS_WIDTH * halfX) / RINGS_HALF), aspectRatio: `${halfX} / ${halfY}` }}
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
        const name = look.name ?? cellName(cell);
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

      {model.notes.map(note => {
        const [x, y] = point(note.spoke, (NOTE_RING[0] + NOTE_RING[1]) / 2);
        const pick = note.pick && onNote ? () => onNote(note) : null;
        const classes = ['cof-note'];
        if (note.lit) classes.push('cof-note-lit');
        if (note.root) classes.push('cof-note-root');
        if (pick) classes.push('cof-pickable');
        return (
          <g
            key={note.spoke}
            className={classes.join(' ')}
            data-note={note.spoke}
            data-tip={note.tip}
            {...(pick ? {
              role: 'button',
              tabIndex: 0,
              'aria-pressed': note.root,
              'aria-label': `${note.name} ${note.label}`,
              onClick: pick,
              onKeyDown: onActivate(pick),
            } : { 'aria-hidden': true })}
          >
            <path d={sector(note.spoke, NOTE_RING)} />
            {note.root && <circle className="cof-pin" cx={x} cy={y} r={PIN_RADIUS} />}
            <text x={x} y={y + NOTE_SIZE * 0.35} textAnchor="middle" fontSize={NOTE_SIZE}>{note.name}</text>
            {note.label && (
              <>
                <path id={`${id}-label-${note.spoke}`} className="cof-label-arc" d={labelArc(note.spoke)} />
                <text className="cof-mode-label" fontSize={LABEL_SIZE}>
                  <textPath href={`#${id}-label-${note.spoke}`} startOffset="50%" textAnchor="middle">
                    {note.label}
                  </textPath>
                </text>
              </>
            )}
          </g>
        );
      })}
      {model.notes.length > 0 && <path className="cof-run" d={run(model.homeSpoke)} />}
      {preview !== null && preview !== model.homeSpoke && (
        <path className="cof-run-preview" d={run(preview, 2)} data-testid="run-preview" />
      )}

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
