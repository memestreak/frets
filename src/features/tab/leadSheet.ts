/*
 * The lead sheet (issue #295, `docs/specs/2026-11-08-tab-lead-sheet-design.md`): the clip as a grid of
 * bars, a box per bar with the chord names at their time and a light slash on each beat with none, as
 * iReal Pro and Nashville charts draw it. Pure: where everything goes, what a press is on, and the keys.
 */
import {
  barNumber, barSpan, barsPerLine, changesTime, groupCountsAt, meterOffset, ticks, timeAt, WHOLE,
  type Column, type Part, type Section, type TimeSignature,
} from './clip';
import { BEAT_TEXT_LINE, BEAT_TEXT_SIZE, beatTextWidth, placeBeatTexts } from './beatText';
import { indexOf, placeOf, type Cursor } from './editing';
import { prettyChord } from './widths';
import type { WordHit } from './layoutText';
import { showsBarNumber, type BarNumbers } from './viewOptions';

/** Bars a row when the arrangement sets no line breaks of its own. */
export const LEAD_BARS_PER_ROW = 4;
/** The narrowest a box gets: a row holds fewer bars rather than boxes narrower than this. */
export const MIN_BOX = 90;
/** Room before the first box of each row, for a time signature. */
export const LEAD_LEFT = 24;
/** Room after the last box, for the thick end line. */
const LEAD_RIGHT = 6;
export const BOX_HEIGHT = 56;
/** A chord name's size, and the smallest it is made to fit beside the next. */
export const LEAD_NAME_SIZE = 20;
const MIN_NAME_SIZE = 11;
/** How wide a name is drawn per character, in its size. */
const NAME_CHAR = 0.62;
/** Inside a box: before its first time, and after its last. */
const INSET = 14;
const END_INSET = 10;
/** Inside a box, in front of a time signature that changes there. */
const TIME_ROOM = 16;
/** Inside a box, after a repeat's start sign. */
const REPEAT_ROOM = 8;
export const LEAD_TIME_SIZE = 11;
/** The rows over the boxes, when a row has one: its section, its texts, its endings' brackets. */
export const SECTION_ROW = 22;
export const TEXT_SIZE = BEAT_TEXT_SIZE;
export const TEXT_LINE = BEAT_TEXT_LINE;
export const ENDING_ROW = 14;
/** The room under each row's boxes: where lyrics will go (issue #408). */
export const LYRIC_ROOM = 24;
/** Room over the first row. */
const TOP = 6;
/** Where a slash is drawn from its beat's start, and half its width. */
export const SLASH_IN = 8;
export const SLASH_HALF = 5;

/** A chord name in a box: an own column's (`index`), or carried on from an earlier bar or another Voice (null). */
export interface LeadChord {
  name: string;
  /** Its column's place in the part, which a press picks; null for a name no press picks. */
  index: number | null;
  /** Its time from the bar's start, in ticks. */
  at: number;
  x: number;
  /** Carried on from before: the chord still sounding at the bar's start. */
  carried: boolean;
}

/** A free text over a box, at its column's time: wrapped, and stacked clear of the row's others (`placeBeatTexts`). */
export interface LeadText {
  text: string;
  index: number;
  x: number;
  lines: string[];
  /** Its first line's place in the row's text lines, from the top. */
  top: number;
}

/** One bar's box. */
export interface LeadBox {
  bar: number;
  /** The box's left and right edges. */
  x0: number;
  x1: number;
  /** Where its time runs, from its start to its end. */
  from: number;
  to: number;
  /** The bar's length in ticks, and each own column's start in it (graces at the next one's). */
  span: number;
  starts: number[];
  chords: LeadChord[];
  /** Each name's size: names that would touch are drawn smaller (`LEAD_NAME_SIZE` at most). */
  nameSize: number;
  slashes: number[];
  texts: LeadText[];
  /** No notes in any Voice and no chord name: an empty box. */
  silent: boolean;
  /** Drawn when the bar starts the clip or changes it; `timeX` its centre. */
  time: TimeSignature | null;
  timeX: number;
  /** The bar's number, drawn small in its corner; null when Bar numbers leave it out. */
  number: number | null;
  repeatStart: boolean;
  /** The times a repeat ending here is played; none for no repeat. */
  repeatEnd: number | null;
  ending: number | null;
  doubleBar: boolean;
  /** The clip's last bar: a thick line at its end. */
  last: boolean;
}

export interface LeadRow {
  /** The row's top, and where its rows over the boxes and the boxes are, all from the drawing's top. */
  top: number;
  sectionY: number | null;
  textY: number | null;
  endingY: number | null;
  boxTop: number;
  boxBottom: number;
  /** Where lyrics will go: the gap under the boxes. */
  lyricsY: number;
  section: { bar: number; section: Section } | null;
  boxes: LeadBox[];
}

export interface LeadLayout {
  width: number;
  height: number;
  rows: LeadRow[];
}

/** A name's width at `size`. */
export function nameWidth(name: string, size = LEAD_NAME_SIZE): number {
  return prettyChord(name).length * size * NAME_CHAR;
}

/** A section's label as drawn: its rehearsal mark, then its text. */
export function sectionWidth(section: Section): number {
  return (section.marker ? section.marker.length * 9 + 12 : 0) + section.text.length * 8;
}

/** The beats a bar's slashes go on, as times from its start: its beats over a quarter or longer, else its Beat groups. */
export function leadBeats(clip: Pick<Part, 'time' | 'bars'>, bar: number): number[] {
  const time = timeAt(clip, bar);
  const unit = WHOLE / time.value;
  const lengths = time.value <= 4 ? Array<number>(time.beats).fill(unit) : groupCountsAt(clip, bar).map(n => n * unit);
  // A Pickup bar is the end of a full bar: only the beats that start in it.
  const offset = meterOffset(clip, bar);
  const span = barSpan(clip, bar);
  const starts: number[] = [];
  let t = 0;
  for (const length of lengths) {
    if (t - offset >= 0 && t - offset < span) starts.push(t - offset);
    t += length;
  }
  return starts;
}

/** Each column's start in its bar, a grace note at the start of what follows it. */
function columnStarts(columns: readonly Column[]): number[] {
  let t = 0;
  return columns.map(c => {
    const at = t;
    if (!c.grace) t += ticks(c.duration);
    return at;
  });
}

/** Whether a bar's Voices hold a note (grace notes too). */
function sounds(clip: Part, bar: number): boolean {
  const b = clip.bars[bar];
  const columns = [b.columns, ...(b.otherVoices ?? []).map(o => o.columns)];
  return columns.some(cs => cs.some(c => c.notes.some(n => n !== null)));
}

/** The bars of each row: the arrangement's own bars per line (four when it sets none), a section starting a row, as many as fit. */
function rowsOf(clip: Part, width: number): { bars: number[]; target: number }[] {
  const fit = Math.max(1, Math.floor((width - LEAD_LEFT - LEAD_RIGHT) / MIN_BOX));
  const target = (line: number) => Math.min(fit, barsPerLine(clip, line) ?? LEAD_BARS_PER_ROW);
  const rows: { bars: number[]; target: number }[] = [];
  let row: number[] = [];
  for (let b = 0; b < clip.bars.length; b++) {
    if (row.length > 0 && (row.length >= target(rows.length) || clip.bars[b].section)) {
      rows.push({ bars: row, target: target(rows.length) });
      row = [];
    }
    row.push(b);
  }
  if (row.length > 0) rows.push({ bars: row, target: target(rows.length) });
  return rows;
}

/**
 * The chord names of a bar: its own columns' at their time, another Voice's where Voice 1 has none, and the
 * chord still sounding at its start when no new one starts there.
 */
function chordsOf(clip: Part, bar: number, starts: number[], carried: string | null): LeadChord[] {
  const b = clip.bars[bar];
  const own: LeadChord[] = b.columns.flatMap((c, i) => (c.chord ? [{ name: c.chord, index: indexOf(clip, bar, i), at: starts[i], x: 0, carried: false }] : []));
  for (const other of b.otherVoices ?? []) {
    const at = columnStarts(other.columns);
    other.columns.forEach((c, i) => {
      if (c.chord && !own.some(o => o.at === at[i])) own.push({ name: c.chord, index: null, at: at[i], x: 0, carried: false });
    });
  }
  own.sort((p, q) => p.at - q.at);
  if (carried && !own.some(c => c.at === 0)) own.unshift({ name: carried, index: null, at: 0, x: 0, carried: true });
  return own;
}

/**
 * Which beats get a slash: each with no chord starting in it and none drawn over it. A name covers the
 * beats after its own while it is drawn, at least a fifth of the next (so "G" on beat 1 of 4/4 covers
 * beat 2, as the design's mock draws it); counted in beats, so it doesn't change with the width.
 */
function slashBeats(beats: number[], span: number, chords: LeadChord[]): number[] {
  const end = (k: number) => beats[k + 1] ?? span;
  // A chord's place in beats: its beat, and how far through it.
  const place = (at: number) => {
    const k = Math.max(0, beats.findLastIndex(s => s <= at));
    return k + (at - beats[k]) / (end(k) - beats[k]);
  };
  return beats.flatMap((s, k) => {
    if (chords.some(c => c.at >= s && c.at < end(k))) return [];
    const covered = chords.some(c => {
      const from = place(c.at);
      return k > from && k < from + Math.max(1.2, prettyChord(c.name).length * 0.45 + 0.6);
    });
    return covered ? [] : [s];
  });
}

/** The lead sheet at `width`: its rows of boxes, each laid out. */
export function layoutLeadSheet(clip: Part, width: number, barNumbers: BarNumbers = 'every'): LeadLayout {
  const rows: LeadRow[] = [];
  let carried: string | null = null;
  let y = TOP;
  for (const { bars, target } of rowsOf(clip, width)) {
    // Every box as wide as a full row's, so a row cut short by a section lines up with a full one.
    const boxWidth = (width - LEAD_LEFT - LEAD_RIGHT) / target;
    const first = bars[0];
    const section = clip.bars[first].section ? { bar: first, section: clip.bars[first].section! } : null;
    const boxes = bars.map((bar, k): LeadBox => {
      const b = clip.bars[bar];
      const x0 = LEAD_LEFT + k * boxWidth;
      const x1 = x0 + boxWidth;
      const time = bar === 0 || changesTime(clip, bar) ? timeAt(clip, bar) : null;
      // A time signature at a row's start goes before the box; elsewhere just inside it.
      const inside = time !== null && k > 0;
      // Clear of a time signature inside the box, and of a repeat sign's dots.
      const from = x0 + INSET + (inside ? TIME_ROOM : 0) + (b.repeatStart ? REPEAT_ROOM : 0);
      const to = x1 - END_INSET;
      const span = barSpan(clip, bar);
      const starts = columnStarts(b.columns);
      const xAt = (t: number) => from + (span > 0 ? (Math.min(t, span) / span) * (to - from) : 0);
      const named = b.columns.some(c => c.chord) || (b.otherVoices ?? []).some(o => o.columns.some(c => c.chord));
      const silent = !sounds(clip, bar) && !named;
      const chords = silent ? [] : chordsOf(clip, bar, starts, carried).map(c => ({ ...c, x: xAt(c.at) }));
      const own = chords.filter(c => !c.carried);
      if (own.length > 0) carried = own[own.length - 1].name;
      // Names that would touch the next, or the box's end, are drawn smaller.
      let nameSize = LEAD_NAME_SIZE;
      chords.forEach((c, i) => {
        const room = (chords[i + 1]?.x ?? to + END_INSET - 2) - c.x - 4;
        const w = nameWidth(c.name);
        if (w > room) nameSize = Math.min(nameSize, (LEAD_NAME_SIZE * room) / w);
      });
      nameSize = Math.max(MIN_NAME_SIZE, nameSize);
      // A narrow box's names may reach further than their beats: no slash is drawn under one.
      const underName = (x: number) => chords.some(c => x + SLASH_IN + SLASH_HALF >= c.x - 2 && x + SLASH_IN - SLASH_HALF <= c.x + nameWidth(c.name, nameSize) + 2);
      const slashes = silent ? [] : slashBeats(leadBeats(clip, bar), span, chords).map(xAt).filter(x => !underName(x));
      const texts = b.columns.flatMap((c, i) => (c.text ? [{ text: c.text, index: indexOf(clip, bar, i), x: xAt(starts[i]), lines: [c.text], top: 0 }] : []));
      return {
        bar, x0, x1, from, to, span, starts, chords, nameSize, slashes, texts, silent,
        time, timeX: inside ? x0 + 4 + (b.repeatStart ? REPEAT_ROOM + 4 : 0) + TIME_ROOM / 2 : x0 - LEAD_LEFT / 2,
        number: showsBarNumber(barNumbers, k === 0) ? barNumber(clip, bar) : null,
        repeatStart: !!b.repeatStart,
        repeatEnd: b.repeatEnd ?? null,
        ending: b.ending ?? null,
        doubleBar: !!b.doubleBar,
        last: bar === clip.bars.length - 1,
      };
    });
    // The rows over the boxes, each only when the row has one.
    const top = y;
    const sectionY = section ? y : null;
    if (section) y += SECTION_ROW;
    // The row's texts wrap and stack clear of each other, as over the tab (issue #323).
    const texts = boxes.flatMap(b => b.texts);
    const stacked = placeBeatTexts(texts.map(t => ({ x0: t.x, text: t.text })), width - LEAD_RIGHT);
    texts.forEach((t, i) => {
      Object.assign(t, stacked.placed[i]);
      // One that would run off the right edge starts further left, so it is read whole.
      t.x = Math.max(0, Math.min(t.x, width - LEAD_RIGHT - Math.max(...t.lines.map(beatTextWidth))));
    });
    const textY = texts.length > 0 ? y : null;
    if (textY !== null) y += stacked.rows * TEXT_LINE + 4;
    const endingY = boxes.some(b => b.ending !== null) || boxes.some(b => b.repeatEnd !== null && b.repeatEnd > 2) ? y : null;
    if (endingY !== null) y += ENDING_ROW;
    const boxTop = y;
    y += BOX_HEIGHT;
    const boxBottom = y;
    const lyricsY = y;
    y += LYRIC_ROOM;
    rows.push({ top, sectionY, textY, endingY, boxTop, boxBottom, lyricsY, section, boxes });
  }
  return { width, height: y, rows };
}

/** A box and its row, by bar. */
export function boxOf(layout: LeadLayout, bar: number): { row: LeadRow; box: LeadBox } | null {
  for (const row of layout.rows) {
    const box = row.boxes.find(b => b.bar === bar);
    if (box) return { row, box };
  }
  return null;
}

/** Where a time in a box is drawn. */
export function boxX(box: LeadBox, t: number): number {
  return box.from + (box.span > 0 ? (Math.max(0, Math.min(t, box.span)) / box.span) * (box.to - box.from) : 0);
}

/** A chord name's box as drawn, from its baseline. */
export function chordBox(row: LeadRow, box: LeadBox, chord: LeadChord) {
  const base = nameBaseline(row);
  return { x0: chord.x - 2, x1: chord.x + nameWidth(chord.name, box.nameSize) + 2, y0: base - box.nameSize * 0.85, y1: base + 4 };
}
/** Where the names sit in a row's boxes. */
export const nameBaseline = (row: LeadRow) => row.boxTop + BOX_HEIGHT / 2 + 8;

/** A text's box: all its lines. */
export function textBoxOf(row: LeadRow, text: LeadText) {
  const y0 = row.textY! + text.top * TEXT_LINE;
  return { x0: text.x - 2, x1: text.x + Math.max(...text.lines.map(beatTextWidth)) + 2, y0, y1: y0 + text.lines.length * TEXT_LINE + 2 };
}
/** A text's line `i`'s baseline. */
export const textBaseline = (row: LeadRow, text: LeadText, i: number) => row.textY! + (text.top + i + 1) * TEXT_LINE - 2;

/** A section's box. */
export function sectionBoxOf(row: LeadRow) {
  const x0 = row.boxes[0].x0;
  return { x0: x0 - 2, x1: x0 + sectionWidth(row.section!.section) + 4, y0: row.sectionY!, y1: row.sectionY! + SECTION_ROW };
}

/** What a press is on: a word (an own chord name, a text, a section) or a beat, the column sounding at its start. */
export type LeadHit = WordHit | { kind: 'beat'; bar: number; column: number };

const inBox = (x: number, y: number, b: { x0: number; x1: number; y0: number; y1: number }) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;

/** The column sounding at a time in a bar: the last starting at or before it (an empty bar's first place, 0). */
export function columnAtTime(box: LeadBox, t: number): number {
  let column = 0;
  box.starts.forEach((s, i) => {
    if (s <= t) column = i;
  });
  return column;
}

/** What a press at (x, y), in the drawing's units, is on; null off every box and word. */
export function leadAt(clip: Part, layout: LeadLayout, x: number, y: number): LeadHit | null {
  for (const row of layout.rows) {
    if (row.section && inBox(x, y, sectionBoxOf(row))) return { kind: 'section', bar: row.section.bar };
    for (const box of row.boxes) {
      for (const text of box.texts) if (inBox(x, y, textBoxOf(row, text))) return { kind: 'text', index: text.index };
      for (const chord of box.chords) if (chord.index !== null && inBox(x, y, chordBox(row, box, chord))) return { kind: 'chord', index: chord.index };
    }
    if (y < row.boxTop || y > row.boxBottom) continue;
    const box = row.boxes.find(b => x >= b.x0 && x <= b.x1);
    if (!box) continue;
    // The beat the press is in, its start the time looked at.
    const t = box.span * Math.max(0, Math.min(1, (x - box.from) / (box.to - box.from)));
    const beats = leadBeats(clip, box.bar);
    const beat = beats.findLast(s => s <= t) ?? 0;
    return { kind: 'beat', bar: box.bar, column: columnAtTime(box, beat) };
  }
  return null;
}

/** Where the caret is drawn: at its column's time in its bar's box. */
export function leadCaret(layout: LeadLayout, at: { bar: number; column: number }): { x: number; y0: number; y1: number } | null {
  const found = boxOf(layout, at.bar);
  if (!found) return null;
  const { row, box } = found;
  return { x: boxX(box, box.starts[at.column] ?? 0) - 3, y0: row.boxTop + 6, y1: row.boxBottom - 6 };
}

/** Where a column `through` of the way through is heard, for the playhead: its time in its box. */
export function leadPlayX(clip: Part, layout: LeadLayout, index: number, through: number): { x: number; y0: number; y1: number } | null {
  const { bar, column } = placeOf(clip, index);
  const found = boxOf(layout, bar);
  const c = clip.bars[bar]?.columns[column];
  if (!found || !c) return null;
  const { row, box } = found;
  const t = (box.starts[column] ?? 0) + (c.grace ? 0 : through * ticks(c.duration));
  return { x: boxX(box, t), y0: row.boxTop + 2, y1: row.boxBottom - 2 };
}

/** Where a word's field opens over the lead sheet: over its row's word, or the box, kept inside the width. */
export function leadWordSpot(layout: LeadLayout, width: number, word: { kind: string; bar: number; column: number }): { x: number; y: number } {
  const FIELD_WIDTH = 180;
  const FIELD_HEIGHT = 64;
  const found = boxOf(layout, word.bar);
  if (!found) return { x: FIELD_WIDTH / 2, y: 0 };
  const { row, box } = found;
  const x = word.kind === 'chord' || word.kind === 'text' ? boxX(box, box.starts[word.column] ?? 0) : box.x0 + FIELD_WIDTH / 2;
  const over = word.kind === 'section' ? row.sectionY ?? row.top : word.kind === 'text' ? row.textY ?? row.boxTop : row.boxTop + 6;
  return { x: Math.min(width - FIELD_WIDTH / 2, Math.max(FIELD_WIDTH / 2, x)), y: Math.max(0, over - FIELD_HEIGHT + 20) };
}

/** A key on the lead sheet: where the caret goes, or what to do; null for a key it doesn't take. */
export type LeadKey = { move: { bar: number; column: number } } | { act: 'chord' | 'edit' | 'delete' | 'letGo' };

/**
 * The lead sheet's keys (spec "Editing"): Left and Right a column, Ctrl/⌘ with them a bar, C a chord name at
 * the caret, Enter and Delete on what is picked, Esc lets go. Nothing else: notes aren't edited here.
 */
export function leadKey(clip: Part, cursor: Cursor, picked: boolean, e: { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; shiftKey?: boolean }): LeadKey | null {
  const mod = !!(e.ctrlKey || e.metaKey);
  if (e.key === 'Escape') return { act: 'letGo' };
  if (picked && e.key === 'Enter') return { act: 'edit' };
  if (picked && (e.key === 'Delete' || e.key === 'Backspace')) return { act: 'delete' };
  if (e.altKey || e.shiftKey) return null;
  if (!mod && (e.key === 'c' || e.key === 'C')) return { act: 'chord' };
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return null;
  const step = e.key === 'ArrowLeft' ? -1 : 1;
  if (mod) {
    const bar = Math.max(0, Math.min(clip.bars.length - 1, cursor.bar + step));
    return { move: { bar, column: 0 } };
  }
  const columns = clip.bars[cursor.bar]?.columns.length ?? 0;
  const next = cursor.column + step;
  if (next >= 0 && next < columns) return { move: { bar: cursor.bar, column: next } };
  if (step < 0 && cursor.bar > 0) {
    const bar = cursor.bar - 1;
    return { move: { bar, column: Math.max(0, clip.bars[bar].columns.length - 1) } };
  }
  if (step > 0 && cursor.bar < clip.bars.length - 1) return { move: { bar: cursor.bar + 1, column: 0 } };
  return { move: { bar: cursor.bar, column: cursor.column } };
}
