import { fireEvent, render, screen, within } from '@testing-library/react';
import ChordLibrary from '@/features/chords/library/ChordLibrary';
import { CHORD_LIBRARY_STORAGE_KEY } from '@/features/chords/library/settings';

const heading = () => screen.getByRole('heading', { level: 1 });
const saved = () => JSON.parse(localStorage.getItem(CHORD_LIBRARY_STORAGE_KEY) ?? '{}');
const group = (name: 'Open' | 'Moveable') => screen.getByRole('region', { name: `${name} shapes` });
const shapes = (name: 'Open' | 'Moveable') => within(group(name)).queryAllByRole('button');
const caption = () => screen.getByTestId('shape-caption');
/** The board's dots as "string:fret" pairs, low E first. */
const boardDots = () =>
  screen.getAllByTestId(/^dot-/).map(d => `${d.dataset.s}:${d.dataset.f}`).sort();

describe('ChordLibrary', () => {
  beforeEach(() => localStorage.clear());

  it('opens on Am7 with its formula, notes and first open shape on the neck', () => {
    render(<ChordLibrary />);
    expect(heading()).toHaveTextContent('Am7');
    expect(screen.getByTestId('chord-formula')).toHaveTextContent('(1 ♭3 5 ♭7)');
    expect(screen.getByTestId('chord-notes')).toHaveTextContent('A C E G');
    expect(caption()).toHaveTextContent('Open 1 of 3 · root on A · frets 1–2');
    // x-0-2-0-1-0: only the chosen shape is on the neck.
    expect(boardDots()).toEqual(['1:0', '2:2', '3:0', '4:1', '5:0']);
    expect(shapes('Open')[0]).toHaveAttribute('aria-pressed', 'true');
  });

  it('changes the chord from the dropdowns and saves it', () => {
    render(<ChordLibrary />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Root' }), { target: { value: 'C' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Type' }), { target: { value: 'M' } });
    expect(heading()).toHaveTextContent(/^C \(/);
    expect(screen.getByTestId('chord-notes')).toHaveTextContent('C E G');
    expect(saved()).toEqual({ root: 'C', type: 'M' });
    expect(shapes('Open')[0]).toHaveAttribute('data-voicing', 'x-3-2-0-1-0');
  });

  it('puts a tapped shape on the neck', () => {
    render(<ChordLibrary />);
    const barre = within(group('Moveable')).getByRole('button', { name: /root on E · frets 5–7/ });
    fireEvent.click(barre);
    expect(barre).toHaveAttribute('aria-pressed', 'true');
    expect(boardDots()).toEqual(['0:5', '1:7', '2:5', '3:5', '4:5', '5:5']);
    expect(caption()).toHaveTextContent(/^Moveable \d+ of \d+ · root on E · frets 5–7$/);
  });

  it('steps through the open shapes, then the moveable ones', () => {
    render(<ChordLibrary />);
    const prev = screen.getByRole('button', { name: 'Previous shape' });
    const next = screen.getByRole('button', { name: 'Next shape' });
    expect(prev).toBeDisabled();
    fireEvent.click(next);
    expect(caption()).toHaveTextContent(/^Open 2 of 3/);
    fireEvent.click(next);
    fireEvent.click(next);
    expect(caption()).toHaveTextContent(/^Moveable 1 of /);
    expect(shapes('Moveable')[0]).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows every moveable shape on request, and the best few again', () => {
    render(<ChordLibrary />);
    const few = shapes('Moveable').length;
    fireEvent.click(screen.getByRole('button', { name: /^Show all \d+ shapes$/ }));
    expect(shapes('Moveable').length).toBeGreaterThan(few);
    fireEvent.click(screen.getByRole('button', { name: 'Show the best few' }));
    expect(shapes('Moveable')).toHaveLength(few);
  });

  it('says so when a chord has no open shape', () => {
    localStorage.setItem(CHORD_LIBRARY_STORAGE_KEY, JSON.stringify({ root: 'C', type: 'm6' }));
    render(<ChordLibrary />);
    expect(within(group('Open')).getByText('No open shape for Cm6.')).toBeInTheDocument();
    expect(caption()).toHaveTextContent(/^Moveable 1 of /);
  });
});
