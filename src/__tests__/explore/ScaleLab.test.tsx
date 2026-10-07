import { act, fireEvent, render, screen, within } from '@testing-library/react';
import ScaleLab from '@/features/explore/scales/ScaleLab';
import { SCALE_LAB_STORAGE_KEY } from '@/features/explore/scales/settings';
import { TIP_DELAY_MS } from '@/features/explore/scales/StripTip';

const formula = () => screen.getByTestId('scale-formula');
const scaleImgs = (name: string) => screen.getAllByRole('img', { name });
const saved = () => JSON.parse(localStorage.getItem(SCALE_LAB_STORAGE_KEY) ?? '{}');
const board = () => screen.getByRole('img', { name: / on the fretboard$/ });
const dotLabels = () => new Set(screen.getAllByTestId(/^dot-/).map(d => d.textContent));
/** Each dot as "string:fret label", low string first. */
const dotsAt = () => screen.getAllByTestId(/^dot-/)
  .map(d => `${d.dataset.s}:${d.dataset.f} ${d.textContent}`)
  .sort();
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

  it('shows a tapped chord\'s shape in the position and clears it on a second tap', () => {
    render(<ScaleLab />);
    const rootFrets = () =>
      screen.getAllByTestId('dot-root').filter(d => d.dataset.s === '0').map(d => d.dataset.f);
    expect(rootFrets()).toEqual(['5']);
    fireEvent.click(chordCard('D7'));
    // The title and formula stay the scale's; the board names the chord.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^A Dorian$/);
    expect(board()).toHaveAccessibleName('D7 in A Dorian on the fretboard');
    expect(formula()).toHaveTextContent('1 2 ♭3 4 5 6 ♭7');
    // D7's easiest shape in frets 5–9, x-x-x-7-7-8, and nothing else.
    expect(dotsAt()).toEqual(['3:7 R', '4:7 3', '5:8 ♭7']);

    fireEvent.click(chordCard('D7'));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^A Dorian$/);
    expect(dotLabels()).toEqual(new Set(['R', '2', '♭3', '4', '5', '6', '♭7']));
  });

  it('draws the chords\' shapes in one position, steps it and saves it', () => {
    render(<ScaleLab />);
    const card = within(screen.getByRole('region', { name: 'In one position' }));
    expect(card.getAllByRole('button', { name: /: shape in Frets 5–9$/ })).toHaveLength(7);
    // The neck outlines the position only while a chord is selected.
    expect(screen.queryByTestId('board-box')).toBeNull();
    fireEvent.click(chordCard('D7'));
    expect(screen.getByTestId('board-box')).toBeInTheDocument();
    fireEvent.click(card.getByRole('button', { name: 'Higher position' }));
    expect(card.getByText('Frets 6–10')).toBeInTheDocument();
    expect(saved()).toMatchObject({ position: 6 });
    for (let i = 0; i < 5; i++) fireEvent.click(card.getByRole('button', { name: 'Lower position' }));
    // The first position takes in the open strings.
    expect(card.getByText('Open–5')).toBeInTheDocument();
    expect(card.getByRole('button', { name: 'Lower position' })).toBeDisabled();
  });

  it('selects a chord from its shape, cycles its shapes and links to the library', () => {
    render(<ScaleLab />);
    const card = within(screen.getByRole('region', { name: 'In one position' }));
    fireEvent.click(card.getByRole('button', { name: /^Am7 \(i7\)/ }));
    expect(chordCard('Am7')).toHaveAttribute('aria-pressed', 'true');
    expect(card.getByText('1 of 3')).toBeInTheDocument();
    const link = () => card.getByRole('link', { name: 'Am7 in the Chord library →' });
    expect(link()).toHaveAttribute('href', '/chords/library?chord=am7&shape=5-7-5-5-5-5');
    expect(dotsAt()).toEqual(['0:5 R', '1:7 5', '2:5 ♭7', '3:5 ♭3', '4:5 5', '5:5 R']);

    fireEvent.click(card.getByRole('button', { name: 'Next shape' }));
    expect(card.getByText('2 of 3')).toBeInTheDocument();
    expect(link()).toHaveAttribute('href', '/chords/library?chord=am7&shape=x-x-7-5-8-5');
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(card.getByText('3 of 3')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(card.getByText('2 of 3')).toBeInTheDocument();

    // Each chord keeps its shape while the position stays.
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(card.getByText('2 of 3')).toBeInTheDocument();
  });

  it('shows the arpeggio around the shape, labelling only the shape', () => {
    render(<ScaleLab />);
    const arpeggio = () => screen.getByRole('button', { name: 'Arpeggio' });
    expect(arpeggio()).toBeDisabled();
    fireEvent.click(chordCard('D7'));
    fireEvent.click(arpeggio());
    expect(arpeggio()).toHaveAttribute('aria-pressed', 'true');
    // Every D7 tone up to fret 15; only the shape's three carry labels.
    const dots = screen.getAllByTestId(/^dot-/);
    expect(dots.length).toBeGreaterThan(20);
    expect(dotsAt().filter(d => !d.endsWith(' '))).toEqual(['3:7 R', '4:7 3', '5:8 ♭7']);
    expect(screen.getAllByTestId('dot-root').filter(d => d.dataset.s === '0').map(d => d.dataset.f))
      .toEqual(['10']);
    // It stays on for the next chord, and goes off with the selection.
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(arpeggio()).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(chordCard('Em7'));
    expect(arpeggio()).toBeDisabled();
    expect(arpeggio()).toHaveAttribute('aria-pressed', 'false');
  });

  it('goes back to the scale on a click outside the controls, or Esc', () => {
    render(<ScaleLab />);
    const scaleBoard = 'A Dorian on the fretboard';
    fireEvent.click(chordCard('D7'));
    // Controls keep the chord.
    fireEvent.click(screen.getByRole('button', { name: 'Higher position' }));
    expect(board()).toHaveAccessibleName('D7 in A Dorian on the fretboard');
    fireEvent.click(screen.getByRole('heading', { level: 1 }));
    expect(board()).toHaveAccessibleName(scaleBoard);

    fireEvent.click(chordCard('D7'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(board()).toHaveAccessibleName(scaleBoard);
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
    const makeRoot = (note: string) =>
      fireEvent.click(screen.getAllByRole('button', { name: new RegExp(`^Make ${note} the root`) })[0]);
    const strip = () => document.querySelector<HTMLElement>('.scale-strip')!;
    const stripNames = () => within(strip()).getAllByTestId('ladder-note')
      .map(g => g.querySelector('text')!.textContent).join(' ');
    const square = () => within(strip()).getAllByTestId('ladder-note')
      .find(g => g.querySelector('rect')!.getAttribute('rx') === '3')!.textContent;

    // There are no step buttons: the strip's notes do the rotating.
    expect(screen.queryByRole('button', { name: /mode/ })).toBeNull();
    makeRoot('D');
    expect(title()).toHaveTextContent(/^D Dorian$/);
    expect(screen.getByRole('combobox', { name: 'Root' })).toHaveValue('D');
    expect(screen.getByRole('combobox', { name: 'Scale' })).toHaveValue('dorian');
    // The strip stays on C major; the root square moves to D.
    expect(stripNames()).toBe('C D E F G A B C');
    expect(square()).toMatch(/^D/);
    expect(saved()).toMatchObject({ root: 'C', scale: 'ionian', mode: 1 });

    makeRoot('B');
    expect(title()).toHaveTextContent(/^B Locrian$/);

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

  it('explains a strip note on mouse hover, not on touch', () => {
    localStorage.setItem(SCALE_LAB_STORAGE_KEY, JSON.stringify({ root: 'C', scale: 'ionian' }));
    render(<ScaleLab />);
    const e = screen.getByRole('button', { name: 'Make E the root: E Phrygian' });
    const tip = () => screen.queryByRole('tooltip');

    fireEvent.pointerOver(e, { pointerType: 'touch' });
    expect(tip()).toBeNull();
    vi.useFakeTimers();
    fireEvent.pointerOver(e, { pointerType: 'mouse' });
    // It waits a second before showing.
    act(() => vi.advanceTimersByTime(TIP_DELAY_MS - 1));
    expect(tip()).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    vi.useRealTimers();
    expect(tip()).toHaveTextContent('Make E the root: E Phrygian');
    expect(tip()).toHaveTextContent('Same notes, new root: a relative mode.');
    fireEvent.pointerDown(e);
    fireEvent.click(e);
    expect(tip()).toBeNull();

    // Touch screens get the same advice as a line under the strip.
    expect(screen.getByText(/^Tap a note to make it the root\./)).toHaveClass('strip-touch-hint');
  });

  it('has no notes to tap in a pentatonic', () => {
    localStorage.setItem(SCALE_LAB_STORAGE_KEY, JSON.stringify({ scale: 'major-pentatonic' }));
    render(<ScaleLab />);
    expect(screen.queryByRole('button', { name: /^Make / })).toBeNull();
    expect(screen.queryByText(/^Tap a note/)).toBeNull();
  });

  it('keeps the selected chord through a rotation', () => {
    localStorage.setItem(SCALE_LAB_STORAGE_KEY, JSON.stringify({ root: 'C', scale: 'ionian' }));
    render(<ScaleLab />);
    fireEvent.click(chordCard('Dm7'));
    expect(chordCard('Dm7')).toHaveAccessibleName(/^ii7, /);
    fireEvent.click(screen.getByRole('button', { name: 'Make D the root: D Dorian' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^D Dorian$/);
    expect(board()).toHaveAccessibleName('Dm7 in D Dorian on the fretboard');
    expect(chordCard('Dm7')).toHaveAccessibleName(/^i7, /);
  });

  it('keeps the chords in the picked scale\'s order through a rotation', () => {
    localStorage.setItem(SCALE_LAB_STORAGE_KEY, JSON.stringify({ root: 'C', scale: 'ionian' }));
    render(<ScaleLab />);
    const symbols = () => Array.from(document.querySelectorAll('.chord-card'))
      .map(c => c.querySelector('.font-bold')!.textContent).join(' ');
    // The tonic is the card numbered I or i (not II, III or IV).
    const tonic = () => Array.from(document.querySelectorAll('.chord-card'))
      .find(c => /^[iI](?![iIvV])/.test(c.querySelector('.chord-numeral')!.textContent!))!
      .querySelector('.font-bold')!.textContent;
    const order = 'Cmaj7 Dm7 Em7 Fmaj7 G7 Am7 Bm7♭5';
    expect(symbols()).toBe(order);
    expect(tonic()).toBe('Cmaj7');

    fireEvent.click(chordCard('Dm7'));
    const ladderCells = () => screen.getAllByTestId('ladder-tone')
      .map(g => g.querySelector('rect')!.getAttribute('x')).join();
    const before = ladderCells();
    fireEvent.click(screen.getByRole('button', { name: 'Make D the root: D Dorian' }));
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
    expect(screen.queryByRole('button', { name: /^Make / })).toBeNull();
  });
});
