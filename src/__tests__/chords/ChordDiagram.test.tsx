import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChordDiagram } from '@/components/chords/ChordDiagram';
import { chordOf } from '@/lib/chords/chordTypes';

/** The text of every `<text>` in the diagram that is a number. */
function fretNumbers(container: HTMLElement): string[] {
  return [...container.querySelectorAll('text')]
    .map(t => t.textContent ?? '')
    .filter(t => /^\d+$/.test(t));
}

describe('ChordDiagram', () => {
  it('labels the starting fret when the shape starts at the nut', () => {
    const { container } = render(
      <ChordDiagram chord={chordOf('C', 'M')} voicing={[null, 3, 2, 0, 1, 0]} />,
    );
    expect(fretNumbers(container)).toEqual(['1']);
  });

  it('labels the starting fret above the nut', () => {
    const { container } = render(
      <ChordDiagram chord={chordOf('C', 'M')} voicing={[null, 3, 5, 5, 5, 3]} />,
    );
    expect(fretNumbers(container)).toEqual(['3']);
  });
});
