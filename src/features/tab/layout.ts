/**
 * Where everything in a clip goes when drawn at a given width: systems
 * (lines of tab), bars and columns, in SVG units. Pure; `TabClip.tsx` only
 * draws what this returns, so the page and the exported images agree.
 */
import { beatTicks, changesKey, changesTime, isRest, isStandardTuning, keyAt, ticks, timeAt, WHOLE, type Bar, type Clip, type Column, type Note } from './clip';
import { accidentalLanes, barHeads, MIDDLE_STEP, writtenStrings, type Head } from './notation';

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
  /** A section over the bar it starts at: its letter boxed, its name in bold. */
  section: number | null;
  /** Ending brackets and repeat counts. */
  endings: number | null;
  /** The wah's "+" (closed) and "o" (open), over the chord names as Guitar Pro prints them. */
  wah: number | null;
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
/** How high a bend's arrow rises over the tab's top string, as Guitar Pro draws it. */
export const BEND_RISE = 26;
/** How far a bend's label stands above the arrow's top, per line of a stacked pair. */
export const BEND_LABEL_STEP = 11;

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
    wah: columns.some(c => c.wah),
    // Under the staff, or alone: strokes, let ring, P.M. and P.H. sit between the staff and the tab
    // (under the staff alone), as printed guitar music has them. Vibrato and accents go on the staff.
    strokes: columns.some(c => c.stroke),
    letRing: notes.some(n => n.letRing),
    palmMute: notes.some(n => n.palmMute),
    harmonics: notes.some(n => n.harmonic === 'pinch'),
    // Vibrato goes over the tab too when the staff is shown, as Guitar Pro prints it (Jeremy, 2026-10-27),
    // and so does a mordent, in the same row (Sweet Child O' Mine, bar 93).
    vibrato: tab && notes.some(n => n.vibrato || n.mordent),
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
    wah: row(used.wah),
    chords: row(used.chords),
    text: row(used.text),
  };
  // The staff: room over its top line and under its bottom one for what reaches past them.
  let score: ScoreRows | null = null;
  if (parts !== 'tab') {
    const top = Math.max(y + 12, 10) + Math.max(SPACE, (reach.high - 8) * SPACE / 2 + 4);
    const bottom = top + 4 * SPACE;
    score = { top, bottom };
    // Then the tab's marks: the first row 26 under the staff, or under what reaches past its foot.
    y = bottom + Math.max(SPACE, -reach.low * SPACE / 2 + 4) + 2;
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
  // A bend's arrow and label stand over the tab's top string, so the row before needs more room.
  const bends = notes.some(n => n.bend);
  // Two strings bent in one column may stack two labels (`bendLabelLines`).
  const stacked = columns.some(c => c.notes.filter(n => n?.bend).length > 1) ? BEND_LABEL_STEP : 0;
  const staffTop = Math.max(score ? score.bottom + 30 : STAFF_HEADROOM, y + (bends ? BEND_RISE + 28 + stacked : 16));
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
  /** Where its note (number, heads) is drawn: near the start of its room, as printed music has it. */
  x: number;
  /** Its room along the line: from `start`, `width` long. */
  start: number;
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
  /** In 4/4: plain eighths are beamed by the half bar, four together. */
  halfBars: boolean;
  columns: PlacedColumn[];
  /** One of the bars a multi-bar rest draws as one; null for a bar drawn by itself. */
  restRun: RestRun | null;
}

/**
 * A bar in a multi-bar rest: bars of rest in a row drawn as one wide bar with a thick bar across the
 * staff and their count over it, as printed parts have them (alphaTex's `\multiBarRest`). Each bar keeps
 * its own slice of the room, so the cursor and the playhead still step through them.
 */
export interface RestRun {
  /** How many bars the rest stands for. */
  count: number;
  first: boolean;
  last: boolean;
  /** The whole rest's room, shared by its bars: from the first's opening line to the last's closing one. */
  span: { x0: number; x1: number };
}

/** A multi-bar rest's room: about a bar of eighths, as Guitar Pro gives it. */
export const MULTI_REST_WIDTH = 300;

/** A bar that is a rest and nothing else, as a multi-bar rest gathers. */
function plainRest(bar: Bar): boolean {
  if (bar.columns.length !== 1 || bar.ending !== undefined || bar.extra?.length) return false;
  const c = bar.columns[0];
  return isRest(c) && !c.chord && !c.text && !c.stroke && !c.grace && !c.tremolo && !c.ottava && !c.wah && !c.extra?.length;
}

/**
 * The multi-bar rests of a clip that asks for them, as the count at each one's first bar: two or more
 * plain bars of rest in a row. The first may start a section, a tempo, a signature or a repeat, and the
 * last may end with a double bar or a repeat; anything else ends the run, as it would need a bar of its own.
 */
export function multiRests(clip: Clip): Map<number, number> {
  const runs = new Map<number, number>();
  if (!clip.multiBarRests) return runs;
  const { bars } = clip;
  const closes = (bar: Bar) => bar.repeatEnd !== undefined || !!bar.doubleBar;
  const opens = (bar: Bar) => !!(bar.section || bar.tempo || bar.time || bar.key || bar.repeatStart);
  let b = 0;
  while (b < bars.length) {
    if (!plainRest(bars[b]) || closes(bars[b])) {
      b++;
      continue;
    }
    let e = b;
    while (e + 1 < bars.length && plainRest(bars[e + 1]) && !opens(bars[e + 1])) {
      e++;
      if (closes(bars[e])) break;
    }
    if (e > b) runs.set(b, e - b + 1);
    b = e + 1;
  }
  return runs;
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
  // Twice as long takes √2 as much room, as Guitar Pro spaces it (Jeremy, 2026-10-28).
  const byTime = column.grace ? 16 : QUARTER_ROOM * Math.sqrt(ticks(column.duration) / (WHOLE / 4));
  // A bend's arrow and label stand right of the number; a release needs more. A tied note carrying a
  // bend on (`bendCarries`) needs none: its line comes from the note before.
  const own = column.notes.filter(n => n?.bend && !(n.tie && n.bend.pre));
  const bend = own.some(n => n?.bend?.release) ? 30 : own.length > 0 ? 18 : 0;
  const slideOut = bend === 0 && column.notes.some(n => n?.slideOut) ? 12 : 0;
  return Math.max(byTime, minColumnWidth(column)) + bend + slideOut;
}

/** A quarter note's room along the line: a sixteenth keeps the room it had, 28, so its numbers stay apart. */
const QUARTER_ROOM = 56;

/** How far into its room a column's note stands: past half its widest number, so the number starts the room. */
export function noteInset(column: Column): number {
  return minColumnWidth(column) / 2;
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
/** A chord name as printed: the sharps and flats of its root and its bass as ♯ and ♭ ("Ab5" is drawn A♭5); the text stays as typed. */
export function prettyChord(chord: string): string {
  return chord.replace(/(^|\/)([A-G])(##|bb|#|b)/g, (_, before: string, letter: string, sign: string) =>
    before + letter + sign.replace('##', '𝄪').replace('bb', '𝄫').replace('#', '♯').replace('b', '♭'));
}
export function chordWidth(chord: string): number {
  return chord.length * 7;
}

/** Extra room above and below the section row, so its box stands clear of the rows beside it (Jeremy, 2026-10-27). */
const SECTION_ROOM = 9;

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
  const open = writtenStrings(clip.tuning);
  const heads = staff ? clip.bars.map((_, b) => barHeads(clip, b, open)) : clip.bars.map(bar => bar.columns.map(() => []));
  const widthOf = (column: Column, b: number, c: number) => (staff ? staffWidth(column, heads[b][c]) : columnWidth(column));

  const rests = multiRests(clip);
  let run: { span: RestRun['span']; count: number; end: number; share: number } | null = null;

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
    const count = rests.get(index);
    if (count) run = { span: { x0: 0, x1: 0 }, count, end: index + count - 1, share: MULTI_REST_WIDTH / count };
    const inRun = run !== null && index <= run.end;
    // A multi-bar rest's bars share its room: the first takes its lead, the last the closing room.
    const inner = inRun ? run!.share : bar.columns.length === 0 ? EMPTY_BAR : bar.columns.reduce((sum, c, k) => sum + widthOf(c, index, k), 0);
    const closing = BAR_PAD_END + (bar.repeatEnd ? REPEAT_PAD : 0);
    const widthWith = (keyRoom: number) => (inRun && !count ? 0 : barLead(bar, timeChange, keyRoom)) + inner + (inRun && index < run!.end ? 0 : closing);
    let w = widthWith(keyChange);
    // A multi-bar rest goes on one line, whole: its first bar asks for the room of them all.
    const asks = count ? w + (count - 1) * run!.share + closing : inRun ? 0 : w;
    if (current.length > 0 && x + asks > width) {
      finish();
      // A key change that starts a line is the line's own key signature, drawn once in front of it.
      keyChange = 0;
      w = widthWith(0);
    }
    const lead = inRun && !count ? 0 : barLead(bar, timeChange, keyChange);
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
      const cw = inRun ? inner : Math.max(minColumnWidth(column), widthOf(column, index, k) * squeeze);
      // The accidentals stand left of the heads, so the heads (and the tab's numbers) move right of the middle.
      const signs = signRoom(columnHeads) / 2;
      const x = cx + Math.min(noteInset(column), cw / 2) + signs * 2 * Math.min(1, squeeze);
      const placed = { column, index: place++, x, start: cx, width: cw, heads: columnHeads, stemUp: stemUpFor(columnHeads) };
      cx += cw;
      return placed;
    });
    if (squeeze < 1 && !inRun) w = cx - x0 + closing;
    x = x0 + w;
    const time = timeAt(clip, index);
    const restRun = inRun ? { count: run!.count, first: !!count, last: index === run!.end, span: run!.span } : null;
    current.push({ bar, index, x0, x1: x, timeX, keyX, beat: beatTicks(time), halfBars: time.beats === 4 && time.value === 4, columns, restRun });
    if (inRun && index === run!.end) run = null;
  });
  finish();
  justify(systems, width);
  // Each multi-bar rest's room, once the lines are spread.
  for (const system of systems) {
    for (const bar of system.bars) {
      if (bar.restRun?.first) bar.restRun.span.x0 = bar.x0;
      if (bar.restRun?.last) bar.restRun.span.x1 = bar.x1;
    }
  }
  const reach = staffReach(clip, heads, staff);
  const rows = rowsFor(clip, parts, reach);
  return { parts, systems, rows, height: systems.length * rows.height, names };
}

/**
 * Every line but the last runs to the full width, as printed music is set (Guitar Pro's Sweet Child
 * O' Mine, Jeremy 2026-10-28): the room left over goes to the columns, in proportion to their room,
 * each note keeping its place near the start of its room. The last line is spread as much as the line
 * before it, so its bars match theirs, and never past the width; when it holds as many bars as that
 * line, it runs to the full width as well. Changes the systems in place.
 */
function justify(systems: System[], width: number): void {
  let previous = 1;
  systems.forEach((system, si) => {
    const last = system.bars[system.bars.length - 1];
    const rooms = system.bars.reduce((sum, bar) => sum + bar.columns.reduce((t, c) => t + c.width, 0), 0);
    if (!last || rooms === 0) return;
    const full = Math.max(1, 1 + (width - last.x1) / rooms);
    // The last line runs to the full width too when it holds as many bars as the line before.
    const lastFull = si === systems.length - 1 && si > 0 && system.bars.length >= systems[si - 1].bars.length;
    const k = si < systems.length - 1 || lastFull ? full : Math.min(full, previous);
    previous = full;
    let shift = 0;
    for (const bar of system.bars) {
      bar.x0 += shift;
      if (bar.timeX !== null) bar.timeX += shift;
      if (bar.keyX !== null) bar.keyX += shift;
      for (const placed of bar.columns) {
        placed.start += shift;
        placed.x += shift;
        shift += placed.width * (k - 1);
        placed.width *= k;
      }
      bar.x1 += shift;
    }
  });
}

/*
 * The staff's marks over its notes, spaced as Guitar Pro prints them (measured against its drawing of
 * bars 113–114 of "Guitar Solo 3"): `staffMarks.ts` places them, `staffReach` makes room for them.
 */
/** From the top of a column's heads or stem up to the middle of a vibrato's wave. */
export const VIBRATO_CLEAR = 24;
/** From the top of another mark (a tie, a slur, an accent) up to the middle of a vibrato's wave. */
export const VIBRATO_OVER_MARKS = 17;
/** From the top of everything else on the staff up to an octave line (or down, under it). */
export const OTTAVA_CLEAR = 33;
/** How far the clip's heads and stems reach above and below the staff, in steps. */
function staffReach(clip: Clip, heads: Head[][][], marks: boolean): StaffReach {
  let high = 8;
  let low = 0;
  // Over every column, in steps: the vibrato's band, then an octave line over all of it.
  let vibrato = -Infinity;
  let ottavaAbove = false;
  let ottavaBelow = false;
  heads.forEach((bar, i) => bar.forEach((column, k) => {
    if (column.length === 0) return;
    const top = column[column.length - 1].step;
    const bottom = column[0].step;
    const up = stemUpFor(column);
    const reachUp = top + (up ? STEM_STEPS + 2 : 1);
    const reachDown = bottom - (up ? 1 : STEM_STEPS + 2);
    high = Math.max(high, reachUp);
    low = Math.min(low, reachDown);
    if (!marks) return;
    const c = clip.bars[i].columns[k];
    const notes = c.notes.filter((n): n is Note => n !== null);
    // Accents and staccato stand at the heads, away from the stem.
    if (notes.some(n => n.accent || n.staccato)) {
      if (up) low = Math.min(low, bottom - 6);
      else high = Math.max(high, top + 6);
    }
    if (notes.some(n => n.vibrato || n.mordent)) vibrato = Math.max(vibrato, Math.max(reachUp, 8) + Math.ceil((VIBRATO_CLEAR + 4) * 2 / SPACE));
    if (c.ottava === '8va' || c.ottava === '15ma') ottavaAbove = true;
    if (c.ottava === '8vb' || c.ottava === '15mb') ottavaBelow = true;
  }));
  high = Math.max(high, vibrato);
  // The octave line, its label reaching into the gap under the row over the staff.
  const ottavaSteps = Math.round(OTTAVA_CLEAR * 2 / SPACE);
  if (ottavaAbove) high += ottavaSteps;
  if (ottavaBelow) low -= ottavaSteps;
  return { high, low };
}

/** The y of a string's line within a system, high e (0) on top. */
export function stringY(rows: Rows, s: number): number {
  return rows.staffTop + s * STRING_GAP;
}

/* — palm mute and let ring: a label and a dashed line over a run of columns — */
