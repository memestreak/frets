/**
 * Lyrics: a syllable under a note, one per Lyric line (`docs/specs/2026-11-09-tab-lyrics-design.md`,
 * issue #408). Their size, which notes take one, setting one, and where the field's Space, hyphen and
 * Shift+Space go next. Pure; `rows.ts` makes their rows, `ClipWords.tsx` draws them.
 */
import { isRest, type Column, type Part } from './clip';
import { columnAt, withColumn, without } from './editing';

export const LYRIC_SIZE = 11;
/** From one Lyric line's middle to the next. */
export const LYRIC_LINE = 15;
/** The room kept between two syllables along a line, so neighbours never touch. */
export const LYRIC_GAP = 6;
/** A hyphen's room, where a syllable is joined to the next. */
export const HYPHEN_ROOM = 10;
/** The most Lyric lines a column takes: plenty for verses and a chorus, and a cap on a runaway Down arrow. */
export const MAX_LYRIC_LINES = 8;

/** About how wide a syllable is drawn: a guess, as the layout knows no fonts. */
export function lyricWidth(text: string): number {
  return text.length * 6.2;
}

/** A syllable as drawn: the word without its trailing hyphen, and whether it is joined to the next. */
export function syllableOf(text: string): { shown: string; joined: boolean } {
  const joined = text.endsWith('-') && text.length > 1;
  return { shown: joined ? text.replace(/-+$/, '') : text, joined };
}

/** The room a column's syllables need along the line: the widest, with a hyphen's room after a joined one. */
export function lyricRoom(column: Column): number {
  return Math.max(0, ...(column.lyrics ?? []).map(l => {
    if (!l) return 0;
    const { shown, joined } = syllableOf(l);
    return lyricWidth(shown) + LYRIC_GAP + (joined ? HYPHEN_ROOM : 0);
  }));
}

/** How many Lyric lines some columns use: one more than the last line any of them has a syllable on. */
export function lyricLines(columns: readonly Column[]): number {
  return Math.max(0, ...columns.map(c => c.lyrics?.length ?? 0));
}

/**
 * Whether a column takes a syllable, as Dorico and MuseScore have it: a note that is played, so not a
 * rest, a grace note, or a column whose notes are all held on from the one before by ties.
 */
export function takesLyric(column: Column | null | undefined): boolean {
  if (!column || column.grace || isRest(column)) return false;
  return column.notes.some(n => n !== null && !n.tie);
}

/** A column's syllable on a line, or "". */
export function lyricAt(clip: Part, at: { bar: number; column: number }, line: number): string {
  return clip.bars[at.bar]?.columns[at.column]?.lyrics?.[line] ?? '';
}

/** The clip with a column's syllable on `line` set; blank clears it. A column that takes none is left as it is. */
export function setLyric(clip: Part, at: { bar: number; column: number }, line: number, text: string): Part {
  const cursor = { ...at, string: 0 };
  if (!columnAt(clip, cursor) || line < 0 || line >= MAX_LYRIC_LINES) return clip;
  const value = text.trim();
  if (lyricAt(clip, at, line) === value) return clip;
  if (value && !takesLyric(columnAt(clip, cursor))) return clip;
  return withColumn(clip, cursor, column => {
    const lyrics = [...(column.lyrics ?? [])];
    while (lyrics.length <= line) lyrics.push('');
    lyrics[line] = value;
    while (lyrics.length > 0 && lyrics[lyrics.length - 1] === '') lyrics.pop();
    const rest = without(column, 'lyrics');
    return lyrics.length > 0 ? { ...rest, lyrics } : rest;
  });
}

/**
 * The next note that takes a syllable after `at` (step 1), or before it (-1), across bar lines; null at
 * either end. With `step` 0, the note at `at` if it takes one, else the next.
 */
export function lyricNote(clip: Part, at: { bar: number; column: number }, step: 1 | -1 | 0): { bar: number; column: number } | null {
  const places: { bar: number; column: number }[] = [];
  clip.bars.forEach((bar, b) => bar.columns.forEach((_, c) => places.push({ bar: b, column: c })));
  const here = places.findIndex(p => p.bar === at.bar && p.column === at.column);
  // In an empty bar: the first place after its start.
  const start = here >= 0 ? here : places.findIndex(p => p.bar > at.bar);
  if (start < 0) return step === -1 ? lastBefore(clip, places, places.length) : null;
  if (step === -1) return lastBefore(clip, places, here >= 0 ? here : start);
  for (let i = step === 1 && here >= 0 ? start + 1 : start; i < places.length; i++) {
    if (takesLyric(columnAt(clip, { ...places[i], string: 0 }))) return places[i];
  }
  return null;
}

function lastBefore(clip: Part, places: { bar: number; column: number }[], before: number): { bar: number; column: number } | null {
  for (let i = before - 1; i >= 0; i--) {
    if (takesLyric(columnAt(clip, { ...places[i], string: 0 }))) return places[i];
  }
  return null;
}

/** What the field's key does after its syllable is set: on to the next note (Space), joined to it (hyphen), back (Shift+Space), another Lyric line, or done. */
export type LyricMove = 'next' | 'hyphen' | 'back' | 'up' | 'down' | 'done' | 'cancel';

/** The syllable a key in the field sets: a hyphen joins it to the next (an empty one stays empty). */
export function lyricValue(typed: string, move: LyricMove): string {
  const value = typed.trim();
  if (move !== 'hyphen') return value;
  const bare = value.replace(/-+$/, '');
  return bare ? `${bare}-` : '';
}
