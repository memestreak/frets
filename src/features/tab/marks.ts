/**
 * The technique marks drawn on and over the tab, as things a press can pick (issue #128;
 * `docs/specs/2026-10-27-tab-pick-marks-design.md`): where each one is, which palette tool sets it,
 * and taking it away. Pure; the boxes follow what `TabClip.tsx` draws.
 */
import { columnAccent, isRest, TREMOLO_VALUES, tupletGroups, type Clip, type Note } from './clip';
import { previousSpots, stringY, type Layout } from './layout';
import type { ToolId } from './tools';

/** The marks a press can pick. P.M. and let ring lines pick their run instead (`runAt`). */
export type DrawnMark =
  | 'bend' | 'slideOut' | 'tap' | 'legato' | 'slide' | 'tie'
  | 'vibrato' | 'pinch' | 'accent' | 'staccato' | 'stroke' | 'tremolo' | 'tuplet';

/** A drawn mark: what it is, its column's place in the clip, and its note's string (null for a mark over the whole column). */
export interface MarkHit {
  kind: 'mark';
  mark: DrawnMark;
  index: number;
  string: number | null;
  /** A tuplet's last column: a tuplet mark covers its whole group. */
  to?: number;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A thin mark's hit area reaches this far above and below it, so the mouse finds it. */
const THIN_REACH = 8;

/** Every picked-able mark on the tab and the box round it, in the tab's units, top line first. */
export function markBoxes(layout: Layout): { hit: MarkHit; box: Box }[] {
  const { rows } = layout;
  const out: { hit: MarkHit; box: Box }[] = [];
  const previous = previousSpots(layout.systems);
  layout.systems.forEach((system, si) => {
    const top = si * rows.height;
    const add = (mark: DrawnMark, index: number, string: number | null, x0: number, y0: number, x1: number, y1: number, to?: number) => {
      out.push({ hit: { kind: 'mark', mark, index, string, ...(to === undefined ? {} : { to }) }, box: { x: x0, y: top + y0, width: x1 - x0, height: y1 - y0 } });
    };
    /** A row's thin mark: tall enough to press. */
    const rowMark = (mark: DrawnMark, index: number, x0: number, x1: number, rowY: number) =>
      add(mark, index, null, x0, rowY - THIN_REACH, x1, rowY + THIN_REACH);
    for (const bar of system.bars) {
      for (const { column, x, index } of bar.columns) {
        const notes = column.notes.filter((n): n is Note => n !== null);
        if (column.stroke && rows.strokes !== null) rowMark('stroke', index, x - 7, x + 7, rows.strokes);
        const wide = notes.some(n => n.vibrato === 'wide');
        if (notes.some(n => n.vibrato) && rows.vibrato !== null) {
          const [width, turns] = wide ? [8, 3] : [6, 4];
          rowMark('vibrato', index, x + 2, x + 6 + 2 * width * turns, rows.vibrato);
        }
        if (notes.some(n => n.harmonic === 'pinch') && rows.harmonics !== null) rowMark('pinch', index, x - 11, x + 11, rows.harmonics);
        const accent = columnAccent(column);
        const staccato = notes.some(n => n.staccato);
        if (rows.accents !== null && (accent || staccato)) {
          const y = rows.accents;
          // With both, the accent sits over the dot and each takes its own half.
          if (accent) add('accent', index, null, x - 7, y - 2 - THIN_REACH, x + 7, staccato ? y + 3 : y + THIN_REACH);
          if (staccato) add('staccato', index, null, x - 6, accent ? y + 3 : y - THIN_REACH, x + 6, (accent ? y + 6 : y) + THIN_REACH);
        }
        if (column.tremolo && !isRest(column) && !column.grace) {
          const value = column.duration.value;
          const slashes = TREMOLO_VALUES.indexOf(column.tremolo) + 1;
          const y0 = value === 2 ? rows.stemBottom - 12 : rows.stemTop + (value === 1 ? 2 : 0);
          add('tremolo', index, null, x - 7, y0, x + 7, y0 + 6 + slashes * 4);
        }
        column.notes.forEach((note, s) => {
          if (!note) return;
          const y = stringY(rows, s);
          const before = previous.get(note);
          const fromX = before && before.system === si ? before.x : system.staffStart;
          if (note.bend) {
            const peak = rows.staffTop - 10;
            const { pre, release } = note.bend;
            // The arrow and its label over the staff; a pre-bend's stands straight up from the number.
            if (pre) add('bend', index, s, x - 15, peak - 14, release ? x + 20 : x + 15, y - 8);
            else add('bend', index, s, x + 6, peak - 14, release ? x + 29 : x + 23, y - 1);
          }
          if (note.slideOut) add('slideOut', index, s, x + 7, y - 7, x + 20, y + 7);
          if (note.tap) add('tap', index, s, x - 6, y - 18, x + 6, y - 7);
          if (note.legato) add('legato', index, s, fromX + 4, y - 26, x - 4, y - 7);
          if (note.slide) {
            const fromNote = (note.slide === 'legato' || note.slide === 'shift') && before;
            const from = fromNote ? fromX + 7 : x - 16;
            // A legato slide has its slur over the line too.
            add('slide', index, s, from - 1, note.slide === 'legato' && before ? y - 21 : y - 7, x - 6, y + 7);
          }
          if (note.tie && before) add('tie', index, s, fromX + 4, y + 5, x - 9, y + 16);
        });
      }
      // A tuplet's number (and bracket) under its group.
      const cols = bar.columns.filter(p => !p.column.grace);
      for (const { from, to } of tupletGroups(cols.map(p => p.column))) {
        add('tuplet', cols[from].index, null, cols[from].x - 6, rows.tuplet - 12, cols[to].x + 6, rows.tuplet + 4, cols[to].index);
      }
    }
  });
  return out;
}

/** How far round a note's number a press is on the note, not a mark drawn near it. */
const NUMBER_REACH = { x: 7, y: 7 };

/**
 * The mark under a point; null when there is none, or when the point is on a note's number (the
 * note wins). Where marks overlap, the smallest box wins: it is the one aimed at.
 */
export function markAt(layout: Layout, x: number, y: number): MarkHit | null {
  const { rows } = layout;
  const si = Math.floor(y / rows.height);
  const system = layout.systems[si];
  if (!system || y < 0) return null;
  const localY = y - si * rows.height;
  const onNumber = system.bars.some(bar => bar.columns.some(c => Math.abs(c.x - x) <= NUMBER_REACH.x
    && c.column.notes.some((n, s) => n && Math.abs(stringY(rows, s) - localY) <= NUMBER_REACH.y)));
  if (onNumber) return null;
  let best: { hit: MarkHit; area: number } | null = null;
  for (const { hit, box } of markBoxes(layout)) {
    if (x < box.x || x > box.x + box.width || y < box.y || y > box.y + box.height) continue;
    const area = box.width * box.height;
    if (!best || area < best.area) best = { hit, area };
  }
  return best?.hit ?? null;
}

/** Whether two hits are the same mark. */
export function sameMark(a: MarkHit, b: MarkHit): boolean {
  return a.mark === b.mark && a.index === b.index && a.string === b.string;
}

/** The box a picked mark is outlined with, and its Delete button goes beside; null when it isn't drawn now. */
export function markBox(layout: Layout, hit: MarkHit): Box | null {
  return markBoxes(layout).find(m => sameMark(m.hit, hit))?.box ?? null;
}

/** The note a mark is on, or the column's notes for a mark over the whole column. */
function markNotes(clip: Clip, hit: MarkHit): Note[] {
  const column = columnAtIndex(clip, hit.index);
  if (!column) return [];
  if (hit.string !== null) {
    const note = column.notes[hit.string];
    return note ? [note] : [];
  }
  return column.notes.filter((n): n is Note => n !== null);
}

function columnAtIndex(clip: Clip, index: number) {
  let left = index;
  for (const bar of clip.bars) {
    if (left < bar.columns.length) return bar.columns[left];
    left -= bar.columns.length;
  }
  return null;
}

/** The palette tool that sets a mark as it is now, lit while it is picked; null once it is gone. */
export function markTool(clip: Clip, hit: MarkHit): ToolId | null {
  const column = columnAtIndex(clip, hit.index);
  const notes = markNotes(clip, hit);
  const note = hit.string !== null ? notes[0] : undefined;
  switch (hit.mark) {
    case 'bend': return note?.bend ? (note.bend.pre ? 'preBend' : 'bend') : null;
    case 'slideOut': return note?.slideOut === 'down' ? 'slideOutDown' : note?.slideOut === 'up' ? 'slideOutUp' : null;
    case 'tap': return note?.tap ? 'tap' : null;
    case 'legato': return note?.legato ? 'legato' : null;
    case 'tie': return note?.tie ? 'tie' : null;
    case 'slide': {
      const tools = { legato: 'slide', shift: 'shiftSlide', below: 'slideBelow', above: 'slideAbove' } as const;
      return note?.slide ? tools[note.slide] : null;
    }
    case 'vibrato': return notes.some(n => n.vibrato) ? 'vibrato' : null;
    case 'pinch': return notes.some(n => n.harmonic === 'pinch') ? 'pinchHarmonic' : null;
    case 'accent': {
      const accent = column ? columnAccent(column) : undefined;
      return accent === 'heavy' ? 'heavyAccent' : accent === 'normal' ? 'accent' : null;
    }
    case 'staccato': return notes.some(n => n.staccato) ? 'staccato' : null;
    case 'stroke': return column?.stroke === 'down' ? 'strokeDown' : column?.stroke === 'up' ? 'strokeUp' : null;
    case 'tremolo': {
      const tools = { 8: 'tremolo8', 16: 'tremolo16', 32: 'tremolo32' } as const;
      return column?.tremolo ? tools[column.tremolo] : null;
    }
    case 'tuplet': return column?.duration.tuplet ? 'tuplet' : null;
  }
}
