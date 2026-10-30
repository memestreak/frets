/**
 * Pure helpers for the AlphaTex view's editor (`AlphaTexEditor.tsx`): where
 * the comments are, and which line a spot in the text is on.
 * See `docs/specs/2026-10-27-tab-alphatex-editing-design.md`.
 */
import type { TextSpot } from './ascii';
import { readFxLine } from './fxLine';

/** What the margin says beside a comment: Frets keeps none of them but the FX lines. */
export const COMMENT_NOTE = 'Comments are not kept';

/** A `\track` tag, not a longer tag that starts the same. */
const TRACK_TAG = /^\\track(?![a-z0-9])/i;

/**
 * The comments in alphaTex text, `// to the line's end` and `/* … *\/`, as
 * spots. Quoted text ("…" or '…', with backslash escapes) is not a comment. Each
 * track's first `// frets:fx` line is kept, as its FX (`fxLine.ts`), so it is no
 * spot: a line belongs to the track whose `\track` comes last before it, and one
 * before the second track's `\track` to the first, as `alphatexRead.ts` reads them.
 */
export function commentSpots(text: string): TextSpot[] {
  const spots: TextSpot[] = [];
  /** The tracks (from 0) whose FX line has been found. */
  const fxKept = new Set<number>();
  let tracks = 0;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '"' || c === "'") {
      i++;
      while (i < text.length && text[i] !== c) i += text[i] === '\\' ? 2 : 1;
      i++;
    } else if (c === '/' && text[i + 1] === '/') {
      const end = text.indexOf('\n', i);
      const to = end === -1 ? text.length : end;
      // Before the second `\track`, the first track's.
      const track = Math.max(0, tracks - 1);
      if (!fxKept.has(track) && readFxLine(text.slice(i + 2, to))) fxKept.add(track);
      else spots.push({ from: i, to, message: COMMENT_NOTE });
      i = to;
    } else if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      const to = end === -1 ? text.length : end + 2;
      spots.push({ from: i, to, message: COMMENT_NOTE });
      i = to;
    } else {
      if (c === '\\' && TRACK_TAG.test(text.slice(i, i + 7))) tracks++;
      i++;
    }
  }
  return spots;
}

/** The 0-based line that a string index is on. */
export function lineAt(text: string, index: number): number {
  let line = 0;
  for (let i = 0; i < index && i < text.length; i++) if (text[i] === '\n') line++;
  return line;
}

/** What each line's margin says: its errors' messages, else that its comments aren't kept, else nothing. */
export interface LineMark {
  tone: 'error' | 'note';
  message: string;
}

/**
 * The marks in the margin, by line. An error with no spot in the text (the
 * clip has two tracks, say) is marked on the first line. A block comment
 * over several lines marks each of them.
 */
export function lineMarks(text: string, errors: TextSpot[], unplaced: string[], comments: TextSpot[]): Map<number, LineMark> {
  const byLine = new Map<number, string[]>();
  const add = (line: number, message: string) => {
    const list = byLine.get(line) ?? [];
    if (!list.includes(message)) list.push(message);
    byLine.set(line, list);
  };
  for (const e of errors) add(lineAt(text, e.from), e.message);
  for (const message of unplaced) add(0, message);
  const marks = new Map<number, LineMark>();
  for (const [line, messages] of byLine) marks.set(line, { tone: 'error', message: messages.join('\n') });
  for (const c of comments) {
    for (let line = lineAt(text, c.from), last = lineAt(text, Math.max(c.from, c.to - 1)); line <= last; line++) {
      if (!marks.has(line)) marks.set(line, { tone: 'note', message: COMMENT_NOTE });
    }
  }
  return marks;
}
