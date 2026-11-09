/**
 * The rows of one system (line) of a clip, top to bottom: which marks a line needs and where each goes,
 * in SVG units from the system's top. `layout.ts` places the columns along them.
 */
import { hasNotes, startsFreeTime, type Bar, type Bend, type Part, type Note } from './clip';
import { BEAT_TEXT_LINE, textGoesUnder } from './beatText';
import { SECTION_LINE } from './sectionText';
import { diagramOf, overNameHeight } from './chordDiagrams';
import type { Parts, PlacedColumn } from './layout';
import { LYRIC_LINE, lyricLines } from './lyrics';


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
  /** Long free text over its column (alphaTex txt), over the chord names: its first line's middle; a wrapped text's lines go on down from it. */
  text: number | null;
  /** Short free text (`textGoesUnder`), under the chord names and their diagrams, right over the music. */
  textUnder: number | null;
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
  /**
   * The Lyrics: the middle of Lyric line 1, each later line `LYRIC_LINE` under it (`lyricCount` of them).
   * Under the staff, between the staff and the tab when both are drawn (as guitar songbooks print them),
   * and under the tab alone (issue #408).
   */
  lyrics: number | null;
  lyricCount: number;
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

/** The room over the tab for the up-stem Voices' stems, beams and tuplet numbers, as under it. */
const STEMS_OVER_ROOM = 50;

/** Whether a part's bar draws two or more Voices, so each Voice's stems take its side (step 9, Q2, Q4). */
export function severalVoices(bar: Bar, ownVoice = 0): boolean {
  if (!bar.otherVoices?.length) return false;
  const ownDrawn = ownVoice === 0 ? bar.columns.length > 0 : hasNotes(bar.columns);
  return bar.otherVoices.length + (ownDrawn ? 1 : 0) >= 2;
}

/**
 * The rows a clip (or one line of it, as `lineClip` makes) needs, top to bottom: the words over
 * everything, the staff, the tab's marks, the tab.
 */
export function rowsFor(
  clip: Part, parts: Parts = 'tab', reach: StaffReach = { high: 8, low: 0 },
  freeTimeLabel = clip.bars.some((_, i) => startsFreeTime(clip, i)),
  /** How many text rows the line's wrapped and stacked texts take (`placeBeatTexts`): the text row grows down by the rest. */
  textLines = 1,
  /** How many text rows the line's short texts under the chord names take: their row grows down by the rest. */
  textUnderLines = 1,
  /** How many rows the line's stacked sections take (`placeSections`): the section row grows down by the rest. */
  sectionLines = 1,
  /** Chord diagrams under the names (the View options' Chord diagrams). */
  diagrams = false,
): Rows {
  const tab = parts !== 'staff';
  // Every Voice's columns: another Voice's chord names, texts and marks take their rows too (step 9).
  const columns = clip.bars.flatMap(b => [...b.columns, ...(b.otherVoices ?? []).flatMap(o => o.columns)]);
  const notes = columns.flatMap(c => c.notes).filter((n): n is Note => n !== null);
  const chords = columns.some(c => c.chord);
  const used = {
    capo: !!clip.capo,
    // "Free time" goes in the tempo's row, over the chord names, as Guitar Pro prints it.
    // The first bar's tempo is printed in the score's head (`tempoOver` in layoutText.ts).
    tempo: clip.bars.some((b, index) => index > 0 && b.tempo) || freeTimeLabel,
    section: clip.bars.some(b => b.section),
    chords,
    diagrams: diagrams && columns.some(c => c.chord && diagramOf(clip, c.chord)),
    text: columns.some(c => c.text && !textGoesUnder(c.text, chords)),
    textUnder: columns.some(c => c.text && textGoesUnder(c.text, chords)),
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
  const lyricCount = lyricLines(columns);
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
    // Long free text over the chord names, so a chord and its diagram sit right over the music (Jeremy, 2026-11-06).
    text: tall(row(used.text), (Math.max(1, textLines) - 1) * BEAT_TEXT_LINE),
    chords: row(used.chords),
    // The diagrams hang under the names (books print the name over its diagram); the rows after start under them.
    diagrams: tall(used.diagrams ? y + DIAGRAM_DROP : null, DIAGRAM_DROP + overNameHeight()),
    // Short free text, such as "let ring", under them, by the music it is about (Jeremy, 2026-11-07).
    textUnder: tall(row(used.textUnder), (Math.max(1, textUnderLines) - 1) * BEAT_TEXT_LINE),
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
  const marksTop = {
    fermatas: row(used.fermatas),
    hairpins: row(used.hairpins),
  };
  // Staff and tab: the words right under the staff and its hairpins, the tab's marks under them.
  const lyricsBetween = parts === 'both' ? tall(row(lyricCount > 0), (lyricCount - 1) * LYRIC_LINE) : null;
  const marks = {
    ...marksTop,
    strokes: tab ? row(used.strokes) : strokesOver,
    letRing: row(used.letRing),
    palmMute: row(used.palmMute),
    whammy: row(used.whammy),
    harmonics: row(used.harmonics),
    vibrato: row(used.vibrato),
    accents: row(used.accents),
  };
  if (!tab) {
    // The staff alone: the words under everything under the staff.
    const lyrics = tall(row(lyricCount > 0), (lyricCount - 1) * LYRIC_LINE);
    // The tab's rows stand at the staff's foot, drawing nothing.
    const end = y + 12;
    return {
      ...words, ...marks, lyrics, lyricCount, score, tab, tabStems: false, dives: null, staffTop: end, staffBottom: end,
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
  const foot = tabStems ? under + 54 : under + 16;
  // The tab alone: the words under its stems and tuplet numbers.
  const lyricsUnder = parts === 'tab' && lyricCount > 0 ? foot + 2 : null;
  return {
    ...words, ...marks, lyrics: lyricsBetween ?? lyricsUnder, lyricCount, score, tab, tabStems, dives, staffTop, staffBottom,
    bandTop: (score ? score.top : staffTop) - 10, bandBottom: staffBottom + 10,
    loopY: tabStems ? under + 40 : under + 14,
    stemTop: under + 8, stemBottom: under + 32, tuplet: under + 45,
    height: lyricsUnder === null ? foot : lyricsUnder + (lyricCount - 1) * LYRIC_LINE + 12,
  };
}

/** The row a column's free text is drawn in: under the chord names when it is a short one, else over them. */
export function textRowOf(rows: Rows, placed: PlacedColumn): number | null {
  return placed.textUnder ? rows.textUnder : rows.text;
}

/** How far the staff's notes and stems reach, in steps: the highest over the top line, the lowest under the bottom one. */
export interface StaffReach {
  high: number;
  low: number;
}

/** Extra room above and below the section row, so its box stands clear of the rows beside it (Jeremy, 2026-10-27). */
const SECTION_ROOM = 9;
