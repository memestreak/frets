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

  it('names a display-only board with its label', () => {
    render(<Fretboard minFret={0} maxFret={5} dots={[]} label="A Dorian on the fretboard" />);
    expect(screen.getByRole('img', { name: 'A Dorian on the fretboard' })).toBeInTheDocument();
  });

  it('fades a muted string and marks it with a × beside the nut', () => {
    render(<Fretboard minFret={0} maxFret={5} dots={[]} mutedStrings={[0, 1]} />);
    const g = fretboardGeometry(0, 5);
    const mark = screen.getByTestId('muted-1');
    expect(mark).toHaveTextContent('×');
    expect(mark).toHaveAttribute('x', String(g.cx(0)));
    expect(mark).toHaveAttribute('y', String(g.cy(1)));
    expect(screen.getByTestId('muted-0')).toBeInTheDocument();
    expect(screen.queryByTestId('muted-2')).not.toBeInTheDocument();
    expect(screen.getByTestId('string-1')).toHaveAttribute('opacity', '0.3');
    expect(screen.getByTestId('string-2')).toHaveAttribute('opacity', '1');
  });

  it('only fades a muted string when the board does not start at the nut', () => {
    render(<Fretboard minFret={3} maxFret={8} dots={[]} mutedStrings={[0]} />);
    expect(screen.queryByTestId('muted-0')).not.toBeInTheDocument();
    expect(screen.getByTestId('string-0')).toHaveAttribute('opacity', '0.3');
  });

  it('keeps every fret drawn but shades and disables the frets out of play', () => {
    const { container } = render(
      <Fretboard
        minFret={0} maxFret={15} dots={[]} onCellClick={() => {}}
        inPlay={{ from: 3, to: 8 }}
      />,
    );
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('viewBox', `0 0 ${fretboardGeometry(0, 15).width} ${fretboardGeometry(0, 15).height}`);
    expect(screen.getByTestId('board-shade').querySelectorAll('rect[clip-path]')).toHaveLength(2);
    expect(screen.getByTestId('cell-0-3')).toBeInTheDocument();
    expect(screen.getByTestId('cell-5-8')).toBeInTheDocument();
    expect(screen.queryByTestId('cell-0-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cell-0-9')).not.toBeInTheDocument();
  });

  it('shades nothing when every fret is in play', () => {
    render(<Fretboard minFret={0} maxFret={15} dots={[]} inPlay={{ from: 0, to: 15 }} />);
    expect(screen.queryByTestId('board-shade')).not.toBeInTheDocument();
  });

  it('joins each link\'s dots with a band, named above a board made taller for it', () => {
    const points = [{ s: 3, f: 9 }, { s: 4, f: 8 }, { s: 5, f: 8 }];
    render(<Fretboard minFret={0} maxFret={15} dots={[]} links={[{ points, label: '1st', opacity: 0.25 }]} />);
    const g = fretboardGeometry(0, 15, 20);
    const link = screen.getByTestId('link');
    expect(link).toHaveAttribute('opacity', '0.25');
    expect(link.querySelector('polyline')).toHaveAttribute(
      'points', points.map(p => `${g.cx(p.f)},${g.cy(p.s)}`).join(' '),
    );
    expect(link).toHaveTextContent('1st');
    expect(screen.getByTestId('board-fill')).toHaveAttribute('y', String(g.fillY));
  });

  it('keeps its height when no link is named', () => {
    render(<Fretboard minFret={0} maxFret={5} dots={[]} links={[{ points: [{ s: 0, f: 1 }, { s: 1, f: 2 }] }]} />);
    expect(screen.getByTestId('board-fill')).toHaveAttribute('y', String(fretboardGeometry(0, 5).fillY));
  });
});
