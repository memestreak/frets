/**
 * A little Markdown in a Text over a column (issue #446;
 * docs/specs/2026-11-09-tab-text-markdown-design.md): only bold is drawn, everything else stays as
 * typed, and Cmd+B in the Text field.
 */
import { drawnText, readTextMarks, runsOf, toggleBold, type TypedText } from '@/features/tab/textMarks';

const runs = (text: string) => {
  const marked = readTextMarks(text);
  return runsOf(marked, 0, marked.drawn.length);
};

describe('readTextMarks', () => {
  it('draws **bold** and __bold__ bold, the marks left out', () => {
    expect(runs('Press **Esc** or __Tab__')).toEqual([
      { text: 'Press ', bold: false },
      { text: 'Esc', bold: true },
      { text: ' or ', bold: false },
      { text: 'Tab', bold: true },
    ]);
  });

  it('keeps every other mark as typed: italics, code, strike, links, an unclosed or empty **', () => {
    for (const text of [
      '*slowly*', '_softly_', '***both***', '`code`', '~~strike~~', '[link](https://example.com)', 'https://example.com',
      '**open', '5* chord', 'snake_case_word', 'a ** b **', '****', '\\(x\\)',
    ]) {
      expect(drawnText(text)).toBe(text);
    }
  });

  it('reads bold inside italics and backticks, which stay as typed', () => {
    expect(runs('*a **b** c*')).toEqual([{ text: '*a ', bold: false }, { text: 'b', bold: true }, { text: ' c*', bold: false }]);
    expect(runs('`**x**`')).toEqual([{ text: '`', bold: false }, { text: 'x', bold: true }, { text: '`', bold: false }]);
  });

  it('shows a star, an underscore or a backslash escaped with a backslash as typed', () => {
    expect(drawnText('\\*\\*star\\*\\* and \\_x\\_ and \\\\')).toBe('**star** and _x_ and \\');
  });

  it('keeps a new line as a letter, and bold runs over it (issue #445)', () => {
    expect(runs('one\n**two\nthree**')).toEqual([{ text: 'one\n', bold: false }, { text: 'two\nthree', bold: true }]);
  });

  it('leaves a text with no marks as it is', () => {
    expect(drawnText('let "it" ring, softly.')).toBe('let "it" ring, softly.');
    expect(drawnText('')).toBe('');
  });
});

describe('toggleBold (Cmd+B in the Text field)', () => {
  const at = (value: string, from: string): TypedText => {
    const start = value.indexOf(from);
    return { value, start, end: start + from.length };
  };

  it('wraps the selected words in **, keeping them selected', () => {
    expect(toggleBold(at('press Esc now', 'Esc'))).toEqual({ value: 'press **Esc** now', start: 8, end: 11 });
    expect(toggleBold(at('press Esc now', 'Esc now'))).toEqual({ value: 'press **Esc now**', start: 8, end: 15 });
  });

  it('makes bold words plain again, from inside the marks or with them selected', () => {
    expect(toggleBold(at('press **Esc** now', 'Esc'))).toEqual({ value: 'press Esc now', start: 6, end: 9 });
    expect(toggleBold(at('press **Esc** now', '**Esc**'))).toEqual({ value: 'press Esc now', start: 6, end: 9 });
  });

  it('leaves spaces and new lines at the selection’s ends outside the marks', () => {
    expect(toggleBold(at('press Esc now', ' Esc '))).toEqual({ value: 'press **Esc** now', start: 8, end: 11 });
    expect(toggleBold(at('one\ntwo', '\ntwo'))).toEqual({ value: 'one\n**two**', start: 6, end: 9 });
  });

  it('puts the marks in with the caret between them when nothing is selected', () => {
    expect(toggleBold({ value: 'press ', start: 6, end: 6 })).toEqual({ value: 'press ****', start: 8, end: 8 });
  });

  it('draws what it writes', () => {
    expect(runs(toggleBold(at('press Esc now', 'Esc')).value)[1]).toEqual({ text: 'Esc', bold: true });
  });
});
