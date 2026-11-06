/**
 * Free text over a column (alphaTex `txt`): its size, about how wide it is, and how a long one wraps onto
 * more lines over its column (issue #323). Pure; `layoutClip` wraps each text once, and the drawing, the
 * hit tests and the exports use its lines.
 */
import { stackWords, wrapWords, type StackedWord } from './stackWords';

export const BEAT_TEXT_SIZE = 11;
/** Free text starts a little left of its column's middle and runs right. */
export const BEAT_TEXT_INSET = 4;
/** From one wrapped line's baseline to the next. */
export const BEAT_TEXT_LINE = 13;
/** The room kept between a text's widest line and the next text along the line. */
export const BEAT_TEXT_GAP = 8;

/** About how wide a run of the text is: a guess, as the layout knows no fonts. */
export function beatTextWidth(text: string): number {
  return text.length * 5.6;
}

/** A text broken at its spaces into lines no wider than `room` (`wrapWords`). */
export function wrapBeatText(text: string, room: number): string[] {
  return wrapWords(text, room, beatTextWidth);
}

/** The least room a text wraps to, about 18 characters, so a text between close columns isn't a word a line. */
export const BEAT_TEXT_MIN_ROOM = 100;
/**
 * The most room a text runs to before it wraps, however much is free: about 60 characters, as long as
 * "Text very near the line end runs to the edge and wraps there" (Jeremy, 2026-11-03).
 */
export const BEAT_TEXT_MAX_ROOM = beatTextWidth('Text very near the line end runs to the edge and wraps there');

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
  return stackWords(texts.map(t => ({ ...t, lead: 0 })), end, {
    width: beatTextWidth, gap: BEAT_TEXT_GAP, minRoom: BEAT_TEXT_MIN_ROOM, maxRoom: BEAT_TEXT_MAX_ROOM,
  });
}
