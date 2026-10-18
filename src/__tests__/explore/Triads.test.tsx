import { fireEvent, render, screen, within } from '@testing-library/react';
import Triads from '@/features/explore/triads/Triads';
import { TRIADS_STORAGE_KEY } from '@/features/explore/triads/settings';

const caption = () => screen.getByTestId('triad-caption');
const saved = () => JSON.parse(localStorage.getItem(TRIADS_STORAGE_KEY) ?? '{}');
const tap = (s: number, f: number) => fireEvent.click(screen.getByTestId(`cell-${s}-${f}`));
/** The opacity of the dot at a string and fret. */
const dotOpacity = (s: number, f: number) => screen.getAllByTestId(/^dot-/)
  .find(d => d.dataset.s === String(s) && d.dataset.f === String(f))!
  .getAttribute('opacity');
const linkNames = () => screen.getAllByTestId('link').map(l => l.textContent);

describe('Triads', () => {
  beforeEach(() => localStorage.clear());

  it('opens on C major on G-B-e, every grip joined and named', () => {
    render(<Triads />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Triads');
    expect(caption()).toHaveTextContent('C major on the G-B-e strings. Tap a grip to name it.');
    expect(screen.getByTestId('string-set')).toHaveTextContent('G B e');
    expect(linkNames()).toEqual(['2nd', 'Root', '1st', '2nd']);
    expect(screen.getAllByTestId(/^dot-/)).toHaveLength(12);
  });

  it('picks a tapped grip, names it and fades the rest', () => {
    render(<Triads />);
    tap(3, 9);
    expect(caption()).toHaveTextContent('1st inversion, C/E · 3rd in the bass');
    expect(dotOpacity(4, 8)).toBe('1');
    expect(dotOpacity(3, 5)).toBe('0.25');
  });

  it('clears the pick on a second tap, an empty fret or Esc', () => {
    render(<Triads />);
    tap(3, 9);
    tap(5, 8);
    expect(caption()).toHaveTextContent(/Tap a grip/);
    tap(3, 5);
    tap(3, 7);
    expect(caption()).toHaveTextContent(/Tap a grip/);
    tap(3, 5);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(caption()).toHaveTextContent(/Tap a grip/);
  });

  it('steps through the string sets, stopping at each end', () => {
    render(<Triads />);
    const higher = screen.getByRole('button', { name: 'Higher strings' });
    const lower = screen.getByRole('button', { name: 'Lower strings' });
    expect(higher).toBeDisabled();
    for (let i = 0; i < 3; i++) fireEvent.click(lower);
    expect(screen.getByTestId('string-set')).toHaveTextContent('E A D');
    expect(lower).toBeDisabled();
    expect(caption()).toHaveTextContent('C major on the E-A-D strings.');
    expect(saved()).toMatchObject({ strings: 0 });
  });

  it('clears the pick for a new root or triad, and saves them', () => {
    render(<Triads />);
    tap(3, 9);
    const picker = screen.getByRole('radiogroup', { name: 'Root' });
    fireEvent.click(within(picker).getByRole('radio', { name: 'C♯' }));
    expect(caption()).toHaveTextContent('D♭ major on the G-B-e strings.');
    fireEvent.click(screen.getByRole('button', { name: 'Aug' }));
    expect(caption()).toHaveTextContent('D♭ augmented on the G-B-e strings.');
    expect(saved()).toMatchObject({ root: 'Db', triad: 'aug' });
  });

  it('keeps the pick when only the labels change', () => {
    render(<Triads />);
    tap(3, 9);
    fireEvent.click(screen.getByRole('button', { name: 'Note' }));
    expect(caption()).toHaveTextContent('1st inversion');
    expect(new Set(screen.getAllByTestId(/^dot-/).map(d => d.textContent))).toEqual(new Set(['C', 'E', 'G']));
  });
});
