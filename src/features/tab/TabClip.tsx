import { useId, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { beatTicks, bendCarries, bendRaises, bendLandings, columnMordent, legatoStarts, slideDirections, startsFreeTime, STRING_COUNT, timeAt, type Part, type Note, type TimeSignature } from './clip';
import { prettyChord, CHORD_SIZE, layoutClip, SPACE, stringY, type Parts, type PlacedBar, type Rows, type System } from './layout';
import { boundaryAt, cursorSpot, hitTest, type Hit, staffAt, type StaffDrag, type StaffHit } from './hitTest';
import { barTextX, endingSpans, CAPO_SIZE, capoText, BEAT_TEXT_INSET, BEAT_TEXT_SIZE, textBox, SECTION_BOX_HEIGHT, SECTION_SIZE, sectionBoxes, TEMPO_SIZE, tempoOver, tempoParts, textAt, type TextHit, type WordHit } from './layoutText';
import { columnRuns, RUN_MARKS, runAt, runLabelWidth, runsIn, type RunMark, type NoteSpot, previousSpots, vibratoRuns, legatoArcs, type LegatoArc } from './runs';
import { BAR_DASHES, FermataSign, ShadowNote, StaffCursor, StaffDrawing, TimeBrackets } from './StaffDrawing';
import { staffCursorPlace } from './staffEntry';
import { staffMarks } from './staffMarks';
import { GLYPHS } from './smufl';
import { showsBarNumber, type BarNumbers } from './viewOptions';
import { markAt, markBox, mordentSign, vibratoWave, type MarkHit } from './marks';
import { columnsInRectangle, type Rectangle } from './rectangle';
import { ColumnDrawing, type Joins, columnMarks, hiddenNumber, labelWidth } from './TabColumn';
import { Stems } from './TabStems';
import { TempoNote } from './TempoNote';
import { PAGE_LOOK, type TabLook } from './tabLook';
import { whammyDrawings, whammyJoins, type WhammyDrawing } from './whammy';

/** What the editor shows on the page: the cursor (a column and a string) and the selected columns. */
export interface Highlight {
  cursor: Hit | null;
  /** First and last selected places in the clip, inclusive. */
  range: [number, number] | null;
  /** The cursor is on its column only, with no string picked: the column is tinted, no string boxed. */
  columnOnly?: boolean;
  /** The staff's own cursor on the cursor's column: the sounding pitch Enter would put there (issue #136). */
  staffPitch?: number | null;
  /**
   * In note input (issue #238) the cursor is outlined, where typing goes; in normal mode what it is on is
   * selected, filled, as MuseScore colours a selected note.
   */
  input?: boolean;
}

/**
 * A clip drawn as tab: systems of six lines with the notes, their marks
 * above the staff and rhythm stems below. Draws what `layoutClip` places
 * and knows no ASCII. On the page it also draws the editor's `highlight`
 * and says where a press lands with `onPick`.
 */
export function TabClip({ clip, width, parts = 'tab', barNumbers = 'none', zoom = 1, look = PAGE_LOOK, title, highlight, picked, errors, onPick, onPickRun, onPickText, onPickMark, onPickColumn, onPickStaff, onDragStaff, onPickRect, onMiss, columnReach = 0, shadow = null, x, y }: {
  clip: Part;
  width: number;
  /** The tab, the notation staff, or both (the staff over the tab). */
  parts?: Parts;
  /** Which bars show their number (the View options). */
  barNumbers?: BarNumbers;
  /** Drawn this many times its size (an exported image at a View options size); `width` is in the drawing's own units. */
  zoom?: number;
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
  /**
   * A note head on the staff dragged up or down (issue #174). A press on a head that doesn't move is
   * still `onPickStaff`, when the pointer lets go.
   */
  onDragStaff?: (drag: StaffDrag) => void;
  /**
   * Shift+drag from blank space (issue #238): the first and last column the rectangle took in. A
   * Shift+press there that doesn't move still extends the selection, as before.
   */
  onPickRect?: (from: number, to: number) => void;
  /**
   * In note input (issue #238): the note value a press would enter, shown under the pointer as a faint
   * note on the staff, or a faint 0 on a string of the tab, as MuseScore's shadow note.
   */
  shadow?: number | null;
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
  /**
   * What a press at a point in the drawing is on. A right-click (or any press but the main button) opens
   * the bar menu, so it skips the words, signatures and marks, whose panels and outlines would open
   * under the menu; it only puts the cursor in the bar.
   */
  const target = (e: PointerEvent<SVGSVGElement> | MouseEvent<SVGSVGElement>) => {
    const words = e.button === 0 && !e.shiftKey;
    const box = e.currentTarget.getBoundingClientRect();
    // From screen pixels to the drawing's units, at any size the page draws it (View options' Size).
    const scale = box.width > 0 ? width / box.width : 1;
    const px = (e.clientX - box.left) * scale;
    const py = (e.clientY - box.top) * scale;
    // Above or below the drawing: only a column, as on the blank band at the edge of the first or last line.
    if (py < 0 || py >= layout.height) {
      const edge = py < 0 ? 0 : layout.height - 1;
      const column = onPickColumn ? boundaryAt(layout, px, edge) : null;
      return { run: null, text: null, mark: null, staff: null, hit: null, column, px, py };
    }
    const run = onPickRun && words ? runAt(layout, px, py) : null;
    const text = !run && onPickText && words ? textAt(layout, px, py) : null;
    const mark = !run && !text && onPickMark && words ? markAt(layout, px, py) : null;
    const staff = run || text || mark || !onPickStaff ? null : staffAt(layout, px, py);
    const hit = run || text || mark || staff ? null : hitTest(layout, px, py);
    const column = run || text || mark || staff || hit || !onPickColumn ? null : boundaryAt(layout, px, py);
    return { run, text, mark, staff, hit, column, px, py };
  };
  const pick = (e: PointerEvent<SVGSVGElement>) => {
    if (!onPick) return;
    const { run, text, mark, staff, hit, column, px, py } = target(e);
    // Shift on blank space (no note, mark or word): a rectangle, if the pointer moves before it lets go.
    const onNote = (staff && staff.string !== null) || (hit && !!clip.bars[hit.bar]?.columns[hit.column]?.notes[hit.string]);
    if (onPickRect && e.shiftKey && e.button === 0 && !run && !text && !mark && !onNote) {
      const press = () => {
        if (staff) onPickStaff!(staff, true);
        else if (hit) onPick(hit, true);
        else if (column !== null) onPickColumn!(column, true);
      };
      rectPress.current = { x: px, y: py, clientX: e.clientX, clientY: e.clientY, press };
      e.currentTarget.setPointerCapture?.(e.pointerId);
      return;
    }
    if (staff && staff.string !== null && onDragStaff && e.button === 0) {
      // A head: a drag or a press, told apart when the pointer moves or lets go.
      headPress.current = { hit: { ...staff, string: staff.string }, y: e.clientY, shift: e.shiftKey, last: null };
      e.currentTarget.setPointerCapture?.(e.pointerId);
      return;
    }
    if (run) onPickRun!(run.mark, run.run.columns[0].index);
    else if (text) onPickText!(text, { x: px, y: py });
    else if (mark) onPickMark!(mark);
    else if (staff) onPickStaff!(staff, e.shiftKey);
    else if (hit) onPick(hit, e.shiftKey);
    else if (column !== null) onPickColumn!(column, e.shiftKey);
    else onMiss?.();
  };
  /** A Shift+press on blank space: where it started, and what a press there does if it doesn't move. */
  const rectPress = useRef<{ x: number; y: number; clientX: number; clientY: number; press: () => void } | null>(null);
  /** The rectangle being drawn, in the drawing's units. */
  const [rect, setRect] = useState<Rectangle | null>(null);
  const drawRect = (e: PointerEvent<SVGSVGElement>) => {
    const from = rectPress.current;
    if (!from) return false;
    // Past a few pixels it is a drag, not a press.
    if (!rect && Math.hypot(e.clientX - from.clientX, e.clientY - from.clientY) < RECT_START) return true;
    const box = e.currentTarget.getBoundingClientRect();
    const scale = box.width > 0 ? width / box.width : 1;
    setRect({ x0: from.x, y0: from.y, x1: (e.clientX - box.left) * scale, y1: (e.clientY - box.top) * scale });
    return true;
  };
  const dropRect = (e: PointerEvent<SVGSVGElement>, cancelled: boolean) => {
    const from = rectPress.current;
    if (!from) return false;
    rectPress.current = null;
    setRect(null);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (cancelled) return true;
    if (!rect) from.press();
    else {
      const range = columnsInRectangle(layout, rect);
      if (range) onPickRect!(range[0], range[1]);
    }
    return true;
  };
  /** A press on a staff head: where it started, Shift then, and what the drag last reported. */
  const headPress = useRef<{ hit: StaffDrag['hit']; y: number; shift: boolean; last: StaffDrag | null } | null>(null);
  /** Where the shadow note is drawn: on the staff at a step, or on a string of the tab; in the drawing's units. */
  const [hover, setHover] = useState<{ system: number; x: number; step: number | null; string: number | null } | null>(null);
  const showShadow = (e: PointerEvent<SVGSVGElement>) => {
    if (shadow === null || headPress.current) return;
    const { text, mark, staff, hit } = target(e);
    const on = text || mark ? null : staff ?? hit;
    const spot = on ? cursorSpot(layout, on.bar, on.column) : null;
    if (!on || !spot) {
      setHover(null);
      return;
    }
    setHover(staff ? { system: spot.system, x: spot.x, step: staff.step, string: null } : { system: spot.system, x: spot.x, step: null, string: hit!.string });
  };
  const dragHead = (e: PointerEvent<SVGSVGElement>) => {
    showShadow(e);
    const press = headPress.current;
    if (!press) return;
    const box = e.currentTarget.getBoundingClientRect();
    const scale = box.width > 0 ? width / box.width : 1;
    // A line or space for each half a staff space the pointer goes up or down.
    const steps = Math.round(((press.y - e.clientY) * scale) / (SPACE / 2));
    if (!press.last && steps === 0) return;
    const drag: StaffDrag = { hit: press.hit, steps, semitones: e.shiftKey, chord: e.metaKey || e.ctrlKey, done: false };
    const last = press.last;
    press.last = drag;
    if (last && last.steps === steps && last.semitones === drag.semitones && last.chord === drag.chord) return;
    onDragStaff!(drag);
  };
  const dropHead = (e: PointerEvent<SVGSVGElement>, cancelled: boolean) => {
    const press = headPress.current;
    if (!press) return;
    headPress.current = null;
    if (press.last) onDragStaff!({ ...press.last, steps: cancelled ? 0 : press.last.steps, done: true });
    else if (!cancelled) onPickStaff!(press.hit, press.shift);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };
  // A press on blank space (or above or below the staff) doesn't take the focus, so no cursor
  // appears there; nor does one on a chord name, section or tempo, whose field has just taken it.
  const keepFocus = (e: MouseEvent<SVGSVGElement>) => {
    const { run, text, mark, staff, hit } = target(e);
    if (text || (!run && !mark && !staff && !hit)) e.preventDefault();
  };
  const spot = highlight?.cursor ? cursorSpot(layout, highlight.cursor.bar, highlight.cursor.column) : null;
  const previous = previousSpots(layout.systems);
  const onStaff = layout.parts !== 'tab' ? staffMarks(layout) : null;
  const slides = slideDirections(clip);
  const joins: Joins = { carries: bendCarries(clip), raises: bendRaises(clip), landings: bendLandings(clip), legatoStarts: legatoStarts(clip), whammy: whammyJoins(clip) };
  const arcs = legatoArcs(layout.systems);
  const whammies = whammyDrawings(layout);
  const lastBar = clip.bars.length - 1;
  // The string lines are masked round each note's number; ids made safe for `url(#…)`.
  const maskId = `tab-gaps${useId().replace(/[^\w-]/g, '')}`;
  return (
    <svg
      x={x} y={y} width={width * zoom} height={layout.height * zoom} viewBox={`0 0 ${width} ${layout.height}`}
      role="img" aria-label={title} fontFamily="var(--font-sans), sans-serif"
      className="block" onPointerDown={onPick ? pick : undefined}
      onPointerMove={onDragStaff || shadow !== null || onPickRect ? e => { if (!drawRect(e)) dragHead(e); } : undefined}
      onPointerLeave={shadow !== null ? () => setHover(null) : undefined}
      onPointerUp={onDragStaff || onPickRect ? e => { if (!dropRect(e, false) && onDragStaff) dropHead(e, false); } : undefined}
      onPointerCancel={onDragStaff || onPickRect ? e => { if (!dropRect(e, true) && onDragStaff) dropHead(e, true); } : undefined} onMouseDown={onPick ? keepFocus : undefined}
      style={columnReach ? { overflow: 'visible' } : undefined}
    >
      {columnReach > 0 && (
        // Takes the presses just above and below the drawing; nothing is drawn.
        <rect x={0} y={-columnReach} width={width} height={layout.height + 2 * columnReach} fill="transparent" data-testid="column-reach" />
      )}
      {highlight?.range && <SelectionBands layout={layout} range={highlight.range} />}
      {rect && (
        <rect
          x={Math.min(rect.x0, rect.x1)} y={Math.min(rect.y0, rect.y1)} width={Math.abs(rect.x1 - rect.x0)} height={Math.abs(rect.y1 - rect.y0)}
          fill="var(--primary-soft)" stroke="var(--primary)" strokeWidth={1} strokeDasharray="4 3" pointerEvents="none" data-testid="select-rectangle"
        />
      )}
      {pickedBox && (
        <rect
          x={pickedBox.x} y={pickedBox.y} width={pickedBox.width} height={pickedBox.height} rx={4}
          fill="var(--primary-soft)" stroke="var(--primary)" strokeWidth={1.5} data-testid={picked?.kind === 'mark' ? 'picked-mark' : 'picked-word'}
        />
      )}
      {spot && highlight?.cursor && (() => {
        const { rows, top } = layout.systems[spot.system];
        return (
        <g transform={`translate(0 ${top})`} data-testid="tab-cursor">
          {/* No band behind the cursor's column: only Shift's selection draws one (Jeremy, 2026-10-28). */}
          {/* While a run of columns is selected, only its band shows: no box follows the cursor (Jeremy, 2026-10-28). */}
          {/* Only the part pressed lights: while the staff has the keys, its own cursor shows the note (Jeremy, 2026-10-30). */}
          {!highlight.range && !highlight.columnOnly && highlight.staffPitch == null && rows.tab && (
            <rect
              x={spot.x - 12} y={stringY(rows, highlight.cursor.string) - 9} width={24} height={18} rx={4}
              fill={highlight.input ? 'none' : 'var(--primary-soft)'} stroke="var(--primary)" strokeWidth={1.5}
              data-testid={highlight.input ? 'input-cursor' : 'selected-note'}
            />
          )}
          {/* On its column with no string picked, the box goes round the whole column; the staff's own cursor shows it there. */}
          {!highlight.range && highlight.columnOnly && highlight.staffPitch == null && (rows.tab || rows.score) && (() => {
            // Round the tab's six strings; with the staff alone, round its five lines.
            const [top, bottom] = rows.tab ? [stringY(rows, 0) - 9, stringY(rows, STRING_COUNT - 1) + 9] : [rows.score!.top - 9, rows.score!.bottom + 9];
            return (
              <rect
                x={spot.x - 12} y={top} width={24} height={bottom - top} rx={4}
                fill={highlight.input ? 'none' : 'var(--primary-soft)'} stroke="var(--primary)" strokeWidth={1.5} data-testid="column-cursor"
              />
            );
          })()}
        </g>
        );
      })()}
      {layout.systems.map((system, si) => {
        const { rows } = system;
        return (
        <g key={si} transform={`translate(0 ${system.top})`} data-testid="tab-system">
          <SystemDrawing
            system={system} rows={rows} index={si} clip={clip} look={look} slides={slides}
            previous={previous} joins={joins} legato={arcs.filter(a => a.system === si)} whammy={whammies[si]} lastBar={lastBar} maskId={`${maskId}-${si}`}
          />
          {rows.score && onStaff && (
            <StaffDrawing system={system} score={rows.score} clip={clip} look={look} lastBar={lastBar} marks={onStaff[si]} alone={layout.parts === 'staff'} />
          )}
          {rows.score && spot?.system === si && highlight?.cursor && !highlight.range && highlight.staffPitch != null && (
            <StaffCursor x={spot.x} score={rows.score} selected={!highlight.input} {...staffCursorPlace(clip, highlight.cursor.bar, highlight.staffPitch)} />
          )}
          {shadow !== null && hover?.system === si && hover.step !== null && rows.score && (
            <ShadowNote x={hover.x} step={hover.step} value={shadow} score={rows.score} />
          )}
          {shadow !== null && hover?.system === si && hover.string !== null && rows.tab && (
            <text
              x={hover.x} y={stringY(rows, hover.string) + 4.5} textAnchor="middle" fontSize={13} fontWeight={600}
              fill="var(--primary)" fillOpacity={0.45} pointerEvents="none" data-testid="shadow-fret"
            >0</text>
          )}
          {rows.score && rows.tab && <StaffJoin x={system.lineStart} top={rows.score.top} bottom={rows.staffBottom} look={look} />}
          {system.bars.map((bar, k) => showsBarNumber(barNumbers, k === 0) && (!bar.restRun || bar.restRun.first) && (
            // Over the top line at the bar's start, small, as Guitar Pro prints it.
            <text
              key={`bar-number-${bar.index}`} x={bar.x0 + BAR_NUMBER_INSET} y={(rows.score ? rows.score.top : rows.staffTop) - 4}
              fontSize={BAR_NUMBER_SIZE} fill={look.ink} fillOpacity={0.7} data-testid="bar-number"
            >
              {bar.index + 1}
            </text>
          ))}
          {errors && system.bars.map(bar => {
            const error = errors.get(bar.index);
            // Under the rhythm: the tab's stems, or the tab or the staff when it has none.
            const y = rows.tabStems ? rows.tuplet - 4 : rows.height - 10;
            return error ? <Warning key={`warning-${bar.index}`} x={bar.x0 + WARNING_INSET} y={y} text={error} /> : null;
          })}
        </g>
        );
      })}
    </svg>
  );
}

/** A bar's number: its size, and how far in from the bar's opening line it starts. */
/** How far (in screen pixels) a Shift+press on blank space moves before it draws a rectangle. */
const RECT_START = 4;
const BAR_NUMBER_SIZE = 9;
const BAR_NUMBER_INSET = 2;

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
  return (
    <g data-testid="tab-selection">
      {layout.systems.map((system, si) => {
        const chosen = system.bars.flatMap(bar => bar.columns).filter(c => c.index >= from && c.index <= to);
        if (chosen.length === 0) return null;
        const first = chosen[0];
        const last = chosen[chosen.length - 1];
        const x0 = first.start;
        return (
          <rect
            key={si} x={x0} y={system.top + system.rows.bandTop} width={last.start + last.width - x0}
            height={system.rows.bandBottom - system.rows.bandTop} fill="var(--primary-soft)"
          />
        );
      })}
    </g>
  );
}

function SystemDrawing({ system, rows, index, clip, look, previous, slides, joins, legato, whammy, lastBar, maskId }: {
  system: System;
  rows: Rows;
  /** The mask that keeps the string lines out from behind the numbers. */
  maskId: string;
  index: number;
  clip: Part;
  look: TabLook;
  previous: Map<Note, NoteSpot>;
  slides: Map<Note, 'up' | 'down'>;
  joins: Joins;
  /** This line's arcs over hammer-ons, pull-offs and legato slides. */
  legato: LegatoArc[];
  /** This line's whammy bar lines, under the tab. */
  whammy: WhammyDrawing[];
  lastBar: number;
}) {
  const end = system.bars[system.bars.length - 1].x1;
  const parts: ReactNode[] = [];
  const words = <SystemWords system={system} rows={rows} clip={clip} look={look} />;
  const rowMarks = <SystemRowMarks system={system} rows={rows} look={look} />;
  // The staff alone: the words over it and the marks under it, and no tab.
  if (!rows.tab) return <>{words}{rowMarks}</>;

  // The staff: the time signature in front of it, then its lines with TAB on them, as tab is printed. The lines stop short of every note's number,
  // so nothing need be painted behind it and the cursor's band or a transparent image shows through.
  parts.push(
    <mask key="gaps" id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={end + 1} height={rows.height}>
      <rect width={end + 1} height={rows.height} fill="#fff" />
      {system.bars.flatMap(bar => bar.columns.flatMap(placed => placed.column.notes.map((note, s) => {
        if (!note) return null;
        const hidden = hiddenNumber(note, placed, bar, rows, joins);
        const lw = hidden ? 0 : labelWidth(note, placed.column);
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
    if (bar.timeX !== null) {
      const brackets = startsFreeTime(clip, bar.index);
      parts.push(<TimeNumbers key={`time-${bar.index}`} time={timeAt(clip, bar.index)} x={bar.timeX} rows={rows} look={look} brackets={brackets} />);
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

  // The whammy bar: lines from the numbers down through the tab to their depths, labelled under it.
  for (const { placed, pieces, labels } of whammy) {
    parts.push(
      <g key={`whammy-${placed.index}`} data-testid="whammy" stroke={look.ink} strokeWidth={1.1} fill="none">
        {pieces.map((p, k) => <line key={k} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} strokeDasharray={p.dashed ? '3 3' : undefined} />)}
        {labels.map((l, k) => (
          <text key={`label-${k}`} x={l.x} y={l.y} fontSize={10} fontWeight={600} fill={look.ink} stroke="none" textAnchor="middle" data-testid="whammy-label">{l.text}</text>
        ))}
      </g>,
    );
  }

  for (const bar of system.bars) {
    for (const placed of bar.columns) {
      parts.push(
        <ColumnDrawing
          key={`col-${bar.index}-${placed.x}`} placed={placed} bar={bar} rows={rows} system={index} look={look}
          previous={previous} slides={slides} joins={joins} staffStart={system.staffStart}
        />,
      );
    }
    // Under a staff, the staff carries the rhythm.
    if (rows.tabStems) parts.push(<Stems key={`stems-${bar.index}`} bar={bar} rows={rows} beat={beatTicks(timeAt(clip, bar.index))} look={look} />);
  }

  return <>{parts}</>;
}

/** What a whammy bar's run is labelled, as guitar books print it. */
const WHAMMY_LABEL = 'w/ bar';

/** The wah's sign centred on (x, y): "+" closed, "o" open, as Guitar Pro prints them. */
function WahMark({ kind, x, y, look }: { kind: 'open' | 'closed'; x: number; y: number; look: TabLook }) {
  return kind === 'closed'
    ? <path d={`M${x - 4} ${y} h8 M${x} ${y - 4} v8`} stroke={look.ink} strokeWidth={1.2} fill="none" data-testid="wah" />
    : <circle cx={x} cy={y} r={3.6} stroke={look.ink} strokeWidth={1.1} fill="none" data-testid="wah" />;
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

  // The whammy bar: "w/ bar" and a dashed line over each run of columns that use it, as guitar books print it.
  if (rows.whammy !== null) {
    const y = rows.whammy;
    const lw = runLabelWidth(WHAMMY_LABEL);
    for (const { columns, x0, x1 } of runsIn(system, c => !!c.whammy)) {
      const longer = x1 > x0 + lw + 2;
      parts.push(
        <g key={`whammy-run-${columns[0].index}`} data-testid="whammy-run">
          <text x={x0} y={y + 4} fontSize={10} fontStyle="italic" fill={look.ink}>{WHAMMY_LABEL}</text>
          {longer && <line x1={x0 + lw} x2={x1} y1={y} y2={y} stroke={look.ink} strokeDasharray="3 3" />}
        </g>,
      );
    }
  }

  // Fermatas, over the tab when there is no staff to carry them.
  if (rows.fermatas !== null) {
    for (const bar of system.bars) {
      for (const { column, x, index } of bar.columns) {
        if (column.fermata) parts.push(<FermataSign key={`fermata-${index}`} fermata={column.fermata} x={x} y={rows.fermatas + 5} look={look} />);
      }
    }
  }

  // Hairpins: one wedge over each run of neighbouring columns getting louder (opening) or softer (closing).
  if (rows.hairpins !== null) {
    for (const run of columnRuns(system, c => c.hairpin ?? null)) {
      const y = rows.hairpins;
      const [x0, x1] = [run.from.x - 4, run.end];
      const [narrow, wide] = run.kind === 'crescendo' ? [x0, x1] : [x1, x0];
      parts.push(
        <path
          key={`hairpin-${run.from.index}`} d={`M${wide} ${y - 4} L${narrow} ${y} L${wide} ${y + 4}`}
          fill="none" stroke={look.ink} strokeWidth={1.1} data-testid="hairpin"
        />,
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
      const mordent = columnMordent(column);
      if (mordent && rows.vibrato !== null) {
        const { d, transform } = mordentSign(x, rows.vibrato, mordent);
        parts.push(<path key={`mordent-${index}`} d={d} transform={transform} fill={look.ink} data-testid="mordent" />);
      }
      if (column.stroke && rows.strokes !== null) {
        const sy = rows.strokes;
        parts.push(column.stroke === 'down'
          ? <path key={`stroke-${index}`} d={`M${x - 4} ${sy + 4} v-7 h8 v7`} fill="none" stroke={look.ink} strokeWidth={1.5} />
          : <path key={`stroke-${index}`} d={`M${x - 4} ${sy - 4} L${x} ${sy + 4} L${x + 4} ${sy - 4}`} fill="none" stroke={look.ink} strokeWidth={1.5} />);
      }
      if (column.wah && rows.wah !== null) parts.push(<WahMark key={`wah-${index}`} kind={column.wah} x={x} y={rows.wah} look={look} />);
      parts.push(<g key={`marks-${index}`}>{columnMarks(column, x, rows, look)}</g>);
    }
  }
  return <>{parts}</>;
}

/** The room between a tempo and "Free time" in the same bar. */
const FREE_TIME_GAP = 10;

/** The words over a line: endings, the capo, sections, tempos, chord names and free text. */
function SystemWords({ system, rows, clip, look }: { system: System; rows: Rows; clip: Part; look: TabLook }) {
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
    const { section } = bar.bar;
    const tempo = tempoOver(bar);
    if (section && rows.section !== null) {
      const y = rows.section;
      const { marker, text } = sectionBoxes(section);
      parts.push(
        <g key={`section-${bar.index}`} data-testid="section" fill={look.ink}>
          {marker && (
            <>
              <rect x={x0 + 0.6} y={y - SECTION_BOX_HEIGHT / 2} width={marker.width - 1.2} height={SECTION_BOX_HEIGHT} fill="none" stroke={look.ink} strokeWidth={1.2} />
              <text x={x0 + marker.width / 2} y={y + 5} fontSize={SECTION_SIZE} fontWeight={700} textAnchor="middle">{section.marker}</text>
            </>
          )}
          <text x={x0 + text.x} y={y + 5} fontSize={SECTION_SIZE} fontWeight={700}>{section.text}</text>
        </g>,
      );
    }
    if (tempo && rows.tempo !== null) {
      const y = rows.tempo;
      const { noteX, numberX } = tempoParts(tempo);
      const nx = x0 + noteX;
      parts.push(
        <g key={`tempo-${bar.index}`} data-testid="tempo" fill={look.ink} fontSize={TEMPO_SIZE} fontWeight={700}>
          {tempo.label && <text x={x0} y={y + 4}>{tempo.label}</text>}
          <TempoNote x={nx} y={y + 2} size={TEMPO_SIZE} ink={look.ink} />
          <text x={x0 + numberX} y={y + 4}>{` = ${tempo.bpm}`}</text>
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
            {prettyChord(placed.column.chord)}
          </text>,
        );
      }
    }
    // "Free time" over the bar that starts it, after the bar's tempo when it has one.
    if (rows.tempo !== null && startsFreeTime(clip, bar.index)) {
      const after = tempo ? tempoParts(tempo).width + FREE_TIME_GAP : 0;
      parts.push(
        <text key={`free-${bar.index}`} x={x0 + after} y={rows.tempo + 4} fontSize={BEAT_TEXT_SIZE} fontStyle="italic" fill={look.ink} data-testid="free-time">
          Free time
        </text>,
      );
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
function TimeNumbers({ time, x, rows, look, brackets = false }: { time: TimeSignature; x: number; rows: Rows; look: TabLook; brackets?: boolean }) {
  const middle = (rows.staffTop + rows.staffBottom) / 2;
  return (
    <g fontSize={20} fontWeight={700} fill={look.ink} textAnchor="middle" data-testid="time-signature">
      <text x={x} y={middle - 2}>{time.beats}</text>
      <text x={x} y={middle + 16}>{time.value}</text>
      {brackets && <TimeBrackets x={x} middle={middle + 2} height={44} look={look} />}
    </g>
  );
}

function BarDrawing({ bar, rows, look, final }: { bar: PlacedBar; rows: Rows; look: TabLook; final: boolean }) {
  const { x0, x1 } = bar;
  const dots = (x: number) => [1.5, 3.5].map(k => (
    <circle key={`${x}-${k}`} cx={x} cy={stringY(rows, k)} r={2.2} fill={look.ink} />
  ));
  const vertical = (x: number, w: number, dashed = false) => (
    <line x1={x} x2={x} y1={rows.staffTop} y2={rows.staffBottom} stroke={look.ink} strokeWidth={w} strokeDasharray={dashed ? BAR_DASHES : undefined} />
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
      ) : bar.bar.doubleBar ? (
        <g data-testid="double-bar">{vertical(x1 - 4, 1)}{vertical(x1, 1)}</g>
      ) : bar.restRun && !bar.restRun.last ? null : vertical(x1, 1, bar.bar.freeTime)}
      {bar.bar.repeatEnd !== undefined && bar.bar.repeatEnd !== 2 && (
        <text x={x1} y={rows.endings! + 6} fontSize={11} fontWeight={700} fill={look.ink} textAnchor="end">
          ×{bar.bar.repeatEnd}
        </text>
      )}
    </g>
  );
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
