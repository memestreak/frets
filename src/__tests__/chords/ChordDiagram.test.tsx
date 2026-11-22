import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChordDiagram } from '@/components/chords/ChordDiagram';
import { toneAt } from '@/components/chords/chordDots';
import { chordOf } from '@/lib/theory/chords';

/** The text of every `<text>` in the diagram that is a number. */
function fretNumbers(container: HTMLElement): string[] {
  return [...container.querySelectorAll('text')]
    .map(t => t.textContent ?? '')
    .filter(t => /^\d+$/.test(t));
}

describe('ChordDiagram', () => {
  it('labels the starting fret when the shape starts at the nut', () => {
    const { container } = render(
      <ChordDiagram chord={chordOf('C', 'M')} shape={[null, 3, 2, 0, 1, 0]} />,
    );
    expect(fretNumbers(container)).toEqual(['1']);
  });

  it('labels the starting fret above the nut', () => {
    const { container } = render(
      <ChordDiagram chord={chordOf('C', 'M')} shape={[null, 3, 5, 5, 5, 3]} />,
    );
    expect(fretNumbers(container)).toEqual(['3']);
  });

  it('draws the fret number at 12 units, 19 under the board, and × at 18', () => {
    const { container } = render(
      <ChordDiagram chord={chordOf('C', 'M')} shape={[null, 3, 2, 0, 1, 0]} />,
    );
    const texts = [...container.querySelectorAll('text')];
    const number = texts.find(t => t.textContent === '1')!;
    const lowString = Math.max(...[...container.querySelectorAll('line')].map(l => Number(l.getAttribute('y1'))));
    expect(number.getAttribute('font-size')).toBe('12');
    expect(Number(number.getAttribute('y')) - lowString).toBe(19);
    expect(texts.find(t => t.textContent === '×')!.getAttribute('font-size')).toBe('18');
  });
});

describe('toneAt', () => {
  it('reads each string in the guitar’s tuning', () => {
    const d = chordOf('D', 'M');
    // Standard tuning's open low string is E, drop D's is D: the root.
    expect(toneAt(d, 1, 0).label).toBe('5');
    expect(toneAt(d, 0, 0, [38, 45, 50, 55, 59, 64]).label).toBe('R');
  });
});
