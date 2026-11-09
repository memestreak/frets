/**
 * Free text over a column (alphaTex `txt`): its size, about how wide it is, and how a long one wraps onto
 * more lines over its column (issue #323). Pure; `layoutClip` wraps each text once, and the drawing, the
 * hit tests and the exports use its lines.
 */
import { lineStarts, stackWords, wrapWords, type StackedWord } from './stackWords';
import { readTextMarks, runsOf, type MarkedText, type TextRun } from './textMarks';

export const BEAT_TEXT_SIZE = 11;
/** Free text starts a little left of its column's middle and runs right. */
export const BEAT_TEXT_INSET = 4;
/** From one wrapped line's baseline to the next. */
export const BEAT_TEXT_LINE = 13;
/** The room kept between a text's widest line and the next text along the line. */
export const BEAT_TEXT_GAP = 8;

/** About how wide one plain (italic) letter of a text is: a guess, as the layout knows no fonts. */
const LETTER = 5.6;
/** How much wider a bold letter is: Figtree's bold over its regular, about 12% (issue #446). */
export const BOLD_WIDER = 1.12;

/** About how wide a run of plain text is. */
export function beatTextWidth(text: string): number {
  return text.length * LETTER;
}

/** About how wide `length` of a text's drawn letters from `at` are, its bold ones wider. */
function markedWidth(marked: MarkedText, at: number, length: number): number {
  let bold = 0;
  for (let k = at; k < at + length; k++) if (marked.bold[k]) bold++;
  return (length - bold) * LETTER + bold * LETTER * BOLD_WIDER;
}

/** A text's drawn letters (its marks left out, `textMarks.ts`) broken at its spaces into lines no wider than `room` (`wrapWords`). */
export function wrapBeatText(text: string, room: number): string[] {
  const marked = readTextMarks(text);
  return wrapWords(marked.drawn, room, (line, at) => markedWidth(marked, at, line.length));
}

/**
 * A wrapped text's lines (`PlacedColumn.textLines`) as runs to draw, a line that broke at a space
 * keeping it, so the text reads and copies as typed; and how wide its widest line is.
 */
export function beatTextLines(text: string, lines: string[]): { runs: TextRun[][]; width: number } {
  const marked = readTextMarks(text);
  const starts = lineStarts(lines);
  return {
    runs: lines.map((line, n) => runsOf(marked, starts[n], line.length + (marked.drawn[starts[n] + line.length] === ' ' ? 1 : 0))),
    width: Math.max(0, ...lines.map((line, n) => markedWidth(marked, starts[n], line.length))),
  };
}

/** The least room a text wraps to, about 18 characters, so a text between close columns isn't a word a line. */
export const BEAT_TEXT_MIN_ROOM = 100;
/**
 * The most room a text runs to before it wraps, however much is free: about 60 characters, as long as
 * "Text very near the line end runs to the edge and wraps there" (Jeremy, 2026-11-03).
 */
export const BEAT_TEXT_MAX_ROOM = beatTextWidth('Text very near the line end runs to the edge and wraps there');

/**
 * The most characters a short text has, such as "let ring throughout": counted, not measured, so it never
 * moves when the line's width changes. Only drawn letters count, not a bold text's marks.
 */
export const SHORT_TEXT_LENGTH = 20;

/**
 * Whether a text goes under the chord names and their diagrams, right over the music, rather than over
 * the names: a short one, such as "let ring" or "P.M.", on a line with chord names. A long one stays over
 * the names, so it never pushes a chord off its music (Jeremy, 2026-11-07); so does one with a new line
 * in it, a note of more than one line (issue #445).
 */
export function textGoesUnder(text: string, lineHasChords: boolean): boolean {
  const { drawn } = readTextMarks(text);
  return lineHasChords && drawn.length <= SHORT_TEXT_LENGTH && !drawn.includes('\n');
}

/** Where a text on a line goes: its lines, and its first line's place in the line's text rows, from the top (its last line is on its level's bottom row). */
export type PlacedBeatText = StackedWord;

/**
 * The texts of one line (system), left to right, wrapped and stacked (issue #323, `stackWords`).
 *
 * Each wraps to the room before the next text, or before `end`, but never to less than
 * `BEAT_TEXT_MIN_ROOM` or more than `BEAT_TEXT_MAX_ROOM`; one that still touches one before it moves up
 * a level, as Dorico moves colliding text away from the staff; a text moved up makes room for the one
 * under it (Jeremy, 2026-11-03).
 */
export function placeBeatTexts(texts: { x0: number; text: string }[], end: number): { placed: PlacedBeatText[]; rows: number } {
  // Wrapped and measured as drawn, the marks left out; the lines are the drawn letters.
  const marked = texts.map(t => readTextMarks(t.text));
  return stackWords(texts.map((t, k) => ({ x0: t.x0, lead: 0, text: marked[k].drawn })), end, {
    width: (line, at, k) => markedWidth(marked[k], at, line.length),
    gap: BEAT_TEXT_GAP, minRoom: BEAT_TEXT_MIN_ROOM, maxRoom: BEAT_TEXT_MAX_ROOM,
  });
}
