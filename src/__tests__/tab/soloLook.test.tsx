/**
 * What Guitar Solo 1 of a book's tab needs (docs/specs/2026-10-28-tab-sweet-child-solo-design.md): a bend
 * held over tied notes is named on the tab, under a staff, only where a bar starts, and a let-down note
 * is named when a pull-off leaves from it.
 */
import { render } from '@testing-library/react';
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { legatoStarts, type Clip } from '@/features/tab/clip';
import { TabClip } from '@/features/tab/TabClip';

function clipOf(text: string): Clip {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.clip;
}

const numbers = (text: string, parts: 'tab' | 'both') => {
  const { container } = render(<TabClip clip={clipOf(text)} width={1600} parts={parts} title="Solo" />);
  return [...container.querySelectorAll('[data-testid="tab-column"] text')].map(t => t.textContent).filter(n => /\d/.test(n ?? ''));
};

describe('a held bend under a staff', () => {
  const HELD = '10.1.8 10.1{b (0 4)}.8 -.1{b (4 4)}.4 -.1{b (4 0)}.8 9.3{b (0 4)}.8 r.4 |\n-.3{b (4 4)}.1 |';

  it('names its tied note only where a bar starts', () => {
    expect(numbers(HELD, 'both')).toEqual(['10', '10', '9', '(9)']);
  });

  it('names every tied note on the tab alone', () => {
    expect(numbers(HELD, 'tab')).toEqual(['10', '10', '(10)', '9', '(9)']);
  });
});

describe('a let-down bend', () => {
  const PULLED = '10.2{b (0 4)}.8 -.2{b (4 0) h}.8 8.2.8 r.8 r.2 |';

  it('is named when a pull-off leaves from it, and its arrow comes down to the number', () => {
    expect(numbers(PULLED, 'both')).toEqual(['10', '(10)', '8']);
    const clip = clipOf(PULLED);
    expect(legatoStarts(clip).has(clip.bars[0].columns[1].notes[1]!)).toBe(true);
  });

  it('is not named otherwise', () => {
    expect(numbers('10.2{b (0 4)}.8 -.2{b (4 0)}.8 8.2.8 r.8 r.2 |', 'both')).toEqual(['10', '8']);
  });
});
