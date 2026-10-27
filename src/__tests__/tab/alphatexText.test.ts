import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { COMMENT_NOTE, commentSpots, lineAt, lineMarks } from '@/features/tab/alphatexText';

describe('commentSpots', () => {
  it('finds line and block comments, but not inside quoted text', () => {
    const text = '\\title "a // b" // one\n/* two\nlines */ 5.6 |\n\\title \'c /* d\' x';
    const found = commentSpots(text).map(s => text.slice(s.from, s.to));
    expect(found).toEqual(['// one', '/* two\nlines */']);
  });

  it('skips escaped quotes and runs an unclosed comment to the end', () => {
    expect(commentSpots('"a \\" // b" /* open').map(s => s.from)).toEqual([12]);
  });
});

describe('lineMarks', () => {
  it('marks errors red, unplaced errors on the first line, and comment lines grey', () => {
    const text = 'one\n/* two\nthree */\nfour';
    const marks = lineMarks(text, [{ from: text.indexOf('four'), to: text.length, message: 'Bad' }], ['No track'], commentSpots(text));
    expect([...marks.entries()].sort()).toEqual([
      [0, { tone: 'error', message: 'No track' }],
      [1, { tone: 'note', message: COMMENT_NOTE }],
      [2, { tone: 'note', message: COMMENT_NOTE }],
      [3, { tone: 'error', message: 'Bad' }],
    ]);
    expect(lineAt(text, text.indexOf('three'))).toBe(2);
  });
});

describe('error spots from alphaTab', () => {
  it('places an error by string index, past symbols that take two UTF-16 units', () => {
    const text = '\\title "🎸"\n:4 5.6 3.q |';
    const result = readAlphaTexWith(alphaTab, text);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.spots).toHaveLength(1);
    expect(text.slice(result.spots![0].from, result.spots![0].to)).toBe('q');
  });
});
