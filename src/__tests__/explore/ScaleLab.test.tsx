import { fireEvent, render, screen } from '@testing-library/react';
import ScaleLab from '@/features/explore/scales/ScaleLab';
import { SCALE_LAB_STORAGE_KEY } from '@/features/explore/scales/settings';

const formula = () => screen.getByTestId('scale-formula');
const scaleImgs = (name: string) => screen.getAllByRole('img', { name });
const saved = () => JSON.parse(localStorage.getItem(SCALE_LAB_STORAGE_KEY) ?? '{}');
const chordCard = (symbol: string) =>
  screen.getByRole('button', { name: new RegExp(`, ${symbol},`) });

describe('ScaleLab', () => {
  beforeEach(() => localStorage.clear());

  it('opens on A Dorian with its formula, strip and sevenths', () => {
    render(<ScaleLab />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('A Dorian');
    expect(screen.getByRole('combobox', { name: 'Root' })).toHaveValue('A');
    // The formula follows the title, in parentheses.
    expect(formula()).toHaveTextContent('(1 2 ♭3 4 5 6 ♭7)');
    // The one-octave strip under the title.
    const strip = scaleImgs('A Dorian: 1 A, 2 B, ♭3 C, 4 D, 5 E, 6 F♯, ♭7 G')
      .find(el => el.classList.contains('scale-strip'));
    expect(strip).toBeDefined();
    expect(screen.getAllByRole('button', { name: /^\S+7, / })).toHaveLength(7);
  });

  it('changes root and scale, and saves them', () => {
    render(<ScaleLab />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Root' }), { target: { value: 'Eb' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Scale' }), {
      target: { value: 'harmonic-minor' },
    });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('E♭ harmonic minor');
    expect(formula()).toHaveTextContent('1 2 ♭3 4 5 ♭6 7');
    expect(scaleImgs('E♭ harmonic minor: 1 E♭, 2 F, ♭3 G♭, 4 A♭, 5 B♭, ♭6 C♭, 7 D'))
      .toHaveLength(2);
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
    // The formula stays the scale's.
    expect(formula()).toHaveTextContent('1 2 ♭3 4 5 6 ♭7');
    // Only D7's tones stay on the neck; B, E and G are gone.
    expect(dotLabels()).toEqual(new Set(['R', '3', '5', '♭7']));
    // The chord root takes the square: D on the low E string.
    expect(rootFrets()).toEqual(['10']);

    fireEvent.click(chordCard('D7'));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^A Dorian \(/);
    expect(dotLabels()).toEqual(new Set(['R', '2', '♭3', '4', '5', '6', '♭7']));
  });

  it('clears the chord when the scale changes', () => {
    render(<ScaleLab />);
    fireEvent.click(chordCard('D7'));
    fireEvent.change(screen.getByRole('combobox', { name: 'Root' }), { target: { value: 'C' } });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^C Dorian \(/);
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

  it('draws the selected chord as a ladder or a clock, and saves the choice', () => {
    render(<ScaleLab />);
    expect(screen.queryByRole('img', { name: /D7/ })).toBeNull();
    fireEvent.click(chordCard('D7'));
    // The ladder, naming each tone from the root.
    const ladder = screen.getByRole('img', {
      name: 'D7 from its root D: major 3rd up to F♯, perfect 5th up to A, minor 7th up to C',
    });
    expect(ladder).toHaveClass('chord-ladder');
    const tones = screen.getAllByTestId('ladder-tone');
    expect(tones.map(t => t.querySelector('text')?.textContent)).toEqual(['D', 'F♯', 'A', 'C']);
    expect(ladder).toHaveTextContent(/M3.*P5.*m7/);

    fireEvent.click(screen.getByRole('button', { name: 'Between tones' }));
    expect(screen.getByRole('img', {
      name: 'D7 in thirds from D: major 3rd up to F♯, then minor 3rd up to A, then minor 3rd up to C',
    })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clock' }));
    const clock = screen.getByRole('img', { name: /^D7 in thirds/ });
    expect(clock).toHaveClass('chord-clock');
    // Only the chord's tones are named on the clock.
    expect(screen.getAllByTestId('clock-tone')).toHaveLength(4);
    expect(saved()).toMatchObject({ chordView: 'clock', chordIntervals: 'between' });

    fireEvent.click(chordCard('D7'));
    expect(screen.queryByRole('img', { name: /D7/ })).toBeNull();
  });

  it('draws the scale alone before a chord is picked', () => {
    render(<ScaleLab />);
    expect(scaleImgs('A Dorian: 1 A, 2 B, ♭3 C, 4 D, 5 E, 6 F♯, ♭7 G')
      .some(el => el.classList.contains('chord-ladder'))).toBe(true);
    // Nothing to annotate yet.
    expect(screen.queryByRole('group', { name: 'Intervals' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Clock' }));
    expect(screen.getAllByTestId('clock-tone')).toHaveLength(7);
  });

  it('steps through the chords with the arrow keys once one is picked', () => {
    render(<ScaleLab />);
    const title = () => screen.getByRole('heading', { level: 1 });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(title()).toHaveTextContent(/^A Dorian \(/);

    fireEvent.click(chordCard('D7'));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(title()).toHaveTextContent('Em7 in A Dorian');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(title()).toHaveTextContent('Cmaj7 in A Dorian');

    // The ends wrap round.
    fireEvent.click(chordCard('Gmaj7'));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(title()).toHaveTextContent('Am7 in A Dorian');

    // The scale list keeps its own arrows.
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Scale' }), { key: 'ArrowRight' });
    expect(title()).toHaveTextContent('Am7 in A Dorian');
  });

  it('explains why a pentatonic has no chords', () => {
    localStorage.setItem(SCALE_LAB_STORAGE_KEY, JSON.stringify({ scale: 'minor-pentatonic' }));
    render(<ScaleLab />);
    expect(screen.getByText(/only seven-note scales have them/)).toBeInTheDocument();
  });
});
