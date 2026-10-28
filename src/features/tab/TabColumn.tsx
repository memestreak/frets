/**
 * One column of the drawn tab: its fret numbers, the ties and bends that join them to the notes
 * before, and the marks over and under it. Draws what `layoutClip` places.
 */

import { type ReactNode } from 'react';
import { columnAccent, type Bend, type Column, type Note } from './clip';
import { BEND_RISE, charWidth, GRACE_SIZE, noteLabel, stringY, type PlacedBar, type PlacedColumn, type Rows } from './layout';
import { type Spot } from './runs';
import { type TabLook } from './tabLook';

const BEND_LABEL: Record<number, string> = { 1: '¼', 2: '½', 4: 'full', 6: '1½', 8: '2' };

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
  legatoStarts: Set<Note>;
}

export function ColumnDrawing({ placed, bar, rows, system, look, previous, slides, joins, staffStart }: {
  placed: PlacedColumn;
  bar: PlacedBar;
  rows: Rows;
  system: number;
  look: TabLook;
  previous: Map<Note, Spot>;
  slides: Map<Note, 'up' | 'down'>;
  joins: Joins;
  staffStart: number;
}) {
  const { column, x } = placed;
  const parts: ReactNode[] = [];
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
      parts.push(<BendCarry key={`bend-${s}`} carry={carry} fromX={before && before.system === system ? fromX : staffStart - 14} x={x} y={shown ? y - 9 : y} staffTop={rows.staffTop} look={look} />);
    } else if (note.bend) {
      parts.push(<BendDrawing key={`bend-${s}`} bend={note.bend} x={x} y={y} staffTop={rows.staffTop} look={look} />);
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
      parts.push(<text key={`tap-${s}`} x={x} y={y - 10} fontSize={10} fontWeight={700} fill={look.ink} textAnchor="middle">T</text>);
    }
  });
  return <g data-testid="tab-column">{parts}</g>;
}

/** The marks drawn once over a column, each in its own row: "P.H.", an accent and a staccato dot. */
export function columnMarks(column: Column, x: number, rows: Rows, look: TabLook): ReactNode[] {
  const notes = column.notes.filter((n): n is Note => n !== null);
  const parts: ReactNode[] = [];
  if (notes.some(n => n.harmonic === 'pinch') && rows.harmonics !== null) {
    parts.push(
      <text key="pinch" x={x} y={rows.harmonics! + 4} fontSize={10} fontWeight={700} fill={look.ink} textAnchor="middle" data-testid="pinch-harmonic">P.H.</text>,
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
 * (or down to the number, `y` raised over it, when one is drawn).
 */
function BendCarry({ carry, fromX, x, y, staffTop, look }: {
  carry: 'hold' | 'release'; fromX: number; x: number; y: number; staffTop: number; look: TabLook;
}) {
  const top = staffTop - BEND_RISE;
  const from = fromX + 14;
  if (carry === 'hold') {
    return <line x1={from} x2={x + 14} y1={top} y2={top} stroke={look.ink} strokeWidth={1.2} strokeDasharray="4 3" data-testid="bend-hold" />;
  }
  const down = x - 8;
  return (
    <g stroke={look.ink} fill="none" strokeWidth={1.2} data-testid="bend-release">
      {down > from && <line x1={from} x2={down} y1={top} y2={top} strokeDasharray="4 3" />}
      <path d={`M${down} ${top} Q${x} ${top} ${x} ${y - 6}`} />
      <path d={`M${x - 4} ${y - 7} L${x} ${y} L${x + 4} ${y - 7}`} fill={look.ink} stroke="none" />
    </g>
  );
}

/** A bend's curved arrow and label; a pre-bend is a straight arrow labelled "PB", so it can't pass for a bend. */
function BendDrawing({ bend, x, y, staffTop, look }: { bend: Bend; x: number; y: number; staffTop: number; look: TabLook }) {
  const top = staffTop - BEND_RISE;
  const head = (tx: number, ty: number, down = false) => (
    <path d={down ? `M${tx - 4} ${ty - 7} L${tx} ${ty} L${tx + 4} ${ty - 7}` : `M${tx - 4} ${ty + 7} L${tx} ${ty} L${tx + 4} ${ty + 7}`} fill={look.ink} />
  );
  const label = (
    <text x={bend.pre ? x : x + 14} y={top - 9} fontSize={10} fontWeight={700} fill={look.ink} stroke="none" textAnchor="middle">
      {bend.pre ? `PB ${BEND_LABEL[bend.quarters]}` : BEND_LABEL[bend.quarters]}
    </text>
  );
  if (bend.pre) {
    return (
      <g stroke={look.ink} fill="none" strokeWidth={1.2} data-testid="bend">
        <line x1={x} x2={x} y1={y - 8} y2={top + 2} />
        {head(x, top)}
        {bend.release && <path d={`M${x + 2} ${top} Q${x + 14} ${top} ${x + 14} ${y - 8}`} />}
        {bend.release && head(x + 14, y - 8, true)}
        {label}
      </g>
    );
  }
  return (
    <g stroke={look.ink} fill="none" strokeWidth={1.2} data-testid="bend">
      <path d={`M${x + 7} ${y - 2} Q${x + 14} ${y - 2} ${x + 14} ${top + 2}`} />
      {head(x + 14, top)}
      {bend.release && <path d={`M${x + 15} ${top} Q${x + 24} ${top} ${x + 24} ${y - 8}`} />}
      {bend.release && head(x + 24, y - 8, true)}
      {label}
    </g>
  );
}
