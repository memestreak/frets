import { useId, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import {
  beatTicks, columnAccent, isRest, slideDirections, STRING_COUNT, timeAt, TREMOLO_VALUES, tupletGroups, tupletLabel,
  type Bend, type Clip, type Column, type Note, type TimeSignature,
} from './clip';
import {
  barTextX, beamGroups, CAPO_SIZE, capoText, charWidth, CHORD_SIZE, BEAT_TEXT_INSET, BEAT_TEXT_SIZE, GRACE_SIZE, cursorSpot, hitTest, layoutClip, noteLabel, RUN_MARKS, runAt, runLabelWidth, runsIn,
  SECTION_SIZE, sectionBoxes, stringY, TEMPO_SIZE, tempoParts, textAt, type TextHit,
  type Hit, type PlacedBar, type PlacedColumn, type Rows, type RunMark, type System,
} from './layout';

/** The colours a clip is drawn in: tokens on the page, concrete colours in an export. */
export interface TabLook {
  ink: string;
  /** The string lines. */
  line: string;
  /** Text on ink, as in a rehearsal mark's box. */
  paper: string;
}

export const PAGE_LOOK: TabLook = {
  ink: 'var(--ink)',
  line: 'var(--line-strong)',
  paper: 'var(--surface-raised)',
};

const BEND_LABEL: Record<number, string> = { 1: '¼', 2: '½', 4: 'full', 6: '1½', 8: '2' };

/** Where a note was drawn, so the next note on its string can join it. */
interface Spot {
  system: number;
  x: number;
}

/** What the editor shows on the page: the cursor (a column and a string) and the selected columns. */
export interface Highlight {
  cursor: Hit | null;
  /** First and last selected places in the clip, inclusive. */
  range: [number, number] | null;
}

/**
 * A clip drawn as tab: systems of six lines with the notes, their marks
 * above the staff and rhythm stems below. Draws what `layoutClip` places
 * and knows no ASCII. On the page it also draws the editor's `highlight`
 * and says where a press lands with `onPick`.
 */
export function TabClip({ clip, width, look = PAGE_LOOK, title, highlight, errors, onPick, onPickRun, onPickText, onMiss, x, y }: {
  clip: Clip;
  width: number;
  /** Where it sits inside a larger drawing (an exported image). */
  x?: number;
  y?: number;
  look?: TabLook;
  /** Read by screen readers; the drawing itself is hidden from them. */
  title: string;
  highlight?: Highlight;
  /** On the page only: bars with something wrong, and what, drawn as a warning under the bar's start with the words as its tip. */
  errors?: Map<number, string>;
  /** A press on the tab: the column and string under it, and whether Shift was held. */
  onPick?: (hit: Hit, extend: boolean) => void;
  /** A press on a P.M. or let ring line: its mark and the place in the clip of a column under it. */
  onPickRun?: (mark: RunMark, index: number) => void;
  /** A press on a chord name, section or tempo. */
  onPickText?: (hit: TextHit) => void;
  /** A press on neither the staff nor a P.M. or let ring line. */
  onMiss?: () => void;
}) {
  const layout = layoutClip(clip, width);
  /** What a press at a point in the drawing is on. */
  const target = (e: PointerEvent<SVGSVGElement> | MouseEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - box.left;
    const py = e.clientY - box.top;
    const run = onPickRun && !e.shiftKey ? runAt(layout, px, py) : null;
    const text = !run && onPickText && !e.shiftKey ? textAt(layout, px, py) : null;
    return { run, text, hit: run || text ? null : hitTest(layout, px, py) };
  };
  const pick = (e: PointerEvent<SVGSVGElement>) => {
    if (!onPick) return;
    const { run, text, hit } = target(e);
    if (run) onPickRun!(run.mark, run.run.columns[0].index);
    else if (text) onPickText!(text);
    else if (hit) onPick(hit, e.shiftKey);
    else onMiss?.();
  };
  // A press on blank space doesn't take the focus, so no cursor appears there; nor does one on a
  // chord name, section or tempo, whose field has just taken it.
  const keepFocus = (e: MouseEvent<SVGSVGElement>) => {
    const { run, text, hit } = target(e);
    if (text || (!run && !hit)) e.preventDefault();
  };
  const spot = highlight?.cursor ? cursorSpot(layout, highlight.cursor.bar, highlight.cursor.column) : null;
  const previous = previousSpots(layout.systems);
  const slides = slideDirections(clip);
  const lastBar = clip.bars.length - 1;
  const { rows } = layout;
  // The string lines are masked round each note's number; ids made safe for `url(#…)`.
  const maskId = `tab-gaps${useId().replace(/[^\w-]/g, '')}`;
  return (
    <svg
      x={x} y={y} width={width} height={layout.height} viewBox={`0 0 ${width} ${layout.height}`}
      role="img" aria-label={title} fontFamily="var(--font-sans), sans-serif"
      className="block" onPointerDown={onPick ? pick : undefined} onMouseDown={onPick ? keepFocus : undefined}
    >
      {highlight?.range && <SelectionBands layout={layout} range={highlight.range} />}
      {spot && highlight?.cursor && (
        <g transform={`translate(0 ${spot.system * rows.height})`} data-testid="tab-cursor">
          {!highlight.range && (
            <rect x={spot.x - spot.width / 2} y={rows.staffTop - 10} width={spot.width} height={rows.staffBottom - rows.staffTop + 20} fill="var(--primary-soft)" />
          )}
          <rect
            x={spot.x - 12} y={stringY(rows, highlight.cursor.string) - 9} width={24} height={18} rx={4}
            fill="none" stroke="var(--primary)" strokeWidth={1.5}
          />
        </g>
      )}
      {layout.systems.map((system, si) => (
        <g key={si} transform={`translate(0 ${si * rows.height})`} data-testid="tab-system">
          <SystemDrawing
            system={system} rows={rows} index={si} clip={clip} look={look} names={layout.names} slides={slides}
            previous={previous} lastBar={lastBar} maskId={`${maskId}-${si}`}
          />
          {errors && system.bars.map(bar => {
            const error = errors.get(bar.index);
            return error ? <Warning key={`warning-${bar.index}`} x={bar.x0 + WARNING_INSET} y={rows.tuplet - 4} text={error} /> : null;
          })}
        </g>
      ))}
    </svg>
  );
}

/** How far in from a bar's start its warning's middle is drawn: clear of the bar line and the first stem. */
const WARNING_INSET = 9;

/**
 * A small triangle with "!" under a bar's start, in the danger colour, whose tip says what is wrong.
 * Only the page draws it; screen readers get the same words from the line under the clip.
 */
function Warning({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <g data-tip={text} data-testid="bar-warning" style={{ cursor: 'help' }}>
      {/* A bigger, invisible target round the small mark, so the mouse finds it. */}
      <rect x={x - 10} y={y - 10} width={20} height={20} fill="transparent" />
      <path d={`M${x} ${y - 6} L${x + 6.5} ${y + 5.5} L${x - 6.5} ${y + 5.5} Z`} fill="var(--danger)" strokeLinejoin="round" stroke="var(--danger)" strokeWidth={1.5} />
      <text x={x} y={y + 4.2} fontSize={8.5} fontWeight={800} fill="var(--surface-raised)" textAnchor="middle">!</text>
    </g>
  );
}

/**
 * A soft band behind the selected columns: one unbroken band on each line of tab, from the first
 * selected column there to the last, so it runs across the bar lines between them (Jeremy, 2026-10-26).
 */
function SelectionBands({ layout, range: [from, to] }: { layout: ReturnType<typeof layoutClip>; range: [number, number] }) {
  const { rows } = layout;
  return (
    <g data-testid="tab-selection">
      {layout.systems.map((system, si) => {
        const chosen = system.bars.flatMap(bar => bar.columns).filter(c => c.index >= from && c.index <= to);
        if (chosen.length === 0) return null;
        const first = chosen[0];
        const last = chosen[chosen.length - 1];
        const x0 = first.x - first.width / 2;
        return (
          <rect
            key={si} x={x0} y={si * rows.height + rows.staffTop - 10} width={last.x + last.width / 2 - x0}
            height={rows.staffBottom - rows.staffTop + 20} fill="var(--primary-soft)"
          />
        );
      })}
    </g>
  );
}

/** For every note, where the note before it on the same string was drawn. */
function previousSpots(systems: System[]): Map<Note, Spot> {
  const out = new Map<Note, Spot>();
  const last: (Spot | null)[] = Array(STRING_COUNT).fill(null);
  systems.forEach((system, si) => {
    for (const bar of system.bars) {
      for (const placed of bar.columns) {
        placed.column.notes.forEach((note, s) => {
          if (!note) return;
          const before = last[s];
          if (before) out.set(note, before);
          last[s] = { system: si, x: placed.x };
        });
      }
    }
  });
  return out;
}

function SystemDrawing({ system, rows, index, clip, look, names, previous, slides, lastBar, maskId }: {
  system: System;
  rows: Rows;
  /** The mask that keeps the string lines out from behind the numbers. */
  maskId: string;
  index: number;
  clip: Clip;
  look: TabLook;
  names: string[] | null;
  previous: Map<Note, Spot>;
  slides: Map<Note, 'up' | 'down'>;
  lastBar: number;
}) {
  const end = system.bars[system.bars.length - 1].x1;
  const parts: ReactNode[] = [];

  // The staff: the time signature and names in front of it, then its lines with TAB on them, as tab is printed. The lines stop short of every note's number,
  // so nothing need be painted behind it and the cursor's band or a transparent image shows through.
  parts.push(
    <mask key="gaps" id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={end + 1} height={rows.height}>
      <rect width={end + 1} height={rows.height} fill="#fff" />
      {system.bars.flatMap(bar => bar.columns.flatMap(placed => placed.column.notes.map((note, s) => {
        if (!note) return null;
        const lw = labelWidth(note, placed.column);
        return <rect key={`${placed.index}-${s}`} x={placed.x - lw / 2} y={stringY(rows, s) - 7} width={lw} height={14} fill="#000" />;
      })))}
    </mask>,
  );
  for (let s = 0; s < STRING_COUNT; s++) {
    parts.push(
      <line
        key={`string-${s}`} x1={system.lineStart} x2={end} y1={stringY(rows, s)} y2={stringY(rows, s)}
        stroke={look.line} strokeWidth={1} mask={`url(#${maskId})`}
      />,
    );
    if (names) {
      parts.push(
        <text key={`name-${s}`} x={system.lineStart - 10} y={stringY(rows, s) + 4} fontSize={10} fill={look.ink} textAnchor="middle">{names[s]}</text>,
      );
    }
  }
  parts.push(
    <line key="open" x1={system.lineStart} x2={system.lineStart} y1={rows.staffTop} y2={rows.staffBottom} stroke={look.ink} strokeWidth={1.5} />,
  );
  const clefX = system.lineStart + 13;
  ['T', 'A', 'B'].forEach((letter, k) => parts.push(
    <text key={`clef-${letter}`} x={clefX} y={rows.staffTop + 21 + k * 20} fontSize={18} fontWeight={700} fill={look.ink} textAnchor="middle">{letter}</text>,
  ));
  // The time signature stands in front of the staff, and a change just inside the bar it starts.
  if (system.timeX !== null) parts.push(<TimeNumbers key="time" time={clip.time} x={system.timeX} rows={rows} look={look} />);
  for (const bar of system.bars) {
    if (bar.timeX !== null && bar.bar.time) {
      parts.push(<TimeNumbers key={`time-${bar.index}`} time={bar.bar.time} x={bar.timeX} rows={rows} look={look} />);
    }
  }

  for (const bar of system.bars) parts.push(<BarDrawing key={`bar-${bar.index}`} bar={bar} rows={rows} look={look} final={bar.index === lastBar} />);

  // Endings: one bracket over each run of bars with the same ending.
  system.bars.forEach((bar, k) => {
    const n = bar.bar.ending;
    if (!n || system.bars[k - 1]?.bar.ending === n) return;
    let last = k;
    while (system.bars[last + 1]?.bar.ending === n) last++;
    const x0 = bar.x0 + 4;
    const x1 = system.bars[last].x1 - 4;
    const y = rows.endings!;
    parts.push(
      <g key={`ending-${bar.index}`} stroke={look.ink} fill="none" strokeWidth={1.2} data-testid="ending">
        <polyline points={`${x0},${y + 8} ${x0},${y - 4} ${x1},${y - 4}`} />
        <text x={x0 + 4} y={y + 6} fontSize={11} fontWeight={700} fill={look.ink} stroke="none">{n}.</text>
      </g>,
    );
  });

  // The capo, over the start of the first line, as printed tab has it.
  if (system.first && clip.capo && rows.capo !== null) {
    parts.push(
      <text key="capo" x={system.lineStart} y={rows.capo + 4} fontSize={CAPO_SIZE} fontWeight={700} fill={look.ink} data-testid="capo">
        {capoText(clip.capo)}
      </text>,
    );
  }

  // Sections and tempos, over the bar they start at; chord names and free text over their columns.
  for (const bar of system.bars) {
    const x0 = barTextX(bar);
    const { section, tempo } = bar.bar;
    if (section && rows.section !== null) {
      const y = rows.section;
      const { marker, text } = sectionBoxes(section);
      parts.push(
        <g key={`section-${bar.index}`} data-testid="section">
          {marker && (
            <>
              <rect x={x0} y={y - 8} width={marker.width} height={16} rx={2} fill={look.ink} />
              <text x={x0 + marker.width / 2} y={y + 4} fontSize={SECTION_SIZE} fontWeight={700} fill={look.paper} textAnchor="middle">{section.marker}</text>
            </>
          )}
          <rect x={x0 + text.x} y={y - 8} width={text.width} height={16} rx={2} fill="none" stroke={look.ink} strokeWidth={1.2} />
          <text x={x0 + text.x + 5} y={y + 4} fontSize={SECTION_SIZE} fontWeight={700} fill={look.ink}>{section.text}</text>
        </g>,
      );
    }
    if (tempo && rows.tempo !== null) {
      const y = rows.tempo;
      const { numberX, labelX } = tempoParts(tempo);
      parts.push(
        <g key={`tempo-${bar.index}`} data-testid="tempo" fill={look.ink}>
          {/* A quarter note: its head and stem. */}
          <ellipse cx={x0 + 2} cy={y + 2} rx={3.2} ry={2.4} transform={`rotate(-20 ${x0 + 2} ${y + 2})`} />
          <line x1={x0 + 5} x2={x0 + 5} y1={y + 1} y2={y - 9} stroke={look.ink} strokeWidth={1.1} />
          <text x={x0 + numberX} y={y + 4} fontSize={TEMPO_SIZE}>{` = ${tempo.bpm}`}</text>
          {tempo.label && <text x={x0 + labelX} y={y + 4} fontSize={TEMPO_SIZE} fontWeight={700}>{tempo.label}</text>}
        </g>,
      );
    }
    if (rows.chords !== null) {
      for (const placed of bar.columns) {
        if (!placed.column.chord) continue;
        parts.push(
          <text
            key={`chord-${placed.index}`} x={placed.x} y={rows.chords + 4} fontSize={CHORD_SIZE} fontWeight={700} fill={look.ink}
            textAnchor="middle" data-testid="chord-name"
          >
            {placed.column.chord}
          </text>,
        );
      }
    }
    if (rows.text !== null) {
      for (const placed of bar.columns) {
        if (!placed.column.text) continue;
        parts.push(
          <text
            key={`text-${placed.index}`} x={placed.x - BEAT_TEXT_INSET} y={rows.text + 4} fontSize={BEAT_TEXT_SIZE} fontStyle="italic"
            fill={look.ink} data-testid="beat-text"
          >
            {placed.column.text}
          </text>,
        );
      }
    }
  }

  // Palm mute and let ring: a label, then a dashed line over the run of columns that have it.
  for (const { mark, label, has } of RUN_MARKS) {
    const y = rows[mark];
    if (y === null) continue;
    const name = mark === 'palmMute' ? 'palm-mute' : 'let-ring';
    for (const { columns, x0, x1 } of runsIn(system, has)) {
      const lw = runLabelWidth(label);
      // A run shorter than its label is the label alone: its line and end tick would cross the word.
      const longer = x1 > x0 + lw + 2;
      parts.push(
        <g key={`${name}-${columns[0].index}`} data-testid={name}>
          <text x={x0} y={y + 4} fontSize={10} fontWeight={700} fill={look.ink}>{label}</text>
          {longer && <line x1={x0 + lw} x2={x1} y1={y} y2={y} stroke={look.ink} strokeDasharray="3 3" />}
          {longer && <line x1={x1} x2={x1} y1={y - 4} y2={y + 4} stroke={look.ink} />}
        </g>,
      );
    }
  }

  for (const bar of system.bars) {
    for (const placed of bar.columns) {
      parts.push(
        <ColumnDrawing
          key={`col-${bar.index}-${placed.x}`} placed={placed} rows={rows} system={index} look={look}
          previous={previous} slides={slides} staffStart={system.staffStart}
        />,
      );
    }
    parts.push(<Stems key={`stems-${bar.index}`} bar={bar} rows={rows} beat={beatTicks(timeAt(clip, bar.index))} look={look} />);
  }

  return <>{parts}</>;
}

/** A time signature's two numbers, close together round the staff's middle. */
function TimeNumbers({ time, x, rows, look }: { time: TimeSignature; x: number; rows: Rows; look: TabLook }) {
  const middle = (rows.staffTop + rows.staffBottom) / 2;
  return (
    <g fontSize={20} fontWeight={700} fill={look.ink} textAnchor="middle" data-testid="time-signature">
      <text x={x} y={middle - 2}>{time.beats}</text>
      <text x={x} y={middle + 16}>{time.value}</text>
    </g>
  );
}

function BarDrawing({ bar, rows, look, final }: { bar: PlacedBar; rows: Rows; look: TabLook; final: boolean }) {
  const { x0, x1 } = bar;
  const dots = (x: number) => [1.5, 3.5].map(k => (
    <circle key={`${x}-${k}`} cx={x} cy={stringY(rows, k)} r={2.2} fill={look.ink} />
  ));
  const vertical = (x: number, w: number) => (
    <line x1={x} x2={x} y1={rows.staffTop} y2={rows.staffBottom} stroke={look.ink} strokeWidth={w} />
  );
  const thickEnd = final || bar.bar.repeatEnd !== undefined;
  return (
    <g>
      {bar.bar.repeatStart && (
        <g data-testid="repeat-start">
          {vertical(x0 + 2, 3)}
          {vertical(x0 + 7, 1)}
          {dots(x0 + 12)}
        </g>
      )}
      {thickEnd ? (
        <g>
          {vertical(x1 - 6, 1)}
          {vertical(x1 - 1.5, 3)}
          {bar.bar.repeatEnd !== undefined && <g data-testid="repeat-end">{dots(x1 - 11)}</g>}
        </g>
      ) : vertical(x1, 1)}
      {bar.bar.repeatEnd !== undefined && bar.bar.repeatEnd !== 2 && (
        <text x={x1} y={rows.endings! + 6} fontSize={11} fontWeight={700} fill={look.ink} textAnchor="end">
          ×{bar.bar.repeatEnd}
        </text>
      )}
    </g>
  );
}

/** How much of the string line a note's number keeps clear. */
function labelWidth(note: Note, column: Column): number {
  return noteLabel(note).length * (charWidth(column) - 0.5) + 4;
}

function ColumnDrawing({ placed, rows, system, look, previous, slides, staffStart }: {
  placed: PlacedColumn;
  rows: Rows;
  system: number;
  look: TabLook;
  previous: Map<Note, Spot>;
  slides: Map<Note, 'up' | 'down'>;
  staffStart: number;
}) {
  const { column, x } = placed;
  const parts: ReactNode[] = [];
  if (column.stroke) {
    const sy = rows.strokes!;
    parts.push(column.stroke === 'down'
      ? <path key="stroke" d={`M${x - 4} ${sy + 4} v-7 h8 v7`} fill="none" stroke={look.ink} strokeWidth={1.5} />
      : <path key="stroke" d={`M${x - 4} ${sy - 4} L${x} ${sy + 4} L${x + 4} ${sy - 4}`} fill="none" stroke={look.ink} strokeWidth={1.5} />);
  }
  parts.push(...columnMarks(column, x, rows, look));
  column.notes.forEach((note, s) => {
    if (!note) return;
    const y = stringY(rows, s);
    const label = noteLabel(note);
    const before = previous.get(note);
    // Where the joined-from note sits on this system, or the staff's start if it was on the line before.
    const fromX = before && before.system === system ? before.x : staffStart;
    if (note.legato) {
      const mid = (fromX + x) / 2;
      parts.push(
        <g key={`legato-${s}`}>
          <path d={`M${fromX + 4} ${y - 8} Q${mid} ${y - 18} ${x - 4} ${y - 8}`} fill="none" stroke={look.ink} strokeWidth={1.1} />
          <text x={mid} y={y - 17} fontSize={9} fontWeight={700} fill={look.ink} textAnchor="middle">{note.legato.toUpperCase()}</text>
        </g>,
      );
    }
    if (note.slide) {
      // Shift and legato slides are drawn alike for now; a slide from below or above starts just before the note.
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
    // Every tie gets its arc, even across a held chord: a number in brackets without one is a ghost note.
    if (note.tie && before) {
      parts.push(
        <path key={`tie-${s}`} d={`M${fromX + 4} ${y + 7} Q${(fromX + x) / 2} ${y + 15} ${x - 10} ${y + 7}`} fill="none" stroke={look.ink} strokeWidth={1.1} />,
      );
    }
    // A grace note's number is drawn small.
    parts.push(column.grace
      ? <text key={`fret-${s}`} x={x} y={y + 3.2} fontSize={GRACE_SIZE} fontWeight={600} fill={look.ink} textAnchor="middle" data-testid="grace">{label}</text>
      : <text key={`fret-${s}`} x={x} y={y + 4.5} fontSize={13} fontWeight={600} fill={look.ink} textAnchor="middle">{label}</text>);
    if (note.bend) parts.push(<BendDrawing key={`bend-${s}`} bend={note.bend} x={x} y={y} staffTop={rows.staffTop} look={look} />);
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

/** The marks drawn once over a column, each in its own row: vibrato, "P.H.", an accent and a staccato dot. */
function columnMarks(column: Column, x: number, rows: Rows, look: TabLook): ReactNode[] {
  const notes = column.notes.filter((n): n is Note => n !== null);
  const parts: ReactNode[] = [];
  const vibrato = notes.some(n => n.vibrato === 'wide') ? 'wide' : notes.some(n => n.vibrato) ? 'slight' : null;
  if (vibrato) {
    // A wide vibrato's wave is taller and longer, in fewer turns.
    const [width, height, turns] = vibrato === 'wide' ? [8, 8, 3] : [6, 4, 4];
    let d = `M${x + 4} ${rows.vibrato}`;
    for (let k = 0; k < turns; k++) d += ` q${width / 2} -${height} ${width} 0 q${width / 2} ${height} ${width} 0`;
    parts.push(<path key="vibrato" d={d} fill="none" stroke={look.ink} strokeWidth={vibrato === 'wide' ? 2 : 1.2} data-testid="vibrato" />);
  }
  if (notes.some(n => n.harmonic === 'pinch')) {
    parts.push(
      <text key="pinch" x={x} y={rows.harmonics! + 4} fontSize={10} fontWeight={700} fill={look.ink} textAnchor="middle" data-testid="pinch-harmonic">P.H.</text>,
    );
  }
  const accent = columnAccent(column);
  const staccato = notes.some(n => n.staccato);
  if (accent || staccato) {
    const y = rows.accents!;
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

/** A bend's curved arrow and label; a pre-bend is a straight arrow labelled "PB", so it can't pass for a bend. */
function BendDrawing({ bend, x, y, staffTop, look }: { bend: Bend; x: number; y: number; staffTop: number; look: TabLook }) {
  const top = staffTop - 10;
  const head = (tx: number, ty: number, down = false) => (
    <path d={down ? `M${tx - 4} ${ty - 7} L${tx} ${ty} L${tx + 4} ${ty - 7}` : `M${tx - 4} ${ty + 7} L${tx} ${ty} L${tx + 4} ${ty + 7}`} fill={look.ink} />
  );
  const label = (
    <text x={bend.pre ? x : x + 14} y={top - 4} fontSize={10} fontWeight={700} fill={look.ink} stroke="none" textAnchor="middle">
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

/** Stems, beams, flags, dots, tremolo slashes, tuplet numbers and rests under the staff; grace notes get none. */
function Stems({ bar, rows, beat, look }: { bar: PlacedBar; rows: Rows; beat: number; look: TabLook }) {
  const parts: ReactNode[] = [];
  const groups = beamGroups(bar, beat);
  const grouped = new Map<Column, PlacedColumn[]>();
  for (const g of groups) for (const p of g.columns) grouped.set(p.column, g.columns);

  for (const placed of bar.columns) {
    const { column, x } = placed;
    const { value, dots } = column.duration;
    const key = `${x}`;
    if (column.grace) continue;
    if (column.tremolo && !isRest(column)) {
      // Tremolo picking: a slash across the stem for each beam of the speed, one for eighths up to three for thirty-seconds.
      // They start near the stem's top: a half note's short stem, or where a stem would be for a whole note.
      const slashes = TREMOLO_VALUES.indexOf(column.tremolo) + 1;
      const top = value === 2 ? rows.stemBottom - 12 : rows.stemTop + (value === 1 ? 2 : 0);
      for (let k = 0; k < slashes; k++) {
        const ty = top + 3 + k * 4;
        parts.push(<line key={`tremolo-${key}-${k}`} x1={x - 4} x2={x + 4} y1={ty + 2} y2={ty - 2} stroke={look.ink} strokeWidth={2} data-testid="tremolo" />);
      }
    }
    if (isRest(column)) {
      parts.push(<Rest key={`rest-${key}`} x={x} y={rows.stemTop + 10} value={value} look={look} />);
    } else if (value === 2) {
      parts.push(<line key={`stem-${key}`} x1={x} x2={x} y1={rows.stemBottom - 12} y2={rows.stemBottom} stroke={look.ink} strokeWidth={1.3} />);
    } else if (value >= 4) {
      parts.push(<line key={`stem-${key}`} x1={x} x2={x} y1={rows.stemTop} y2={rows.stemBottom} stroke={look.ink} strokeWidth={1.3} />);
      const group = grouped.get(column);
      if (value >= 8 && (!group || group.length === 1)) {
        // A lone eighth or shorter gets its flags.
        for (let f = 0; f < beamCount(value); f++) {
          const fy = rows.stemBottom - f * 6;
          parts.push(<path key={`flag-${key}-${f}`} d={`M${x} ${fy} q6 -2 8 -9`} fill="none" stroke={look.ink} strokeWidth={1.5} />);
        }
      }
    }
    // A note's dots sit by its stem's foot; a rest's beside the rest, clear of a whole or half rest's line.
    const rest = isRest(column);
    const dotX = rest ? x + (value <= 2 ? 13 : 8) : x + 5;
    const dotY = rest ? rows.stemTop + (value <= 2 ? 5 : 10) : rows.stemBottom - 3;
    for (let d = 0; d < dots; d++) {
      parts.push(<circle key={`dot-${key}-${d}`} cx={dotX + d * 5} cy={dotY} r={1.8} fill={look.ink} />);
    }
  }

  for (const g of groups) {
    if (g.columns.length < 2) continue;
    const first = g.columns[0].x;
    const last = g.columns[g.columns.length - 1].x;
    parts.push(<line key={`beam-${first}`} x1={first} x2={last} y1={rows.stemBottom} y2={rows.stemBottom} stroke={look.ink} strokeWidth={3.2} />);
    // The second, third and fourth beams join neighbours that have them too; a note alone in having
    // one gets a short stub toward its neighbour.
    for (let level = 2; level <= 4; level++) {
      const has = (p?: PlacedColumn) => p !== undefined && beamCount(p.column.duration.value) >= level;
      const y = rows.stemBottom - (level - 1) * 6;
      g.columns.forEach((p, k) => {
        if (!has(p)) return;
        const next = g.columns[k + 1];
        const prev = g.columns[k - 1];
        if (has(next)) {
          parts.push(<line key={`beam${level}-${p.x}`} x1={p.x} x2={next.x} y1={y} y2={y} stroke={look.ink} strokeWidth={3.2} />);
        } else if (!has(prev)) {
          const toward = next ? 7 : -7;
          parts.push(<line key={`stub${level}-${p.x}`} x1={p.x} x2={p.x + toward} y1={y} y2={y} stroke={look.ink} strokeWidth={3.2} />);
        }
      });
    }
  }

  // Each tuplet group's number in its middle: 3 under a triplet, 9 under nine, 3:4 under three in the
  // time of four. Where one beam doesn't already join the whole group (a rest in it, or quarter notes),
  // a bracket across every member shows what the number counts. A group short of notes is drawn as it
  // is, and the warning under the bar says so.
  const cols = bar.columns.filter(p => !p.column.grace);
  for (const { from, to, duration } of tupletGroups(cols.map(p => p.column))) {
    const label = tupletLabel(duration);
    const members = cols.slice(from, to + 1);
    const beam = grouped.get(members[0].column);
    const beamed = members.length > 1 && members.every(p => grouped.get(p.column) === beam);
    const x0 = cols[from].x - 5;
    const x1 = cols[to].x + 5;
    const mid = (x0 + x1) / 2;
    const gap = label.length * 3.5 + 4;
    const y = rows.tuplet - 4;
    parts.push(
      <g key={`tuplet-${cols[from].x}`} data-testid="tuplet-group">
        {!beamed && (
          <path
            d={`M${x0} ${y - 4} V${y} H${Math.max(x0, mid - gap)} M${Math.min(x1, mid + gap)} ${y} H${x1} V${y - 4}`}
            fill="none" stroke={look.ink} strokeWidth={1} data-testid="tuplet-bracket"
          />
        )}
        <text x={mid} y={rows.tuplet} fontSize={10} fontStyle="italic" fontWeight={700} fill={look.ink} textAnchor="middle" data-testid="tuplet">{label}</text>
      </g>,
    );
  }

  return <g>{parts}</g>;
}

function Rest({ x, y, value, look }: { x: number; y: number; value: number; look: TabLook }) {
  // A whole rest hangs from a line, a half rest sits on one. Under the tab there is no staff line to
  // show which, so each gets a short line of its own, as rests written outside a staff do.
  if (value === 1 || value === 2) {
    const line = y - 3;
    return (
      <g fill={look.ink} data-testid="rest">
        <line x1={x - 9} x2={x + 9} y1={line} y2={line} stroke={look.ink} strokeWidth={1.2} />
        <rect x={x - 6} y={value === 1 ? line : line - 5} width={12} height={5} />
      </g>
    );
  }
  if (value === 4) {
    return (
      <path
        d={`M${x - 2} ${y - 12} l5 6 l-5 5 l5 6 q-6 -2 -4 5`} fill="none" stroke={look.ink} strokeWidth={2}
        strokeLinejoin="round" data-testid="rest"
      />
    );
  }
  // Eighth rests and shorter: a slanted stem with a flag for each beam, the stem longer for three or four.
  const flags = beamCount(value);
  const length = 16 + Math.max(0, flags - 2) * 6;
  return (
    <g fill={look.ink} stroke={look.ink} data-testid="rest">
      <line x1={x + 3} y1={y - 8} x2={x + 3 - length * 5 / 16} y2={y - 8 + length} strokeWidth={1.4} />
      {Array.from({ length: flags }, (_, f) => <circle key={f} cx={x - 2 - f * 2} cy={y - 7 + f * 6} r={2.4} />)}
    </g>
  );
}

/** Beams (or flags) a note value has: one for an eighth, two for a sixteenth, up to four for a sixty-fourth. */
function beamCount(value: number): number {
  return value >= 8 ? Math.log2(value) - 2 : 0;
}

