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
const strings = () => screen.getByRole('combobox', { name: 'Strings' });
const triad = () => screen.getByRole('combobox', { name: 'Triad' });
const shown = (select: HTMLElement) =>
  within(select).getAllByRole<HTMLOptionElement>('option').find(o => o.selected)?.textContent;
const linkNames = () => screen.getAllByTestId('link').map(l => l.textContent);

describe('Triads', () => {
  beforeEach(() => localStorage.clear());

  it('opens on C major on G-B-e, every grip joined and named', () => {
    render(<Triads />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Triads');
    expect(caption()).toHaveTextContent('C major on the e-B-G strings. Tap a grip to name it.');
    expect(shown(strings())).toBe('e B G');
    // High strings first.
    expect(within(strings()).getAllByRole('option').map(o => o.textContent))
      .toEqual(['e B G', 'B G D', 'G D A', 'D A E']);
    expect(shown(triad())).toBe('Major');
    expect(within(triad()).getAllByRole('option').map(o => o.textContent))
      .toEqual(['Major', 'Minor', 'Diminished', 'Augmented']);
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

  it('orders the pickers Triad, Strings, Root', () => {
    render(<Triads />);
    const root = screen.getByRole('radiogroup', { name: 'Root' });
    expect(triad().compareDocumentPosition(strings()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(strings().compareDocumentPosition(root) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('picks a string set from its menu, and clears the pick', () => {
    render(<Triads />);
    tap(3, 9);
    fireEvent.change(strings(), { target: { value: '0' } });
    expect(shown(strings())).toBe('D A E');
    expect(caption()).toHaveTextContent('C major on the D-A-E strings.');
    expect(saved()).toMatchObject({ strings: 0 });
  });

  it('clears the pick for a new root or triad, and saves them', () => {
    render(<Triads />);
    tap(3, 9);
    const picker = screen.getByRole('radiogroup', { name: 'Root' });
    fireEvent.click(within(picker).getByRole('radio', { name: 'C♯' }));
    expect(caption()).toHaveTextContent('D♭ major on the e-B-G strings.');
    fireEvent.change(triad(), { target: { value: 'aug' } });
    expect(caption()).toHaveTextContent('D♭ augmented on the e-B-G strings.');
    expect(saved()).toMatchObject({ root: 'Db', triad: 'aug' });
  });

  it('keeps the pick when only the labels change', () => {
    render(<Triads />);
    tap(3, 9);
    fireEvent.click(screen.getByRole('button', { name: 'Note' }));
    expect(caption()).toHaveTextContent('1st inversion');
    expect(new Set(screen.getAllByTestId(/^dot-/).map(d => d.textContent))).toEqual(new Set(['C', 'E', 'G']));
  });

  it('shows every tone of the triad with the Arpeggio, under the neck beside the labels', () => {
    render(<Triads />);
    const arpeggio = screen.getByRole('button', { name: 'Arpeggio' });
    // The labels and the Arpeggio sit together, under the neck.
    expect(arpeggio.parentElement).toContainElement(screen.getByRole('group', { name: 'Dot labels' }));
    fireEvent.click(arpeggio);
    expect(arpeggio).toHaveAttribute('aria-pressed', 'true');
    // C, E and G on every string from the nut to fret 15, the low E included.
    expect(screen.getAllByTestId(/^dot-/)).toHaveLength(26);
    expect(screen.getAllByTestId(/^dot-/).some(d => d.dataset.s === '0')).toBe(true);
    tap(3, 9);
    expect(caption()).toHaveTextContent('1st inversion');
    const labelled = screen.getAllByTestId(/^dot-/).filter(d => d.textContent);
    expect(labelled.map(d => `${d.dataset.s}:${d.dataset.f}`).sort()).toEqual(['3:9', '4:8', '5:8']);
    fireEvent.keyDown(window, { key: ' ' });
    expect(arpeggio).toHaveAttribute('aria-pressed', 'false');
  });
});
