/**
 * One column of the drawn tab: its fret numbers, the ties and bends that join them to the notes
 * before, and the marks over and under it. Draws what `layoutClip` places.
 */

import { type ReactNode } from 'react';
import { columnAccent, type Bend, type Column, type Note } from './clip';
import { BEND_LABEL_RAISE, BEND_LABEL_STEP, BEND_PEAK, BEND_RISE, bendShape, charWidth, TAP_RADIUS, GRACE_SIZE, noteLabel, stringY, type PlacedBar, type PlacedColumn, type Rows } from './layout';
import { type NoteSpot } from './runs';
import { bendLabel, bendLabelLines } from './staffMarks';
import { type TabLook } from './tabLook';
import { TapSign } from './TapSign';

/** How much of the string line a note's number keeps clear. */
export function labelWidth(note: Note, column: Column): number {
  return noteLabel(note).length * (charWidth(column) - 0.5) + 4;
}

/**
 * Whether a note's number is left out, as Guitar Pro prints Sweet Child O' Mine. A released bend's note
 * has none (its arrow comes down to the string) unless it starts a bar or a hammer-on, pull-off or legato
 * slide leaves from it, which needs a number to start from. Under the staff, a tied note's number shows
 * only at the start of a bar, in brackets: within the bar the staff's tie says it all, and a held bend's
 * dashed line. A tied note keeps its number when a legato leaves from it, under a mordent, or under
 * vibrato (bars 113, 114, 117 and 118 of the book); a tied note that bends up after a grace note has
 * none unless it has vibrato too, its arrow rising from the string (bar 118 against bar 113).
 */
export function hiddenNumber(note: Note, placed: PlacedColumn, bar: PlacedBar, rows: Rows, joins: Joins): boolean {
  const barStart = placed === bar.columns[0];
  const carry = joins.carries.get(note);
  if (carry === 'release') return !barStart && !joins.legatoStarts.has(note) && !note.slideOut;
  return note.tie === true && rows.score !== null && !barStart && !joins.legatoStarts.has(note) && !note.mordent && !note.vibrato;
}

/** How notes join the ones before and after them on a string, for drawing their numbers. */
export interface Joins {
  carries: Map<Note, 'hold' | 'release'>;
  /** How far each carried bend has been pushed on up (`bendRaises`). */
  raises: Map<Note, number>;
  /** Tied notes going on from a bend let down part of the way (`bendLandings`). */
  landings: Set<Note>;
  legatoStarts: Set<Note>;
}

export function ColumnDrawing({ placed, bar, rows, system, look, previous, slides, joins, staffStart }: {
  placed: PlacedColumn;
  bar: PlacedBar;
  rows: Rows;
  system: number;
  look: TabLook;
  previous: Map<Note, NoteSpot>;
  slides: Map<Note, 'up' | 'down'>;
  joins: Joins;
  staffStart: number;
}) {
  const { column, x } = placed;
  const parts: ReactNode[] = [];
  const labelLines = bendLabelLines(column, note => joins.carries.has(note));
  column.notes.forEach((note, s) => {
    if (!note) return;
    const y = stringY(rows, s);
    const label = noteLabel(note);
    const before = previous.get(note);
    // Where the joined-from note sits on this system, or the staff's start if it was on the line before.
    const fromX = before && before.system === system ? before.x : staffStart;
    // Hammer-ons, pull-offs and legato slides get one arc over their whole run (`legatoArcs`, drawn per line).
    if (note.slide) {
      // A slide from below or above starts just before the note; from the note before, a line between them.
      const up = slides.get(note) === 'up';
      const fromNote = (note.slide === 'legato' || note.slide === 'shift') && before;
      const from = fromNote ? fromX + 7 : x - 16;
      parts.push(
        <line
          key={`slide-${s}`} x1={from} x2={x - 7} y1={y + (up ? 3 : -3)} y2={y + (up ? -3 : 3)}
          stroke={look.ink} strokeWidth={1.2}
        />,
      );
    }
    // A tie gets its arc on the tab alone, even across a held chord: a number in brackets without one is
    // a ghost note. Under the staff, which draws the tie, the brackets alone say it (Jeremy, 2026-10-27).
    if (note.tie && before && !rows.score) {
      parts.push(
        <path key={`tie-${s}`} d={`M${fromX + 4} ${y + 7} Q${(fromX + x) / 2} ${y + 15} ${x - 10} ${y + 7}`} fill="none" stroke={look.ink} strokeWidth={1.1} />,
      );
    }
    const carry = joins.carries.get(note);
    const shown = !hiddenNumber(note, placed, bar, rows, joins);
    // A grace note's number is drawn small.
    if (shown) parts.push(column.grace
      ? <text key={`fret-${s}`} x={x} y={y + 3.2} fontSize={GRACE_SIZE} fontWeight={600} fill={look.ink} textAnchor="middle" data-testid="grace">{label}</text>
      : <text key={`fret-${s}`} x={x} y={y + 4.5} fontSize={13} fontWeight={600} fill={look.ink} textAnchor="middle">{label}</text>);
    if (carry) {
      const level = joins.raises.get(note) ?? 0;
      const rise = note.bend?.from !== undefined ? note.bend : undefined;
      parts.push(
        <BendCarry
          key={`bend-${s}`} carry={carry} level={level} rise={rise} bend={note.bend} landed={joins.landings.has(note)} fromX={before && before.system === system ? fromX : staffStart - 14}
          fromPeak={before && before.system === system ? before.peak : staffStart}
          peakX={x + bendShape(placed, { pre: false, release: false }).peak}
          x={x} y={shown ? y - 9 : y} staffTop={rows.staffTop} look={look}
        />,
      );
    } else if (note.bend) {
      // A tied note bent with no number of its own (after a grace note) bends from the note it is tied
      // from, its arrow rising right by that number as the book prints bars 131 and 132.
      const from = !shown && note.tie && !note.bend.pre && before && before.system === system ? fromX : undefined;
      parts.push(
        <BendDrawing
          key={`bend-${s}`} bend={note.bend} line={labelLines.get(note) ?? 0} x={x} from={from} y={y} staffTop={rows.staffTop} look={look}
          shape={bendShape(placed, note.bend)}
        />,
      );
    }
    if (note.slideOut) {
      // A short line away from the number, down or up, to no fret in particular.
      const down = note.slideOut === 'down';
      parts.push(
        <line
          key={`slide-out-${s}`} x1={x + 8} x2={x + 18} y1={y + (down ? -3 : 3)} y2={y + (down ? 4 : -4)}
          stroke={look.ink} strokeWidth={1.2} data-testid="slide-out"
        />,
      );
    }
    if (note.tap) {
      parts.push(<TapSign key={`tap-${s}`} x={x} y={y - 6 - TAP_RADIUS} look={look} testId="tab-tap" />);
    }
  });
  return <g data-testid="tab-column">{parts}</g>;
}

/** The marks drawn once over a column, each in its own row: "P.H." or "AH", an accent and a staccato dot. */
export function columnMarks(column: Column, x: number, rows: Rows, look: TabLook): ReactNode[] {
  const notes = column.notes.filter((n): n is Note => n !== null);
  const parts: ReactNode[] = [];
  if (notes.some(n => n.harmonic === 'pinch') && rows.harmonics !== null) {
    parts.push(
      <text key="pinch" x={x} y={rows.harmonics! + 4} fontSize={10} fontWeight={700} fill={look.ink} textAnchor="middle" data-testid="pinch-harmonic">P.H.</text>,
    );
  } else if (notes.some(n => n.harmonic === 'artificial') && rows.harmonics !== null) {
    // An artificial harmonic is labelled "AH", as the book prints bar 158 of Sweet Child O' Mine.
    parts.push(
      <text key="artificial" x={x} y={rows.harmonics + 4} fontSize={10} fontWeight={700} fill={look.ink} textAnchor="middle" data-testid="artificial-harmonic">AH</text>,
    );
  }
  const accent = columnAccent(column);
  const staccato = notes.some(n => n.staccato);
  if ((accent || staccato) && rows.accents !== null) {
    const y = rows.accents;
    // With both, the accent sits over the dot.
    const ay = staccato ? y - 2 : y;
    if (accent === 'normal') {
      parts.push(<path key="accent" d={`M${x - 5} ${ay - 4} L${x + 5} ${ay} L${x - 5} ${ay + 4}`} fill="none" stroke={look.ink} strokeWidth={1.5} data-testid="accent" />);
    }
    if (accent === 'heavy') {
      parts.push(<path key="accent" d={`M${x - 4} ${ay + 4} L${x} ${ay - 5} L${x + 4} ${ay + 4}`} fill="none" stroke={look.ink} strokeWidth={1.8} data-testid="accent" />);
    }
    if (staccato) parts.push(<circle key="staccato" cx={x} cy={accent ? y + 6 : y} r={1.8} fill={look.ink} data-testid="staccato" />);
  }
  return parts;
}

/**
 * A bend carried on over a tied note, from the arrow's top over the note before: a dashed line held at
 * the bend's height, then for a release a curved arrow down to the string, where the note's number would be
 * (or down to the number, `y` raised over it, when one is drawn). A bend pushed on up (`rise`) leaves
 * the dashed line in a curved arrow to a line higher, `BEND_LABEL_STEP` a step, labelled with its new
 * height; `level` is how many steps up it stands.
 */
function BendCarry({ carry, level, rise, bend, landed, fromX, fromPeak, x, peakX, y, staffTop, look }: {
  carry: 'hold' | 'release'; level: number; rise?: Bend; bend?: Bend; landed: boolean; fromX: number; fromPeak: number; x: number; peakX: number; y: number;
  staffTop: number; look: TabLook;
}) {
  const top = staffTop - BEND_RISE - level * BEND_LABEL_STEP;
  // From the peak of the arrow over the note before.
  const from = fromPeak;
  if (rise) {
    const below = top + BEND_LABEL_STEP;
    // From where the note before let it down, the arrow rises straight from its arrowhead, as the book
    // draws bar 165; from a held bend, the dashed line runs on first.
    const up = landed ? fromX + 4 : x + 4;
    return (
      <g stroke={look.ink} fill="none" strokeWidth={1.2} data-testid="bend-rise">
        {!landed && up > from && <line x1={from} x2={up} y1={below} y2={below} strokeDasharray="4 3" />}
        <path d={`M${up} ${below} Q${x + 14} ${below} ${x + 14} ${top + 2}`} />
        <path d={`M${x + 10} ${top + 7} L${x + 14} ${top} L${x + 18} ${top + 7}`} fill={look.ink} stroke="none" />
        {rise.release && <path d={`M${x + 15} ${top} Q${x + 24} ${top} ${x + 24} ${releaseEnd(rise, top, y)}`} />}
        {rise.release && <ReleaseLabel bend={rise} x={x + 24} top={top} look={look} />}
        <text x={x + 14} y={top - 9} fontSize={10} fontWeight={700} fill={look.ink} stroke="none" textAnchor="middle" data-testid="bend-label">
          {bendLabel({ ...rise, pre: false })}
        </text>
      </g>
    );
  }
  if (carry === 'hold') {
    return <line x1={from} x2={peakX} y1={top} y2={top} stroke={look.ink} strokeWidth={1.2} strokeDasharray="4 3" data-testid="bend-hold" />;
  }
  const down = x - 8;
  // Down to the string, or, let down part of the way, to a step under the bend's line.
  const end = bend?.to !== undefined ? top + BEND_LABEL_STEP : y;
  return (
    <g stroke={look.ink} fill="none" strokeWidth={1.2} data-testid="bend-release">
      {down > from && <line x1={from} x2={down} y1={top} y2={top} strokeDasharray="4 3" />}
      <path d={`M${down} ${top} Q${x} ${top} ${x} ${end - 6}`} />
      <path d={`M${x - 4} ${end - 7} L${x} ${end} L${x + 4} ${end - 7}`} fill={look.ink} stroke="none" />
      {bend && <ReleaseLabel bend={bend} x={x} top={top} look={look} />}
    </g>
  );
}

/** Where a release's arrowhead stops: over the number, or a step under the bend's line when it lands at `to`. */
function releaseEnd(bend: Bend, top: number, y: number): number {
  return bend.to !== undefined ? top + BEND_LABEL_STEP : y - 8;
}

/** A release that stops part of the way down is labelled with the height it lands at, up by its arrowhead, clear of what rises from there. */
function ReleaseLabel({ bend, x, top, look }: { bend: Bend; x: number; top: number; look: TabLook }) {
  if (bend.to === undefined) return null;
  return (
    <text x={x + 6} y={top + BEND_LABEL_STEP - 5} fontSize={10} fontWeight={700} fill={look.ink} stroke="none" data-testid="bend-to">
      {bendLabel({ quarters: bend.to, pre: false, release: false })}
    </text>
  );
}

/**
 * A bend's curved arrow and label; a pre-bend is a straight arrow labelled "PB", so it can't pass for a bend.
 * `line` is the label's line in a stacked pair (`bendLabelLines`), -1 for none. With `from`, the arrow
 * rises by the number there instead, and a held bend's dashed line runs on over the note at `x`.
 */
function BendDrawing({ bend, line, x: noteX, from, y, staffTop, look, shape }: {
  bend: Bend; line: number; x: number; from?: number; y: number; staffTop: number; look: TabLook; shape: { peak: number; drop: number };
}) {
  const top = staffTop - BEND_RISE;
  const x = from ?? noteX;
  // The arrow down, a held bend's dashed line and the rise of a note's own bend run its length; one rising
  // by the number it is tied from peaks just past that number, as the book's bars 131 and 132 draw it.
  const peak = from === undefined ? shape.peak : BEND_PEAK;
  const drop = Math.max(peak + 10, noteX + shape.drop - x);
  const head = (tx: number, ty: number, down = false) => (
    <path d={down ? `M${tx - 4} ${ty - 7} L${tx} ${ty} L${tx + 4} ${ty - 7}` : `M${tx - 4} ${ty + 7} L${tx} ${ty} L${tx + 4} ${ty + 7}`} fill={look.ink} />
  );
  const label = line >= 0 && (
    <text
      x={x + peak} y={top - BEND_LABEL_RAISE - line * BEND_LABEL_STEP} fontSize={10} fontWeight={700} fill={look.ink}
      stroke="none" textAnchor="middle" data-testid="bend-label"
    >
      {bendLabel(bend)}
    </text>
  );
  if (bend.pre) {
    return (
      <g stroke={look.ink} fill="none" strokeWidth={1.2} data-testid="bend">
        <line x1={x} x2={x} y1={y - 8} y2={top + 2} />
        {head(x, top)}
        {bend.release && <path d={`M${x + 2} ${top} Q${x + drop} ${top} ${x + drop} ${releaseEnd(bend, top, y)}`} />}
        {bend.release && head(x + drop, releaseEnd(bend, top, y), true)}
        {bend.release && <ReleaseLabel bend={bend} x={x + drop} top={top} look={look} />}
        {label}
      </g>
    );
  }
  return (
    <g stroke={look.ink} fill="none" strokeWidth={1.2} data-testid="bend">
      <path d={`M${x + 7} ${y - 2} Q${x + peak} ${y - 2} ${x + peak} ${top + 2}`} />
      {head(x + peak, top)}
      {bend.release && <path d={`M${x + peak + 1} ${top} Q${x + drop} ${top} ${x + drop} ${releaseEnd(bend, top, y)}`} />}
      {bend.release && head(x + drop, releaseEnd(bend, top, y), true)}
      {bend.release && <ReleaseLabel bend={bend} x={x + drop} top={top} look={look} />}
      {!bend.release && from !== undefined && x + peak + 4 < noteX + shape.peak && <line x1={x + peak + 4} x2={noteX + shape.peak} y1={top} y2={top} strokeDasharray="4 3" />}
      {label}
    </g>
  );
}
