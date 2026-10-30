import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { writeBars } from '@/features/tab/alphatex';
import { partOf, type Part } from '@/features/tab/clip';
import { digitOfCode, nextInChord, pitchAt, selectedNotes, stepFrets, valueForDigit } from '@/features/tab/normalMode';

function clipOf(text: string): Part {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return partOf(result.clip);
}
const bars = (clip: Part) => writeBars(clip).join('\n');

describe('valueForDigit and digitOfCode', () => {
  it('read MuseScore’s length keys, 5 a quarter, and nothing past a whole', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(valueForDigit)).toEqual([64, 32, 16, 8, 4, 2, 1]);
    expect(valueForDigit(8)).toBeNull();
    expect(valueForDigit(0)).toBeNull();
  });
  it('read the digit from where the key is, whatever Shift made it type', () => {
    expect(digitOfCode('Digit5')).toBe(5);
    expect(digitOfCode('Numpad3')).toBe(3);
    expect(digitOfCode('KeyA')).toBeNull();
  });
});

describe('stepFrets', () => {
  const clip = clipOf('(0.1 5.2).4 3.3.4 |');
  it('raises or lowers each note a fret on its own string, keeping the others', () => {
    expect(bars(stepFrets(clip, [{ bar: 0, column: 0, string: 1 }], 1))).toBe('(0.1 6.2).4 3.3.4 |');
    expect(bars(stepFrets(clip, selectedNotes(clip, { bar: 0, column: 0, string: 0 }, { anchor: 0, focus: 1 }), 1))).toBe('(1.1 6.2).4 4.3.4 |');
  });
  it('moves nothing when any note would go under the open string', () => {
    expect(stepFrets(clip, selectedNotes(clip, { bar: 0, column: 0, string: 0 }, { anchor: 0, focus: 1 }), -1)).toBe(clip);
  });
});

describe('nextInChord', () => {
  // The high e's 5 (A), the B's 7 (F♯) and the G's 2 (A, an octave under).
  const clip = clipOf('(5.1 7.2 2.3).4 |');
  const at = { bar: 0, column: 0, string: 1 };
  it('steps up and down the chord by pitch', () => {
    expect(nextInChord(clip, at, pitchAt(clip, at), true)).toBe(0);
    expect(nextInChord(clip, at, pitchAt(clip, at), false)).toBe(2);
    expect(nextInChord(clip, { ...at, string: 0 }, pitchAt(clip, { ...at, string: 0 }), true)).toBeNull();
  });
  it('from the column alone, goes to its top or bottom note', () => {
    expect(nextInChord(clip, at, null, true)).toBe(0);
    expect(nextInChord(clip, at, null, false)).toBe(2);
  });
});
