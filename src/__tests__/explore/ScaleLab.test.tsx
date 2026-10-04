import { fireEvent, render, screen } from '@testing-library/react';
import ScaleLab from '@/features/explore/scales/ScaleLab';
import { SCALE_LAB_STORAGE_KEY } from '@/features/explore/scales/settings';

const fact = (name: string) =>
  screen.queryAllByText(name).find(el => el.tagName === 'DT')?.nextElementSibling;
const saved = () => JSON.parse(localStorage.getItem(SCALE_LAB_STORAGE_KEY) ?? '{}');
const chordCard = (symbol: string) =>
  screen.getByRole('button', { name: new RegExp(`, ${symbol},`) });

describe('ScaleLab', () => {
  beforeEach(() => localStorage.clear());

  it('opens on A Dorian with its facts and sevenths', () => {
    render(<ScaleLab />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('A Dorian');
    expect(fact('Notes')).toHaveTextContent('A B C D E F♯ G');
    expect(fact('Formula')).toHaveTextContent('1 2 ♭3 4 5 6 ♭7');
    expect(fact('Steps')).toHaveTextContent('W H W W W H W');
    expect(screen.getAllByRole('button', { name: /^\S+7, / })).toHaveLength(7);
  });

  it('changes root and scale, and saves them', () => {
    render(<ScaleLab />);
    fireEvent.click(screen.getByRole('button', { name: 'E♭' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Scale' }), {
      target: { value: 'harmonic-minor' },
    });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('E♭ harmonic minor');
    expect(fact('Notes')).toHaveTextContent('E♭ F G♭ A♭ B♭ C♭ D');
    expect(saved()).toMatchObject({ root: 'Eb', scale: 'harmonic-minor' });
  });

  it('shows a tapped chord over the scale and clears it on a second tap', () => {
    render(<ScaleLab />);
    const dotLabels = () =>
      new Set(screen.getAllByTestId(/^dot-/).map(d => d.textContent));
    const rootFrets = () =>
      screen.getAllByTestId('dot-root').filter(d => d.dataset.s === '0').map(d => d.dataset.f);
    expect(rootFrets()).toEqual(['5']);
    fireEvent.click(chordCard('D7'));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('D7 in A Dorian');
    expect(fact('Notes')).toHaveTextContent('D F♯ A C');
    expect(fact('Formula')).toHaveTextContent('1 3 5 ♭7');
    expect(fact('Steps')).toBeUndefined();
    // Only D7's tones stay on the neck; B, E and G are gone.
    expect(dotLabels()).toEqual(new Set(['R', '3', '5', '♭7']));
    // The chord root takes the square: D on the low E string.
    expect(rootFrets()).toEqual(['10']);

    fireEvent.click(chordCard('D7'));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^A Dorian$/);
    expect(dotLabels()).toEqual(new Set(['R', '2', '♭3', '4', '5', '6', '♭7']));
  });

  it('clears the chord when the scale changes', () => {
    render(<ScaleLab />);
    fireEvent.click(chordCard('D7'));
    fireEvent.click(screen.getByRole('button', { name: 'C' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^C Dorian$/);
  });

  it('switches to triads and dot labels', () => {
    render(<ScaleLab />);
    fireEvent.click(screen.getByRole('button', { name: 'Triads' }));
    expect(chordCard('Am')).toHaveTextContent('i');
    fireEvent.click(screen.getByRole('button', { name: 'Note' }));
    const root = screen.getAllByTestId('dot-root')[0];
    expect(root).toHaveTextContent('A');
    expect(saved()).toMatchObject({ chordSize: 3, labels: 'note' });
  });

  it('explains why a pentatonic has no chords', () => {
    localStorage.setItem(SCALE_LAB_STORAGE_KEY, JSON.stringify({ scale: 'minor-pentatonic' }));
    render(<ScaleLab />);
    expect(screen.getByText(/only seven-note scales have them/)).toBeInTheDocument();
  });
});
