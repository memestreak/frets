/**
 * The Chords panel's words (issue #400): a copy's free name, and where Insert writes.
 */
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { partOf } from '@/features/tab/clip';
import { cursorPlace, freeName } from '@/features/tab/ChordPanel';

function part(text: string) {
  const read = readAlphaTexWith(alphaTab, text);
  if (!read.ok) throw new Error(read.errors.join('\n'));
  return partOf(read.clip);
}

describe('freeName', () => {
  it('numbers a copy from 2, past the names taken', () => {
    expect(freeName('C', ['C'])).toBe('C 2');
    expect(freeName('C', ['C', 'C 2', 'C 3'])).toBe('C 4');
    expect(freeName('G/B', ['G/B'])).toBe('G/B 2');
  });
});

describe('cursorPlace', () => {
  const clip = part('\\ts (4 4)\n3.1.4 3.1.8 3.1.8 3.1.16 3.1.16 3.1.8 r.4 | r.1 |');
  const at = (bar: number, column: number) => cursorPlace(clip, { bar, column, string: 0 });

  it('counts bars and beats from 1, the parts between as ¼ ½ ¾', () => {
    expect(at(0, 0)).toBe('bar 1, beat 1');
    expect(at(0, 1)).toBe('bar 1, beat 2');
    expect(at(0, 2)).toBe('bar 1, beat 2½');
    expect(at(0, 4)).toBe('bar 1, beat 3¼');
    expect(at(0, 5)).toBe('bar 1, beat 3½');
    expect(at(1, 0)).toBe('bar 2, beat 1');
  });

  it('counts in the bar’s own beat: eighths in 6/8', () => {
    const six = part('\\ts (6 8)\n3.1.4 3.1.8 r.4. |');
    expect(cursorPlace(six, { bar: 0, column: 1, string: 0 })).toBe('bar 1, beat 3');
  });

  it('says nothing for a bar the clip hasn’t', () => {
    expect(at(5, 0)).toBe('');
  });
});
