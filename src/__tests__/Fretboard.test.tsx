import { render, screen } from '@testing-library/react';
import { Fretboard } from '@/components/fretboard/Fretboard';
import { BOARD_RADIUS, fretboardGeometry } from '@/lib/fretboardGeometry';

describe('Fretboard', () => {
  it('draws the fingerboard as a rounded fill', () => {
    render(<Fretboard minFret={0} maxFret={12} dots={[]} />);
    const g = fretboardGeometry(0, 12);
    const fill = screen.getByTestId('board-fill');
    expect(fill).toHaveAttribute('x', String(g.fillX));
    expect(fill).toHaveAttribute('y', String(g.fillY));
    expect(fill).toHaveAttribute('width', String(g.fillW));
    expect(fill).toHaveAttribute('height', String(g.fillH));
    expect(fill).toHaveAttribute('rx', String(BOARD_RADIUS));
  });
});
