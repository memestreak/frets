/**
 * Free text over a column (alphaTex `txt`): its size, about how wide it is, and how a long one wraps onto
 * more lines over its column (issue #323). Pure; `layoutClip` wraps each text once, and the drawing, the
 * hit tests and the exports use its lines.
 */

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

/**
 * A text broken at its spaces into lines no wider than `room`, each as long as fits. A word wider than
 * the room is never split: it goes on a line of its own. The words are kept as typed.
 */
export function wrapBeatText(text: string, room: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const longer = line ? `${line} ${word}` : word;
    if (line && beatTextWidth(longer) > room) {
      lines.push(line);
      line = word;
    } else {
      line = longer;
    }
  }
  lines.push(line);
  return lines;
}

/** The least room a text wraps to, about 18 characters, so a text between close columns isn't a word a line. */
export const BEAT_TEXT_MIN_ROOM = 100;
/**
 * The most room a text runs to before it wraps, however much is free: about 60 characters, as long as
 * "Text very near the line end runs to the edge and wraps there" (Jeremy, 2026-11-03).
 */
export const BEAT_TEXT_MAX_ROOM = beatTextWidth('Text very near the line end runs to the edge and wraps there');

/** Where a text on a line goes: its lines, and its first line's place in the line's text rows, from the top. */
export interface PlacedBeatText {
  lines: string[];
  top: number;
}

/**
 * The texts of one line (system), left to right, wrapped and stacked (issue #323).
 *
 * First each wraps to the room before the next text starts, or before `end`, but never to less than
 * `BEAT_TEXT_MIN_ROOM` or more than `BEAT_TEXT_MAX_ROOM`. A text that then still touches one before it
 * moves up a level, as Dorico moves colliding text away from the staff: each takes the lowest level
 * where it clears the texts already there. Then each text wraps again to the room before the next text
 * left on its own level (Jeremy, 2026-11-03: a text moved up makes room for the one under it), still no
 * more than `BEAT_TEXT_MAX_ROOM`. A level is as tall as its tallest text, level 0 is nearest the music,
 * and `rows` is how many text rows the line takes.
 */
export function placeBeatTexts(texts: { x0: number; text: string }[], end: number): { placed: PlacedBeatText[]; rows: number } {
  const roomBefore = (x0: number, nextStart: number) =>
    Math.min(BEAT_TEXT_MAX_ROOM, Math.max(BEAT_TEXT_MIN_ROOM, nextStart - BEAT_TEXT_GAP - x0));
  const lineEnd = end + BEAT_TEXT_GAP;
  // Wrapped to the room before the next text, to find which texts touch.
  const first = texts.map(({ x0, text }, k) => {
    const lines = wrapBeatText(text, roomBefore(x0, texts[k + 1]?.x0 ?? lineEnd));
    return x0 + Math.max(...lines.map(beatTextWidth));
  });
  // Each level's right end so far.
  const ends: number[] = [];
  const levels = texts.map(({ x0 }, k) => {
    let level = ends.findIndex(e => x0 >= e + BEAT_TEXT_GAP);
    if (level < 0) level = ends.length;
    ends[level] = first[k];
    return level;
  });
  // Wrapped again to the room before the next text on the same level.
  const lines = texts.map(({ x0, text }, k) => {
    const next = texts.findIndex((_, j) => j > k && levels[j] === levels[k]);
    return wrapBeatText(text, roomBefore(x0, next < 0 ? lineEnd : texts[next].x0));
  });
  const heights = ends.map((_, level) => Math.max(...lines.filter((_, k) => levels[k] === level).map(l => l.length)));
  // Levels from the top: the highest first.
  const above = (level: number) => heights.slice(level + 1).reduce((sum, h) => sum + h, 0);
  return {
    placed: lines.map((l, k) => ({ lines: l, top: above(levels[k]) })),
    rows: Math.max(1, heights.reduce((sum, h) => sum + h, 0)),
  };
}
