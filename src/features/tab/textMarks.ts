/**
 * The little Markdown a Text over a column may hold (issue #446): `**bold**` (or `__bold__`), read by
 * the Chat panel's own reader with only bold on (`parseInlines`). The alphaTex keeps the marks as
 * typed, so other programs show them plainly; Frets draws the letters without them. Any other mark
 * (italics, code, strike, a link, an unclosed `**`) is drawn as typed. A new line in a Text (issue #445)
 * is one of its letters. Pure.
 */
import { parseInlines, type Inline } from './chat/markdown';

/** A run of a Text's drawn letters, all bold or all plain. */
export interface TextRun {
  text: string;
  bold: boolean;
}

/** A Text's drawn letters, the marks left out, and which of them are bold. */
export interface MarkedText {
  drawn: string;
  bold: boolean[];
}

/** The text read for its marks. */
export function readTextMarks(text: string): MarkedText {
  const marked: MarkedText = { drawn: '', bold: [] };
  const walk = (inlines: Inline[], bold: boolean) => {
    for (const inline of inlines) {
      if (inline.kind === 'strong') walk(inline.children, true);
      else if (inline.kind === 'text') {
        marked.drawn += inline.text;
        for (let k = 0; k < inline.text.length; k++) marked.bold.push(bold);
      }
      // Nothing else is read with only bold on.
    }
  };
  walk(parseInlines(text, { boldOnly: true }), false);
  return marked;
}

/** A Text's letters as drawn, its marks left out: what the Guitar Pro export writes and the short-text rule counts. */
export function drawnText(text: string): string {
  return readTextMarks(text).drawn;
}

/** The drawn letters from `at` for `length`, as runs of bold or plain. */
export function runsOf(marked: MarkedText, at: number, length: number): TextRun[] {
  const runs: TextRun[] = [];
  for (let k = at; k < at + length && k < marked.drawn.length; k++) {
    const last = runs[runs.length - 1];
    if (last && last.bold === marked.bold[k]) last.text += marked.drawn[k];
    else runs.push({ text: marked.drawn[k], bold: marked.bold[k] });
  }
  return runs;
}

/** A text being typed and its selection, from `start` to `end`. */
export interface TypedText {
  value: string;
  start: number;
  end: number;
}

/**
 * Cmd+B in the Text field (issue #446): the selected words made bold with `**` round them, or plain
 * again when they already are; the selection stays on the same words. Spaces and new lines at the
 * selection's ends are left outside the marks, as Markdown wants, and marks selected with the words
 * count as round them. With nothing selected, the marks go in with the caret between them.
 */
export function toggleBold(typed: TypedText): TypedText {
  const { value } = typed;
  let { start, end } = typed;
  while (start < end && /\s/.test(value[start])) start++;
  while (end > start && /\s/.test(value[end - 1])) end--;
  while (end - start > 4 && value.startsWith('**', start) && value.endsWith('**', end)) { start += 2; end -= 2; }
  const bold = start < end && value.endsWith('**', start) && value.startsWith('**', end);
  if (bold) {
    return { value: value.slice(0, start - 2) + value.slice(start, end) + value.slice(end + 2), start: start - 2, end: end - 2 };
  }
  return { value: `${value.slice(0, start)}**${value.slice(start, end)}**${value.slice(end)}`, start: start + 2, end: end + 2 };
}
