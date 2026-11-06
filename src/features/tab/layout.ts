/**
 * Where everything in a clip goes when drawn at a given width: systems
 * (lines of tab), bars and columns, in SVG units. Pure; `TabClip.tsx` only
 * draws what this returns, so the page and the exported images agree.
 */
import { barLength, barsPerLine, barTicks, beatGroupsAt, beatTicks, type TimeSignature, changesKey, changesTime, hasNotes, isRest, MAX_VOICES, startsFreeTime, keyAt, ticks, timeAt, voiceColumns, WHOLE, type Bar, type Bend, type Part, type Column, type Note } from './clip';
import { accidentalLanes, barHeads, MIDDLE_STEP, writtenStrings, type Head } from './notation';
import { staffInk } from './staffMarks';
import { BEAT_TEXT_INSET, BEAT_TEXT_LINE, placeBeatTexts } from './beatText';
import { BAR_TEXT_INSET, placeSections, SECTION_LINE } from './sectionText';
import { diagramOf, overNameHeight, type ShapedChord } from './chordDiagrams';

/**
 * What the Notation view draws (Jeremy, 2026-10-27; `docs/specs/2026-10-27-tab-notation-design.md`):
 * the tab, the staff, or both, the staff over the tab.
 */
export type Parts = 'tab' | 'staff' | 'both';
export const PARTS: readonly Parts[] = ['staff', 'tab', 'both'];

/* — vertical rows of one system, from its top — */

/**
 * Where things go up and down in one system (line) of a clip, in SVG units from the system's top. The
 * rows above the staff are there only when the line uses them (null otherwise), each a line of its
 * own so marks never collide. Each line has only its own rows, so a line without chord names or bends
 * has no room left for them (Jeremy, 2026-10-28: "way too much vertical white space").
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
  /** The wah's "+" (closed) and "o" (open), under the chord names: no mark goes over them (Jeremy, 2026-10-28). */
  wah: number | null;
  /** Chord names over their columns. */
  chords: number | null;
  /** The top of the diagrams under the chord names (issue #242), when the line draws any. */
  diagrams: number | null;
  /** Free text over its column (alphaTex txt): its first line's middle; a wrapped text's lines go on down from it. */
  text: number | null;
  /** Fermatas, over the tab when there is no staff to carry them. */
  fermatas: number | null;
  /** Hairpins (crescendo, decrescendo), right under the staff or over the tab's other marks. */
  hairpins: number | null;
  strokes: number | null;
  letRing: number | null;
  palmMute: number | null;
  /** "w/ bar" and its dashed line over a run of whammy bar columns, as printed guitar books have it. */
  whammy: number | null;
  /** "P.H." over pinch harmonics, "AH" over artificial ones. */
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
  /**
   * Under the tab, where the whammy bar's lines go down to (`whammy.ts`): the top of the room they take
   * under the bottom string, pushing the stems down. Null on a line without one, or without the tab.
   */
  dives: number | null;
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

/** From a chord name's row down to the top of the diagram under it. */
const DIAGRAM_DROP = 7;

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
/** The shortest rise of a bend's arrow, right of its number; and a bend let down's shortest run to its arrowhead down. */
export const BEND_PEAK = 14;
export const BEND_DROP = 24;
/** How far short of the next note a bend's arrows stop; short of a pre-bend's, its wider "PB" label clear of theirs. */
const BEND_END_GAP = 16;
const PRE_BEND_CLEAR = 36;

function preBent(column: Column): boolean {
  return column.notes.some(n => n?.bend?.pre && !n.tie);
}

/**
 * How far right of its number a bend's arrow peaks and, let down, where its arrow down lands: over the
 * note's whole length, to just before the next note, as Guitar Pro draws them (Sweet Child O' Mine,
 * bar 170: a bend over a dotted half), never shorter than BEND_PEAK and BEND_DROP. A pre-bend stands
 * straight up from its number (a peak of 0) and lets down by the next note. A bend let down peaks halfway.
 */
export function bendShape(placed: Pick<PlacedColumn, 'bendRoom' | 'bendPeakRoom'>, bend: Pick<Bend, 'pre' | 'release'>): { peak: number; drop: number } {
  const room = placed.bendRoom;
  if (bend.pre) return { peak: 0, drop: Math.max(BEND_PEAK, room) };
  if (bend.release) return { peak: Math.max(BEND_PEAK, Math.min(room / 2, placed.bendPeakRoom)), drop: Math.max(BEND_DROP, room) };
  const peak = Math.max(BEND_PEAK, placed.bendPeakRoom);
  return { peak, drop: peak };
}

/** From the bottom string down to the top of the whammy bar's room, and that room's height: its lines and labels. */
export const DIVES_GAP = 6;
export const DIVES_ROOM = 34;

/** The radius of a tap's circled T, over the staff and over its number on the tab. */
export const TAP_RADIUS = 5.5;
/** From the top of a bend's arrow down to its label's baseline: the label stands this far over the arrow. */
export const BEND_LABEL_RAISE = 9;

/**
 * The rows a clip (or one line of it, as `lineClip` makes) needs, top to bottom: the words over
 * everything, the staff, the tab's marks, the tab.
 */
/** The room over the tab for the up-stem Voices' stems, beams and tuplet numbers, as under it. */
const STEMS_OVER_ROOM = 50;

/** Whether a part's bar draws two or more Voices, so each Voice's stems take its side (step 9, Q2, Q4). */
export function severalVoices(bar: Bar, ownVoice = 0): boolean {
  if (!bar.otherVoices?.length) return false;
  const ownDrawn = ownVoice === 0 ? bar.columns.length > 0 : hasNotes(bar.columns);
  return bar.otherVoices.length + (ownDrawn ? 1 : 0) >= 2;
}

export function rowsFor(
  clip: Part, parts: Parts = 'tab', reach: StaffReach = { high: 8, low: 0 },
  freeTimeLabel = clip.bars.some((_, i) => startsFreeTime(clip, i)),
  /** How many text rows the line's wrapped and stacked texts take (`placeBeatTexts`): the text row grows down by the rest. */
  textLines = 1,
  /** How many rows the line's stacked sections take (`placeSections`): the section row grows down by the rest. */
  sectionLines = 1,
  /** Chord diagrams under the names (the View options' Chord diagrams). */
  diagrams = false,
): Rows {
  const tab = parts !== 'staff';
  // Every Voice's columns: another Voice's chord names, texts and marks take their rows too (step 9).
  const columns = clip.bars.flatMap(b => [...b.columns, ...(b.otherVoices ?? []).flatMap(o => o.columns)]);
  const notes = columns.flatMap(c => c.notes).filter((n): n is Note => n !== null);
  const used = {
    capo: !!clip.capo,
    // "Free time" goes in the tempo's row, over the chord names, as Guitar Pro prints it.
    // The first bar's tempo is printed in the score's head (`tempoOver` in layoutText.ts).
    tempo: clip.bars.some((b, index) => index > 0 && b.tempo) || freeTimeLabel,
    section: clip.bars.some(b => b.section),
    chords: columns.some(c => c.chord),
    diagrams: diagrams && columns.some(c => c.chord && diagramOf(clip, c.chord)),
    text: columns.some(c => c.text),
    endings: clip.bars.some(b => b.ending !== undefined || (b.repeatEnd !== undefined && b.repeatEnd !== 2)),
    wah: columns.some(c => c.wah),
    // Strokes, let ring, P.M. and P.H. sit between the staff and the tab, as printed guitar music has
    // them; under the staff alone, strokes go over it, as Gould, Dorico and MuseScore have them
    // (Jeremy, 2026-11-06), and the rest under it. Vibrato and accents go on the staff.
    // A fermata goes on the staff when there is one, over the tab only without it.
    fermatas: parts === 'tab' && columns.some(c => c.fermata),
    hairpins: columns.some(c => c.hairpin),
    strokes: columns.some(c => c.stroke),
    letRing: notes.some(n => n.letRing),
    palmMute: notes.some(n => n.palmMute),
    whammy: columns.some(c => c.whammy),
    harmonics: notes.some(n => n.harmonic === 'pinch' || n.harmonic === 'artificial'),
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
  // A row that takes more than one line: the rows after it start under its last.
  const tall = (at: number | null, extra: number) => {
    if (at !== null) y += extra;
    return at;
  };
  const words = {
    capo: row(used.capo),
    tempo: row(used.tempo),
    section: tall(row(used.section, true), (Math.max(1, sectionLines) - 1) * SECTION_LINE),
    endings: row(used.endings),
    // Free text over the chord names, so a chord and its diagram sit right over the music (Jeremy, 2026-11-06).
    text: tall(row(used.text), (Math.max(1, textLines) - 1) * BEAT_TEXT_LINE),
    chords: row(used.chords),
    // The diagrams hang under the names (books print the name over its diagram); the rows after start under them.
    diagrams: tall(used.diagrams ? y + DIAGRAM_DROP : null, DIAGRAM_DROP + overNameHeight()),
    // The wah's signs, like any mark on the music, go under the chord names (Jeremy, 2026-10-28).
    wah: row(used.wah),
  };
  // The staff alone: strokes over it, under every word (Jeremy, 2026-11-06).
  const strokesOver = row(!tab && used.strokes);
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
    fermatas: row(used.fermatas),
    hairpins: row(used.hairpins),
    strokes: tab ? row(used.strokes) : strokesOver,
    letRing: row(used.letRing),
    palmMute: row(used.palmMute),
    whammy: row(used.whammy),
    harmonics: row(used.harmonics),
    vibrato: row(used.vibrato),
    accents: row(used.accents),
  };
  if (!tab) {
    // The staff alone: the tab's rows stand at the staff's foot, drawing nothing.
    const end = y + 12;
    return {
      ...words, ...marks, score, tab, tabStems: false, dives: null, staffTop: end, staffBottom: end,
      bandTop: score!.top - 10, bandBottom: score!.bottom + 10, loopY: end,
      stemTop: end, stemBottom: end, tuplet: end, height: end + 8,
    };
  }
  // A bend's arrow and label stand over the tab's top string: its label is a row of its own, ROW_GAP
  // under the row before, with the arrow's rise and the label's place over the arrow under it.
  const bends = notes.some(n => n.bend);
  // Two strings bent in one column may stack two labels (`bendLabelLines`), and a bend pushed on up
  // stands a line higher (`bendRaises`).
  const stacked = columns.some(c => c.notes.filter(n => n?.bend).length > 1) || notes.some(n => n.bend?.from !== undefined)
    ? BEND_LABEL_STEP : 0;
  // A bar of two Voices with no staff over the tab: the up-stem Voices' stems go over the tab (step 9, Q4).
  const stemsOver = score === null && clip.bars.some(bar => severalVoices(bar, clip.voice ?? 0));
  const staffTop = Math.max(score ? score.bottom + 30 : STAFF_HEADROOM, y + (bends ? ROW_GAP + BEND_RISE + BEND_LABEL_RAISE + stacked : 16)) + (stemsOver ? STEMS_OVER_ROOM : 0);
  const staffBottom = staffTop + 5 * STRING_GAP;
  // Under a staff, the staff carries the rhythm (Jeremy, 2026-10-27): the tab has no stems.
  const tabStems = score === null;
  // The whammy bar's lines and their labels go under the tab, and the stems under them.
  const dives = used.whammy ? staffBottom + DIVES_GAP : null;
  const under = dives === null ? staffBottom : dives + DIVES_ROOM;
  return {
    ...words, ...marks, score, tab, tabStems, dives, staffTop, staffBottom,
    bandTop: (score ? score.top : staffTop) - 10, bandBottom: staffBottom + 10,
    loopY: tabStems ? under + 40 : under + 14,
    stemTop: under + 8, stemBottom: under + 32, tuplet: under + 45, height: tabStems ? under + 54 : under + 16,
  };
}

/** How far the staff's notes and stems reach, in steps: the highest over the top line, the lowest under the bottom one. */
export interface StaffReach {
  high: number;
  low: number;
}

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
/** The room a free-time bar's brackets round its time signature take. */
const TIME_BRACKETS_WIDTH = 14;
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
  /** How far right of `x` a bend's arrows may run: to just before the next note on the line (`bendShape`). */
  bendRoom: number;
  /** How far its arrow may peak: as far, unless the next note is a pre-bend, whose wider label it keeps clear of. */
  bendPeakRoom: number;
  /** On the staff: its note heads, low to high, and which way its stem goes. */
  heads: Head[];
  stemUp: boolean;
  /** Its free text, wrapped to the room before the next text on the line (`beatText.ts`); empty without one. */
  textLines: string[];
  /** The diagram drawn under its chord name, when Chord diagrams are on and its chord has a shape (issue #242). */
  diagram?: ShapedChord;
  /** Its text's first line, in text rows down from the line's text row: above 0 when moved up clear of another. */
  textTop: number;
  /**
   * In a bar where two or more Voices are present: whether its Voice is an up-stem one (Voices 1 and 3) or
   * a down-stem one (2 and 4), which sets its stems, rests and marks' side (step 9, Q2). None otherwise.
   */
  voiceUp?: boolean;
  /**
   * On the staff, in a bar of two or more Voices: how far right its heads and stem move, beside another
   * Voice's heads a second away (the up-stem one on the right), or the same pitch with another kind of head.
   */
  headShift?: number;
  /** On the staff: the strings whose head another Voice's same pitch and kind of head stands for (shared). */
  sharedHeads?: Set<number>;
}

/** One of the Voices a bar carries besides the part's own, placed on the bar's time line with it (step 9). */
export interface PlacedVoice {
  /** The Voice, from 0. */
  voice: number;
  /** Its Columns, placed; `index` counts as that Voice's own Part counts its columns. */
  columns: PlacedColumn[];
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
  /** Ticks in one of its beats: the note input grid marks each. */
  beat: number;
  time: TimeSignature;
  /** Its Beat groups in ticks: beams follow them (`beams.ts`). */
  groups: number[];
  columns: PlacedColumn[];
  /** One of the bars a multi-bar rest draws as one; null for a bar drawn by itself. */
  restRun: RestRun | null;
  /** A full bar with no note: drawn as one Whole-bar rest, centred, whatever its Columns (`isWholeBarRest`). */
  wholeRest: boolean;
  /** Its section's name, wrapped (`placeSections`); empty without one. */
  sectionLines: string[];
  /** Its section's first line, in section rows down from the line's section row: above 0 when moved up clear of another. */
  sectionTop: number;
  /** The other Voices present in the bar, placed on its time line; none in a bar of one Voice (step 9, Q1). */
  voices?: PlacedVoice[];
  /**
   * The part's own Voice is absent from the bar (a Voice other than Voice 1 with no notes there): its
   * stand-in rests are placed, for the cursor and the grid, but not drawn (step 9, Q9).
   */
  hidden?: boolean;
}

/** Where a Whole-bar rest is centred: the middle of its Columns' room. */
export function wholeRestX(bar: PlacedBar): number {
  const first = bar.columns[0];
  const last = bar.columns[bar.columns.length - 1];
  return (first.start + last.start + last.width) / 2;
}

/**
 * Whether bar `b` is drawn as one Whole-bar rest: a bar as long as its time signature, not in free
 * time, with Columns and no note, grace note or tuplet in them (rests are Gaps, step 3). It may store
 * more than one rest (5/8 `rq. rq`); they are drawn, picked and selected as one.
 */
export function isWholeBarRest(part: Part, b: number): boolean {
  const bar = part.bars[b];
  if (!bar || bar.columns.length === 0 || bar.freeTime) return false;
  if (!bar.columns.every(c => isRest(c) && !c.grace && !c.duration.tuplet)) return false;
  return barLength(bar) === barTicks(timeAt(part, b));
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

/** A rest with nothing on it or over it. */
export function plainRestColumn(c: Column): boolean {
  return isRest(c) && !c.chord && !c.text && !c.stroke && !c.grace && !c.tremolo && !c.ottava && !c.wah && !c.hairpin && !c.whammy && !c.extra?.length;
}

/**
 * A bar of rests and nothing else, as a multi-bar rest gathers: one whole-bar rest, or several that fill
 * it, in every Voice (another Voice is present only where it has notes).
 */
function restBar(bar: Bar): boolean {
  if (bar.columns.length === 0 || bar.ending !== undefined || bar.extra?.length || bar.otherVoices?.length) return false;
  return bar.columns.every(plainRestColumn);
}

/** The most room the other tracks' bars in step with bar `b` ask for, and the least they can take. */
function alongsideRoom(clip: Part, b: number, staff: boolean): { inner: number; least: number } {
  const origin = clip.bars[b].origin;
  let inner = 0;
  let least = 0;
  if (origin === undefined || !clip.alongside) return { inner, least };
  for (const other of clip.alongside) {
    const bar = other.bars[origin];
    if (!bar) continue;
    if (bar.columns.length === 0) {
      inner = Math.max(inner, EMPTY_BAR);
      least = Math.max(least, EMPTY_BAR);
      continue;
    }
    const heads = staff ? barHeads(other, origin, writtenStrings(other.tuning)) : bar.columns.map(() => []);
    inner = Math.max(inner, bar.columns.reduce((sum, c, k) => sum + (staff ? staffWidth(c, heads[k]) : columnWidth(c)), 0));
    least = Math.max(least, bar.columns.reduce((sum, c, k) => sum + leastWidth(c, heads[k], staff), 0));
  }
  return { inner, least };
}

/**
 * The multi-bar rests of a part, as the count at each one's first bar: two or more bars of rests in a row.
 * A clip of one track gathers them only when it asks (`\multiBarRest`); a track of a clip of several
 * always does, so a part that sits out half the song isn't drawn as bar after empty bar (Jeremy,
 * 2026-10-30). Only the part's own bars count: the other tracks may play there.
 * The first may start a section, a tempo, a signature or a repeat, and the last may end with a double
 * bar or a repeat; anything else ends the run, as it would need a bar of its own.
 */
export function multiRests(clip: Part): Map<number, number> {
  const runs = new Map<number, number>();
  if (!clip.multiBarRests && !clip.alongside?.length) return runs;
  const bars = clip.bars;
  const closes = (bar: Bar) => bar.repeatEnd !== undefined || !!bar.doubleBar || !!bar.freeTime;
  const opens = (bar: Bar) => !!(bar.section || bar.tempo || bar.time || bar.key || bar.repeatStart || bar.freeTime);
  let b = 0;
  while (b < bars.length) {
    if (!restBar(bars[b]) || closes(bars[b])) {
      b++;
      continue;
    }
    let e = b;
    while (e + 1 < bars.length && restBar(bars[e + 1]) && !opens(bars[e + 1])) {
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
  /** Where this line's rows are, from its own top: each line has only the rows it uses. */
  rows: Rows;
  /** The line's top within the whole drawing: the lines before it, one under another. */
  top: number;
  /** Where the time signature's numbers are centred, on the first line of tab only. */
  timeX: number | null;
  /** Where the staff lines and the opening line start: after the time signature. "TAB" sits on the lines. */
  lineStart: number;
  /** Where the first bar starts: after "TAB", and on the staff the clef and the key signature. */
  staffStart: number;
  /** On the staff: where the key signature's first sign goes. */
  keyX: number;
  first: boolean;
  /** How many text rows its free texts take, wrapped and stacked (`placeBeatTexts`). */
  textRows: number;
  /** How many rows its sections take, stacked clear of each other (`placeSections`). */
  sectionRows: number;
}

/** A line before its rows are worked out, once the bars on it are known. */
type LineDraft = Omit<System, 'rows' | 'top'>;

export interface Layout {
  parts: Parts;
  systems: System[];
  height: number;
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

/** The least room a column takes on a line squeezed to fit: its numbers, and on the staff its heads and accidentals. */
function leastWidth(column: Column, heads: Head[], staff: boolean): number {
  if (!staff) return minColumnWidth(column);
  const seconds = heads.some((h, k) => k > 0 && h.step - heads[k - 1].step === 1) ? HEAD_WIDTH : 0;
  return Math.max(minColumnWidth(column), STAFF_LEAST) + signRoom(heads) + seconds;
}
/** A note head and a little room either side. */
const STAFF_LEAST = 20;

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
 * What is written on the string for a note: "5", "X" (a capital, as printed tab has it, issue #177), "<12>" for a natural harmonic, and in brackets
 * a tie, "(5)" with an arc from the note before, or a ghost note, "(5)" or "(X)" alone.
 */
export function noteLabel(note: Note): string {
  if (note.tie) return `(${note.fret})`;
  const label = note.fret === null ? 'X' : note.harmonic === 'natural' ? `<${note.fret}>` : String(note.fret);
  return note.ghost ? `(${label})` : label;
}

/** The room a bar takes before its first column: padding, a repeat's dots, and a time or key signature change. */
function barLead(bar: Bar, timeChange: boolean, keyChange: number, brackets = false): number {
  return BAR_PAD_START + (bar.repeatStart ? REPEAT_PAD : 0) + (timeChange ? BAR_TIME_WIDTH : 0) + (brackets ? TIME_BRACKETS_WIDTH : 0) + keyChange;
}

/** A column's room on the staff too: its accidentals and a head set beside its neighbour a second away. */
function staffWidth(column: Column, heads: Head[]): number {
  const signs = signRoom(heads);
  const seconds = heads.some((h, k) => k > 0 && h.step - heads[k - 1].step === 1) ? HEAD_WIDTH : 0;
  return columnWidth(column) + signs + seconds;
}

/** The room left of a column's heads: their accidentals, and a bent note's starting head before them. */
export function signRoom(heads: Head[]): number {
  return accidentalRoom(heads) + bendFromRoom(heads);
}

/** The room a column's accidentals take left of its heads. */
export function accidentalRoom(heads: Head[]): number {
  const lanes = accidentalLanes(heads).filter((l): l is number => l !== null);
  return lanes.length === 0 ? 0 : (Math.max(...lanes) + 1) * ACCIDENTAL_ROOM + 2;
}

/** A bent note's bracketed starting head and the line from it to the note (issue #176). */
export const BEND_FROM_ROOM = 34;

/** The room left of the accidentals for a bent note's starting head, and its own accidental. */
export function bendFromRoom(heads: Head[]): number {
  const from = heads.filter(h => h.bendFrom);
  if (from.length === 0) return 0;
  return BEND_FROM_ROOM + (from.some(h => h.bendFrom!.shows !== null) ? ACCIDENTAL_ROOM : 0);
}

/** Which way a column's stem goes: down when its heads sit mostly on or above the middle line. */
export function stemUpFor(heads: Head[]): boolean {
  if (heads.length === 0) return true;
  const far = heads[0].step + heads[heads.length - 1].step;
  return far < 2 * MIDDLE_STEP;
}

/** A bar's Voices on one time line: each own column's room, and the other Voices' columns to place by them. */
interface BarVoices {
  /** Each of the part's own columns' room: the time line's spots it covers. */
  ownWidths: number[];
  /** The least the bar's room may be squeezed to. */
  least: number;
  /** Whether two or more Voices are drawn in the bar: then each Voice's stems take its side (Q2). */
  several: boolean;
  /** The part's own Voice is absent: its stand-in rests are placed but not drawn. */
  hidden: boolean;
  /** The other Voices present, each column's first and last spot on the time line. */
  others: { voice: number; columns: Column[]; heads: Head[][]; from: number[]; to: number[] }[];
  /** Each own column's first and last spot, and every spot's room. */
  ownFrom: number[];
  ownTo: number[];
  spots: number[];
  /**
   * Each spot's room for accidentals, the most any Voice's notes starting there need: every Voice's notes
   * at one time stand at one x, right of all their signs.
   */
  spotSigns: number[];
}

/**
 * The bar's Voices on one time line, or null for a bar of one Voice (drawn as before). A spot stands at
 * each moment any Voice starts a column (grace notes at their own spots before it); each spot is as wide
 * as the columns sounding over it need, a column's room shared out by time over the spots it covers, and
 * at least what its numbers need where it starts. The part's own columns cover the spots from theirs to
 * the next, so they still tile the bar, and the edits' indexes stay as they are (step 9, Q1).
 */
function barVoices(clip: Part, b: number, staff: boolean, open: number[], ownHeads: Head[][]): BarVoices | null {
  const bar = clip.bars[b];
  const present = bar.otherVoices ?? [];
  if (present.length === 0 || bar.columns.length === 0) return null;
  const ownVoice = clip.voice ?? 0;
  const hidden = ownVoice > 0 && !hasNotes(bar.columns);
  const headsOf = (columns: Column[]) => (staff ? barHeads({ ...clip, bars: clip.bars.map((x, i) => (i === b ? { ...x, columns } : x)) }, b, open) : columns.map(() => []));
  const lines = [
    { voice: ownVoice, columns: bar.columns, heads: ownHeads, drawn: !hidden },
    ...present.map(o => ({ voice: o.voice, columns: o.columns, heads: headsOf(o.columns), drawn: true })),
  ];
  // Each column's place on the time line: its start, and grace notes ranked before the note they lead to.
  const keyed = lines.map(line => {
    let t = 0;
    return line.columns.map((column, k) => {
      let rank = 0;
      if (column.grace) {
        let n = 0;
        while (line.columns[k + n]?.grace) n++;
        rank = -n;
      }
      const at = { t, rank, length: column.grace ? 0 : ticks(column.duration) };
      t += at.length;
      return at;
    });
  });
  const spotKeys = [...new Set(keyed.flatMap(line => line.map(k => `${k.t}:${k.rank}`)))]
    .map(key => key.split(':').map(Number) as [number, number])
    .sort((a, c) => a[0] - c[0] || a[1] - c[1]);
  const spotOf = new Map(spotKeys.map((k, i) => [`${k[0]}:${k[1]}`, i]));
  const end = Math.max(...keyed.map(line => line.reduce((t, k) => t + k.length, 0)));
  const spotLength = spotKeys.map((k, i) => (k[1] < 0 ? 0 : (spotKeys[i + 1]?.[0] ?? end) - k[0]));
  const ranges = keyed.map(line => {
    const from = line.map(k => spotOf.get(`${k.t}:${k.rank}`)!);
    const to = from.map((f, k) => (k + 1 < from.length ? from[k + 1] - 1 : spotKeys.length - 1));
    return { from, to };
  });
  const spots = spotKeys.map(() => 0);
  const spotSigns = spotKeys.map(() => 0);
  lines.forEach((line, l) => {
    if (!line.drawn) return;
    line.columns.forEach((column, k) => {
      if (staff) spotSigns[ranges[l].from[k]] = Math.max(spotSigns[ranges[l].from[k]], signRoom(line.heads[k]));
      const room = staff ? staffWidth(column, line.heads[k]) : columnWidth(column);
      const { from, to } = { from: ranges[l].from[k], to: ranges[l].to[k] };
      const length = keyed[l][k].length;
      for (let s = from; s <= to; s++) {
        const share = length === 0 ? (s === from ? room : 0) : (room * spotLength[s]) / length;
        spots[s] = Math.max(spots[s], s === from ? Math.max(share, leastWidth(column, line.heads[k], staff)) : share);
      }
    });
  });
  const sum = (from: number, to: number) => spots.slice(from, to + 1).reduce((t, w) => t + w, 0);
  const ownWidths = bar.columns.map((_, k) => sum(ranges[0].from[k], ranges[0].to[k]));
  const least = Math.max(...lines.filter(line => line.drawn).map(line => line.columns.reduce((t, c, k) => t + leastWidth(c, line.heads[k], staff), 0)));
  return {
    ownWidths, least, several: lines.filter(line => line.drawn).length > 1, hidden,
    others: lines.slice(1).map((line, k) => ({ voice: line.voice, columns: line.columns, heads: line.heads, from: ranges[k + 1].from, to: ranges[k + 1].to })),
    ownFrom: ranges[0].from, ownTo: ranges[0].to, spots, spotSigns,
  };
}

/** Where another Voice's column sits on its bar's time line: by the own column whose room each of its ends falls in. */
interface Anchor { start: PlacedColumn; startAt: number; end: PlacedColumn; endAt: number; inset: number; signs: number }
const anchors = new WeakMap<PlacedColumn, Anchor>();

/** The other Voices of a bar, placed by the part's own columns (`barVoices`). */
function placeOthers(multi: BarVoices, own: PlacedColumn[], places: number[], squeeze: number): PlacedVoice[] {
  // Where each spot starts and ends, as a fraction of the own column it falls in.
  const spotAt = (s: number, edge: 'start' | 'end'): { column: PlacedColumn; at: number } => {
    const k = multi.ownFrom.findIndex((f, i) => f <= s && multi.ownTo[i] >= s);
    const column = own[k];
    const total = multi.ownWidths[k];
    const before = multi.spots.slice(multi.ownFrom[k], s).reduce((t, w) => t + w, 0) + (edge === 'end' ? multi.spots[s] : 0);
    return { column, at: total > 0 ? before / total : 0 };
  };
  return multi.others.map(other => ({
    voice: other.voice,
    columns: other.columns.map((column, k): PlacedColumn => {
      const start = spotAt(other.from[k], 'start');
      const end = spotAt(other.to[k], 'end');
      const heads = other.heads[k];
      const placed: PlacedColumn = {
        column, index: places[other.voice] + k, x: 0, start: 0, width: 0, bendRoom: 0, bendPeakRoom: 0, heads,
        stemUp: stemUpFor(heads), textLines: [], textTop: 0,
      };
      if (multi.several) {
        placed.voiceUp = other.voice % 2 === 0;
        placed.stemUp = placed.voiceUp;
      }
      anchors.set(placed, { start: start.column, startAt: start.at, end: end.column, endAt: end.at, inset: noteInset(column), signs: multi.spotSigns[other.from[k]] * Math.min(1, squeeze) });
      followAnchor(placed);
      return placed;
    }),
  }));
}

/**
 * Heads of two Voices at one time on the staff (step 9, Q2): a second apart, they sit side by side, the
 * up-stem Voice's on the right; the same pitch shares one head when both are the same kind (both black or
 * both white), else they sit side by side.
 */
function sideBySide(bar: PlacedBar): void {
  const drawn = [...(bar.hidden ? [] : bar.columns), ...(bar.voices ?? []).flatMap(v => v.columns)];
  const kind = (p: PlacedColumn) => (p.column.duration.value === 1 ? 0 : p.column.duration.value === 2 ? 1 : 2);
  for (const up of drawn) {
    if (up.voiceUp !== true || up.heads.length === 0 || up.column.grace) continue;
    for (const down of drawn) {
      if (down.voiceUp !== false || down.heads.length === 0 || down.column.grace || Math.abs(down.start - up.start) > 0.5) continue;
      let beside = false;
      for (const h of up.heads) {
        for (const d of down.heads) {
          if (Math.abs(h.step - d.step) === 1) beside = true;
          if (h.step === d.step && h.shows === d.shows) {
            if (kind(up) === kind(down)) (down.sharedHeads ??= new Set()).add(d.string);
            else beside = true;
          }
        }
      }
      if (beside) up.headShift = HEAD_WIDTH;
    }
  }
}

/** Puts another Voice's column where its anchor's own columns now are. */
function followAnchor(placed: PlacedColumn): void {
  const a = anchors.get(placed);
  if (!a) return;
  placed.start = a.start.start + a.startAt * a.start.width;
  placed.width = Math.max(0, a.end.start + a.endAt * a.end.width - placed.start);
  placed.x = placed.start + Math.min(a.inset, placed.width / 2) + a.signs;
}

export function layoutClip(clip: Part, width: number, parts: Parts = 'tab', diagrams = false): Layout {
  const staff = parts !== 'tab';
  // In front of the staff: the time signature (drawn on the first line only, but every line leaves its
  // room, so the lines start one under another). No string names: the score's head shows the tuning
  // (Jeremy, 2026-10-29). On the notation staff the clef and every line's key signature follow; the tab leaves the same room, so the bars line up.
  // With the notation staff, the first line's time signature goes after the clef and key signature
  // instead, as printed music has it (Jeremy, 2026-10-27).
  const lineStart = parts === 'both' ? BRACKET_MARGIN : staff ? STAFF_MARGIN : TIME_WIDTH;
  const widestKey = staff ? Math.max(0, ...clip.bars.map((_, b) => keyWidth(keyAt(clip, b).fifths))) : 0;
  const keyStart = lineStart + CLEF_WIDTH;
  const head = keyStart + widestKey;
  const firstKey = staff ? keyWidth(keyAt(clip, 0).fifths) : 0;
  const firstTimeX = staff ? keyStart + firstKey + STAFF_TIME_WIDTH / 2 - 2 : TIME_WIDTH / 2 - 2;
  const firstHead = staff ? Math.max(head, keyStart + firstKey + STAFF_TIME_WIDTH) : head;
  const open = writtenStrings(clip.tuning);
  const heads = staff ? clip.bars.map((_, b) => barHeads(clip, b, open)) : clip.bars.map(bar => bar.columns.map(() => []));
  const widthOf = (column: Column, b: number, c: number) => (staff ? staffWidth(column, heads[b][c]) : columnWidth(column));
  const ownVoice = clip.voice ?? 0;
  // Where each Voice's columns start in its own Part, bar by bar, so a press on another Voice's note says
  // which column of that Voice it is.
  const voicePlace = Array.from({ length: MAX_VOICES }, () => 0);

  const rests = multiRests(clip);
  let run: { span: RestRun['span']; count: number; end: number; share: number } | null = null;

  const drafts: LineDraft[] = [];
  let current: PlacedBar[] = [];
  let place = 0; // the next column's place in the whole clip
  let x = firstHead;
  // Where the line would end with every column at its least width: a line of the clip's own breaks
  // wraps only when even that doesn't fit.
  let xLeast = firstHead;
  // The clip's own line breaks (`\systemsLayout`), if it sets them: the line of them being filled, and how
  // many bars it still asks for. A line too wide for the width still wraps; what is left of it goes on the next.
  const modelled = barsPerLine(clip, 0) !== null;
  let modelLine = 0;
  let wanted = barsPerLine(clip, 0) ?? 0;
  // Whether each line holds all the bars it asks for: only the last may not, and it isn't run to the width.
  const complete: boolean[] = [];
  const finish = () => {
    const first = drafts.length === 0;
    drafts.push({
      bars: current, timeX: first ? firstTimeX : null, lineStart, staffStart: first ? firstHead : head, keyX: keyStart, first, textRows: 1, sectionRows: 1,
    });
    complete.push(true);
    current = [];
    x = head;
    xLeast = head;
  };
  clip.bars.forEach((bar, index) => {
    // A run of free-time bars shows the time signature again, in brackets, where it starts.
    const freeStart = index > 0 && startsFreeTime(clip, index);
    const timeChange = changesTime(clip, index) || freeStart;
    let keyChange = staff && index > 0 && changesKey(clip, index) ? keyWidth(keyAt(clip, index).fifths) : 0;
    const count = rests.get(index);
    if (count) run = { span: { x0: 0, x1: 0 }, count, end: index + count - 1, share: MULTI_REST_WIDTH / count };
    const inRun = run !== null && index <= run.end;
    // A multi-bar rest's bars share its room: the first takes its lead, the last the closing room.
    // A bar of more than one Voice lays them out on one time line (step 9, Q1).
    const multi = inRun ? null : barVoices(clip, index, staff, open, heads[index]);
    const ownRoom = (k: number) => (multi ? multi.ownWidths[k] : widthOf(bar.columns[k], index, k));
    const own = inRun ? run!.share : bar.columns.length === 0 ? EMPTY_BAR : bar.columns.reduce((sum, _, k) => sum + ownRoom(k), 0);
    // As wide as the widest track's bar, its columns spread to fill it, so every track has the same lines.
    const company = inRun ? { inner: 0, least: 0 } : alongsideRoom(clip, index, staff);
    const inner = Math.max(own, company.inner);
    const spread = bar.columns.length > 0 ? inner / own : 1;
    const closing = BAR_PAD_END + (bar.repeatEnd ? REPEAT_PAD : 0);
    const widthWith = (keyRoom: number) => (inRun && !count ? 0 : barLead(bar, timeChange, keyRoom, freeStart)) + inner + (inRun && index < run!.end ? 0 : closing);
    let w = widthWith(keyChange);
    // A multi-bar rest goes on one line, whole: its first bar asks for the room of them all.
    const asks = count ? w + (count - 1) * run!.share + closing : inRun ? 0 : w;
    // A multi-bar rest counts as one bar of the clip's line breaks, as it is drawn as one.
    const restOn = inRun && !count;
    const lineFull = modelled && wanted <= 0 && !restOn;
    const leastInner = inRun || bar.columns.length === 0 ? inner
      : multi ? Math.max(company.least, multi.least)
      : Math.max(company.least, bar.columns.reduce((sum, c, k) => sum + leastWidth(c, heads[index][k], staff), 0));
    const overflows = modelled ? xLeast + (asks - inner + leastInner) > width : x + asks > width;
    if (current.length > 0 && (lineFull || overflows)) {
      finish();
      if (lineFull) wanted = barsPerLine(clip, ++modelLine)!;
      // A key change that starts a line is the line's own key signature, drawn once in front of it.
      keyChange = 0;
      w = widthWith(0);
    }
    const lead = inRun && !count ? 0 : barLead(bar, timeChange, keyChange, freeStart);
    const x0 = x;
    // A bar wider than a whole line is squeezed to fit, down to what its numbers need.
    // On a line of the clip's own breaks only a bar alone on its line is; `spreadLines` fits the rest.
    const alone = !modelled || current.length === 0;
    const squeeze = bar.columns.length > 0 && alone ? Math.min(1, (width - x0 - (w - inner)) / inner) : 1;
    // A time signature change stands just inside the bar, after a repeat's dots; a key change after it.
    // On the notation staff the key change comes first, then the time signature.
    const inside = x0 + (bar.repeatStart ? REPEAT_PAD : 0);
    const timeX = timeChange ? inside + (staff ? keyChange : 0) + 14 + (freeStart ? TIME_BRACKETS_WIDTH / 2 : 0) : null;
    const keyX = keyChange ? inside + (staff ? 0 : timeChange ? BAR_TIME_WIDTH : 0) + 8 : null;
    let cx = x0 + lead;
    const columns = bar.columns.map((column, k) => {
      const columnHeads = heads[index][k];
      const least = multi?.hidden ? 0 : minColumnWidth(column);
      const cw = inRun ? inner / bar.columns.length : Math.max(least, ownRoom(k) * spread * squeeze);
      // The accidentals stand left of the heads, so the heads (and the tab's numbers) move right of the middle.
      const signs = (multi ? multi.spotSigns[multi.ownFrom[k]] : signRoom(columnHeads)) / 2;
      const x = cx + Math.min(noteInset(column), cw / 2) + signs * 2 * Math.min(1, squeeze);
      const placed: PlacedColumn = { column, index: place++, x, start: cx, width: cw, bendRoom: 0, bendPeakRoom: 0, heads: columnHeads, stemUp: stemUpFor(columnHeads), textLines: [] as string[], textTop: 0 };
      if (multi?.several) {
        placed.voiceUp = ownVoice % 2 === 0;
        placed.stemUp = placed.voiceUp;
      }
      cx += cw;
      return placed;
    });
    const voices = multi ? placeOthers(multi, columns, voicePlace, squeeze) : undefined;
    for (let v = 0; v < MAX_VOICES; v++) if (v !== ownVoice) voicePlace[v] += voiceColumns(clip, index, v).length;
    if (squeeze < 1 && !inRun) w = cx - x0 + closing;
    xLeast += (w - inner) + Math.min(inner, leastInner);
    x = x0 + w;
    const time = timeAt(clip, index);
    const restRun = inRun ? { count: run!.count, first: !!count, last: index === run!.end, span: run!.span } : null;
    const placedBar: PlacedBar = { bar, index, x0, x1: x, timeX, keyX, beat: beatTicks(time), time, groups: beatGroupsAt(clip, index), columns, restRun, wholeRest: !inRun && !multi?.hidden && isWholeBarRest(clip, index), sectionLines: [], sectionTop: 0 };
    if (voices && voices.length > 0) placedBar.voices = voices;
    if (multi?.hidden) placedBar.hidden = true;
    current.push(placedBar);
    if (inRun && index === run!.end) run = null;
    if (!restOn) wanted--;
  });
  finish();
  complete[complete.length - 1] = wanted <= 0;
  if (modelled) spreadLines(drafts, complete, width, staff);
  else justify(drafts, width);
  // Each multi-bar rest's room, once the lines are spread.
  for (const system of drafts) {
    for (const bar of system.bars) {
      if (bar.restRun?.first) bar.restRun.span.x0 = bar.x0;
      if (bar.restRun?.last) bar.restRun.span.x1 = bar.x1;
    }
  }
  // The other Voices' columns follow their own Voice's, wherever spreading the lines moved them.
  for (const system of drafts) for (const bar of system.bars) for (const v of bar.voices ?? []) for (const placed of v.columns) followAnchor(placed);
  if (staff) for (const system of drafts) for (const bar of system.bars) if (bar.voices) sideBySide(bar);
  // The diagram under each chord name with a shape (issue #242), in every Voice.
  if (diagrams) {
    for (const system of drafts) {
      for (const bar of system.bars) {
        for (const placed of [...bar.columns, ...(bar.voices ?? []).flatMap(v => v.columns)]) {
          const diagram = placed.column.chord ? diagramOf(clip, placed.column.chord) : null;
          if (diagram) placed.diagram = diagram;
        }
      }
    }
  }
  // How far right of each note its bend's arrows may run: to just before the next note on the line, in its Voice.
  for (const system of drafts) {
    const placed = system.bars.flatMap(b => b.columns);
    const lineEnd = system.bars[system.bars.length - 1].x1;
    const bendRooms = (list: PlacedColumn[]) => list.forEach((column, k) => {
      const next = list[k + 1];
      column.bendRoom = (next ? next.x : lineEnd) - column.x - BEND_END_GAP;
      column.bendPeakRoom = next && preBent(next.column) ? next.x - column.x - PRE_BEND_CLEAR : column.bendRoom;
    });
    bendRooms(placed);
    for (let v = 0; v < MAX_VOICES; v++) {
      const list = system.bars.flatMap(b => b.voices?.find(o => o.voice === v)?.columns ?? []);
      if (list.length > 0) bendRooms(list);
    }
    // A text wraps to the room before the next text on the line, or before the drawing's right edge, and
    // moves up clear of one it still touches (issue #323). Every Voice's texts share the row.
    const texted = [...placed, ...system.bars.flatMap(b => (b.voices ?? []).flatMap(v => v.columns))].filter(c => c.column.text).sort((a, b) => a.x - b.x);
    const texts = placeBeatTexts(
      texted.map(c => ({ x0: c.x - BEAT_TEXT_INSET, text: c.column.text! })),
      Math.max(width, system.bars[system.bars.length - 1].x1),
    );
    texted.forEach((c, k) => {
      c.textLines = texts.placed[k].lines;
      c.textTop = texts.placed[k].top;
    });
    system.textRows = texts.rows;
    // A section wraps to the room before the next, and moves up clear of one it still touches (issue #389).
    const sectioned = system.bars.filter(b => b.bar.section);
    const sections = placeSections(
      sectioned.map(b => ({ x0: b.x0 + BAR_TEXT_INSET, section: b.bar.section! })),
      Math.max(width, system.bars[system.bars.length - 1].x1),
    );
    sectioned.forEach((b, k) => {
      b.sectionLines = sections.placed[k].lines;
      b.sectionTop = sections.placed[k].top;
    });
    system.sectionRows = sections.rows;
  }
  // Each line gets the rows its own bars use, and the lines stack one under another.
  const stack = (reaches: StaffReach[]): Layout => {
    let top = 0;
    const systems = drafts.map((draft, si): System => {
      const indices = draft.bars.map(b => b.index);
      const rows = rowsFor(lineClip(clip, indices, draft.first), parts, reaches[si], indices.some(i => startsFreeTime(clip, i)), draft.textRows, draft.sectionRows, diagrams);
      const system = { ...draft, rows, top };
      top += rows.height;
      return system;
    });
    return { parts, systems, height: top };
  };
  const reaches = drafts.map(draft => staffReach(draft.bars, staff));
  const layout = stack(reaches);
  if (!staff) return layout;
  // A bend's arrow and label on the staff, and an octave line over them, reach as far as they are
  // drawn, past what `staffReach` makes room for. The marks sit relative to the staff, so one more
  // pass with room for them places everything.
  const drawn = staffInk(layout);
  const wider = reaches.map((r, si) => ({ high: Math.max(r.high, drawn[si].high), low: Math.min(r.low, drawn[si].low) }));
  return wider.some((r, si) => r.high !== reaches[si].high || r.low !== reaches[si].low) ? stack(wider) : layout;
}

/** One line of a clip, as `rowsFor` reads it: its own bars, and the capo only on the first line. */
export function lineClip(clip: Part, bars: number[], first: boolean): Part {
  return { ...clip, capo: first ? clip.capo : undefined, bars: bars.map(i => clip.bars[i]) };
}

/** The line under a y in the whole drawing, and the y within it; null above or below the lines. */
export function lineAt(layout: Layout, y: number): { si: number; system: System; localY: number } | null {
  if (y < 0) return null;
  const si = layout.systems.findIndex(s => y < s.top + s.rows.height);
  if (si < 0) return null;
  const system = layout.systems[si];
  return { si, system, localY: y - system.top };
}

/**
 * Every line but the last runs to the full width, as printed music is set (Guitar Pro's Sweet Child
 * O' Mine, Jeremy 2026-10-28): the room left over goes to the columns, in proportion to their room,
 * each note keeping its place near the start of its room. The last line is spread as much as the line
 * before it, so its bars match theirs, and never past the width; when it holds as many bars as that
 * line, it runs to the full width as well. Changes the systems in place.
 */
function justify(systems: LineDraft[], width: number): void {
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

/**
 * The lines of a clip that sets its own line breaks (`\systemsLayout`), run to the width with Frets' own
 * spacing: each line's room after its fixed parts (clef, signatures, bar lines) goes to its bars in
 * proportion to the room their notes take, as `justify` spreads a line, and a line too full is squeezed
 * the same way, no bar below what its notes need (Jeremy, 2026-10-28: Frets' spacing over Guitar Pro's
 * even shares by `\scale`, which is kept but not used). Within a bar, columns keep their proportions. A
 * line holding fewer bars than it asks for (the last) is spread at the line before's rate, and never
 * runs past the width. Changes the systems in place.
 */
function spreadLines(systems: LineDraft[], complete: boolean[], width: number, staff: boolean): void {
  let previousRate = Infinity;
  systems.forEach((system, si) => {
    const bars = system.bars;
    // A clip of one short line keeps its bars' own room, as a short last line of filled lines does.
    if (bars.length === 0 || (!complete[si] && previousRate === Infinity)) return;
    const natural = bars.map(bar => (bar.columns.length > 0 ? bar.columns.reduce((t, c) => t + c.width, 0) : EMPTY_BAR));
    const least = bars.map((bar, b) => (bar.restRun || bar.columns.length === 0 ? natural[b] : bar.columns.reduce((t, c) => t + Math.min(c.width, leastWidth(c.column, c.heads, staff)), 0)));
    const fixed = bars.reduce((t, bar, b) => t + (bar.x1 - bar.x0) - natural[b], 0);
    const room = width - bars[0].x0 - fixed;
    // Each bar's share; a bar its share can't hold keeps what it needs, and the rest share what is left.
    const target = bars.map(() => 0);
    const held = bars.map(() => false);
    let rate = 0;
    for (let pass = 0; pass <= bars.length; pass++) {
      const free = room - bars.reduce((t, _, b) => t + (held[b] ? least[b] : 0), 0);
      const shares = bars.reduce((t, _, b) => t + (held[b] ? 0 : natural[b]), 0);
      rate = shares > 0 ? free / shares : 0;
      if (!complete[si]) rate = Math.min(rate, previousRate);
      let changed = false;
      bars.forEach((_, b) => {
        if (held[b]) return;
        target[b] = rate * natural[b];
        if (target[b] < least[b]) { held[b] = true; target[b] = least[b]; changed = true; }
      });
      if (!changed) break;
    }
    previousRate = rate;
    let shift = 0;
    bars.forEach((bar, b) => {
      bar.x0 += shift;
      if (bar.timeX !== null) bar.timeX += shift;
      if (bar.keyX !== null) bar.keyX += shift;
      if (bar.columns.length === 0) shift += target[b] - natural[b];
      const widths = fitColumns(bar.columns, target[b], staff);
      bar.columns.forEach((placed, c) => {
        const offset = placed.x - placed.start;
        placed.start += shift;
        placed.x = placed.start + Math.min(offset, Math.max(widths[c] / 2, widths[c] - noteInset(placed.column)));
        shift += widths[c] - placed.width;
        placed.width = widths[c];
      });
      bar.x1 += shift;
    });
  });
}

/** Columns' widths summing to `total`: each its room times one factor, none below what its notes need. */
function fitColumns(columns: PlacedColumn[], total: number, staff: boolean): number[] {
  const rooms = columns.map(c => c.width);
  const sum = rooms.reduce((t, w) => t + w, 0);
  if (sum === 0) return rooms;
  if (total >= sum) return rooms.map(w => (w * total) / sum);
  const least = columns.map(c => Math.min(c.width, leastWidth(c.column, c.heads, staff)));
  const widths = (f: number) => rooms.map((w, c) => Math.max(least[c], w * f));
  let low = 0;
  let high = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2;
    if (widths(mid).reduce((t, w) => t + w, 0) > total) high = mid;
    else low = mid;
  }
  return widths(low);
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
/** How far the heads and stems of the given bars (one line's) reach above and below the staff, in steps. */
function staffReach(bars: PlacedBar[], marks: boolean): StaffReach {
  let high = 8;
  let low = 0;
  // Over every column, in steps: the vibrato's band, then an octave line over all of it.
  let vibrato = -Infinity;
  let ottavaAbove = false;
  let ottavaBelow = false;
  // Every Voice drawn in the bar, each with its own stems' side (step 9).
  bars.flatMap(bar => [...(bar.hidden ? [] : bar.columns), ...(bar.voices ?? []).flatMap(v => v.columns)]).forEach(placed => {
    const column = placed.heads;
    if (column.length === 0) return;
    const top = column[column.length - 1].step;
    const bottom = column[0].step;
    const up = placed.voiceUp ?? stemUpFor(column);
    const reachUp = top + (up ? STEM_STEPS + 2 : 1);
    const reachDown = bottom - (up ? 1 : STEM_STEPS + 2);
    high = Math.max(high, reachUp);
    low = Math.min(low, reachDown);
    if (!marks) return;
    const c = placed.column;
    const notes = c.notes.filter((n): n is Note => n !== null);
    // Accents and staccato stand at the heads, away from the stem.
    if (notes.some(n => n.accent || n.staccato)) {
      if (up) low = Math.min(low, bottom - 6);
      else high = Math.max(high, top + 6);
    }
    // A tap's circled T over the heads, an upward stem and the marks over the heads (`staffMarks.ts`).
    if (notes.some(n => n.tap)) {
      const marksOver = !up && notes.some(n => n.accent || n.staccato) ? top + 6 : -Infinity;
      const under = Math.max(8, up ? reachUp : top + 1, marksOver);
      high = Math.max(high, under + Math.ceil((6 + 2 * TAP_RADIUS + 2) * 2 / SPACE));
    }
    // A fermata over the heads, an upward stem and a tap (`staffMarks.ts`).
    if (c.fermata) {
      const under = Math.max(8, up ? reachUp : top + 1) + (notes.some(n => n.tap) ? Math.ceil((6 + 2 * TAP_RADIUS + 2) * 2 / SPACE) : 0);
      high = Math.max(high, Math.max(under + Math.ceil((3 + 12 + 2) * 2 / SPACE), 8 + Math.ceil((10 + 3 + 12 + 2) * 2 / SPACE)));
    }
    if (notes.some(n => n.vibrato || n.mordent)) vibrato = Math.max(vibrato, Math.max(reachUp, 8) + Math.ceil((VIBRATO_CLEAR + 4) * 2 / SPACE));
    if (c.ottava === '8va' || c.ottava === '15ma') ottavaAbove = true;
    if (c.ottava === '8vb' || c.ottava === '15mb') ottavaBelow = true;
  });
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
