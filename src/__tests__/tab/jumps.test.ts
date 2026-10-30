import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { partOf, type Part } from '@/features/tab/clip';
import { jumpCursor, jumpFocus, jumpForKey } from '@/features/tab/jumps';

function clipOf(text: string): Part {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return partOf(result.clip);
}

// Three bars of two halves each: places 0 1 | 2 3 | 4 5.
const clip = clipOf(':2 5.1 7.1 | 8.1 9.1 | 3.2 5.2 |');
/** The same clip with its middle bar emptied, so places 0 1 | | 2 3. */
const holed: Part = { ...clip, bars: clip.bars.map((bar, b) => (b === 1 ? { ...bar, columns: [] } : bar)) };
const at = (bar: number, column: number) => ({ bar, column, string: 2 });

describe('jumpCursor', () => {
  it('goes back to the start of its bar, then to the start of the bar before', () => {
    expect(jumpCursor(clip, at(1, 1), 'barBack')).toEqual(at(1, 0));
    expect(jumpCursor(clip, at(1, 0), 'barBack')).toEqual(at(0, 0));
    expect(jumpCursor(clip, at(0, 0), 'barBack')).toEqual(at(0, 0));
  });
  it('goes on to the start of the next bar, and stays in the last', () => {
    expect(jumpCursor(clip, at(0, 1), 'barOn')).toEqual(at(1, 0));
    expect(jumpCursor(clip, at(2, 0), 'barOn')).toEqual(at(2, 0));
  });
  it('stops in an empty bar, as ← → do', () => {
    expect(jumpCursor(holed, at(0, 0), 'barOn')).toEqual(at(1, 0));
  });
  it('goes to the clip’s first and last columns, keeping the string', () => {
    expect(jumpCursor(clip, at(1, 1), 'clipStart')).toEqual(at(0, 0));
    expect(jumpCursor(clip, at(0, 0), 'clipEnd')).toEqual(at(2, 1));
  });
});

describe('jumpFocus', () => {
  const lines: [number, number][] = [[0, 3], [4, 5]];
  it('grows to the end of its bar, then to the end of the next', () => {
    expect(jumpFocus(clip, 0, 'barOn', lines)).toBe(1);
    expect(jumpFocus(clip, 1, 'barOn', lines)).toBe(3);
    expect(jumpFocus(clip, 5, 'barOn', lines)).toBe(5);
  });
  it('grows back to the start of its bar, then to the start of the one before', () => {
    expect(jumpFocus(clip, 5, 'barBack', lines)).toBe(4);
    expect(jumpFocus(clip, 4, 'barBack', lines)).toBe(2);
    expect(jumpFocus(clip, 0, 'barBack', lines)).toBe(0);
  });
  it('steps over an empty bar', () => {
    expect(jumpFocus(holed, 1, 'barOn', [])).toBe(3);
    expect(jumpFocus(holed, 2, 'barBack', [])).toBe(0);
  });
  it('grows to the ends of the focus’s line', () => {
    expect(jumpFocus(clip, 2, 'lineStart', lines)).toBe(0);
    expect(jumpFocus(clip, 2, 'lineEnd', lines)).toBe(3);
    expect(jumpFocus(clip, 4, 'lineEnd', lines)).toBe(5);
  });
  it('grows to the clip’s ends', () => {
    expect(jumpFocus(clip, 3, 'clipStart', lines)).toBe(0);
    expect(jumpFocus(clip, 3, 'clipEnd', lines)).toBe(5);
  });
});

describe('jumpForKey', () => {
  it('reads Ctrl/⌘ with the arrows, Home and End, and Shift with Home and End', () => {
    expect(jumpForKey('ArrowLeft', true, false)).toBe('barBack');
    expect(jumpForKey('ArrowRight', true, true)).toBe('barOn');
    expect(jumpForKey('Home', true, true)).toBe('clipStart');
    expect(jumpForKey('End', true, false)).toBe('clipEnd');
    expect(jumpForKey('Home', false, true)).toBe('lineStart');
    expect(jumpForKey('End', false, true)).toBe('lineEnd');
    // Plain arrows, Shift+arrows and plain Home / End are not jumps.
    expect(jumpForKey('ArrowLeft', false, true)).toBeNull();
    expect(jumpForKey('Home', false, false)).toBeNull();
  });
});
