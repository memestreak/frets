/**
 * Where everything in a clip goes when drawn at a given width: systems
 * (lines of tab), bars and columns, in SVG units. Pure; `TabClip.tsx` only
 * draws what this returns, so the page and the exported images agree.
 */
import {
  STRING_COUNT, beatTicks, changesKey, changesTime, isLetRing, isPalmMuted, isRest, isStandardTuning, keyAt, ticks, timeAt, WHOLE,
  type Bar, type Clip, type Column, type Note, type Section, type Tempo,
} from './clip';
import { accidentalLanes, barHeads, MIDDLE_STEP, openStrings, type Head } from './notation';

/**
 * What the Notation view draws (Jeremy, 2026-10-27; `docs/specs/2026-10-27-tab-notation-design.md`):
 * the tab, the staff, or both, the staff over the tab.
 */
export type Parts = 'tab' | 'staff' | 'both';
export const PARTS: readonly Parts[] = ['staff', 'tab', 'both'];
/** Which parts the viewer last chose, kept for the next visit (not in the clip). */
export const PARTS_KEY = 'frets.tab.parts';

/** A saved choice of parts; the tab alone when missing or invalid. */
export function parseParts(saved: unknown): Parts {
  return PARTS.find(p => p === saved) ?? 'tab';
}

/* — vertical rows of one system, from its top — */

/**
 * Where things go up and down in every system of a clip, in SVG units from the system's top. The
 * rows above the staff are there only when the clip uses them (null otherwise), each a line of its
 * own so marks never collide; the same rows go in every system, so the lines of tab look alike.
 */
export interface Rows {
  /** "Capo 3" over the start of the first line. */
  capo: number | null;
  /** A tempo over the bar it starts at. */
  tempo: number | null;
  /** A section's name, boxed, over the bar it starts at. */
  section: number | null;
  /** Ending brackets and repeat counts. */
  endings: number | null;
  /** Chord names over their columns. */
  chords: number | null;
  /** Free text over its column (alphaTex txt). */
  text: number | null;
  strokes: number | null;
  letRing: number | null;
  palmMute: number | null;
  /** "P.H." over pinch harmonics. */
  harmonics: number | null;
  vibrato: number | null;
  /** Accents and staccato dots. */
  accents: number | null;
  /** The notation staff, over the tab, when it is drawn. */
  score: ScoreRows | null;
  /** Whether the tab is drawn, and whether it has its own stems (not under a staff, which has them). */
  tab: boolean;
  tabStems: boolean;
  /** The cursor's band, the selection and the playhead: over the tab, and the staff too when it is drawn. */
  bandTop: number;
  bandBottom: number;
  /** The loop's bracket, under the rhythm. */
  loopY: number;
  /** The top string. */
  staffTop: number;
  staffBottom: number;
  stemTop: number;
  stemBottom: number;
  tuplet: number;
  /** One system's height. */
  height: number;
}

/** Where the notation staff is: its top and bottom lines. */
export interface ScoreRows {
  top: number;
  bottom: number;
}

/** The notation staff's space between lines; a step (line to space) is half of it. */
export const SPACE = 9;
/** How far a stem reaches from its note head, in steps: three and a half spaces. */
export const STEM_STEPS = 7;

/** The y of a staff step (half spaces up from the bottom line) in a system. */
export function stepY(score: ScoreRows, step: number): number {
  return score.bottom - step * SPACE / 2;
}

export const STRING_GAP = 14;
const FIRST_ROW = 12;
const ROW_GAP = 15;
/** Room over the top string for bend arrows and their labels, and the H or P over a hammer-on. */
const STAFF_HEADROOM = 30;

/** The rows a clip needs, top to bottom: the words over everything, the staff, the tab's marks, the tab. */
export function rowsFor(clip: Clip, parts: Parts = 'tab', reach: StaffReach = { high: 8, low: 0 }): Rows {
  const tab = parts !== 'staff';
  const columns = clip.bars.flatMap(b => b.columns);
  const notes = columns.flatMap(c => c.notes).filter((n): n is Note => n !== null);
  const used = {
    capo: !!clip.capo,
    tempo: clip.bars.some(b => b.tempo),
    section: clip.bars.some(b => b.section),
    chords: columns.some(c => c.chord),
    text: columns.some(c => c.text),
    endings: clip.bars.some(b => b.ending !== undefined || (b.repeatEnd !== undefined && b.repeatEnd !== 2)),
    // Under the staff, or alone: strokes, let ring, P.M. and P.H. sit between the staff and the tab
    // (under the staff alone), as printed guitar music has them. Vibrato and accents go on the staff.
    strokes: columns.some(c => c.stroke),
    letRing: notes.some(n => n.letRing),
    palmMute: notes.some(n => n.palmMute),
    harmonics: notes.some(n => n.harmonic === 'pinch'),
    vibrato: parts === 'tab' && notes.some(n => n.vibrato),
    accents: parts === 'tab' && notes.some(n => n.accent || n.staccato),
  };
  let y = FIRST_ROW - ROW_GAP;
  // A row comes ROW_GAP after the one before, plus room for a section's box when either is the section row.
  let lastWasSection = false;
  const row = (on: boolean, section = false) => {
    if (!on) return null;
    const first = y === FIRST_ROW - ROW_GAP;
    y += ROW_GAP + (!first && (section || lastWasSection) ? SECTION_ROOM : 0);
    lastWasSection = section;
    return y;
  };
  const words = {
    capo: row(used.capo),
    tempo: row(used.tempo),
    section: row(used.section, true),
    endings: row(used.endings),
    chords: row(used.chords),
    text: row(used.text),
  };
  // The staff: room over its top line and under its bottom one for what reaches past them.
  let score: ScoreRows | null = null;
  if (parts !== 'tab') {
    const top = Math.max(y + 12, 10) + Math.max(SPACE, (reach.high - 8) * SPACE / 2 + 4);
    const bottom = top + 4 * SPACE;
    score = { top, bottom };
    y = bottom + Math.max(SPACE, -reach.low * SPACE / 2 + 4) - 4;
  }
  const marks = {
    strokes: row(used.strokes),
    letRing: row(used.letRing),
    palmMute: row(used.palmMute),
    harmonics: row(used.harmonics),
    vibrato: row(used.vibrato),
    accents: row(used.accents),
  };
  if (!tab) {
    // The staff alone: the tab's rows stand at the staff's foot, drawing nothing.
    const end = y + 12;
    return {
      ...words, ...marks, score, tab, tabStems: false, staffTop: end, staffBottom: end,
      bandTop: score!.top - 10, bandBottom: score!.bottom + 10, loopY: end,
      stemTop: end, stemBottom: end, tuplet: end, height: end + 8,
    };
  }
  const staffTop = Math.max(score ? score.bottom + 30 : STAFF_HEADROOM, y + 16);
  const staffBottom = staffTop + 5 * STRING_GAP;
  // Under a staff, the staff carries the rhythm (Jeremy, 2026-10-27): the tab has no stems.
  const tabStems = score === null;
  return {
    ...words, ...marks, score, tab, tabStems, staffTop, staffBottom,
    bandTop: (score ? score.top : staffTop) - 10, bandBottom: staffBottom + 10,
    loopY: tabStems ? staffBottom + 40 : staffBottom + 14,
    stemTop: staffBottom + 8, stemBottom: staffBottom + 32, tuplet: staffBottom + 45, height: tabStems ? staffBottom + 54 : staffBottom + 16,
  };
}

/** How far the staff's notes and stems reach, in steps: the highest over the top line, the lowest under the bottom one. */
export interface StaffReach {
  high: number;
  low: number;
}

const NAMES_WIDTH = 16;
const CLEF_WIDTH = 30;
const TIME_WIDTH = 30;
/** The notation staff's room for the first line's time signature, after the key signature, and the margin before its lines. */
const STAFF_TIME_WIDTH = 26;
const STAFF_MARGIN = 2;
/** In Both, room before the lines for the bracket that joins the staff and the tab. */
export const BRACKET_WIDTH = 10;
const BRACKET_MARGIN = BRACKET_WIDTH + 6;
/** Room for a time signature change, just inside the bar it starts. */
const BAR_TIME_WIDTH = 24;
const BAR_PAD_START = 14;
const BAR_PAD_END = 6;
const REPEAT_PAD = 12;
const EMPTY_BAR = 120;
const CHAR = 7.5;
/** A key signature's room per sharp or flat, and after the last. */
const KEY_SIGN_WIDTH = 8;
const KEY_PAD = 6;
/** Room left of a note head for one lane of sharps, flats and naturals. */
export const ACCIDENTAL_ROOM = 10;
/** A note head's width; a head a second from the one below it goes beside it, this far right. */
export const HEAD_WIDTH = 1.18 * SPACE;

/** How wide a key signature is drawn, with the room after it; none for C major. */
function keyWidth(fifths: number): number {
  return fifths === 0 ? 0 : Math.abs(fifths) * KEY_SIGN_WIDTH + KEY_PAD;
}

export interface PlacedColumn {
  column: Column;
  /** The column's place in the whole clip, counting from 0 (as `editing.ts` counts). */
  index: number;
  /** The column's centre. */
  x: number;
  width: number;
  /** On the staff: its note heads, low to high, and which way its stem goes. */
  heads: Head[];
  stemUp: boolean;
}

export interface PlacedBar {
  bar: Bar;
  /** The bar's index in the clip. */
  index: number;
  /** Where the bar starts (its opening line) and ends (its closing line). */
  x0: number;
  x1: number;
  /** Where a time signature change's numbers are centred, when the bar starts one. */
  timeX: number | null;
  /** On the staff: where a key signature change's first sign goes, when the bar starts one. */
  keyX: number | null;
  /** Ticks in one of its beats: eighths and shorter are beamed within one. */
  beat: number;
  columns: PlacedColumn[];
}

export interface System {
  bars: PlacedBar[];
  /** Where the time signature's numbers are centred, on the first line of tab only. */
  timeX: number | null;
  /** Where the staff lines and the opening line start: after the time signature and the names, if any. "TAB" sits on the lines. */
  lineStart: number;
  /** Where the first bar starts: after "TAB", and on the staff the clef and the key signature. */
  staffStart: number;
  /** On the staff: where the key signature's first sign goes. */
  keyX: number;
  first: boolean;
}

export interface Layout {
  parts: Parts;
  systems: System[];
  rows: Rows;
  height: number;
  /** Names to draw left of the strings, high string first, when the tuning isn't standard. */
  names: string[] | null;
}

/** A column's width: longer notes take more room, and its widest note must fit; a grace note takes little. */
export function columnWidth(column: Column): number {
  const byTime = column.grace ? 16 : 12 + 32 * Math.sqrt(ticks(column.duration) / (WHOLE / 4));
  // A bend's arrow and label stand right of the number; a release needs more.
  const bend = column.notes.some(n => n?.bend?.release) ? 30 : column.notes.some(n => n?.bend) ? 18 : 0;
  const slideOut = bend === 0 && column.notes.some(n => n?.slideOut) ? 12 : 0;
  return Math.max(byTime, minColumnWidth(column)) + bend + slideOut;
}

/** The least room a column's widest note needs. */
function minColumnWidth(column: Column): number {
  const widest = Math.max(1, ...column.notes.map(n => (n ? noteLabel(n).length : 0)));
  return Math.max(widest * charWidth(column) + 6, column.chord ? chordWidth(column.chord) + 6 : 0);
}

/** A grace note's numbers are drawn smaller than the rest. */
export const GRACE_SIZE = 9;
/** How wide one character of a column's numbers is drawn. */
export function charWidth(column: Column): number {
  return column.grace ? 5.5 : CHAR;
}

/* — words over the tab: chord names, sections and tempos, and how wide each is drawn — */

export const CHORD_SIZE = 12;
export function chordWidth(chord: string): number {
  return chord.length * 7;
}

export const BEAT_TEXT_SIZE = 11;
/** Free text starts a little left of its column's middle and runs right. */
export const BEAT_TEXT_INSET = 4;
export function beatTextWidth(text: string): number {
  return text.length * 5.6;
}

export const SECTION_SIZE = 11;
/** A section's boxes: their height and the room between the name and its box's sides. */
export const SECTION_BOX_HEIGHT = 16;
export const SECTION_PAD = 5;
/** Extra room above and below the section row, so its box stands clear of the rows beside it (Jeremy, 2026-10-27). */
const SECTION_ROOM = 5;
/** A section's rehearsal mark box (if any) and its name's box, from the bar's start. */
export function sectionBoxes(section: Section): { marker: { x: number; width: number } | null; text: { x: number; width: number } } {
  const marker = section.marker ? { x: 0, width: section.marker.length * 7 + 8 } : null;
  const x = marker ? marker.width + 4 : 0;
  return { marker, text: { x, width: section.text.length * 6.4 + 2 * SECTION_PAD } };
}

export const TEMPO_SIZE = 11;
/**
 * Where a tempo's parts go from the bar's start: the note, " = 60", then its word ("Slowly"), which
 * comes last so nothing has to be placed after text of unknown width. `width` is a guess, for presses.
 */
export function tempoParts(tempo: Tempo): { numberX: number; labelX: number; width: number } {
  const numberX = 8;
  const labelX = numberX + ` = ${tempo.bpm}`.length * 6.2 + 6;
  return { numberX, labelX, width: labelX + (tempo.label ? tempo.label.length * 6 : 0) };
}

/** Where the words over a bar start: just after its opening line. */
export function barTextX(bar: PlacedBar): number {
  return bar.x0 + 4;
}

/**
 * What is written on the string for a note: "5", "x", "<12>" for a natural harmonic, and in brackets
 * a tie, "(5)" with an arc from the note before, or a ghost note, "(5)" or "(x)" alone.
 */
export function noteLabel(note: Note): string {
  if (note.tie) return `(${note.fret})`;
  const label = note.fret === null ? 'x' : note.harmonic === 'natural' ? `<${note.fret}>` : String(note.fret);
  return note.ghost ? `(${label})` : label;
}

/** The room a bar takes before its first column: padding, a repeat's dots, and a time or key signature change. */
function barLead(bar: Bar, timeChange: boolean, keyChange: number): number {
  return BAR_PAD_START + (bar.repeatStart ? REPEAT_PAD : 0) + (timeChange ? BAR_TIME_WIDTH : 0) + keyChange;
}

/** A column's room on the staff too: its accidentals and a head set beside its neighbour a second away. */
function staffWidth(column: Column, heads: Head[]): number {
  const signs = signRoom(heads);
  const seconds = heads.some((h, k) => k > 0 && h.step - heads[k - 1].step === 1) ? HEAD_WIDTH : 0;
  return columnWidth(column) + signs + seconds;
}

/** The room a column's accidentals take left of its heads. */
export function signRoom(heads: Head[]): number {
  const lanes = accidentalLanes(heads).filter((l): l is number => l !== null);
  return lanes.length === 0 ? 0 : (Math.max(...lanes) + 1) * ACCIDENTAL_ROOM + 2;
}

/** Which way a column's stem goes: down when its heads sit mostly on or above the middle line. */
export function stemUpFor(heads: Head[]): boolean {
  if (heads.length === 0) return true;
  const far = heads[0].step + heads[heads.length - 1].step;
  return far < 2 * MIDDLE_STEP;
}

export function layoutClip(clip: Clip, width: number, parts: Parts = 'tab'): Layout {
  const staff = parts !== 'tab';
  const names = staff || isStandardTuning(clip.tuning) ? null : [...clip.tuning].reverse();
  // In front of the staff: the time signature (drawn on the first line only, but every line leaves its
  // room, so the lines start one under another), then the string names. On the notation staff the
  // clef and every line's key signature follow; the tab leaves the same room, so the bars line up.
  // With the notation staff, the first line's time signature goes after the clef and key signature
  // instead, as printed music has it (Jeremy, 2026-10-27).
  const lineStart = parts === 'both' ? BRACKET_MARGIN : staff ? STAFF_MARGIN : TIME_WIDTH + (names ? NAMES_WIDTH : 0);
  const widestKey = staff ? Math.max(0, ...clip.bars.map((_, b) => keyWidth(keyAt(clip, b).fifths))) : 0;
  const keyStart = lineStart + CLEF_WIDTH;
  const head = keyStart + widestKey;
  const firstKey = staff ? keyWidth(keyAt(clip, 0).fifths) : 0;
  const firstTimeX = staff ? keyStart + firstKey + STAFF_TIME_WIDTH / 2 - 2 : TIME_WIDTH / 2 - 2;
  const firstHead = staff ? Math.max(head, keyStart + firstKey + STAFF_TIME_WIDTH) : head;
  const open = openStrings(clip.tuning);
  const heads = staff ? clip.bars.map((_, b) => barHeads(clip, b, open)) : clip.bars.map(bar => bar.columns.map(() => []));
  const widthOf = (column: Column, b: number, c: number) => (staff ? staffWidth(column, heads[b][c]) : columnWidth(column));

  const systems: System[] = [];
  let current: PlacedBar[] = [];
  let place = 0; // the next column's place in the whole clip
  let x = firstHead;
  const finish = () => {
    const first = systems.length === 0;
    systems.push({
      bars: current, timeX: first ? firstTimeX : null, lineStart, staffStart: first ? firstHead : head, keyX: keyStart, first,
    });
    current = [];
    x = head;
  };
  clip.bars.forEach((bar, index) => {
    const timeChange = changesTime(clip, index);
    let keyChange = staff && index > 0 && changesKey(clip, index) ? keyWidth(keyAt(clip, index).fifths) : 0;
    const inner = bar.columns.length === 0 ? EMPTY_BAR : bar.columns.reduce((sum, c, k) => sum + widthOf(c, index, k), 0);
    const widthWith = (keyRoom: number) => barLead(bar, timeChange, keyRoom) + inner + BAR_PAD_END + (bar.repeatEnd ? REPEAT_PAD : 0);
    let w = widthWith(keyChange);
    if (current.length > 0 && x + w > width) {
      finish();
      // A key change that starts a line is the line's own key signature, drawn once in front of it.
      keyChange = 0;
      w = widthWith(0);
    }
    const lead = barLead(bar, timeChange, keyChange);
    const x0 = x;
    // A bar wider than a whole line is squeezed to fit, down to what its numbers need.
    const squeeze = bar.columns.length > 0 ? Math.min(1, (width - x0 - (w - inner)) / inner) : 1;
    // A time signature change stands just inside the bar, after a repeat's dots; a key change after it.
    // On the notation staff the key change comes first, then the time signature.
    const inside = x0 + (bar.repeatStart ? REPEAT_PAD : 0);
    const timeX = timeChange ? inside + (staff ? keyChange : 0) + 14 : null;
    const keyX = keyChange ? inside + (staff ? 0 : timeChange ? BAR_TIME_WIDTH : 0) + 8 : null;
    let cx = x0 + lead;
    const columns = bar.columns.map((column, k) => {
      const columnHeads = heads[index][k];
      const cw = Math.max(minColumnWidth(column), widthOf(column, index, k) * squeeze);
      // The accidentals stand left of the heads, so the heads (and the tab's numbers) move right of the middle.
      const signs = signRoom(columnHeads) / 2;
      const placed = { column, index: place++, x: cx + cw / 2 + signs * Math.min(1, squeeze), width: cw, heads: columnHeads, stemUp: stemUpFor(columnHeads) };
      cx += cw;
      return placed;
    });
    if (squeeze < 1) w = cx - x0 + BAR_PAD_END + (bar.repeatEnd ? REPEAT_PAD : 0);
    x = x0 + w;
    current.push({ bar, index, x0, x1: x, timeX, keyX, beat: beatTicks(timeAt(clip, index)), columns });
  });
  finish();
  const reach = staffReach(heads);
  // The staff's own marks need room past its notes: a vibrato's wave over it, accents either side.
  const extra = staff ? marksReach(clip.bars.flatMap(b => b.columns.flatMap(c => c.notes.filter((n): n is Note => n !== null)))) : { high: 0, low: 0 };
  const rows = rowsFor(clip, parts, { high: reach.high + extra.high, low: reach.low - extra.low });
  return { parts, systems, rows, height: systems.length * rows.height, names };
}

/** Room the staff's marks (`staffMarks.ts`) need past its heads and stems, in steps: over it for vibrato, both ways for accents. */
export function marksReach(notes: Note[]): { high: number; low: number } {
  const vibrato = notes.some(n => n.vibrato);
  const articulated = notes.some(n => n.accent || n.staccato);
  return { high: (vibrato ? 5 : 0) + (articulated ? 4 : 0), low: articulated ? 4 : 0 };
}

/** How far the clip's heads and stems reach above and below the staff, in steps. */
function staffReach(heads: Head[][][]): StaffReach {
  let high = 8;
  let low = 0;
  for (const bar of heads) {
    for (const column of bar) {
      if (column.length === 0) continue;
      const top = column[column.length - 1].step;
      const bottom = column[0].step;
      const up = stemUpFor(column);
      high = Math.max(high, top + (up ? STEM_STEPS + 2 : 1));
      low = Math.min(low, bottom - (up ? 1 : STEM_STEPS + 2));
    }
  }
  return { high, low };
}

/** The y of a string's line within a system, high e (0) on top. */
export function stringY(rows: Rows, s: number): number {
  return rows.staffTop + s * STRING_GAP;
}

/* — palm mute and let ring: a label and a dashed line over a run of columns — */

export type RunMark = 'palmMute' | 'letRing';
export const RUN_MARKS: { mark: RunMark; label: string; has: (column: Column) => boolean }[] = [
  { mark: 'palmMute', label: 'P.M.', has: isPalmMuted },
  { mark: 'letRing', label: 'let ring', has: isLetRing },
];

/** One run as drawn on one line of tab: its columns, and where its label starts and its line ends. */
export interface Run {
  columns: PlacedColumn[];
  x0: number;
  x1: number;
}

/** How wide a run's label is drawn. */
export function runLabelWidth(label: string): number {
  return label.length * 5.5;
}

/** The runs of columns that have a mark, on one line of tab. */
export function runsIn(system: System, has: (column: Column) => boolean): Run[] {
  const runs: Run[] = [];
  let current: PlacedColumn[] = [];
  const close = () => {
    if (current.length > 0) runs.push({ columns: current, x0: current[0].x - 8, x1: current[current.length - 1].x + 8 });
    current = [];
  };
  for (const placed of system.bars.flatMap(b => b.columns)) {
    if (has(placed.column)) current.push(placed);
    else close();
  }
  close();
  return runs;
}

/** The run under a point, label or line, with the mark it draws; null when there is none. */
export function runAt(layout: Layout, x: number, y: number): { mark: RunMark; run: Run } | null {
  const { rows } = layout;
  const system = layout.systems[Math.floor(y / rows.height)];
  if (!system || y < 0) return null;
  const localY = y - Math.floor(y / rows.height) * rows.height;
  for (const { mark, label, has } of RUN_MARKS) {
    const rowY = rows[mark];
    if (rowY === null || Math.abs(localY - rowY) > 7) continue;
    const run = runsIn(system, has).find(r => x >= r.x0 - 2 && x <= Math.max(r.x1, r.x0 + runLabelWidth(label)) + 2);
    if (run) return { mark, run };
  }
  return null;
}

/**
 * What a press on the words over the staff, or on a time signature, is on: a chord name or free text
 * (its column's place in the clip), or a bar's section, tempo or time signature (the first line's is bar 0's).
 */
export type TextHit = WordHit | { kind: 'time'; bar: number } | { kind: 'key'; bar: number };

export const CAPO_SIZE = 11;
/** The capo's words, as drawn: "Capo 3". */
export function capoText(capo: number): string {
  return `Capo ${capo}`;
}

/** A word over the staff that can be picked: a chord name, free text, a section, a tempo or the capo. */
export type WordHit = { kind: 'chord' | 'text'; index: number } | { kind: 'section' | 'tempo' | 'capo'; bar: number };

/**
 * The box round a drawn word, in the tab's units, as a press finds it (`textAt`); null when it isn't
 * drawn. A picked word is outlined with it, and its Edit and Delete buttons go beside it.
 */
export function textBox(layout: Layout, hit: WordHit, capo: number | null): { x: number; y: number; width: number; height: number } | null {
  const { rows } = layout;
  const box = (s: number, rowY: number | null, x0: number, x1: number, height = 18) =>
    rowY === null ? null : { x: x0 - 3, y: s * rows.height + rowY - height / 2, width: x1 - x0 + 6, height };
  for (let s = 0; s < layout.systems.length; s++) {
    const system = layout.systems[s];
    if (hit.kind === 'capo') {
      if (!system.first || !capo) continue;
      return box(s, rows.capo, system.lineStart, system.lineStart + capoText(capo).length * 6.5);
    }
    if (hit.kind === 'chord' || hit.kind === 'text') {
      const placed = system.bars.flatMap(b => b.columns).find(c => c.index === hit.index);
      if (!placed) continue;
      if (hit.kind === 'chord') {
        const w = placed.column.chord ? chordWidth(placed.column.chord) : 0;
        return w > 0 ? box(s, rows.chords, placed.x - w / 2, placed.x + w / 2) : null;
      }
      const t = placed.column.text;
      const x0 = placed.x - BEAT_TEXT_INSET;
      return t ? box(s, rows.text, x0, x0 + beatTextWidth(t)) : null;
    }
    if (!('bar' in hit)) continue;
    const bar = system.bars.find(b => b.index === hit.bar);
    if (!bar) continue;
    const x0 = barTextX(bar);
    if (hit.kind === 'section') {
      if (!bar.bar.section) return null;
      const { text } = sectionBoxes(bar.bar.section);
      return box(s, rows.section, x0, x0 + text.x + text.width, SECTION_BOX_HEIGHT + 6);
    }
    return bar.bar.tempo ? box(s, rows.tempo, x0, x0 + tempoParts(bar.bar.tempo).width) : null;
  }
  return null;
}

/** How far from a time signature's centre a press is on it. */
const TIME_REACH = 11;

/** The chord name, section, tempo, capo or time signature under a point; null when there is none. */
export function textAt(layout: Layout, x: number, y: number): TextHit | null {
  const { rows } = layout;
  const system = layout.systems[Math.floor(y / rows.height)];
  if (!system || y < 0) return null;
  const localY = y - Math.floor(y / rows.height) * rows.height;
  const near = (rowY: number | null) => rowY !== null && Math.abs(localY - rowY) <= 8;
  if (system.first && near(rows.capo) && x >= system.lineStart - 2 && x <= system.lineStart + capoText(1).length * 6.5 + 8) {
    return { kind: 'capo', bar: 0 };
  }
  if (near(rows.chords)) {
    for (const placed of system.bars.flatMap(b => b.columns)) {
      const w = placed.column.chord ? chordWidth(placed.column.chord) : 0;
      if (w > 0 && Math.abs(x - placed.x) <= w / 2 + 2) return { kind: 'chord', index: placed.index };
    }
  }
  if (near(rows.text)) {
    for (const placed of system.bars.flatMap(b => b.columns)) {
      const t = placed.column.text;
      const x0 = placed.x - BEAT_TEXT_INSET;
      if (t && x >= x0 - 2 && x <= x0 + beatTextWidth(t) + 2) return { kind: 'text', index: placed.index };
    }
  }
  for (const bar of system.bars) {
    const x0 = barTextX(bar);
    if (near(rows.section) && bar.bar.section) {
      const { text } = sectionBoxes(bar.bar.section);
      if (x >= x0 - 2 && x <= x0 + text.x + text.width + 2) return { kind: 'section', bar: bar.index };
    }
    if (near(rows.tempo) && bar.bar.tempo && x >= x0 - 2 && x <= x0 + tempoParts(bar.bar.tempo).width + 2) {
      return { kind: 'tempo', bar: bar.index };
    }
  }
  // Time signatures are drawn on the notation staff when it is shown, else on the tab.
  const onStaff = rows.score
    ? localY >= rows.score.top - 4 && localY <= rows.score.bottom + 4
    : rows.tab && localY >= rows.staffTop && localY <= rows.staffBottom;
  if (onStaff && system.timeX !== null && Math.abs(x - system.timeX) <= TIME_REACH) return { kind: 'time', bar: 0 };
  const changed = system.bars.find(b => b.timeX !== null && Math.abs(x - b.timeX) <= TIME_REACH);
  if (onStaff && changed) return { kind: 'time', bar: changed.index };
  // The clef and the key signature after it (the line's own; a press on the clef opens it even when the
  // key has no sharps or flats, Jeremy 2026-10-27), or the key inside a bar that changes it.
  if (rows.score && onStaff) {
    if (x >= system.lineStart && x < system.staffStart) return { kind: 'key', bar: system.bars[0].index };
    const keyed = system.bars.find(b => b.keyX !== null && x >= b.keyX - 4 && x < b.columns[0]?.x - 6);
    if (keyed) return { kind: 'key', bar: keyed.index };
  }
  return null;
}

/** Where a note was drawn: its line of tab and its column's centre. */
export interface Spot {
  system: number;
  x: number;
}

/** For every note, where the note before it on the same string was drawn. */
export function previousSpots(systems: System[]): Map<Note, Spot> {
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

/* — the cursor — */

/** Where a click lands: the bar under it, its nearest column (0 in an empty bar) and the nearest string. */
export interface Hit {
  bar: number;
  column: number;
  string: number;
}

/** How far above the top string and below the bottom one a press still lands on the staff, as the cursor's band reaches. */
export const STAFF_REACH = 10;

/** How near a note head a press on the notation staff must be: about a head's width across, a space up or down. */
const HEAD_REACH_X = HEAD_WIDTH;
const HEAD_REACH_Y = SPACE;

/** The tab note under a press on a note head of the notation staff: the nearest head within reach. */
function staffHeadAt(system: System, score: ScoreRows, x: number, localY: number): Hit | null {
  let best: { hit: Hit; distance: number } | null = null;
  for (const bar of system.bars) {
    bar.columns.forEach((placed, column) => {
      const dx = Math.abs(placed.x - x);
      if (dx > HEAD_REACH_X) return;
      for (const head of placed.heads) {
        const dy = Math.abs(stepY(score, head.step) - localY);
        if (dy > HEAD_REACH_Y) continue;
        const distance = dx + dy;
        if (!best || distance < best.distance) best = { hit: { bar: bar.index, column, string: head.string }, distance };
      }
    });
  }
  return best ? (best as { hit: Hit }).hit : null;
}

/** How far past the staff's lines a press still lands on it, in steps: two ledger lines. */
const STAFF_PRESS_STEPS = 4;
/**
 * In Both, below the staff toward the tab: one ledger line, and the tab reaches less far up, so the
 * gap between them is left for moving the cursor or the playback line (Jeremy, 2026-10-27).
 */
const STAFF_PRESS_STEPS_OVER_TAB = 2;
const TAB_REACH_UNDER_STAFF = 6;

/** Where a press on the notation staff lands: a column, the line or space, and the string of the head pressed (null off a head). */
export interface StaffHit {
  bar: number;
  column: number;
  step: number;
  string: number | null;
}

/**
 * A press on the notation staff (issue #136): on a note head, that note; else the nearest column of
 * the bar and the line or space pressed, up to two ledger lines past the staff. Null anywhere else.
 */
export function staffAt(layout: Layout, x: number, y: number): StaffHit | null {
  const { rows } = layout;
  const score = rows.score;
  const system = layout.systems[Math.floor(y / rows.height)];
  if (!score || !system || y < 0) return null;
  const localY = y - Math.floor(y / rows.height) * rows.height;
  const step = Math.round((score.bottom - localY) / (SPACE / 2));
  const below = rows.tab ? STAFF_PRESS_STEPS_OVER_TAB : STAFF_PRESS_STEPS;
  if (step < -below || step > 8 + STAFF_PRESS_STEPS) return null;
  const head = staffHeadAt(system, score, x, localY);
  if (head) {
    const placed = system.bars.find(b => b.index === head.bar)!.columns[head.column];
    return { bar: head.bar, column: head.column, step: placed.heads.find(h => h.string === head.string)!.step, string: head.string };
  }
  const bar = system.bars.find(b => x >= b.x0 && x < b.x1);
  if (!bar) return null;
  let column = 0;
  bar.columns.forEach((c, i) => {
    if (Math.abs(c.x - x) < Math.abs(bar.columns[column].x - x)) column = i;
  });
  return { bar: bar.index, column, step, string: null };
}

/** The column and string a press on the tab lands on; null anywhere else. */
export function hitTest(layout: Layout, x: number, y: number): Hit | null {
  const { rows } = layout;
  const system = layout.systems[Math.floor(y / rows.height)];
  if (!system || y < 0) return null;
  if (!rows.tab) return null;
  const localY = y - Math.floor(y / rows.height) * rows.height;
  // Only the staff itself, as far as the cursor's band reaches: not the marks over it, the rhythm
  // under it, or the blank space beside the last bar.
  const above = rows.score ? TAB_REACH_UNDER_STAFF : STAFF_REACH;
  if (localY < rows.staffTop - above || localY > rows.staffBottom + STAFF_REACH) return null;
  const bar = system.bars.find(b => x >= b.x0 && x < b.x1);
  if (!bar) return null;
  const string = Math.min(5, Math.max(0, Math.round((localY - rows.staffTop) / STRING_GAP)));
  let column = 0;
  bar.columns.forEach((c, i) => {
    if (Math.abs(c.x - x) < Math.abs(bar.columns[column].x - x)) column = i;
  });
  return { bar: bar.index, column, string };
}

/** How far right of a column's centre a press still counts as on it: about a note head's half width. */
export const ON_COLUMN_REACH = 8;

/**
 * Where a press anywhere in a bar's height, above or below the staff included, puts the playback line:
 * on the column pressed, else the first column after the press (Jeremy, 2026-10-27: "it should be
 * sufficient to click anywhere after the note"). Past a bar's last column, the next bar's first; past
 * the clip's last, the last. Null beside the bars or in an empty bar.
 */
export function columnAt(layout: Layout, x: number, y: number): number | null {
  const system = layout.systems[Math.floor(y / layout.rows.height)];
  if (!system || y < 0) return null;
  const bar = system.bars.find(b => x >= b.x0 && x < b.x1);
  if (!bar || bar.columns.length === 0) return null;
  const next = bar.columns.find(c => x <= c.x + Math.min(ON_COLUMN_REACH, c.width / 2));
  if (next) return next.index;
  const last = bar.columns[bar.columns.length - 1].index;
  const later = layout.systems.some(s => s.bars.some(b => b.columns.some(c => c.index > last)));
  return later ? last + 1 : last;
}

/** Where the cursor's column is drawn: its system, centre and width; an empty bar's middle. */
export function cursorSpot(layout: Layout, bar: number, column: number): { system: number; x: number; width: number } | null {
  for (let s = 0; s < layout.systems.length; s++) {
    const placed = layout.systems[s].bars.find(b => b.index === bar);
    if (!placed) continue;
    const c = placed.columns[column];
    if (c) return { system: s, x: c.x, width: c.width };
    return { system: s, x: (placed.x0 + placed.x1) / 2, width: 28 };
  }
  return null;
}

/* — beams: eighths and shorter within one beat are joined — */

export interface BeamGroup {
  columns: PlacedColumn[];
}

/** Runs of beamable columns (eighth or shorter, not rests) within each beat of a bar. */
export function beamGroups(bar: PlacedBar, beat: number): BeamGroup[] {
  const groups: BeamGroup[] = [];
  let at = 0;
  let current: PlacedColumn[] = [];
  let currentBeat = -1;
  const close = () => {
    if (current.length > 0) groups.push({ columns: current });
    current = [];
  };
  for (const placed of bar.columns) {
    // A grace note takes no time and is drawn without a stem, so it ends a beam and starts none.
    if (placed.column.grace) {
      close();
      currentBeat = -1;
      continue;
    }
    const b = Math.floor(at / beat);
    const beamable = placed.column.duration.value >= 8 && !isRest(placed.column);
    if (!beamable || b !== currentBeat) close();
    if (beamable) {
      current.push(placed);
      currentBeat = b;
    }
    at += ticks(placed.column.duration);
  }
  close();
  return groups;
}
