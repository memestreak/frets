import { fireEvent, render, screen } from '@testing-library/react';
import { Fretboard } from '@/components/fretboard/Fretboard';
import { BOARD_RADIUS, fretboardGeometry, OPENW } from '@/lib/fretboardGeometry';

const band = (from: number, to: number) => ({ from, to, color: 'green' });

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

  it('clips the fretted range band to the fingerboard', () => {
    render(<Fretboard minFret={0} maxFret={12} dots={[]} band={band(3, 7)} />);
    const g = fretboardGeometry(0, 12);
    const rect = screen.getByTestId('range-band');
    expect(rect).toHaveAttribute('clip-path', expect.stringMatching(/^url\(#.+\)$/));
    expect(rect).toHaveAttribute('x', String(g.cellX(3)));
    expect(rect).toHaveAttribute('y', String(g.fillY));
    expect(rect).toHaveAttribute('height', String(g.fillH));
    expect(screen.queryByTestId('range-band-open')).not.toBeInTheDocument();
  });

  it('adds an open-string segment when the range includes fret 0', () => {
    render(<Fretboard minFret={0} maxFret={12} dots={[]} band={band(0, 3)} />);
    const g = fretboardGeometry(0, 12);
    const open = screen.getByTestId('range-band-open');
    expect(open).toHaveAttribute('x', String(g.cellX(0)));
    expect(open).toHaveAttribute('width', String(OPENW));
    expect(open).not.toHaveAttribute('clip-path');
    // The fretted part starts at fret 1, not at the open column.
    expect(screen.getByTestId('range-band')).toHaveAttribute('x', String(g.cellX(1)));
  });

  it('shows only the open segment for a 0–0 range', () => {
    render(<Fretboard minFret={0} maxFret={12} dots={[]} band={band(0, 0)} />);
    expect(screen.getByTestId('range-band-open')).toBeInTheDocument();
    expect(screen.queryByTestId('range-band')).not.toBeInTheDocument();
  });

  it('dims cells and stops them accepting taps', () => {
    const onCellClick = vi.fn();
    render(
      <Fretboard
        minFret={0} maxFret={5} dots={[]} onCellClick={onCellClick}
        isCellDimmed={p => p.f === 0 || p.f > 2}
      />,
    );
    expect(screen.getByTestId('dim-0-3')).toBeInTheDocument();
    expect(screen.queryByTestId('dim-0-2')).not.toBeInTheDocument();
    // The open column has no fingerboard under it to dim.
    expect(screen.queryByTestId('dim-0-0')).not.toBeInTheDocument();

    for (const id of ['cell-0-3', 'cell-0-0']) {
      const cell = screen.getByTestId(id);
      expect(cell).toHaveAttribute('aria-disabled', 'true');
      fireEvent.click(cell);
      fireEvent.keyDown(cell, { key: 'Enter' });
    }
    expect(onCellClick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('cell-0-2'));
    expect(onCellClick).toHaveBeenCalledWith({ s: 0, f: 2 });
  });

  it('keeps the dimming when the board is not tappable', () => {
    render(
      <Fretboard minFret={0} maxFret={5} dots={[]} isCellDimmed={p => p.f > 2} />,
    );
    expect(screen.getByTestId('dim-5-4')).toBeInTheDocument();
    expect(screen.queryByTestId('cell-5-4')).not.toBeInTheDocument();
  });
});
