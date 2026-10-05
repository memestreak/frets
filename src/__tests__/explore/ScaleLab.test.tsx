import { fireEvent, render, screen, within } from '@testing-library/react';
import ScaleLab from '@/features/explore/scales/ScaleLab';
import { SCALE_LAB_STORAGE_KEY } from '@/features/explore/scales/settings';

const formula = () => screen.getByTestId('scale-formula');
const scaleImgs = (name: string) => screen.getAllByRole('img', { name });
const saved = () => JSON.parse(localStorage.getItem(SCALE_LAB_STORAGE_KEY) ?? '{}');
const board = () => screen.getByRole('img', { name: / on the fretboard$/ });
const chordCard = (symbol: string) =>
  screen.getByRole('button', { name: new RegExp(`, ${symbol},`) });

describe('ScaleLab', () => {
  beforeEach(() => localStorage.clear());

  it('opens on A Dorian with its formula, strip and sevenths', () => {
    render(<ScaleLab />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('A Dorian');
    expect(screen.getByRole('combobox', { name: 'Root' })).toHaveValue('A');
    // The formula sits under the title, outside the heading.
    expect(formula()).toHaveTextContent(/^1 2 ♭3 4 5 6 ♭7$/);
    expect(screen.getByRole('heading', { level: 1 })).not.toContainElement(formula());
    // The one-octave strip under the title.
    // Its notes are buttons, so it is a group.
    expect(screen.getByRole('group', { name: 'A Dorian: 1 A, 2 B, ♭3 C, 4 D, 5 E, 6 F♯, ♭7 G' }))
      .toHaveClass('scale-strip');
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
    const name = 'E♭ harmonic minor: 1 E♭, 2 F, ♭3 G♭, 4 A♭, 5 B♭, ♭6 C♭, 7 D';
    expect(screen.getByRole('group', { name })).toHaveClass('scale-strip');
    expect(scaleImgs(name)[0]).toHaveClass('chord-ladder');
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
    // The title and formula stay the scale's; the board names the chord.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^A Dorian$/);
    expect(board()).toHaveAccessibleName('D7 in A Dorian on the fretboard');
    expect(formula()).toHaveTextContent('1 2 ♭3 4 5 6 ♭7');
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
    fireEvent.change(screen.getByRole('combobox', { name: 'Root' }), { target: { value: 'C' } });
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
    expect(title()).toHaveTextContent(/^A Dorian$/);

    fireEvent.click(chordCard('D7'));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(board()).toHaveAccessibleName('Em7 in A Dorian on the fretboard');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(board()).toHaveAccessibleName('Cmaj7 in A Dorian on the fretboard');

    // The ends wrap round.
    fireEvent.click(chordCard('Gmaj7'));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(board()).toHaveAccessibleName('Am7 in A Dorian on the fretboard');

    // The scale list keeps its own arrows.
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Scale' }), { key: 'ArrowRight' });
    expect(board()).toHaveAccessibleName('Am7 in A Dorian on the fretboard');
  });

  it('rotates the mode along the picked scale', () => {
    localStorage.setItem(SCALE_LAB_STORAGE_KEY, JSON.stringify({ root: 'C', scale: 'ionian' }));
    render(<ScaleLab />);
    const title = () => screen.getByRole('heading', { level: 1 });
    const next = () => screen.getByRole('button', { name: /^Next mode/ });
    const prev = () => screen.getByRole('button', { name: /^Previous mode/ });
    const strip = () => document.querySelector<HTMLElement>('.scale-strip')!;
    const stripNames = () => within(strip()).getAllByTestId('ladder-note')
      .map(g => g.querySelector('text')!.textContent).join(' ');
    const square = () => within(strip()).getAllByTestId('ladder-note')
      .find(g => g.querySelector('rect')!.getAttribute('rx') === '3')!.textContent;

    expect(next()).toHaveAccessibleName('Next mode: D Dorian');
    fireEvent.click(next());
    expect(title()).toHaveTextContent(/^D Dorian$/);
    expect(screen.getByRole('combobox', { name: 'Root' })).toHaveValue('D');
    expect(screen.getByRole('combobox', { name: 'Scale' })).toHaveValue('dorian');
    // The strip stays on C major; the root square moves to D.
    expect(stripNames()).toBe('C D E F G A B C');
    expect(square()).toMatch(/^D/);
    expect(saved()).toMatchObject({ root: 'C', scale: 'ionian', mode: 1 });

    // The ends wrap round.
    fireEvent.click(prev());
    fireEvent.click(prev());
    expect(title()).toHaveTextContent(/^B Locrian$/);
    expect(prev()).toHaveAccessibleName('Previous mode: A natural minor');

    // A dropdown starts again from what it shows.
    fireEvent.change(screen.getByRole('combobox', { name: 'Scale' }), {
      target: { value: 'phrygian' },
    });
    expect(title()).toHaveTextContent(/^B Phrygian$/);
    expect(stripNames()).toMatch(/^B C D/);
    expect(saved()).toMatchObject({ root: 'B', scale: 'phrygian', mode: 0 });
  });

  it('rotates to a tapped note and resets', () => {
    localStorage.setItem(SCALE_LAB_STORAGE_KEY, JSON.stringify({ root: 'C', scale: 'ionian' }));
    render(<ScaleLab />);
    const title = () => screen.getByRole('heading', { level: 1 });
    const reset = () => screen.queryByRole('button', { name: /^Reset to / });
    // Nothing to reset yet, and the root is not a button.
    expect(reset()).toBeNull();
    expect(screen.queryByRole('button', { name: /^Make C the root/ })).toBeNull();

    fireEvent.click(chordCard('Dm7'));
    fireEvent.click(screen.getByRole('button', { name: 'Make E the root: E Phrygian' }));
    expect(title()).toHaveTextContent(/^E Phrygian$/);
    expect(saved()).toMatchObject({ root: 'C', scale: 'ionian', mode: 2 });
    // The chord stays selected, its numeral counted from E.
    expect(chordCard('Dm7')).toHaveAccessibleName(/^♭vii7, /);

    // The keyboard works too, and the C at either end goes home.
    fireEvent.keyDown(screen.getByRole('button', { name: 'Make G the root: G Mixolydian' }), { key: 'Enter' });
    expect(title()).toHaveTextContent(/^G Mixolydian$/);
    expect(screen.getAllByRole('button', { name: 'Make C the root: C major' })).toHaveLength(2);

    fireEvent.click(reset()!);
    expect(title()).toHaveTextContent(/^C major$/);
    expect(reset()).toBeNull();
    expect(chordCard('Dm7')).toHaveAccessibleName(/^ii7, /);
  });

  it('has no notes to tap in a pentatonic', () => {
    localStorage.setItem(SCALE_LAB_STORAGE_KEY, JSON.stringify({ scale: 'major-pentatonic' }));
    render(<ScaleLab />);
    expect(screen.queryByRole('button', { name: /^Make / })).toBeNull();
  });

  it('keeps the selected chord through a rotation', () => {
    localStorage.setItem(SCALE_LAB_STORAGE_KEY, JSON.stringify({ root: 'C', scale: 'ionian' }));
    render(<ScaleLab />);
    fireEvent.click(chordCard('Dm7'));
    expect(chordCard('Dm7')).toHaveAccessibleName(/^ii7, /);
    fireEvent.click(screen.getByRole('button', { name: /^Next mode/ }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^D Dorian$/);
    expect(board()).toHaveAccessibleName('Dm7 in D Dorian on the fretboard');
    expect(chordCard('Dm7')).toHaveAccessibleName(/^i7, /);
  });

  it('keeps the chords in the picked scale\'s order through a rotation', () => {
    localStorage.setItem(SCALE_LAB_STORAGE_KEY, JSON.stringify({ root: 'C', scale: 'ionian' }));
    render(<ScaleLab />);
    const symbols = () => Array.from(document.querySelectorAll('.chord-card'))
      .map(c => c.querySelector('.font-bold')!.textContent).join(' ');
    const tonic = () => document.querySelector('.chord-card .text-\\(--degree-root\\)')!
      .closest('button')!.querySelector('.font-bold')!.textContent;
    const order = 'Cmaj7 Dm7 Em7 Fmaj7 G7 Am7 Bm7♭5';
    expect(symbols()).toBe(order);
    expect(tonic()).toBe('Cmaj7');

    fireEvent.click(chordCard('Dm7'));
    const ladderCells = () => screen.getAllByTestId('ladder-tone')
      .map(g => g.querySelector('rect')!.getAttribute('x')).join();
    const before = ladderCells();
    fireEvent.click(screen.getByRole('button', { name: /^Next mode/ }));
    // Same cards in the same places; the tonic moves to Dm7.
    expect(symbols()).toBe(order);
    expect(tonic()).toBe('Dm7');
    // Dm7 stays where it was on the ladder, which still starts on C.
    expect(ladderCells()).toBe(before);

    // The clock keeps C at the top.
    fireEvent.click(screen.getByRole('button', { name: 'Clock' }));
    const top = Array.from(document.querySelectorAll('.chord-clock text.diagram-name'))
      .find(t => Math.abs(Number(t.getAttribute('x'))) < 0.01 && Number(t.getAttribute('y')) < 0);
    expect(top?.textContent).toBe('C');
  });

  it('reopens on the rotated mode', () => {
    localStorage.setItem(SCALE_LAB_STORAGE_KEY, JSON.stringify({
      root: 'C', scale: 'ionian', mode: 4,
    }));
    render(<ScaleLab />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^G Mixolydian$/);
  });

  it('explains why a pentatonic has no chords', () => {
    localStorage.setItem(SCALE_LAB_STORAGE_KEY, JSON.stringify({ scale: 'minor-pentatonic' }));
    render(<ScaleLab />);
    expect(screen.getByText(/only seven-note scales have them/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next mode' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous mode' })).toBeDisabled();
  });
});
