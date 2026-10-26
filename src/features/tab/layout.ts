/**
 * Where everything in a clip goes when drawn at a given width: systems
 * (lines of tab), bars and columns, in SVG units. Pure; `TabClip.tsx` only
 * draws what this returns, so the page and the exported images agree.
 */
import {
  changesTime, isLetRing, isPalmMuted, isRest, isStandardTuning, ticks, WHOLE,
  type Bar, type Clip, type Column, type Note, type Section, type Tempo,
} from './clip';

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
  strokes: number | null;
  letRing: number | null;
  palmMute: number | null;
  /** "P.H." over pinch harmonics. */
  harmonics: number | null;
  vibrato: number | null;
  /** Accents and staccato dots. */
  accents: number | null;
  /** The top string. */
  staffTop: number;
  staffBottom: number;
  stemTop: number;
  stemBottom: number;
  tuplet: number;
  /** One system's height. */
  height: number;
}

export const STRING_GAP = 14;
const FIRST_ROW = 12;
const ROW_GAP = 15;
/** Room over the top string for bend arrows and their labels, and the H or P over a hammer-on. */
const STAFF_HEADROOM = 30;

/** The rows a clip needs, top to bottom. */
export function rowsFor(clip: Clip): Rows {
  const columns = clip.bars.flatMap(b => b.columns);
  const notes = columns.flatMap(c => c.notes).filter((n): n is Note => n !== null);
  const used = {
    capo: !!clip.capo,
    tempo: clip.bars.some(b => b.tempo),
    section: clip.bars.some(b => b.section),
    chords: columns.some(c => c.chord),
    endings: clip.bars.some(b => b.ending !== undefined || (b.repeatEnd !== undefined && b.repeatEnd !== 2)),
    strokes: columns.some(c => c.stroke),
    letRing: notes.some(n => n.letRing),
    palmMute: notes.some(n => n.palmMute),
    harmonics: notes.some(n => n.harmonic === 'pinch'),
    vibrato: notes.some(n => n.vibrato),
    accents: notes.some(n => n.accent || n.staccato),
  };
  let y = FIRST_ROW - ROW_GAP;
  const row = (on: boolean) => (on ? (y += ROW_GAP) : null);
  const rows = {
    capo: row(used.capo),
    tempo: row(used.tempo),
    section: row(used.section),
    endings: row(used.endings),
    chords: row(used.chords),
    strokes: row(used.strokes),
    letRing: row(used.letRing),
    palmMute: row(used.palmMute),
    harmonics: row(used.harmonics),
    vibrato: row(used.vibrato),
    accents: row(used.accents),
  };
  const staffTop = Math.max(STAFF_HEADROOM, y + 16);
  const staffBottom = staffTop + 5 * STRING_GAP;
  return {
    ...rows, staffTop, staffBottom,
    stemTop: staffBottom + 8, stemBottom: staffBottom + 32, tuplet: staffBottom + 45, height: staffBottom + 54,
  };
}

const NAMES_WIDTH = 16;
const CLEF_WIDTH = 30;
const TIME_WIDTH = 30;
/** Room for a time signature change, just inside the bar it starts. */
const BAR_TIME_WIDTH = 24;
const BAR_PAD_START = 14;
const BAR_PAD_END = 6;
const REPEAT_PAD = 12;
const EMPTY_BAR = 120;
const CHAR = 7.5;

export interface PlacedColumn {
  column: Column;
  /** The column's place in the whole clip, counting from 0 (as `editing.ts` counts). */
  index: number;
  /** The column's centre. */
  x: number;
  width: number;
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
  columns: PlacedColumn[];
}

export interface System {
  bars: PlacedBar[];
  /** Where the time signature's numbers are centred, on the first line of tab only. */
  timeX: number | null;
  /** Where the staff lines and the opening line start: after the time signature and the names, if any. "TAB" sits on the lines. */
  lineStart: number;
  /** Where the first bar starts: after "TAB". */
  staffStart: number;
  first: boolean;
}

export interface Layout {
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

export const SECTION_SIZE = 11;
/** A section's rehearsal mark box (if any) and its name's box, from the bar's start. */
export function sectionBoxes(section: Section): { marker: { x: number; width: number } | null; text: { x: number; width: number } } {
  const marker = section.marker ? { x: 0, width: section.marker.length * 7 + 8 } : null;
  const x = marker ? marker.width + 4 : 0;
  return { marker, text: { x, width: section.text.length * 6.4 + 10 } };
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

/** The room a bar takes before its first column: padding, a repeat's dots and a time signature change. */
function barLead(bar: Bar, timeChange: boolean): number {
  return BAR_PAD_START + (bar.repeatStart ? REPEAT_PAD : 0) + (timeChange ? BAR_TIME_WIDTH : 0);
}

function barWidth(bar: Bar, timeChange: boolean): number {
  const inner = bar.columns.length === 0 ? EMPTY_BAR : bar.columns.reduce((w, c) => w + columnWidth(c), 0);
  return barLead(bar, timeChange) + inner + BAR_PAD_END + (bar.repeatEnd ? REPEAT_PAD : 0);
}

export function layoutClip(clip: Clip, width: number): Layout {
  const names = isStandardTuning(clip.tuning) ? null : [...clip.tuning].reverse();
  // In front of the staff: the time signature (drawn on the first line only, but every line leaves its
  // room, so the lines start one under another), then the string names.
  const lineStart = TIME_WIDTH + (names ? NAMES_WIDTH : 0);
  const head = lineStart + CLEF_WIDTH;

  const systems: System[] = [];
  let current: PlacedBar[] = [];
  let place = 0; // the next column's place in the whole clip
  let x = head;
  const finish = () => {
    const first = systems.length === 0;
    systems.push({
      bars: current, timeX: first ? TIME_WIDTH / 2 - 2 : null, lineStart, staffStart: head, first,
    });
    current = [];
    x = head;
  };
  clip.bars.forEach((bar, index) => {
    const timeChange = changesTime(clip, index);
    let w = barWidth(bar, timeChange);
    if (current.length > 0 && x + w > width) finish();
    const x0 = x;
    // A bar wider than a whole line is squeezed to fit, down to what its numbers need.
    const inner = bar.columns.reduce((sum, c) => sum + columnWidth(c), 0);
    const squeeze = inner > 0 ? Math.min(1, (width - x0 - (w - inner)) / inner) : 1;
    // A time signature change stands just inside the bar, after a repeat's dots.
    const timeX = timeChange ? x0 + (bar.repeatStart ? REPEAT_PAD : 0) + 14 : null;
    let cx = x0 + barLead(bar, timeChange);
    const columns = bar.columns.map(column => {
      const cw = Math.max(minColumnWidth(column), columnWidth(column) * squeeze);
      const placed = { column, index: place++, x: cx + cw / 2, width: cw };
      cx += cw;
      return placed;
    });
    if (squeeze < 1) w = cx - x0 + BAR_PAD_END + (bar.repeatEnd ? REPEAT_PAD : 0);
    x = x0 + w;
    current.push({ bar, index, x0, x1: x, timeX, columns });
  });
  finish();
  const rows = rowsFor(clip);
  return { systems, rows, height: systems.length * rows.height, names };
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
 * What a press on the words over the staff, or on a time signature, is on: a chord name (its
 * column's place in the clip), or a bar's section, tempo or time signature (the first line's is bar 0's).
 */
export type TextHit = { kind: 'chord'; index: number } | { kind: 'section' | 'tempo' | 'time' | 'capo'; bar: number };

export const CAPO_SIZE = 11;
/** The capo's words, as drawn: "Capo 3". */
export function capoText(capo: number): string {
  return `Capo ${capo}`;
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
  const onStaff = localY >= rows.staffTop && localY <= rows.staffBottom;
  if (onStaff && system.timeX !== null && Math.abs(x - system.timeX) <= TIME_REACH) return { kind: 'time', bar: 0 };
  const changed = system.bars.find(b => b.timeX !== null && Math.abs(x - b.timeX) <= TIME_REACH);
  if (onStaff && changed) return { kind: 'time', bar: changed.index };
  return null;
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

/** The column and string a press lands on; null anywhere but on the staff of a bar. */
export function hitTest(layout: Layout, x: number, y: number): Hit | null {
  const { rows } = layout;
  const system = layout.systems[Math.floor(y / rows.height)];
  if (!system || y < 0) return null;
  const localY = y - Math.floor(y / rows.height) * rows.height;
  // Only the staff itself, as far as the cursor's band reaches: not the marks over it, the rhythm
  // under it, or the blank space beside the last bar.
  if (localY < rows.staffTop - STAFF_REACH || localY > rows.staffBottom + STAFF_REACH) return null;
  const bar = system.bars.find(b => x >= b.x0 && x < b.x1);
  if (!bar) return null;
  const string = Math.min(5, Math.max(0, Math.round((localY - rows.staffTop) / STRING_GAP)));
  let column = 0;
  bar.columns.forEach((c, i) => {
    if (Math.abs(c.x - x) < Math.abs(bar.columns[column].x - x)) column = i;
  });
  return { bar: bar.index, column, string };
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
