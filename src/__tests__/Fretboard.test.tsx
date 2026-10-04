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

  it('draws square dots as rounded squares and the rest as circles', () => {
    const dot = { fill: 'red', fg: 'white', label: 'R', fontSize: 12 };
    render(
      <Fretboard
        minFret={0} maxFret={5}
        dots={[
          { ...dot, s: 0, f: 3, kind: 'root', shape: 'square' },
          { ...dot, s: 1, f: 3, kind: 'target' },
        ]}
      />,
    );
    expect(screen.getByTestId('dot-root').querySelector('rect')).not.toBeNull();
    expect(screen.getByTestId('dot-target').querySelector('circle')).not.toBeNull();
  });

  it('draws a dot at its size when one is given', () => {
    const dot = { fill: 'grey', fg: 'white', label: '', fontSize: 0 };
    render(
      <Fretboard
        minFret={0} maxFret={5}
        dots={[{ ...dot, s: 0, f: 3, kind: 'small', size: 12 }]}
      />,
    );
    expect(screen.getByTestId('dot-small').querySelector('circle'))
      .toHaveAttribute('r', '6');
  });

  it('names a display-only board with its label', () => {
    render(<Fretboard minFret={0} maxFret={5} dots={[]} label="A Dorian on the fretboard" />);
    expect(screen.getByRole('img', { name: 'A Dorian on the fretboard' })).toBeInTheDocument();
  });
});
