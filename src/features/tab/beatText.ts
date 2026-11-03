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
