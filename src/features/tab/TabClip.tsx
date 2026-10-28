import { useId, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import {
  beatTicks, bendCarries, columnAccent, isRest, slideDirections, STRING_COUNT, timeAt, TREMOLO_VALUES, tupletGroups, tupletLabel,
  type Bend, type Clip, type Column, type Note, type TimeSignature,
} from './clip';
import {
  barTextX, beamGroups, BEND_RISE, boundaryAt, endingSpans, CAPO_SIZE, capoText, charWidth, CHORD_SIZE, BEAT_TEXT_INSET, BEAT_TEXT_SIZE, GRACE_SIZE, cursorSpot, hitTest, layoutClip, textBox, noteLabel, RUN_MARKS, runAt, runLabelWidth, runsIn,
  SECTION_BOX_HEIGHT, SECTION_PAD, SECTION_SIZE, sectionBoxes, stringY, TEMPO_SIZE, tempoParts, textAt, type TextHit, type WordHit,
  type Hit, staffAt, type StaffHit, type Parts, type PlacedBar, type PlacedColumn, type Rows, type RunMark, type Spot, type System, previousSpots, vibratoRuns, legatoArcs, type LegatoArc,
} from './layout';
import { StaffCursor, StaffDrawing } from './StaffDrawing';
import { staffCursorPlace } from './staffEntry';
import { staffMarks } from './staffMarks';
import { GLYPHS } from './smufl';
import { markAt, markBox, vibratoWave, type MarkHit } from './marks';

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

/** What the editor shows on the page: the cursor (a column and a string) and the selected columns. */
export interface Highlight {
  cursor: Hit | null;
  /** First and last selected places in the clip, inclusive. */
  range: [number, number] | null;
  /** The cursor is on its column only, with no string picked: the column is tinted, no string boxed. */
  columnOnly?: boolean;
  /** The staff's own cursor on the cursor's column: the sounding pitch Enter would put there (issue #136). */
  staffPitch?: number | null;
}

/**
 * A clip drawn as tab: systems of six lines with the notes, their marks
 * above the staff and rhythm stems below. Draws what `layoutClip` places
 * and knows no ASCII. On the page it also draws the editor's `highlight`
 * and says where a press lands with `onPick`.
 */
export function TabClip({ clip, width, parts = 'tab', look = PAGE_LOOK, title, highlight, picked, errors, onPick, onPickRun, onPickText, onPickMark, onPickColumn, onPickStaff, onMiss, columnReach = 0, x, y }: {
  clip: Clip;
  width: number;
  /** The tab, the notation staff, or both (the staff over the tab). */
  parts?: Parts;
  /** Where it sits inside a larger drawing (an exported image). */
  x?: number;
  y?: number;
  look?: TabLook;
  /** Read by screen readers; the drawing itself is hidden from them. */
  title: string;
  highlight?: Highlight;
  /** On the page only: the picked chord name, text, section, tempo or capo, or technique mark, outlined. */
  picked?: WordHit | MarkHit | null;
  /** On the page only: bars with something wrong, and what, drawn as a warning under the bar's start with the words as its tip. */
  errors?: Map<number, string>;
  /** A press on the tab: the column and string under it, and whether Shift was held. */
  onPick?: (hit: Hit, extend: boolean) => void;
  /** A press on a P.M. or let ring line: its mark and the place in the clip of a column under it. */
  onPickRun?: (mark: RunMark, index: number) => void;
  /** A press on a chord name, section or tempo, or a time or key signature; with the press, in the drawing's own units. */
  onPickText?: (hit: TextHit, at: { x: number; y: number }) => void;
  /** A press on a technique mark: a bend, slide, tie, vibrato, accent… (`marks.ts`). */
  onPickMark?: (hit: MarkHit) => void;
  /**
   * A press above or below the staff, off any mark or label: the gap between columns there, as the
   * index of the column after it (the column count past the last); `extend` when Shift was held.
   */
  onPickColumn?: (index: number, extend: boolean) => void;
  /** A press on the notation staff: the column and line or space (and string, on a head); `extend` with Shift. */
  onPickStaff?: (hit: StaffHit, extend: boolean) => void;
  /** A press on neither the staff nor a P.M. or let ring line (nor, with `onPickColumn`, a column). */
  onMiss?: () => void;
  /**
   * How far above and below the drawing a press still picks a column with `onPickColumn` (Jeremy,
   * 2026-10-27: "more clickable area above and below"), in pixels; the page's margin round the clip.
   */
  columnReach?: number;
}) {
  const layout = layoutClip(clip, width, parts);
  const pickedBox = !picked ? null : picked.kind === 'mark' ? markBox(layout, picked) : textBox(layout, picked, clip.capo ?? null);
  /** What a press at a point in the drawing is on. */
  const target = (e: PointerEvent<SVGSVGElement> | MouseEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - box.left;
    const py = e.clientY - box.top;
    // Above or below the drawing: only a column, as on the blank band at the edge of the first or last line.
    if (py < 0 || py >= layout.height) {
      const edge = py < 0 ? 0 : layout.height - 1;
      const column = onPickColumn ? boundaryAt(layout, px, edge) : null;
      return { run: null, text: null, mark: null, staff: null, hit: null, column, px, py };
    }
    const run = onPickRun && !e.shiftKey ? runAt(layout, px, py) : null;
    const text = !run && onPickText && !e.shiftKey ? textAt(layout, px, py) : null;
    const mark = !run && !text && onPickMark && !e.shiftKey ? markAt(layout, px, py) : null;
    const staff = run || text || mark || !onPickStaff ? null : staffAt(layout, px, py);
    const hit = run || text || mark || staff ? null : hitTest(layout, px, py);
    const column = run || text || mark || staff || hit || !onPickColumn ? null : boundaryAt(layout, px, py);
    return { run, text, mark, staff, hit, column, px, py };
  };
  const pick = (e: PointerEvent<SVGSVGElement>) => {
    if (!onPick) return;
    const { run, text, mark, staff, hit, column, px, py } = target(e);
    if (run) onPickRun!(run.mark, run.run.columns[0].index);
    else if (text) onPickText!(text, { x: px, y: py });
    else if (mark) onPickMark!(mark);
    else if (staff) onPickStaff!(staff, e.shiftKey);
    else if (hit) onPick(hit, e.shiftKey);
    else if (column !== null) onPickColumn!(column, e.shiftKey);
    else onMiss?.();
  };
  // A press on blank space (or above or below the staff) doesn't take the focus, so no cursor
  // appears there; nor does one on a chord name, section or tempo, whose field has just taken it.
  const keepFocus = (e: MouseEvent<SVGSVGElement>) => {
    const { run, text, mark, staff, hit } = target(e);
    if (text || (!run && !mark && !staff && !hit)) e.preventDefault();
  };
  const spot = highlight?.cursor ? cursorSpot(layout, highlight.cursor.bar, highlight.cursor.column) : null;
  const previous = previousSpots(layout.systems);
  const onStaff = layout.rows.score ? staffMarks(layout) : null;
  const slides = slideDirections(clip);
  const carries = bendCarries(clip);
  const arcs = legatoArcs(layout.systems);
  const lastBar = clip.bars.length - 1;
  const { rows } = layout;
  // The string lines are masked round each note's number; ids made safe for `url(#…)`.
  const maskId = `tab-gaps${useId().replace(/[^\w-]/g, '')}`;
  return (
    <svg
      x={x} y={y} width={width} height={layout.height} viewBox={`0 0 ${width} ${layout.height}`}
      role="img" aria-label={title} fontFamily="var(--font-sans), sans-serif"
      className="block" onPointerDown={onPick ? pick : undefined} onMouseDown={onPick ? keepFocus : undefined}
      style={columnReach ? { overflow: 'visible' } : undefined}
    >
      {columnReach > 0 && (
        // Takes the presses just above and below the drawing; nothing is drawn.
        <rect x={0} y={-columnReach} width={width} height={layout.height + 2 * columnReach} fill="transparent" data-testid="column-reach" />
      )}
      {highlight?.range && <SelectionBands layout={layout} range={highlight.range} />}
      {pickedBox && (
        <rect
          x={pickedBox.x} y={pickedBox.y} width={pickedBox.width} height={pickedBox.height} rx={4}
          fill="var(--primary-soft)" stroke="var(--primary)" strokeWidth={1.5} data-testid={picked?.kind === 'mark' ? 'picked-mark' : 'picked-word'}
        />
      )}
      {spot && highlight?.cursor && (
        <g transform={`translate(0 ${spot.system * rows.height})`} data-testid="tab-cursor">
          {!highlight.range && (
            <rect x={spot.x - spot.width / 2} y={rows.bandTop} width={spot.width} height={rows.bandBottom - rows.bandTop} fill="var(--primary-soft)" />
          )}
          {!highlight.columnOnly && rows.tab && (
            <rect
              x={spot.x - 12} y={stringY(rows, highlight.cursor.string) - 9} width={24} height={18} rx={4}
              fill="none" stroke="var(--primary)" strokeWidth={1.5}
            />
          )}
        </g>
      )}
      {layout.systems.map((system, si) => (
        <g key={si} transform={`translate(0 ${si * rows.height})`} data-testid="tab-system">
          <SystemDrawing
            system={system} rows={rows} index={si} clip={clip} look={look} names={layout.names} slides={slides}
            previous={previous} carries={carries} legato={arcs.filter(a => a.system === si)} lastBar={lastBar} maskId={`${maskId}-${si}`}
          />
          {rows.score && onStaff && (
            <StaffDrawing system={system} score={rows.score} clip={clip} look={look} lastBar={lastBar} marks={onStaff[si]} />
          )}
          {rows.score && spot?.system === si && highlight?.cursor && highlight.staffPitch != null && (
            <StaffCursor x={spot.x} score={rows.score} {...staffCursorPlace(clip, highlight.cursor.bar, highlight.staffPitch)} />
          )}
          {rows.score && rows.tab && <StaffJoin x={system.lineStart} top={rows.score.top} bottom={rows.staffBottom} look={look} />}
          {errors && system.bars.map(bar => {
            const error = errors.get(bar.index);
            // Under the rhythm: the tab's stems, or the tab or the staff when it has none.
            const y = rows.tabStems ? rows.tuplet - 4 : rows.height - 10;
            return error ? <Warning key={`warning-${bar.index}`} x={bar.x0 + WARNING_INSET} y={y} text={error} /> : null;
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
            key={si} x={x0} y={si * rows.height + rows.bandTop} width={last.x + last.width / 2 - x0}
            height={rows.bandBottom - rows.bandTop} fill="var(--primary-soft)"
          />
        );
      })}
    </g>
  );
}

function SystemDrawing({ system, rows, index, clip, look, names, previous, slides, carries, legato, lastBar, maskId }: {
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
  carries: Map<Note, 'hold' | 'release'>;
  /** This line's arcs over hammer-ons, pull-offs and legato slides. */
  legato: LegatoArc[];
  lastBar: number;
}) {
  const end = system.bars[system.bars.length - 1].x1;
  const parts: ReactNode[] = [];
  const words = <SystemWords system={system} rows={rows} clip={clip} look={look} />;
  const rowMarks = <SystemRowMarks system={system} rows={rows} look={look} />;
  // The staff alone: the words over it and the marks under it, and no tab.
  if (!rows.tab) return <>{words}{rowMarks}</>;

  // The staff: the time signature and names in front of it, then its lines with TAB on them, as tab is printed. The lines stop short of every note's number,
  // so nothing need be painted behind it and the cursor's band or a transparent image shows through.
  parts.push(
    <mask key="gaps" id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={end + 1} height={rows.height}>
      <rect width={end + 1} height={rows.height} fill="#fff" />
      {system.bars.flatMap(bar => bar.columns.flatMap(placed => placed.column.notes.map((note, s) => {
        if (!note) return null;
        // A released bend's note has no number: its arrow comes down to the string.
        const lw = carries.get(note) === 'release' ? 0 : labelWidth(note, placed.column);
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
  // The time signature stands in front of the staff, and a change just inside the bar it starts; under
  // the notation staff, only on that staff (Jeremy, 2026-10-27).
  if (!rows.score && system.timeX !== null) parts.push(<TimeNumbers key="time" time={clip.time} x={system.timeX} rows={rows} look={look} />);
  for (const bar of rows.score ? [] : system.bars) {
    if (bar.timeX !== null && bar.bar.time) {
      parts.push(<TimeNumbers key={`time-${bar.index}`} time={bar.bar.time} x={bar.timeX} rows={rows} look={look} />);
    }
  }

  for (const bar of system.bars) parts.push(<BarDrawing key={`bar-${bar.index}`} bar={bar} rows={rows} look={look} final={bar.index === lastBar} />);

  parts.push(<g key="words">{words}</g>);

  parts.push(<g key="row-marks">{rowMarks}</g>);

  // One arc over each legato run, rising with its length, as Guitar Pro draws it.
  for (const arc of legato) {
    const y = stringY(rows, arc.string) - 8;
    const x0 = arc.continued ? arc.x0 : arc.x0 + 4;
    const rise = Math.min(18, 10 + (arc.x1 - x0) / 20);
    parts.push(
      <path
        key={`legato-${arc.string}-${arc.x0}`} d={`M${x0} ${y} Q${(x0 + arc.x1 - 4) / 2} ${y - rise} ${arc.x1 - 4} ${y}`}
        fill="none" stroke={look.ink} strokeWidth={1.1} data-testid="legato"
      />,
    );
  }

  for (const bar of system.bars) {
    for (const placed of bar.columns) {
      parts.push(
        <ColumnDrawing
          key={`col-${bar.index}-${placed.x}`} placed={placed} rows={rows} system={index} look={look}
          previous={previous} slides={slides} carries={carries} staffStart={system.staffStart}
        />,
      );
    }
    // Under a staff, the staff carries the rhythm.
    if (rows.tabStems) parts.push(<Stems key={`stems-${bar.index}`} bar={bar} rows={rows} beat={beatTicks(timeAt(clip, bar.index))} look={look} />);
  }

  return <>{parts}</>;
}

/** The marks in their own rows over the tab (under a staff alone): P.M. and let ring runs, and each column's stroke, vibrato, P.H. and accents. */
function SystemRowMarks({ system, rows, look }: { system: System; rows: Rows; look: TabLook }) {
  const parts: ReactNode[] = [];
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

  // Vibrato: one wave over each run of neighbouring notes that have it, over the tab under a staff too.
  if (rows.vibrato !== null) {
    for (const run of vibratoRuns(system)) {
      const { d, strokeWidth } = vibratoWave(run.from.x, rows.vibrato, run.kind === 'wide', run.end);
      parts.push(<path key={`vibrato-${run.from.index}`} d={d} fill="none" stroke={look.ink} strokeWidth={strokeWidth} data-testid="vibrato" />);
    }
  }

  for (const bar of system.bars) {
    for (const { column, x, index } of bar.columns) {
      if (column.stroke && rows.strokes !== null) {
        const sy = rows.strokes;
        parts.push(column.stroke === 'down'
          ? <path key={`stroke-${index}`} d={`M${x - 4} ${sy + 4} v-7 h8 v7`} fill="none" stroke={look.ink} strokeWidth={1.5} />
          : <path key={`stroke-${index}`} d={`M${x - 4} ${sy - 4} L${x} ${sy + 4} L${x + 4} ${sy - 4}`} fill="none" stroke={look.ink} strokeWidth={1.5} />);
      }
      parts.push(<g key={`marks-${index}`}>{columnMarks(column, x, rows, look)}</g>);
    }
  }
  return <>{parts}</>;
}

/** The words over a line: endings, the capo, sections, tempos, chord names and free text. */
function SystemWords({ system, rows, clip, look }: { system: System; rows: Rows; clip: Clip; look: TabLook }) {
  const parts: ReactNode[] = [];
  // Endings: one bracket over each run of bars with the same ending.
  endingSpans(system).forEach(({ bar, n, x0, x1 }) => {
    const y = rows.endings!;
    parts.push(
      <g key={`ending-${bar}`} stroke={look.ink} fill="none" strokeWidth={1.2} data-testid="ending">
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
              <rect x={x0} y={y - SECTION_BOX_HEIGHT / 2} width={marker.width} height={SECTION_BOX_HEIGHT} rx={2} fill={look.ink} />
              <text x={x0 + marker.width / 2} y={y + 4} fontSize={SECTION_SIZE} fontWeight={700} fill={look.paper} textAnchor="middle">{section.marker}</text>
            </>
          )}
          <rect x={x0 + text.x} y={y - SECTION_BOX_HEIGHT / 2} width={text.width} height={SECTION_BOX_HEIGHT} rx={2} fill="none" stroke={look.ink} strokeWidth={1.2} />
          <text x={x0 + text.x + SECTION_PAD} y={y + 4} fontSize={SECTION_SIZE} fontWeight={700} fill={look.ink}>{section.text}</text>
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

function ColumnDrawing({ placed, rows, system, look, previous, slides, carries, staffStart }: {
  placed: PlacedColumn;
  rows: Rows;
  system: number;
  look: TabLook;
  previous: Map<Note, Spot>;
  slides: Map<Note, 'up' | 'down'>;
  carries: Map<Note, 'hold' | 'release'>;
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
    const carry = carries.get(note);
    // A grace note's number is drawn small; a released bend's note shows none, as Guitar Pro prints it.
    if (carry !== 'release') parts.push(column.grace
      ? <text key={`fret-${s}`} x={x} y={y + 3.2} fontSize={GRACE_SIZE} fontWeight={600} fill={look.ink} textAnchor="middle" data-testid="grace">{label}</text>
      : <text key={`fret-${s}`} x={x} y={y + 4.5} fontSize={13} fontWeight={600} fill={look.ink} textAnchor="middle">{label}</text>);
    if (carry) {
      parts.push(<BendCarry key={`bend-${s}`} carry={carry} fromX={before && before.system === system ? fromX : staffStart - 14} x={x} y={y} staffTop={rows.staffTop} look={look} />);
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
function columnMarks(column: Column, x: number, rows: Rows, look: TabLook): ReactNode[] {
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
 * the bend's height, then for a release a curved arrow down to the string, where the note's number would be.
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

/**
 * The staff and the tab of one guitar joined as one part (Jeremy, 2026-10-27): a square bracket in
 * front, its ends curling over the lines, and the opening line drawn through both.
 */
function StaffJoin({ x, top, bottom, look }: { x: number; top: number; bottom: number; look: TabLook }) {
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
