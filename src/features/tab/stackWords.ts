/**
 * Words written along a line over the music (free text, section names) that make room for each other
 * without moving the music: each wraps to the room before the next, and one that still touches the one
 * before it moves up a level, away from the music, as Dorico and MuseScore move colliding text
 * (issues #323, #389). Pure; `layoutClip` places each line's words once.
 */

/** One word to place: where it starts, how far right of that its text starts (a rehearsal mark's box goes first), and its text. */
export interface WordToStack {
  x0: number;
  lead: number;
  text: string;
}

/** How a kind of word is measured and wrapped. */
export interface StackRules {
  /** About how wide a run of its text is drawn. */
  width: (text: string) => number;
  /** The room kept between one word's end and the next word's start. */
  gap: number;
  /** The least and the most room a word wraps to, however close or far the next word is. */
  minRoom: number;
  maxRoom: number;
}

/** A placed word: its lines, and its first line's place in the line's rows, from the top (its last line is on its level's bottom row). */
export interface StackedWord {
  lines: string[];
  top: number;
}

/**
 * A text broken at its spaces into lines no wider than `room`, each as long as fits. A word wider than
 * the room is never split: it goes on a line of its own. The words are kept as typed.
 */
export function wrapWords(text: string, room: number, width: (text: string) => number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const longer = line ? `${line} ${word}` : word;
    if (line && width(longer) > room) {
      lines.push(line);
      line = word;
    } else {
      line = longer;
    }
  }
  lines.push(line);
  return lines;
}

/**
 * The words of one line (system), left to right, wrapped and stacked.
 *
 * First each wraps to the room before the next word starts, or before `end`, between the rules' least
 * and most room. A word that then still touches one before it moves up a level: each takes the lowest
 * level where it clears the words already there. Then each wraps again to the room before the next word
 * left on its own level, so a word moved up makes room for the one under it. A level is as tall as its
 * tallest word and each word sits on its level's bottom row; level 0 is nearest the music, and `rows` is
 * how many rows the line's words take (at least one).
 */
export function stackWords(words: WordToStack[], end: number, rules: StackRules): { placed: StackedWord[]; rows: number } {
  const wrapped = (k: number, nextStart: number) => {
    const { x0, lead, text } = words[k];
    const room = Math.min(rules.maxRoom, Math.max(rules.minRoom, nextStart - rules.gap - x0 - lead));
    return wrapWords(text, room, rules.width);
  };
  const reach = (k: number, lines: string[]) => words[k].x0 + words[k].lead + Math.max(...lines.map(rules.width));
  const lineEnd = end + rules.gap;
  // Wrapped to the room before the next word, to find which words touch.
  const first = words.map((_, k) => reach(k, wrapped(k, words[k + 1]?.x0 ?? lineEnd)));
  // Each level's right end so far.
  const ends: number[] = [];
  const levels = words.map(({ x0 }, k) => {
    let level = ends.findIndex(e => x0 >= e + rules.gap);
    if (level < 0) level = ends.length;
    ends[level] = first[k];
    return level;
  });
  // Wrapped again to the room before the next word on the same level.
  const lines = words.map((_, k) => {
    const next = words.findIndex((_, j) => j > k && levels[j] === levels[k]);
    return wrapped(k, next < 0 ? lineEnd : words[next].x0);
  });
  const heights = ends.map((_, level) => Math.max(...lines.filter((_, k) => levels[k] === level).map(l => l.length)));
  // Levels from the top: the highest first.
  const above = (level: number) => heights.slice(level + 1).reduce((sum, h) => sum + h, 0);
  return {
    // Each word sits on its level's bottom row, next to the music, as in Dorico and MuseScore: a short
    // word beside a wrapped one stays by the staff rather than hanging from the top.
    placed: lines.map((l, k) => ({ lines: l, top: above(levels[k]) + heights[levels[k]] - l.length })),
    rows: Math.max(1, heights.reduce((sum, h) => sum + h, 0)),
  };
}
