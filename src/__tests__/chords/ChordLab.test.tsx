import { fireEvent, render, screen, within } from '@testing-library/react';
import ChordLab from '@/features/chords/lab/ChordLab';

const heading = () => screen.getByRole('heading', { level: 1 });
const cell = (s: number, f: number) => screen.getByTestId(`cell-${s}-${f}`);
/** The board's dots as "string:fret" pairs, low E first. */
const boardDots = () =>
  screen.queryAllByTestId(/^dot-/).map(d => `${d.dataset.s}:${d.dataset.f}`).sort();
const names = () => within(screen.getByRole('region', { name: 'Name it' })).queryAllByRole('button');
const arpeggio = () => screen.getByRole('button', { name: 'Arpeggio' });
/** The board's dot at a string and fret. */
const dotAt = (s: number, f: number) =>
  screen.queryAllByTestId(/^dot-/).find(d => d.dataset.s === `${s}` && d.dataset.f === `${f}`)!;
const OPEN_C = ['1:3', '2:2', '3:0', '4:1', '5:0'];

describe('ChordLab', () => {
  it('opens on an open C, named', () => {
    render(<ChordLab />);
    expect(heading()).toHaveTextContent(/^C \(1 3 5\)$/);
    expect(boardDots()).toEqual(OPEN_C);
    expect(names()[0]).toHaveTextContent('C');
    expect(names()[0]).toHaveAttribute('aria-pressed', 'true');
    expect(arpeggio()).toHaveAttribute('aria-pressed', 'false');
  });

  it('names the notes after a tap, and mutes a string tapped again', () => {
    render(<ChordLab />);
    fireEvent.click(cell(5, 0)); // mutes the high E, which plays open
    expect(boardDots()).not.toContain('5:0');
    fireEvent.click(cell(4, 3)); // B string, fret 3: a D
    expect(heading()).toHaveTextContent(/^Cadd9/);
  });

  it('relabels against the root of the name picked', () => {
    render(<ChordLab />);
    fireEvent.click(cell(5, 0));
    fireEvent.click(cell(5, 5)); // x-3-2-0-1-5: C E G C A
    expect(heading()).toHaveTextContent(/^C6 /);
    const am7 = names().find(n => n.textContent?.startsWith('Am7/C'))!;
    fireEvent.click(am7);
    expect(heading()).toHaveTextContent(/^Am7\/C /);
    expect(screen.getByTestId('chord-notes')).toHaveTextContent('A C E G');
  });

  it('clears the neck', () => {
    render(<ChordLab />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(boardDots()).toEqual([]);
    expect(heading()).toHaveTextContent('Tap the neck');
    expect(screen.getByText('Tap two or more notes to name them.')).toBeInTheDocument();
    expect(arpeggio()).toBeDisabled();
  });

  it('puts a tapped shape on the neck', () => {
    render(<ChordLab />);
    const moveable = within(screen.getByRole('region', { name: 'Moveable shapes' })).getAllByRole('button');
    fireEvent.click(moveable[0]);
    expect(moveable[0]).toHaveAttribute('aria-pressed', 'true');
    expect(heading()).toHaveTextContent(/^C /);
  });

  it('swaps the shape for the arpeggio and back, with the button or space', () => {
    render(<ChordLab />);
    fireEvent.click(arpeggio());
    expect(arpeggio()).toHaveAttribute('aria-pressed', 'true');
    // Every C, E and G up to fret 15, such as the open low E and its 3rd fret G.
    expect(boardDots()).toEqual(expect.arrayContaining(['0:0', '0:3', '5:15']));
    expect(screen.getByTestId('neck-caption')).toHaveTextContent('Arpeggio · every C, E and G up to fret 15');
    fireEvent.keyDown(window, { key: ' ' });
    expect(arpeggio()).toHaveAttribute('aria-pressed', 'false');
    expect(boardDots()).toEqual(OPEN_C);
    fireEvent.keyDown(window, { key: ' ' });
    fireEvent.keyDown(window, { key: ' ', repeat: true }); // held down
    expect(arpeggio()).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps the arpeggio on for another name, and relabels it', () => {
    render(<ChordLab />);
    fireEvent.click(cell(5, 0));
    fireEvent.click(cell(5, 5)); // C6, or Am7/C
    fireEvent.click(arpeggio());
    fireEvent.click(names().find(n => n.textContent?.startsWith('Am7/C'))!);
    expect(arpeggio()).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('neck-caption')).toHaveTextContent('every A, C, E and G');
  });

  it('keeps the arpeggio on when a note is played, labelling only the notes played', () => {
    render(<ChordLab />);
    fireEvent.click(arpeggio());
    fireEvent.click(cell(4, 3)); // B string, fret 3: Cadd9
    expect(arpeggio()).toHaveAttribute('aria-pressed', 'true');
    expect(heading()).toHaveTextContent(/^Cadd9/);
    expect(dotAt(4, 3)).toHaveTextContent('9');
    expect(dotAt(0, 0).textContent).toBe(''); // the open low E isn't played
  });

  it('toggles the arpeggio with space on a focused fret, without tapping it', () => {
    render(<ChordLab />);
    cell(4, 3).focus();
    fireEvent.keyDown(cell(4, 3), { key: ' ' });
    fireEvent.keyUp(cell(4, 3), { key: ' ' });
    expect(arpeggio()).toHaveAttribute('aria-pressed', 'true');
    expect(heading()).toHaveTextContent(/^C /);
    expect(cell(4, 3)).not.toHaveFocus(); // no focus ring left on it
  });

  it('turns the arpeggio off when a shape is chosen or the neck cleared', () => {
    render(<ChordLab />);
    fireEvent.click(arpeggio());
    const moveable = within(screen.getByRole('region', { name: 'Moveable shapes' })).getAllByRole('button');
    fireEvent.click(moveable[0]);
    expect(arpeggio()).toHaveAttribute('aria-pressed', 'false');
    expect(moveable[0]).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(arpeggio());
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(arpeggio()).toHaveAttribute('aria-pressed', 'false');
  });
});
