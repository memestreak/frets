import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { writeBars } from '@/features/tab/alphatex';
import { emptyPart, partOf, type Part } from '@/features/tab/clip';
import { isEmpty, pasteOver, withRestsInEmptyBars, type Cursor } from '@/features/tab/editing';

function clipOf(text: string): Part {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return partOf(result.clip);
}
const bars = (clip: Part) => writeBars(clip).join('\n');
const at = (bar: number, column: number): Cursor => ({ bar, column, string: 0 });

// Issue #238, bars stay full: a paste writes over the time from the cursor on, as MuseScore's does.
describe('pasteOver', () => {
  const clip = clipOf('\\ts (4 4)\n1.1.4 2.1.4 3.1.4 4.1.4 | 5.1.4 6.1.4 7.1.4 8.1.4 |');

  it('writes over as much time as it takes, and the cursor ends on its last column', () => {
    const result = pasteOver(clip, at(0, 1), clipOf('9.2.4 10.2.4 |'));
    expect(bars(result.clip)).toBe('1.1.4 9.2.4 10.2.4 4.1.4 |\n5.1.4 6.1.4 7.1.4 8.1.4 |');
    expect(result.cursor).toEqual(at(0, 2));
  });

  it('flows on over the bar line', () => {
    const result = pasteOver(clip, at(0, 2), clipOf('9.2.4 10.2.4 | 11.2.4 |'));
    expect(bars(result.clip)).toBe('1.1.4 2.1.4 9.2.4 10.2.4 |\n11.2.4 6.1.4 7.1.4 8.1.4 |');
    expect(result.cursor).toEqual(at(1, 0));
  });

  it('leaves the rest of a note it covers in part as rests', () => {
    const result = pasteOver(clipOf('\\ts (4 4)\n1.1.2 2.1.2 |'), at(0, 0), clipOf('9.2.4 |'));
    expect(bars(result.clip)).toBe('9.2.4 r.4 2.1.2 |');
  });

  it('splits a note that would cross the bar line, tied over', () => {
    const result = pasteOver(clip, at(0, 3), clipOf('9.2.2 |'));
    expect(bars(result.clip)).toBe('1.1.4 2.1.4 3.1.4 9.2.4 |\n-.2.4 6.1.4 7.1.4 8.1.4 |');
    // The cursor goes to the start of the last Sounding note pasted, not its tied-on part.
    expect(result.cursor).toEqual(at(0, 3));
  });

  it('adds bars of rests past the end of the clip', () => {
    const result = pasteOver(clip, at(1, 3), clipOf('9.2.4 10.2.4 |'));
    expect(bars(result.clip)).toBe('1.1.4 2.1.4 3.1.4 4.1.4 |\n5.1.4 6.1.4 7.1.4 9.2.4 |\n10.2.4 r.4 r.2 |');
  });

  it('fills what a short bar lacks before going on', () => {
    const result = pasteOver(clipOf('\\ts (4 4)\n1.1.4 |'), at(0, 0), clipOf('9.2.2 10.2.2 |'));
    expect(bars(result.clip)).toBe('9.2.2 10.2.2 |');
  });

  it('into an empty clip comes whole, with its name and time', () => {
    const result = pasteOver(emptyPart(), at(0, 0), clipOf('\\title "Line"\n\\ts (3 4)\n5.3.2{d} |'));
    expect(result.clip.name).toBe('Line');
    expect(result.clip.time).toEqual({ beats: 3, value: 4 });
  });
});

// Issues #421, #422: a new arrangement's bar, empty or written out as its Whole-bar rest, is an empty clip.
describe('a paste into a new arrangement', () => {
  const restBar = withRestsInEmptyBars(emptyPart())!;

  it('counts a new arrangement with its bar written out as its rest as empty, but not a bar of rests in Voice 2 or two bars', () => {
    expect(isEmpty(emptyPart())).toBe(true);
    expect(isEmpty(restBar)).toBe(true);
    expect(bars(restBar)).toBe('r.1 |');
    expect(isEmpty({ ...restBar, voice: 1 })).toBe(false);
    expect(isEmpty({ ...restBar, bars: [...restBar.bars, ...restBar.bars] })).toBe(false);
    expect(withRestsInEmptyBars(restBar)).toBeNull();
  });

  it('takes whole bars whole, with the pasted time', () => {
    const result = pasteOver(restBar, at(0, 0), clipOf('\\ts (3 4)\n1.1.4 2.1.4 3.1.4 | 4.1.2{d} |'));
    expect(result.clip.time).toEqual({ beats: 3, value: 4 });
    expect(bars(result.clip)).toBe('1.1.4 2.1.4 3.1.4 |\n4.1.2{d} |');
  });

  it('writes a copy from inside a bar through the meter, so its bar is full', () => {
    for (const into of [emptyPart(), restBar]) {
      const result = pasteOver(into, at(0, 0), clipOf('\\ts (4 4)\n3.3.8 5.3.8 |'));
      expect(bars(result.clip)).toBe('3.3.8 5.3.8 r.4 r.2 |');
      expect(result.cursor).toEqual(at(0, 1));
    }
  });
});
