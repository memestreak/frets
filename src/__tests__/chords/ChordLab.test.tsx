import { fireEvent, render, screen, within } from '@testing-library/react';
import ChordLab from '@/features/chords/lab/ChordLab';

const heading = () => screen.getByRole('heading', { level: 1 });
const cell = (s: number, f: number) => screen.getByTestId(`cell-${s}-${f}`);
/** The board's dots as "string:fret" pairs, low E first. */
const boardDots = () =>
  screen.queryAllByTestId(/^dot-/).map(d => `${d.dataset.s}:${d.dataset.f}`).sort();
const names = () => within(screen.getByRole('region', { name: 'Name it' })).queryAllByRole('button');
const chip = (label: string) =>
  within(screen.getByRole('group', { name: 'Chord tones' })).getByRole('button', { name: label });

describe('ChordLab', () => {
  it('opens on an open C, named', () => {
    render(<ChordLab />);
    expect(heading()).toHaveTextContent(/^C \(1 3 5\)$/);
    expect(boardDots()).toEqual(['1:3', '2:2', '3:0', '4:1', '5:0']);
    expect(names()[0]).toHaveTextContent('C');
    expect(names()[0]).toHaveAttribute('aria-pressed', 'true');
    expect(chip('3')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('♭7')).toHaveAttribute('aria-pressed', 'false');
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

  it('puts a shape for the new chord on the neck when a tone chip is toggled', () => {
    render(<ChordLab />);
    fireEvent.click(chip('♭7'));
    expect(heading()).toHaveTextContent(/^C7/);
    expect(chip('♭7')).toHaveAttribute('aria-pressed', 'true');
  });

  it('says so when a chip leaves too few tones', () => {
    render(<ChordLab />);
    fireEvent.click(chip('3'));
    fireEvent.click(chip('5'));
    expect(screen.getByRole('status')).toHaveTextContent('A chord needs two or more tones.');
  });

  it('clears the neck', () => {
    render(<ChordLab />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(boardDots()).toEqual([]);
    expect(heading()).toHaveTextContent('Tap the neck');
    expect(screen.getByText('Tap two or more notes to name them.')).toBeInTheDocument();
  });

  it('puts a tapped shape on the neck', () => {
    render(<ChordLab />);
    const moveable = within(screen.getByRole('region', { name: 'Moveable shapes' })).getAllByRole('button');
    fireEvent.click(moveable[0]);
    expect(moveable[0]).toHaveAttribute('aria-pressed', 'true');
    expect(heading()).toHaveTextContent(/^C /);
  });
});
