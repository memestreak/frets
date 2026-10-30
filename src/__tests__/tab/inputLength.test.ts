import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { writeBars } from '@/features/tab/alphatex';
import { partOf, type Part } from '@/features/tab/clip';
import { setFret } from '@/features/tab/editing';
import { cycleLengthDots, lengthIsOn, startLength, stepLength } from '@/features/tab/inputLength';

function clipOf(text: string): Part {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return partOf(result.clip);
}
const bars = (clip: Part) => writeBars(clip).join('\n');

describe('note input’s length (issue #238)', () => {
  it('starts from the cursor’s note, else the last note before it, else a quarter', () => {
    const clip = clipOf('\\ts (4 4)\n5.1.8{d} r.8 r.2 |');
    expect(startLength(clip, { bar: 0, column: 0, string: 0 })).toEqual({ value: 8, dots: 1 });
    expect(startLength(clip, { bar: 0, column: 2, string: 0 })).toEqual({ value: 8, dots: 1 });
    expect(startLength(clipOf('\\ts (4 4)\nr.1 |'), { bar: 0, column: 0, string: 0 })).toEqual({ value: 4, dots: 0 });
  });

  it('steps between a whole and a sixty-fourth, and a sixty-fourth takes no dots', () => {
    expect(stepLength({ value: 4, dots: 1 }, -1)).toEqual({ value: 8, dots: 1 });
    expect(stepLength({ value: 1, dots: 0 }, 1)).toEqual({ value: 1, dots: 0 });
    expect(stepLength({ value: 32, dots: 1 }, -1)).toEqual({ value: 64, dots: 0 });
    expect(cycleLengthDots({ value: 4, dots: 2 })).toEqual({ value: 4, dots: 0 });
    expect(cycleLengthDots({ value: 64, dots: 0 })).toEqual({ value: 64, dots: 0 });
  });

  it('lights the Duration button of its value and Dotted when it has dots', () => {
    expect(lengthIsOn({ value: 16, dots: 0 }, 'sixteenth')).toBe(true);
    expect(lengthIsOn({ value: 16, dots: 0 }, 'quarter')).toBe(false);
    expect(lengthIsOn({ value: 16, dots: 1 }, 'dot')).toBe(true);
  });
});

describe('setFret with a length', () => {
  const at = (column: number) => ({ bar: 0, column, string: 0 });

  it('splits a longer rest, leaving the fewest rests after the note', () => {
    expect(bars(setFret(clipOf('\\ts (4 4)\n5.1.4 r.2 r.4 |'), at(1), 7, { value: 16, dots: 0 }))).toBe('5.1.4 7.1.16 r.4{dd} r.4 |');
  });

  it('takes a longer note’s time from the plain rests after it', () => {
    expect(bars(setFret(clipOf('\\ts (4 4)\n5.1.4 r.8 r.8 r.2 |'), at(1), 7, { value: 4, dots: 1 }))).toBe('5.1.4 7.1.4{d} r.4{d} |');
  });

  it('runs over the bar when the rests after it are too short', () => {
    expect(bars(setFret(clipOf('\\ts (4 4)\n5.1.2 r.4 7.1.4 |'), at(1), 7, { value: 2, dots: 0 }))).toBe('5.1.2 7.1.2 7.1.4 |');
  });

  it('leaves a column with notes its length, and with none given a rest still takes the last note’s', () => {
    expect(bars(setFret(clipOf('\\ts (4 4)\n5.1.4 r.2{d} |'), { bar: 0, column: 0, string: 1 }, 7, { value: 16, dots: 0 }))).toBe('(5.1 7.2).4 r.2{d} |');
    expect(bars(setFret(clipOf('\\ts (4 4)\n5.1.4 r.2{d} |'), at(1), 7))).toBe('5.1.4 7.1.4 r.2 |');
  });
});
