import { memo, useEffect, useId, useMemo, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { barNumber, bendCarries, bendRaises, bendLandings, legatoStarts, slideDirections, startsFreeTime, STRING_COUNT, timeAt, type Part, type Note } from './clip';
import { layoutClip, SPACE, STRING_GAP, stepY, stringY, type Layout, type Parts, type Rows, type System } from './layout';
import { gridLines, stopNear, type GridLook } from './grid';
import { boundaryAt, cursorSpot, hitTest, rhythmAt, type FretDrag, type Hit, type SpanDrag, staffAt, type StaffDrag, type StaffHit } from './hitTest';
import { sameWord, textAt, type TextHit, type WordHit } from './layoutText';
import { type NoteDrawnAt, previousDrawnAt, legatoArcs, type LegatoArc } from './runs';
import { ShadowNote, StaffCursor, StaffDrawing, type NoteAt } from './StaffDrawing';
import { staffCursorPlace } from './staffEntry';
import { staffMarks } from './staffMarks';
import { showsBarNumber, type BarNumbers } from './viewOptions';
import { markAt, markLights, type MarkHit, type MarkLit } from './marks';
import { columnsInRectangle, type Rectangle } from './rectangle';
import { ColumnDrawing, type Joins, hiddenNumber, labelWidth } from './TabColumn';
import { Stems } from './TabStems';
import { litLook, PAGE_LOOK, type TabLook } from './tabLook';
import { whammyDrawings, whammyJoins, type WhammyDrawing } from './whammy';
import { attachment, columnNear, handleAt, type Handle } from './attachment';
import { boxSpan, RANGE_EDGE_REACH, rangeBoxes, rangeEndAt, rangeHandleAt, rangeHandles, type RangeDrag, type RangeHandle } from './rangeBox';
import { drawnLayout, otherVoices, voiceLayout, voicePart } from './voiceLayers';
import { BarDrawing, StaffJoin, TimeNumbers } from './ClipBars';
import { SystemRowMarks } from './ClipMarks';
import { SystemWords } from './ClipWords';

/** What the editor shows on the page: the cursor (a column and a string) and the selected columns. */
export interface Highlight {
  cursor: Hit | null;
  /** First and last selected places in the clip, inclusive. */
  range: [number, number] | null;
  /**
   * Whether the range is a run selected as a range (a bar pressed, Shift, a rectangle), boxed as MuseScore
   * boxes one; a rest or a column selected by itself only lights (Jeremy, 2026-11-01, issue #276).
   */
  boxed?: boolean;
  /** The cursor is on its column only, with no string picked: the column is tinted, no string boxed. */
  columnOnly?: boolean;
  /** The staff's own cursor on the cursor's column: the sounding pitch Enter would put there (issue #136). */
  staffPitch?: number | null;
  /**
   * In note input (issue #238) the cursor is outlined, where typing goes; in normal mode what it is on is
   * selected, filled, as MuseScore colours a selected note.
   */
  input?: boolean;
  /** How far into its rest note input's cursor is, in ticks (issue #293): drawn that far along the rest. */
  at?: number;
  /**
   * Written notes of a Tie chain drawn picked besides the cursor's: the rest of a picked chain, or a
   * chain a selection runs on into (`docs/specs/2026-11-04-tab-ties-forward-design.md`).
   */
  tied?: readonly { index: number; string: number }[];
}

/**
 * A clip drawn as tab: systems of six lines with the notes, their marks
 * above the staff and rhythm stems below. Draws what `layoutClip` places
 * and knows no ASCII. On the page it also draws the editor's `highlight`
 * and says where a press lands with `onPick`.
 */
/**
 * The ink of the Voices other than the Active voice while editing (step 9, Q6 b): `--line-strong`,
 * lighter than `--ink-muted`, which sat too close to the ink to tell apart (Jeremy, 2026-11-04).
 */
export const MUTED_VOICE_INK = 'var(--line-strong)';

/** How strongly the mouse's shadow note and box are drawn in note input: fainter than the caret's ghost (0.45). */
const MOUSE_SHADOW = 0.25;

/** Where a double-click landed: a place on a string, on the staff, or a rest or stem. */
export interface DoubleClickPlace {
  hit: Hit | null;
  staff: StaffHit | null;
  rest: { bar: number; column: number } | null;
}

export const TabClip = memo(function TabClip({ clip, layout: given, width, parts = 'tab', barNumbers = 'none', zoom = 1, look = PAGE_LOOK, title, highlight, picked, errors, onPick, onPickText, onPickMark, onPickColumn, onPickRhythm, onPickStaff, onDragStaff, onDragFret, onDragSpan, onDragRange, onPickRect, onPickWarning, onMiss, onDoubleClick, columnReach = 0, shadow = null, gridStep = null, gridLook = null, mutedVoices = false, voiceSelections, onPickVoice, chordDiagrams = false, x, y }: {
  clip: Part;
  /** A diagram under every chord name with a shape (issue #242), when `layout` isn't given; a given layout says so itself. */
  chordDiagrams?: boolean;
  /**
   * On the page while the cursor or a pick is on the tab (step 9, Q6 b, Q22): the Voices other than the
   * part's own (the Active voice) are drawn in `MUTED_VOICE_INK`.
   */
  mutedVoices?: boolean;
  /** A selection over several Voices (step 9, Q18): each other Voice's selected run of its own columns. */
  voiceSelections?: ReadonlyMap<number, [number, number]>;
  /**
   * A press on another Voice's note, where the part's own Voice has none (step 9, Q5): that Voice (from 0)
   * and the note, in its own columns' numbering.
   */
  onPickVoice?: (voice: number, hit: Hit) => void;
  width: number;
  /** The tab, the notation staff, or both (the staff over the tab). */
  parts?: Parts;
  /** `clip` laid out at `width` with `parts`, when the page has worked it out already; else it is worked out here. */
  layout?: Layout;
  /** Which bars show their number (the View options). */
  barNumbers?: BarNumbers;
  /** Drawn this many times its size (an exported image at the page's Size); `width` is in the drawing's own units. */
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
  /** `alone`: Alt was held, so a Tied note is picked by itself, not its whole Tie chain. */
  onPick?: (hit: Hit, extend: boolean, alone?: boolean) => void;
  /** A press on a chord name, section or tempo, or a time or key signature; with the press, in the drawing's own units. */
  onPickText?: (hit: TextHit, at: { x: number; y: number }) => void;
  /** A press on an Uneven bar's ⚠: its bar, and where, in the drawing's units. */
  onPickWarning?: (bar: number, at: { x: number; y: number }) => void;
  /** A press on a technique mark: a bend, slide, tie, vibrato, accent… (`marks.ts`). */
  onPickMark?: (hit: MarkHit) => void;
  /**
   * A press above or below the staff, off any mark or label: the gap between columns there, as the
   * index of the column after it (the column count past the last); `extend` when Shift was held.
   */
  onPickColumn?: (index: number, extend: boolean) => void;
  /** A press on the notation staff: the column and line or space (and string, on a head); `extend` with Shift. */
  onPickStaff?: (hit: StaffHit, extend: boolean, alone?: boolean) => void;
  /**
   * A note head on the staff dragged up or down (issue #174). A press on a head that doesn't move is
   * still `onPickStaff`, when the pointer lets go.
   */
  onDragStaff?: (drag: StaffDrag) => void;
  /**
   * A fret number on the tab dragged to another string (issue #238, normal mode only). The press itself
   * is still `onPick`, at once, so the note is selected before it moves.
   */
  onDragFret?: (drag: FretDrag) => void;
  /** A picked Span's Handle dragged (step 8): the column it is over, as it moves and when it lets go. */
  onDragSpan?: (drag: SpanDrag) => void;
  /**
   * A selected run's Range handle dragged (`docs/specs/2026-11-05-tab-range-handles-design.md`): the
   * column its end is over, as it moves, when it lets go, or called off. Without it no handles are drawn.
   */
  onDragRange?: (drag: RangeDrag) => void;
  /**
   * Shift+drag from blank space (issue #238): the first and last column the rectangle took in. A
   * Shift+press there that doesn't move still extends the selection, as before.
   */
  onPickRect?: (from: number, to: number) => void;
  /**
   * A double-click on the drawing, staff or tab: the word or bar line under it, if any, and whether it was
   * on a mark (issue #238: on nothing of these it goes into note input, as MuseScore's does; issue #289:
   * on a word with an Edit it opens its field).
   */
  onDoubleClick?: (word: TextHit | null, onMark: boolean, place: DoubleClickPlace) => void;
  /**
   * In note input (issue #238): the note value a press would enter, shown under the pointer as a faint
   * note on the staff, or a faint 0 on a string of the tab, as MuseScore's shadow note.
   */
  shadow?: number | null;
  /**
   * Note input's grid in ticks (issue #293): a press beside the notes, and the shadow note, snap to the
   * nearest note or grid line inside a rest, and the press says how far into the rest (`at`). Null outside note input.
   */
  gridStep?: number | null;
  /**
   * How the grid is drawn in note input, as Dorico shows it (Settings › Tab › Editing), over the cursor's bar
   * and the bar under the pointer, as Dorico draws it (Jeremy, 2026-11-07, issue #396):
   * a ruler over the top staff, or faint lines across the staves.
   */
  gridLook?: GridLook | null;
  /** A press on neither the staff nor a P.M. or let ring line (nor, with `onPickColumn`, a column). */
  onMiss?: () => void;
  /**
   * How far above and below the drawing a press still picks a column with `onPickColumn` (Jeremy,
   * 2026-10-27: "more clickable area above and below"), in pixels; the page's margin round the clip.
   */
  columnReach?: number;
  /** A press on a rest, or on a stem under the tab alone, in normal mode (issues #276, #290): its bar and column, and whether Shift grows the selection to it. */
  onPickRhythm?: (at: { bar: number; column: number; lastBar?: number }, extend: boolean) => void;
}) {
  const layout = useMemo(() => given ?? layoutClip(clip, width, parts, chordDiagrams), [given, clip, width, parts, chordDiagrams]);
  // The picked word, bar line or mark is drawn in the selection's blue where it is (issue #276).
  const lights = markLights(layout, picked?.kind === 'mark' ? picked : null);
  // What the picked Mark belongs to (step 8): its notes tinted, its Attachment lines, a Span's Handles.
  const attached = useMemo(() => attachment(layout, picked ?? null, clip.capo ?? null), [layout, picked, clip.capo]);
  /** A Handle being dragged: which, and the column it was last over. */
  const spanPress = useRef<{ handle: Handle; column: number | null } | null>(null);
  const [dragging, setDragging] = useState(false);
  // A boxed run's Range handles: on the page only, not on a run a picked Mark selects.
  const handleRange = onDragRange && highlight?.boxed ? highlight.range : null;
  const handles = useMemo(() => (handleRange ? rangeHandles(layout, handleRange) : []), [handleRange, layout]);
  /** A Range handle being dragged: which end, and the column it was last over. */
  const rangePress = useRef<{ handle: RangeHandle; column: number | null } | null>(null);
  const dragRange = (e: PointerEvent<SVGSVGElement>) => {
    const press = rangePress.current;
    if (!press) return false;
    const { px, py } = toUnits(e);
    const column = rangeEndAt(layout, px, py);
    if (column !== null && column !== press.column) {
      press.column = column;
      onDragRange!({ end: press.handle.end, column, done: false, cancelled: false });
    }
    return true;
  };
  const dropRange = (e: PointerEvent<SVGSVGElement> | null, cancelled: boolean) => {
    const press = rangePress.current;
    if (!press) return false;
    rangePress.current = null;
    setDragging(false);
    if (e) e.currentTarget.releasePointerCapture?.(e.pointerId);
    // Let go where it was pressed: the run stays as it was.
    if (press.column !== null || cancelled) onDragRange!({ end: press.handle.end, column: press.column ?? 0, done: true, cancelled: cancelled || press.column === null });
    return true;
  };
  const toUnits = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const scale = box.width > 0 ? width / box.width : 1;
    return { px: (e.clientX - box.left) * scale, py: (e.clientY - box.top) * scale };
  };
  const dragSpan = (e: PointerEvent<SVGSVGElement>) => {
    const press = spanPress.current;
    if (!press || picked?.kind !== 'mark') return false;
    const column = columnNear(layout, press.handle.system, toUnits(e).px);
    if (column !== null && column !== press.column) {
      press.column = column;
      onDragSpan!({ hit: picked, end: press.handle.end, column, done: false, cancelled: false });
    }
    return true;
  };
  const dropSpan = (e: PointerEvent<SVGSVGElement> | null, cancelled: boolean) => {
    const press = spanPress.current;
    if (!press || picked?.kind !== 'mark') return false;
    spanPress.current = null;
    setDragging(false);
    if (e) e.currentTarget.releasePointerCapture?.(e.pointerId);
    onDragSpan!({ hit: picked, end: press.handle.end, column: press.column ?? (press.handle.end === 'start' ? picked.index : picked.to ?? picked.index), done: true, cancelled });
    return true;
  };
  // Esc while dragging a Handle puts the Span back (Q8).
  useEffect(() => {
    if (!dragging) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      if (!dropRange(null, true)) dropSpan(null, true);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });
  const pickedWord = picked && picked.kind !== 'mark' ? picked : null;
  /**
   * What a press at a point in the drawing is on. A right-click picks a word, signature, bar line or mark,
   * as a press does, for its menu (issue #276, step 8).
   */
  /** In note input, a press's column moved to the nearest stop on the grid, with how far into its rest. */
  const snapped = <T extends { bar: number; column: number }>(on: T | null, px: number): (T & { at?: number }) | null => {
    if (!on || gridStep === null) return on;
    const stop = stopNear(layout, on.bar, px, gridStep);
    return stop ? { ...on, column: stop.column, at: stop.at } : on;
  };
  const target = (e: PointerEvent<SVGSVGElement> | MouseEvent<SVGSVGElement>) => {
    const words = (e.button === 0 || e.button === 2) && !e.shiftKey;
    const box = e.currentTarget.getBoundingClientRect();
    // From screen pixels to the drawing's units, at any Size the page draws it.
    const scale = box.width > 0 ? width / box.width : 1;
    const px = (e.clientX - box.left) * scale;
    const py = (e.clientY - box.top) * scale;
    // Above or below the drawing: only a column, as on the blank band at the edge of the first or last line.
    if (py < 0 || py >= layout.height) {
      const edge = py < 0 ? 0 : layout.height - 1;
      const column = onPickColumn ? boundaryAt(layout, px, edge) : null;
      return { text: null, mark: null, rest: null, staff: null, hit: null, column, px, py };
    }
    const text = onPickText && words ? textAt(layout, px, py) : null;
    const mark = !text && onPickMark && words ? markAt(layout, px, py) : null;
    const rest = text || mark || !onPickRhythm || e.button !== 0 ? null : rhythmAt(layout, px, py);
    const onStaff = text || mark || rest || !onPickStaff ? null : staffAt(layout, px, py);
    // A head pressed is that note; a line or space snaps to the grid, as the tab does.
    const staff = onStaff && onStaff.string === null ? snapped(onStaff, px) : onStaff;
    const hit = text || mark || rest || staff ? null : snapped(hitTest(layout, px, py), px);
    const column = text || mark || rest || staff || hit || !onPickColumn ? null : boundaryAt(layout, px, py);
    return { text, mark, rest, staff, hit, column, px, py };
  };
  const pick = (e: PointerEvent<SVGSVGElement>) => {
    if (!onPick) return;
    // A selected run's Range handle takes the press before anything under it.
    if (e.button === 0 && handles.length > 0) {
      const { px, py } = toUnits(e);
      const handle = rangeHandleAt(handles, px, py);
      if (handle) {
        rangePress.current = { handle, column: null };
        setDragging(true);
        e.currentTarget.setPointerCapture?.(e.pointerId);
        return;
      }
    }
    // A picked Span's Handle takes the press before anything under it.
    if (onDragSpan && e.button === 0 && attached.handles.length > 0) {
      const { px, py } = toUnits(e);
      const handle = handleAt(attached.handles, px, py);
      if (handle) {
        spanPress.current = { handle, column: null };
        setDragging(true);
        e.currentTarget.setPointerCapture?.(e.pointerId);
        return;
      }
    }
    const warning = onPickWarning && e.button === 0 ? (e.target as Element).closest?.('[data-warning-bar]') : null;
    if (warning) {
      const box = e.currentTarget.getBoundingClientRect();
      const scale = box.width > 0 ? width / box.width : 1;
      onPickWarning!(Number(warning.getAttribute('data-warning-bar')), { x: (e.clientX - box.left) * scale, y: (e.clientY - box.top) * scale });
      return;
    }
    const { text, mark, rest, staff, hit, column, px, py } = target(e);
    // A right-click inside the selection keeps it, for its menu, as Dorico, MuseScore and GP8 do (step 9).
    if (e.button === 2 && highlight?.range && !text && !mark) {
      const on = rest ?? staff ?? hit;
      const index = on ? layout.systems.flatMap(system => system.bars).find(bar => bar.index === on.bar)?.columns[on.column]?.index : undefined;
      if (index !== undefined && index >= highlight.range[0] && index <= highlight.range[1]) return;
    }
    // Another Voice's note under the press, where the own Voice has none there: it is picked in its Voice.
    const other = onPickVoice && e.button === 0 && !e.shiftKey && !text && !mark ? otherVoiceAt(px, py, staff, hit) : null;
    if (other) {
      onPickVoice!(other.voice, other.hit);
      return;
    }
    if (rest) {
      // A rest or a stem pressed in normal mode: its column alone is selected, or with Shift the run grows to it (issues #276, #290).
      onPickRhythm!(rest, e.shiftKey);
      return;
    }
    // Shift on blank space (no note, mark or word): a rectangle, if the pointer moves before it lets go.
    const onNote = (staff && staff.string !== null) || (hit && !!clip.bars[hit.bar]?.columns[hit.column]?.notes[hit.string]);
    if (onPickRect && e.shiftKey && e.button === 0 && !text && !mark && !onNote) {
      const press = () => {
        if (staff) onPickStaff!(staff, true);
        else if (hit) onPick(hit, true);
        else if (column !== null) onPickColumn!(column, true);
      };
      rectPress.current = { x: px, y: py, clientX: e.clientX, clientY: e.clientY, press };
      e.currentTarget.setPointerCapture?.(e.pointerId);
      return;
    }
    if (hit && onDragFret && e.button === 0 && !e.shiftKey && clip.bars[hit.bar]?.columns[hit.column]?.notes[hit.string]?.fret != null) {
      // A fret number: selected now, and dragged to another string if the pointer moves up or down.
      fretPress.current = { hit, y: e.clientY, string: hit.string };
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    if (staff && staff.string !== null && onDragStaff && e.button === 0) {
      // A head: a drag or a press, told apart when the pointer moves or lets go.
      headPress.current = { hit: { ...staff, string: staff.string }, y: e.clientY, shift: e.shiftKey, alt: e.altKey, last: null };
      e.currentTarget.setPointerCapture?.(e.pointerId);
      return;
    }
    if (text) onPickText!(text, { x: px, y: py });
    else if (mark) onPickMark!(mark);
    else if (staff) onPickStaff!(staff, e.shiftKey, e.altKey);
    else if (hit) onPick(hit, e.shiftKey, e.altKey);
    else if (column !== null) onPickColumn!(column, e.shiftKey);
    else onMiss?.();
  };
  /** Another Voice's note under a press that finds no note of the part's own Voice there. */
  const otherVoiceAt = (px: number, py: number, staff: StaffHit | null, hit: Hit | null): { voice: number; hit: Hit } | null => {
    const ownNote = (staff && staff.string !== null) || (hit && clip.bars[hit.bar]?.columns[hit.column]?.notes[hit.string]);
    if (ownNote) return null;
    for (const v of voiceViews) {
      const onHead = layout.parts !== 'tab' ? staffAt(v.layout, px, py) : null;
      if (onHead && onHead.string !== null) return { voice: v.voice, hit: { bar: onHead.bar, column: onHead.column, string: onHead.string } };
      const onTab = hitTest(v.layout, px, py);
      if (!onTab) continue;
      const placed = v.layout.systems.flatMap(system => system.bars).find(bar => bar.index === onTab.bar)?.columns[onTab.column];
      // Near enough the note's number across, as a press on the part's own note is.
      if (placed && placed.column.notes[onTab.string] && Math.abs(placed.x - px) <= ON_NOTE_REACH) return { voice: v.voice, hit: onTab };
    }
    return null;
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
  const headPress = useRef<{ hit: StaffDrag['hit']; y: number; shift: boolean; alt: boolean; last: StaffDrag | null } | null>(null);
  /**
   * Where the mouse's shadow note is drawn in note input: on the staff at a step, or on a string of the tab;
   * in the drawing's units, with the bar under it for the Grid. The mouse never moves the caret, as in Dorico
   * (Jeremy, 2026-11-07, issue #396), and nothing of it is kept outside note input.
   */
  const [hover, setHover] = useState<{ system: number; bar: number; x: number; step: number | null; string: number | null } | null>(null);
  // Another view, width or size moves the bars under a still pointer: the shadow waits for it to move again.
  const drawnAs = `${layout.parts}:${width}:${zoom}:${shadow !== null}`;
  const [seenDrawn, setSeenDrawn] = useState(drawnAs);
  if (seenDrawn !== drawnAs) {
    setSeenDrawn(drawnAs);
    setHover(null);
  }
  const showShadow = (e: PointerEvent<SVGSVGElement>) => {
    if (shadow === null || headPress.current) return;
    const { text, mark, staff, hit } = target(e);
    const on = text || mark ? null : staff ?? hit;
    const spot = on ? cursorSpot(layout, on.bar, on.column, on.at) : null;
    if (!on || !spot) {
      setHover(null);
      return;
    }
    setHover({ system: spot.system, bar: on.bar, x: spot.x, step: staff ? staff.step : null, string: staff ? null : hit!.string });
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
    else if (!cancelled) onPickStaff!(press.hit, press.shift, press.alt);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };
  /** A press on a fret number: the note, where the pointer started, and the string it was last over. */
  const fretPress = useRef<{ hit: Hit; y: number; string: number } | null>(null);
  const dragFret = (e: PointerEvent<SVGSVGElement>) => {
    const press = fretPress.current;
    if (!press) return false;
    const box = e.currentTarget.getBoundingClientRect();
    const scale = box.width > 0 ? width / box.width : 1;
    // A string for each string gap the pointer goes down (up toward the high e), as far as the staff goes.
    const string = Math.min(STRING_COUNT - 1, Math.max(0, press.hit.string + Math.round(((e.clientY - press.y) * scale) / STRING_GAP)));
    if (string === press.string) return true;
    press.string = string;
    onDragFret!({ hit: press.hit, string, done: false, cancelled: false });
    return true;
  };
  const dropFret = (e: PointerEvent<SVGSVGElement>, cancelled: boolean) => {
    const press = fretPress.current;
    if (!press) return false;
    fretPress.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    // Let go off the drawing, the note goes back where it was.
    const box = e.currentTarget.getBoundingClientRect();
    const outside = box.width > 0 && (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom);
    if (press.string !== press.hit.string || cancelled || outside) onDragFret!({ hit: press.hit, string: press.string, done: true, cancelled: cancelled || outside });
    return true;
  };
  // A press on blank space (or above or below the staff) doesn't take the focus, so no cursor
  // appears there; nor does one on a chord name, section or tempo, whose field has just taken it.
  // Nor does a press on a staff head, picked only when the pointer lets go or moves: focus taken now
  // would light the old cursor until then (issue #337); `onPickStaff` and `onDragStaff` take it.
  const keepFocus = (e: MouseEvent<SVGSVGElement>) => {
    const { text, mark, rest, staff, hit } = target(e);
    const head = staff && staff.string !== null && onDragStaff && e.button === 0;
    if (text || head || (!mark && !rest && !staff && !hit)) e.preventDefault();
  };
  const spot = highlight?.cursor ? cursorSpot(layout, highlight.cursor.bar, highlight.cursor.column, highlight.at) : null;
  // The part's own Voice as drawn (none of its stand-in rests where it is absent), and each other Voice
  // drawn the same way from a layout of its own (step 9).
  const drawn = drawnLayout(layout);
  const previous = previousDrawnAt(drawn.systems);
  const onStaff = layout.parts !== 'tab' ? staffMarks(drawn) : null;
  const slides = slideDirections(clip);
  const joins: Joins = { carries: bendCarries(clip), raises: bendRaises(clip), landings: bendLandings(clip), legatoStarts: legatoStarts(clip), whammy: whammyJoins(clip) };
  const arcs = legatoArcs(drawn.systems);
  const whammies = whammyDrawings(drawn);
  const voiceViews = otherVoices(layout).map(voice => {
    const own = voicePart(clip, voice);
    const view = voiceLayout(layout, clip, voice);
    return {
      voice, clip: own, layout: view, previous: previousDrawnAt(view.systems), slides: slideDirections(own),
      joins: { carries: bendCarries(own), raises: bendRaises(own), landings: bendLandings(own), legatoStarts: legatoStarts(own), whammy: whammyJoins(own) } as Joins,
      arcs: legatoArcs(view.systems), whammies: whammyDrawings(view), onStaff: layout.parts !== 'tab' ? staffMarks(view) : null,
    };
  });
  const voiceLook = mutedVoices ? { ...look, ink: MUTED_VOICE_INK } : look;
  const noLights: MarkLit = () => false;
  const lastBar = clip.bars.length - 1;
  // The string lines are masked round each note's number; ids made safe for `url(#…)`.
  const maskId = `tab-gaps${useId().replace(/[^\w-]/g, '')}`;
  return (
    <svg
      x={x} y={y} width={width * zoom} height={layout.height * zoom} viewBox={`0 0 ${width} ${layout.height}`}
      role="img" aria-label={title} fontFamily="var(--font-sans), sans-serif"
      className="block" onPointerDown={onPick ? pick : undefined} onDoubleClick={onDoubleClick ? e => { const { text, mark, hit, staff, rest } = target(e); onDoubleClick(text, !!mark, { hit, staff, rest }); } : undefined}
      onPointerMove={onDragStaff || onDragFret || onDragSpan || onDragRange || shadow !== null || onPickRect ? e => { if (!dragRange(e) && !dragSpan(e) && !drawRect(e) && !dragFret(e)) dragHead(e); } : undefined}
      onPointerLeave={shadow !== null ? () => setHover(null) : undefined}
      onPointerUp={onDragStaff || onDragFret || onDragSpan || onDragRange || onPickRect ? e => { if (!dropRange(e, false) && !dropSpan(e, false) && !dropRect(e, false) && !dropFret(e, false) && onDragStaff) dropHead(e, false); } : undefined}
      onPointerCancel={onDragStaff || onDragFret || onDragSpan || onDragRange || onPickRect ? e => { if (!dropRange(e, true) && !dropSpan(e, true) && !dropRect(e, true) && !dropFret(e, true) && onDragStaff) dropHead(e, true); } : undefined} onMouseDown={onPick ? keepFocus : undefined}
      style={columnReach ? { overflow: 'visible' } : undefined}
    >
      {columnReach > 0 && (
        // Takes the presses just above and below the drawing; nothing is drawn.
        <rect x={0} y={-columnReach} width={width} height={layout.height + 2 * columnReach} fill="transparent" data-testid="column-reach" />
      )}
      {rect && (
        <rect
          x={Math.min(rect.x0, rect.x1)} y={Math.min(rect.y0, rect.y1)} width={Math.abs(rect.x1 - rect.x0)} height={Math.abs(rect.y1 - rect.y0)}
          fill="var(--select-soft)" stroke="var(--select)" strokeWidth={1} strokeDasharray="4 3" pointerEvents="none" data-testid="select-rectangle"
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
              fill={highlight.input ? 'none' : 'var(--select-soft)'} stroke="var(--select)" strokeWidth={1.5}
              data-testid={highlight.input ? 'input-cursor' : 'selected-note'}
            />
          )}
          {/*
            In note input, with no note under the caret's box, a faint 0 in it: the note a press or a digit would put
            there, as MuseScore's tab shadow note (Jeremy, 2026-11-08, issue #396).
          */}
          {highlight.input && !highlight.range && !highlight.columnOnly && highlight.staffPitch == null && rows.tab
            && !clip.bars[highlight.cursor.bar]?.columns[highlight.cursor.column]?.notes[highlight.cursor.string] && (
            <g pointerEvents="none" data-testid="tab-ghost">
              {/* The string line breaks round it, as round a note's number. */}
              <rect x={spot.x - 6} y={stringY(rows, highlight.cursor.string) - 7} width={12} height={14} fill={look.paper} />
              <text x={spot.x} y={stringY(rows, highlight.cursor.string) + 4.5} fontSize={13} fontWeight={600} fill={look.ink} fillOpacity={0.45} textAnchor="middle">0</text>
            </g>
          )}
          {/*
            In note input on a column with no string picked, the caret's upright line, as on the staff (Dorico's),
            so the caret never goes missing, wherever the mouse is (issue #396).
          */}
          {!highlight.range && highlight.columnOnly && highlight.input && highlight.staffPitch == null && rows.tab && (
            <line
              x1={spot.x - 12} x2={spot.x - 12} y1={stringY(rows, 0) - 9} y2={stringY(rows, STRING_COUNT - 1) + 9}
              stroke="var(--select)" strokeWidth={2} data-testid="tab-caret"
            />
          )}
          {/* The Active voice's number by the cursor, when it isn't Voice 1 (step 9, Q5). */}
          {!highlight.range && (clip.voice ?? 0) > 0 && (rows.tab || rows.score) && (
            <text
              x={spot.x + 14} y={(rows.score ? rows.score.top : stringY(rows, 0)) - 6} fontSize={10} fontWeight={600}
              fill="var(--select)" fontFamily="var(--font-sans)" data-testid="cursor-voice"
            >
              {(clip.voice ?? 0) + 1}
            </text>
          )}
          {/* On its column with no string picked, the box goes round the whole column; the staff's own cursor shows it there. */}
          {/* Not in note input: there the shadow square under the mouse is the cursor until a string is pressed (Jeremy, 2026-10-31). */}
          {!highlight.range && highlight.columnOnly && !highlight.input && highlight.staffPitch == null && (rows.tab || rows.score) && (() => {
            // An empty bar has no column to select: the box goes round the whole bar, as round a selected bar (issue #317).
            const empty = layout.systems[spot.system].bars.find(b => b.index === highlight.cursor!.bar);
            if (empty && empty.columns.length === 0) {
              const { top, bottom } = boxSpan(rows);
              return (
                <rect
                  x={empty.x0} y={top} width={empty.x1 - empty.x0} height={bottom - top} rx={3}
                  fill="var(--select-soft)" fillOpacity={0.6} stroke="var(--select)" strokeWidth={1} data-testid="bar-cursor"
                />
              );
            }
            // Round the tab's six strings; with the staff alone, round its five lines.
            const [top, bottom] = rows.tab ? [stringY(rows, 0) - 9, stringY(rows, STRING_COUNT - 1) + 9] : [rows.score!.top - 9, rows.score!.bottom + 9];
            return (
              <rect
                x={spot.x - 12} y={top} width={24} height={bottom - top} rx={4}
                fill="var(--select-soft)" stroke="var(--select)" strokeWidth={1.5} data-testid="column-cursor"
              />
            );
          })()}
        </g>
        );
      })()}
      {highlight?.range && highlight.boxed && rangeBoxes(layout.systems, highlight.range).map(box => (
        // Round the selected run, line by line, under the notes, as MuseScore boxes a range (issue #276).
        <rect
          key={`range-${box.system}`} x={box.x} y={box.y} width={box.width} height={box.height} rx={3} pointerEvents="none"
          fill="var(--select-soft)" fillOpacity={0.6} stroke="var(--select)" strokeWidth={1}
          data-testid="range-box"
        />
      ))}
      {layout.systems.map((system, si) => {
        const { rows } = system;
        // The selected note lights where it is drawn: no cursor of its own over it (issue #276).
        const cursorOnStaff = rows.score && spot?.system === si && highlight?.cursor && !highlight.range && highlight.staffPitch != null;
        const selectedNote = cursorOnStaff ? staffNoteAt(system, highlight) : null;
        return (
        <g key={si} transform={`translate(0 ${system.top})`} data-testid="tab-system">
          {/* A picked Mark's notes, tinted softly under their numbers and heads: not lit as picked (step 8, Q18). */}
          {attached.tint.length > 0 && system.bars.flatMap(bar => bar.columns.flatMap(placed => attached.tint.filter(t => t.index === placed.index).flatMap(t => {
            const note = placed.column.notes[t.string];
            if (!note) return [];
            const out: ReactNode[] = [];
            if (rows.tab && !hiddenNumber(note, placed, bar, rows, joins)) out.push(
              <rect key={`tint-${t.index}-${t.string}`} x={placed.x - 10} y={stringY(rows, t.string) - 8} width={20} height={16} rx={4} fill="var(--select-soft)" pointerEvents="none" data-testid="tinted-note" />,
            );
            const head = rows.score ? placed.heads.find(h => h.string === t.string) : undefined;
            if (head) out.push(<ellipse key={`tint-head-${t.index}-${t.string}`} cx={placed.x} cy={stepY(rows.score!, head.step)} rx={8} ry={6} fill="var(--select-soft)" pointerEvents="none" data-testid="tinted-head" />);
            return out;
          })))}
          {/* A picked word's rest, tinted under its glyph as a note's head is (issue #393). */}
          {attached.rests.filter(r => r.system === si).map((r, k) => (
            <rect key={`tint-rest-${k}`} x={r.x} y={r.y} width={r.width} height={r.height} rx={3} fill="var(--select-soft)" pointerEvents="none" data-testid="tinted-rest" />
          ))}
          {/* Under the numbers, as the cursor's box is, so the Tied note's number shows through. */}
          {rows.tab && highlight?.tied && (highlight.range || highlight.staffPitch == null) && system.bars.flatMap(bar => bar.columns.flatMap(placed =>
            highlight.tied!.filter(t => t.index === placed.index).map(t => {
              const note = placed.column.notes[t.string];
              // A Tied note the tab doesn't number (inside a bar, under the staff) lights on the staff only.
              if (!note || hiddenNumber(note, placed, bar, rows, joins)) return null;
              return (
                <rect
                  key={`tied-${t.index}-${t.string}`} x={placed.x - 12} y={stringY(rows, t.string) - 9} width={24} height={18} rx={4}
                  fill="var(--select-soft)" stroke="var(--select)" strokeWidth={1.5} pointerEvents="none" data-testid="tied-note"
                />
              );
            })))}
          <SystemDrawing
            system={drawn.systems[si]} rows={rows} index={si} clip={clip} look={look} slides={slides}
            previous={previous} joins={joins} legato={arcs.filter(a => a.system === si)} whammy={whammies[si]} lastBar={lastBar} maskId={`${maskId}-${si}`}
            selected={highlight?.range ?? null} lit={lights.tab} word={pickedWord}
            masked={voiceViews.map(v => v.layout.systems[si])}
          />
          {rows.score && onStaff && (
            <StaffDrawing
              system={drawn.systems[si]} score={rows.score} clip={clip} look={look} lastBar={lastBar} marks={onStaff[si]} alone={layout.parts === 'staff'}
              selected={highlight?.range ?? null} selectedNote={selectedNote} litMark={lights.staff} word={pickedWord}
              tiedNotes={highlight?.tied && (highlight.range || highlight.staffPitch != null || !rows.tab) ? highlight.tied : undefined}
            />
          )}
          {voiceViews.map(v => (
            // Every other Voice, drawn as the part's own is but for the bar lines, signatures and words over bars (step 9).
            <g key={`voice-${v.voice}`} data-testid="other-voice" data-voice={v.voice + 1} data-muted={mutedVoices || undefined}>
              <SystemDrawing
                system={v.layout.systems[si]} rows={rows} index={si} clip={v.clip} look={voiceLook} slides={v.slides}
                previous={v.previous} joins={v.joins} legato={v.arcs.filter(a => a.system === si)} whammy={v.whammies[si]} lastBar={lastBar} maskId={`${maskId}-${si}-v${v.voice}`}
                selected={voiceSelections?.get(v.voice) ?? null} lit={noLights} word={null} notesOnly
              />
              {rows.score && v.onStaff && (
                <StaffDrawing
                  system={v.layout.systems[si]} score={rows.score} clip={v.clip} look={voiceLook} lastBar={lastBar} marks={v.onStaff[si]} alone={layout.parts === 'staff'}
                  selected={voiceSelections?.get(v.voice) ?? null} notesOnly
                />
              )}
            </g>
          ))}
          {gridLook && gridStep && highlight?.input && highlight.cursor && (() => {
            // The Grid over the part the caret is on, the staff or the tab (Jeremy, 2026-11-07), and, as Dorico
            // draws it, over the bar under the mouse too, on the part the mouse is over (issue #396).
            const onStaff = (staff: boolean) => (rows.score && rows.tab ? staff : !!rows.score);
            const wanted = [{ bar: highlight.cursor!.bar, staff: onStaff(highlight.staffPitch != null) }];
            if (hover?.system === si) wanted.push({ bar: hover.bar, staff: onStaff(hover.step !== null) });
            const grids = wanted.filter((w, k) => wanted.findIndex(o => o.bar === w.bar && o.staff === w.staff) === k);
            return grids.map(({ bar, staff }) => {
              const placed = system.bars.find(b => b.index === bar);
              if (!placed) return null;
              const lines = gridLines(placed, gridStep);
              const top = staff ? rows.score!.top : rows.staffTop;
              const bottom = staff ? rows.score!.bottom : rows.staffBottom;
              // Over the tab the ruler sits a little higher, clear of the top string's numbers.
              const rule = top - (staff ? 9 : 14);
              return (
                <g key={`${bar}:${staff}`} pointerEvents="none" data-testid="grid-lines" data-bar={bar} data-part={staff ? 'staff' : 'tab'} data-look={gridLook} stroke="var(--ink-muted)" fill="var(--ink-muted)">
                  {gridLook === 'ruler' && (
                    <>
                      <line x1={placed.x0} x2={placed.x1} y1={rule} y2={rule} strokeWidth={0.75} strokeOpacity={0.6} />
                      {lines.map((l, k) => <line key={k} x1={l.x} x2={l.x} y1={rule} y2={rule - (l.beat ? 6 : 3)} strokeWidth={l.beat ? 1.25 : 0.75} strokeOpacity={0.7} />)}
                    </>
                  )}
                  {gridLook === 'lines' && lines.map((l, k) => (
                    <line key={k} x1={l.x} x2={l.x} y1={top - 4} y2={bottom + 4} strokeWidth={1} strokeOpacity={l.beat ? 0.3 : 0.15} />
                  ))}
                </g>
              );
            });
          })()}
          {cursorOnStaff && !selectedNote && (() => {
            const place = staffCursorPlace(clip, highlight!.cursor!.bar, highlight!.staffPitch!);
            // The caret always shows in note input, as Dorico's, wherever the mouse is (Jeremy, 2026-11-07, issue
            // #396): its ghost, the next note to add, and its line, but on a note at another pitch (one just
            // entered, say) only the ghost, to add to the chord (Jeremy, 2026-11-06). Over a note at its own pitch,
            // both, the ghost see-through over the head.
            const heads = highlight!.input ? staffColumnHeads(system, highlight!.cursor!) : [];
            const onOwnNote = heads.some(h => h.step === place.step);
            return (
              <StaffCursor
                x={spot!.x} score={rows.score!} selected={!highlight!.input} caret={heads.length === 0 || onOwnNote}
                value={shadow ?? 4} {...place}
              />
            );
          })()}
          {/* The mouse's shadow note: fainter than the caret's ghost, so the two are told apart (issue #396). */}
          {shadow !== null && hover?.system === si && hover.step !== null && rows.score && (
            <ShadowNote x={hover.x} step={hover.step} value={shadow} score={rows.score} opacity={MOUSE_SHADOW} />
          )}
          {/* On the tab, a faint copy of the input cursor's box: a press there places a 0 to type over. */}
          {shadow !== null && hover?.system === si && hover.string !== null && rows.tab && (
            <rect
              x={hover.x - 12} y={stringY(rows, hover.string) - 9} width={24} height={18} rx={4}
              fill="none" stroke="var(--select)" strokeWidth={1.5} strokeOpacity={MOUSE_SHADOW} pointerEvents="none" data-testid="shadow-fret"
            />
          )}
          {rows.score && rows.tab && <StaffJoin x={system.lineStart} top={rows.score.top} bottom={rows.staffBottom} look={look} />}
          {system.bars.map((bar, k) => showsBarNumber(barNumbers, k === 0) && (!bar.restRun || bar.restRun.first) && barNumber(clip, bar.index) > 0 && (
            // Over the top line at the bar's start, small, as Guitar Pro prints it.
            <text
              key={`bar-number-${bar.index}`} x={bar.x0 + BAR_NUMBER_INSET} y={(rows.score ? rows.score.top : rows.staffTop) - 4}
              fontSize={BAR_NUMBER_SIZE} fill={look.ink} fillOpacity={0.7} data-testid="bar-number"
            >
              {barNumber(clip, bar.index)}
            </text>
          ))}
          {errors && system.bars.map(bar => {
            const error = errors.get(bar.index);
            // Under the rhythm: the tab's stems, or the tab or the staff when it has none.
            const y = rows.tabStems ? rows.tuplet - 4 : rows.height - 10;
            return error ? <Warning key={`warning-${bar.index}`} bar={bar.index} x={bar.x0 + WARNING_INSET} y={y} text={error} /> : null;
          })}
        </g>
        );
      })}
      {/* A picked Mark's Attachment lines and a Span's Handles: on the page only, over everything (step 8). */}
      {attached.lines.map((l, k) => (
        <line key={`attach-${k}`} x1={l.x} x2={l.x} y1={l.y0} y2={l.y1} stroke="var(--select)" strokeWidth={1} strokeDasharray="1.5 2.5" strokeLinecap="round" pointerEvents="none" data-testid="attachment-line" />
      ))}
      {handles.map(h => <RangeEdge key={`range-handle-${h.end}`} handle={h} />)}
      {onDragSpan && attached.handles.map(h => (
        <circle key={`handle-${h.end}-${h.system}`} cx={h.x} cy={h.y} r={3.5} fill="var(--surface-raised)" stroke="var(--select)" strokeWidth={1.5} style={{ cursor: 'ew-resize' }} data-testid="span-handle" data-end={h.end} />
      ))}
    </svg>
  );
});

/** How far (in screen pixels) a Shift+press on blank space moves before it draws a rectangle. */
const RECT_START = 4;
/** How far across from another Voice's fret number a press still picks it: about the number's half width and a little. */
const ON_NOTE_REACH = 10;
/** A bar's number: its size, and how far in from the bar's opening line it starts. */
const BAR_NUMBER_SIZE = 9;
const BAR_NUMBER_INSET = 2;

/** How far in from a bar's start its warning's middle is drawn: clear of the bar line and the first stem. */
const WARNING_INSET = 9;

/**
 * A small triangle with "!" under a bar's start, in the danger colour, whose tip says what is wrong.
 * Only the page draws it; screen readers get the same words from the line under the clip.
 */
function Warning({ bar, x, y, text }: { bar: number; x: number; y: number; text: string }) {
  // A press opens the popover with the fix (`BarFixPopover`).
  return (
    <g data-tip={text} data-testid="bar-warning" data-warning-bar={bar} style={{ cursor: 'pointer' }}>
      {/* A bigger, invisible target round the small mark, so the mouse finds it. */}
      <rect x={x - 10} y={y - 10} width={20} height={20} fill="transparent" />
      <path d={`M${x} ${y - 6} L${x + 6.5} ${y + 5.5} L${x - 6.5} ${y + 5.5} Z`} fill="var(--danger)" strokeLinejoin="round" stroke="var(--danger)" strokeWidth={1.5} />
      <text x={x} y={y + 4.2} fontSize={8.5} fontWeight={800} fill="var(--surface-raised)" textAnchor="middle">!</text>
    </g>
  );
}

function SystemDrawing({ system, rows, index, clip, look, previous, slides, joins, legato, whammy, lastBar, maskId, selected, lit, word, masked = [], notesOnly = false }: {
  system: System;
  /** The same line in the other Voices' layouts: the string lines stop short of their numbers too. */
  masked?: System[];
  /** Another Voice's notes and the marks on them, over the part's own drawing: no strings, bar lines or words over bars (step 9). */
  notesOnly?: boolean;
  rows: Rows;
  /** The mask that keeps the string lines out from behind the numbers. */
  maskId: string;
  index: number;
  clip: Part;
  look: TabLook;
  previous: Map<Note, NoteDrawnAt>;
  slides: Map<Note, 'up' | 'down'>;
  joins: Joins;
  /** This line's arcs over hammer-ons, pull-offs and legato slides. */
  legato: LegatoArc[];
  /** This line's whammy bar lines, under the tab. */
  whammy: WhammyDrawing[];
  lastBar: number;
  /** The selected run of columns: their numbers and marks are drawn in `--select` (issue #238). */
  selected: [number, number] | null;
  /** Whether a mark drawn on the tab is the picked one, drawn in `--select` (issue #276). */
  lit: MarkLit;
  /** The picked word or bar line, drawn in `--select`. */
  word: WordHit | null;
}) {
  const end = system.bars[system.bars.length - 1].x1;
  const parts: ReactNode[] = [];
  const words = <SystemWords system={system} rows={rows} clip={clip} look={look} word={word} columnsOnly={notesOnly} />;
  const rowMarks = <SystemRowMarks system={system} rows={rows} look={look} selected={selected} lit={lit} />;
  // The staff alone: the words over it and the marks under it, and no tab.
  if (!rows.tab) return <>{words}{rowMarks}</>;
  if (notesOnly) return <>{words}{rowMarks}{notesOf(system, index, rows, look, previous, slides, joins, legato, whammy, selected, lit)}</>;

  // The staff: the time signature in front of it, then its lines with TAB on them, as tab is printed. The lines stop short of every note's number,
  // so nothing need be painted behind it and the cursor's band or a transparent image shows through.
  parts.push(
    <mask key="gaps" id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={end + 1} height={rows.height}>
      <rect width={end + 1} height={rows.height} fill="#fff" />
      {[system, ...masked].flatMap((line, l) => line.bars.flatMap(bar => bar.columns.flatMap(placed => placed.column.notes.map((note, s) => {
        if (!note) return null;
        // Another Voice's tied note may be numbered where the part's isn't: its gap is always cut.
        const hidden = l === 0 && hiddenNumber(note, placed, bar, rows, joins);
        const lw = hidden ? 0 : labelWidth(note, placed.column);
        return <rect key={`${l}-${placed.index}-${s}`} x={placed.x - lw / 2} y={stringY(rows, s) - 7} width={lw} height={14} fill="#000" />;
      }))))}
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
  // A picked time signature is drawn in `--select` (step 8).
  const timeLook = (bar: number) => litLook(look, sameWord(word, { kind: 'time', bar }));
  if (!rows.score && system.timeX !== null) parts.push(<TimeNumbers key="time" time={clip.time} x={system.timeX} rows={rows} look={timeLook(0)} />);
  for (const bar of rows.score ? [] : system.bars) {
    if (bar.timeX !== null) {
      const brackets = startsFreeTime(clip, bar.index);
      parts.push(<TimeNumbers key={`time-${bar.index}`} time={timeAt(clip, bar.index)} x={bar.timeX} rows={rows} look={timeLook(bar.index)} brackets={brackets} />);
    }
  }

  for (const bar of system.bars) parts.push(<BarDrawing key={`bar-${bar.index}`} bar={bar} rows={rows} look={look} final={bar.index === lastBar} word={word} />);

  parts.push(<g key="words">{words}</g>);

  parts.push(<g key="row-marks">{rowMarks}</g>);

  parts.push(...notesOf(system, index, rows, look, previous, slides, joins, legato, whammy, selected, lit));
  return <>{parts}</>;
}

/** A line's notes and what is drawn with them on the tab: legato arcs, the whammy bar, each column, the stems. */
function notesOf(
  system: System, index: number, rows: Rows, look: TabLook, previous: Map<Note, NoteDrawnAt>, slides: Map<Note, 'up' | 'down'>, joins: Joins,
  legato: LegatoArc[], whammy: WhammyDrawing[], selected: [number, number] | null, lit: MarkLit,
): ReactNode[] {
  const parts: ReactNode[] = [];
  // One arc over each legato run, rising with its length, as Guitar Pro draws it.
  for (const arc of legato) {
    const y = stringY(rows, arc.string) - 8;
    const x0 = arc.continued ? arc.x0 : arc.x0 + 4;
    const rise = Math.min(18, 10 + (arc.x1 - x0) / 20);
    // Picked by the hammer-on, pull-off or legato slide of any note it joins.
    const picked = arc.joined.some(i => lit('legato', i, arc.string) || lit('slide', i, arc.string));
    parts.push(
      <path
        key={`legato-${arc.string}-${arc.x0}`} d={`M${x0} ${y} Q${(x0 + arc.x1 - 4) / 2} ${y - rise} ${arc.x1 - 4} ${y}`}
        fill="none" stroke={litLook(look, picked).ink} strokeWidth={1.1} data-testid="legato" data-selected={picked || undefined}
      />,
    );
  }

  // The whammy bar: lines from the numbers down through the tab to their depths, labelled under it.
  for (const { placed, pieces, labels } of whammy) {
    const ink = litLook(look, lit('whammy', placed.index, null)).ink;
    parts.push(
      <g key={`whammy-${placed.index}`} data-testid="whammy" stroke={ink} strokeWidth={1.1} fill="none">
        {pieces.map((p, k) => <line key={k} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} strokeDasharray={p.dashed ? '3 3' : undefined} />)}
        {labels.map((l, k) => (
          <text key={`label-${k}`} x={l.x} y={l.y} fontSize={10} fontWeight={600} fill={ink} stroke="none" textAnchor="middle" data-testid="whammy-label">{l.text}</text>
        ))}
      </g>,
    );
  }

  for (const bar of system.bars) {
    for (const placed of bar.columns) {
      parts.push(
        <ColumnDrawing
          key={`col-${bar.index}-${placed.x}`} placed={placed} bar={bar} rows={rows} system={index}
          look={selected && placed.index >= selected[0] && placed.index <= selected[1] ? { ...look, ink: 'var(--select)' } : look}
          previous={previous} slides={slides} joins={joins} staffStart={system.staffStart} lit={lit}
        />,
      );
    }
    // Under a staff, the staff carries the rhythm.
    if (rows.tabStems) parts.push(<Stems key={`stems-${bar.index}`} bar={bar} rows={rows} look={look} selected={selected} lit={lit} />);
  }
  return parts;
}

/** The heads drawn in the cursor's column on the staff; none on a rest or off the system. */
function staffColumnHeads(system: System, cursor: { bar: number; column: number }): readonly { step: number }[] {
  const bar = system.bars.find(b => b.index === cursor.bar);
  return bar?.columns[cursor.column]?.heads ?? [];
}

/**
 * In normal mode, the note the staff's cursor is on, when one is drawn there: lit in place rather than
 * covered by a cursor head, whose sign would sit apart from the note's own (issue #276).
 */
function staffNoteAt(system: System, highlight: Highlight): NoteAt | null {
  const { cursor, input, columnOnly } = highlight;
  if (!cursor || input || columnOnly) return null;
  const bar = system.bars.find(b => b.index === cursor.bar);
  const placed = bar?.columns[cursor.column];
  if (!placed || !placed.heads.some(h => h.string === cursor.string)) return null;
  return { index: placed.index, string: cursor.string };
}

/**
 * A selected run's Range handle: the box's end edge, drawn as nothing more than the box's own line, over a
 * clear strip that turns the pointer to ↔ over all its reach (Jeremy, 2026-11-06).
 */
function RangeEdge({ handle }: { handle: RangeHandle }) {
  const { x, top, bottom, end } = handle;
  return (
    <rect
      x={x - RANGE_EDGE_REACH} y={top - RANGE_EDGE_REACH} width={RANGE_EDGE_REACH * 2} height={bottom - top + RANGE_EDGE_REACH * 2}
      fill="transparent" style={{ cursor: 'ew-resize' }} data-testid="range-handle" data-end={end}
    />
  );
}
