/**
 * The technique marks drawn on and over the tab, as things a press can pick (issue #128;
 * `docs/specs/2026-10-27-tab-pick-marks-design.md`): where each one is, which palette tool sets it,
 * and taking it away. Pure; the boxes follow what `TabClip.tsx` draws.
 */
import { bendCarries, bendRaises, columnAccent, columnMordent, isRest, TREMOLO_VALUES, tupletGroups, type Clip, type Note } from './clip';
import { BEND_LABEL_STEP, BEND_RISE, SPACE, stepY, stringY, type Layout } from './layout';
import { previousSpots, vibratoRuns } from './runs';
import { GLYPHS } from './smufl';
import { staffMarks } from './staffMarks';
import type { ToolId } from './tools';

/** The marks a press can pick. P.M. and let ring lines pick their run instead (`runAt`). */
export type DrawnMark =
  | 'bend' | 'slideOut' | 'tap' | 'legato' | 'slide' | 'tie'
  | 'vibrato' | 'mordent' | 'pinch' | 'accent' | 'staccato' | 'stroke' | 'wah' | 'tremolo' | 'tuplet' | 'ottava';

/** A drawn mark: what it is, its column's place in the clip, and its note's string (null for a mark over the whole column). */
export interface MarkHit {
  kind: 'mark';
  mark: DrawnMark;
  index: number;
  string: number | null;
  /** The last column of a mark drawn across several: a tuplet's group, a vibrato's run, an octave line. */
  to?: number;
  /** Pressed where the notation staff draws it, not on the tab: its outline goes there. */
  on?: 'staff';
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A vibrato's wave from just right of `x` to about `end`, in whole turns (at least one). A wide one is
 * heavier, its turns short and close as Guitar Pro prints it (Sweet Child O' Mine, bar 25).
 */
export function vibratoWave(x: number, y: number, wide: boolean, end: number): { d: string; width: number; strokeWidth: number } {
  const [width, height] = wide ? [3.6, 5] : [6, 4];
  const turns = Math.max(1, Math.round((end - x - 4) / (2 * width)));
  let d = `M${x + 4} ${y}`;
  for (let k = 0; k < turns; k++) d += ` q${width / 2} -${height} ${width} 0 q${width / 2} ${height} ${width} 0`;
  return { d, width: 2 * width * turns, strokeWidth: wide ? 2.2 : 1.2 };
}

/**
 * A mordent's sign centred on (x, y), as Guitar Pro prints it over the staff and the tab: an upper
 * mordent the short wavy line, a lower one with a stroke through it (Bravura's ornamentShortTrill and
 * ornamentMordent), about a note head and a half wide.
 */
export function mordentSign(x: number, y: number, kind: 'upper' | 'lower'): { d: string; transform: string; box: Box } {
  const glyph = GLYPHS[kind === 'upper' ? 'ornamentShortTrill' : 'ornamentMordent'];
  const scale = SPACE * MORDENT_SCALE;
  const width = glyph.width * scale;
  // The upper sign sits on its baseline, 0.98 spaces tall; the lower one's stroke reaches 0.29 under it.
  const left = x - width / 2;
  const base = y + 0.49 * scale;
  return {
    d: glyph.d,
    transform: `translate(${left} ${base}) scale(${scale})`,
    box: { x: left, y: base - 1.3 * scale, width, height: 1.6 * scale },
  };
}
/** A mordent's size against the staff's glyphs. */
const MORDENT_SCALE = 0.55;

/** A thin mark's hit area reaches this far above and below it, so the mouse finds it. */
const THIN_REACH = 8;

/** Every picked-able mark on the tab and the box round it, in the tab's units, top line first. */
export function markBoxes(layout: Layout): { hit: MarkHit; box: Box }[] {
  const { rows } = layout;
  const out: { hit: MarkHit; box: Box }[] = [];
  const previous = previousSpots(layout.systems);
  const bars = { bars: layout.systems.flatMap(sys => sys.bars.map(b => b.bar)) };
  const carries = bendCarries(bars);
  const raises = bendRaises(bars);
  const onStaff = staffMarks(layout);
  layout.systems.forEach((system, si) => {
    const top = si * rows.height;
    const add = (mark: DrawnMark, index: number, string: number | null, x0: number, y0: number, x1: number, y1: number, to?: number) => {
      out.push({ hit: { kind: 'mark', mark, index, string, ...(to === undefined ? {} : { to }) }, box: { x: x0, y: top + y0, width: x1 - x0, height: y1 - y0 } });
    };
    /** A row's thin mark: tall enough to press. */
    const rowMark = (mark: DrawnMark, index: number, x0: number, x1: number, rowY: number) =>
      add(mark, index, null, x0, rowY - THIN_REACH, x1, rowY + THIN_REACH);
    // A vibrato over neighbouring notes is one wave, picked whole.
    if (rows.vibrato !== null) {
      for (const run of vibratoRuns(system)) {
        const { width } = vibratoWave(run.from.x, rows.vibrato, run.kind === 'wide', run.end);
        add('vibrato', run.from.index, null, run.from.x + 2, rows.vibrato - THIN_REACH, run.from.x + 6 + width, rows.vibrato + THIN_REACH, run.to.index);
      }
    }
    for (const bar of system.bars) {
      for (const { column, x, index } of bar.columns) {
        const notes = column.notes.filter((n): n is Note => n !== null);
        const mordent = columnMordent(column);
        if (mordent && rows.vibrato !== null) {
          const { box } = mordentSign(x, rows.vibrato, mordent);
          add('mordent', index, null, box.x - 2, rows.vibrato - THIN_REACH, box.x + box.width + 2, rows.vibrato + THIN_REACH);
        }
        if (column.stroke && rows.strokes !== null) rowMark('stroke', index, x - 7, x + 7, rows.strokes);
        if (column.wah && rows.wah !== null) rowMark('wah', index, x - 7, x + 7, rows.wah);
        if (notes.some(n => n.harmonic === 'pinch') && rows.harmonics !== null) rowMark('pinch', index, x - 11, x + 11, rows.harmonics);
        const accent = columnAccent(column);
        const staccato = notes.some(n => n.staccato);
        if (rows.accents !== null && (accent || staccato)) {
          const y = rows.accents;
          // With both, the accent sits over the dot and each takes its own half.
          if (accent) add('accent', index, null, x - 7, y - 2 - THIN_REACH, x + 7, staccato ? y + 3 : y + THIN_REACH);
          if (staccato) add('staccato', index, null, x - 6, accent ? y + 3 : y - THIN_REACH, x + 6, (accent ? y + 6 : y) + THIN_REACH);
        }
        // Under a staff the tab has no stems: the staff carries tremolo slashes and tuplet numbers.
        if (column.tremolo && !isRest(column) && !column.grace && rows.tabStems) {
          const value = column.duration.value;
          const slashes = TREMOLO_VALUES.indexOf(column.tremolo) + 1;
          const y0 = value === 2 ? rows.stemBottom - 12 : rows.stemTop + (value === 1 ? 2 : 0);
          add('tremolo', index, null, x - 7, y0, x + 7, y0 + 6 + slashes * 4);
        }
        column.notes.forEach((note, s) => {
          if (!note || !rows.tab) return;
          const y = stringY(rows, s);
          const before = previous.get(note);
          const fromX = before && before.system === si ? before.x : system.staffStart;
          const carry = carries.get(note);
          if (carry) {
            // A held bend's dashed line, or a release's arrow down to the string.
            // A bend pushed on up stands a line higher, its label over it (`BendCarry`).
            const peak = rows.staffTop - BEND_RISE - (raises.get(note) ?? 0) * BEND_LABEL_STEP;
            const from = (before && before.system === si ? fromX : system.staffStart - 14) + 14;
            if (note.bend?.from !== undefined) add('bend', index, s, from, peak - 19, x + 20, peak + BEND_LABEL_STEP + THIN_REACH);
            else if (carry === 'hold') add('bend', index, s, from, peak - THIN_REACH, x + 14, peak + THIN_REACH);
            else add('bend', index, s, Math.min(from, x - 10), peak - THIN_REACH, x + 6, y + 2);
          } else if (note.bend) {
            const peak = rows.staffTop - BEND_RISE;
            const { pre, release } = note.bend;
            // The arrow and its label over the staff; a pre-bend's stands straight up from the number.
            if (pre) add('bend', index, s, x - 15, peak - 19, release ? x + 20 : x + 15, y - 8);
            // A tied note's arrow may rise by the number it is tied from (`BendDrawing`).
            else add('bend', index, s, (note.tie && before?.system === si ? fromX : x) + 6, peak - 19, release ? x + 29 : x + 23, y - 1);
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
      const cols = rows.tabStems ? bar.columns.filter(p => !p.column.grace) : [];
      for (const { from, to } of tupletGroups(cols.map(p => p.column))) {
        add('tuplet', cols[from].index, null, cols[from].x - 6, rows.tuplet - 12, cols[to].x + 6, rows.tuplet + 4, cols[to].index);
      }
    }
    for (const { hit, box } of onStaff[si]) out.push({ hit, box: { ...box, y: top + box.y } });
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
  const onNumber = rows.tab && system.bars.some(bar => bar.columns.some(c => Math.abs(c.x - x) <= NUMBER_REACH.x
    && c.column.notes.some((n, s) => n && Math.abs(stringY(rows, s) - localY) <= NUMBER_REACH.y)));
  // A note head on the staff is the note too.
  const score = rows.score;
  const onHead = score !== null && system.bars.some(bar => bar.columns.some(c => Math.abs(c.x - x) <= NUMBER_REACH.x
    && c.heads.some(h => Math.abs(stepY(score, h.step) - localY) <= SPACE / 2 + 1)));
  if (onNumber || onHead) return null;
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
  const found = markBoxes(layout).filter(m => sameMark(m.hit, hit));
  // Drawn on both the staff and the tab: outlined where it was pressed.
  return (found.find(m => m.hit.on === hit.on) ?? found[0])?.box ?? null;
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
    case 'ottava': return column?.ottava ? 'ottava' : null;
    case 'pinch': return notes.some(n => n.harmonic === 'pinch') ? 'pinchHarmonic' : null;
    case 'accent': {
      const accent = column ? columnAccent(column) : undefined;
      return accent === 'heavy' ? 'heavyAccent' : accent === 'normal' ? 'accent' : null;
    }
    case 'staccato': return notes.some(n => n.staccato) ? 'staccato' : null;
    case 'mordent': {
      const mordent = column ? columnMordent(column) : undefined;
      return mordent === 'upper' ? 'mordent' : mordent === 'lower' ? 'lowerMordent' : null;
    }
    case 'stroke': return column?.stroke === 'down' ? 'strokeDown' : column?.stroke === 'up' ? 'strokeUp' : null;
    case 'wah': return column?.wah ? 'wah' : null;
    case 'tremolo': {
      const tools = { 8: 'tremolo8', 16: 'tremolo16', 32: 'tremolo32' } as const;
      return column?.tremolo ? tools[column.tremolo] : null;
    }
    case 'tuplet': return column?.duration.tuplet ? 'tuplet' : null;
  }
}
