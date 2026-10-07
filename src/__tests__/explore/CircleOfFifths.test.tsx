import { act, fireEvent, render, screen, within } from '@testing-library/react';
import CircleOfFifths from '@/features/explore/circle/CircleOfFifths';
import { TIP_DELAY_MS } from '@/features/explore/circle/HoverTips';

/** The page's URL query, and the URLs it pushed. */
const nav = vi.hoisted(() => ({ search: '', push: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/explore/circle',
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ push: nav.push }),
}));

/** Renders the page; `rerender` follows a pushed URL as Next would. */
function renderAt(search = '') {
  nav.search = search;
  const view = render(<CircleOfFifths />);
  return {
    ...view,
    follow() {
      nav.search = nav.push.mock.lastCall![0].replace('/explore/circle', '');
      view.rerender(<CircleOfFifths />);
    },
  };
}

const heading = () => screen.getByRole('heading', { level: 1 });
const cell = (id: string) => document.querySelector(`[data-cell="${id}"]`)!;
const chips = (section: string) =>
  within(screen.getByRole('region', { name: section })).getAllByRole('listitem').map(li => li.textContent);

describe('CircleOfFifths', () => {
  beforeEach(() => nav.push.mockClear());

  it('opens on C major in Key view, its chords in their degree colours', () => {
    renderAt();
    expect(heading()).toHaveTextContent('C major');
    expect(chips('Chords')).toEqual(['IC', 'iiDm', 'iiiEm', 'IVF', 'VG', 'viAm', 'vii°B°']);
    expect(cell('major:0')).toHaveAttribute('aria-pressed', 'true');
    expect(cell('major:0').querySelector('path')).toHaveStyle({ fill: 'var(--degree-root)' });
    // Not in the key: drawn plain.
    expect(cell('major:2').querySelector('path')!.getAttribute('style')).toBeNull();
  });

  it('picks a major key from the outer ring and a minor key from the middle', () => {
    renderAt();
    fireEvent.click(cell('major:2'));
    expect(heading()).toHaveTextContent('D major');
    fireEvent.keyDown(cell('minor:2'), { key: 'Enter' });
    expect(heading()).toHaveTextContent('B minor');
    expect(chips('Chords')).toContain('VF♯');
  });

  it('adds borrowed chords and secondary dominants from their checkboxes', () => {
    renderAt();
    expect(screen.queryByRole('region', { name: 'Borrowed from C minor' })).toBeNull();
    fireEvent.click(screen.getByLabelText('Parallel key'));
    expect(chips('Borrowed from C minor')).toContain('♭VIA♭');
    fireEvent.click(screen.getByLabelText('Secondary dominants'));
    expect(chips('Secondary dominants')).toEqual(['V/iiA7', 'V/iiiB7', 'V/IVC7', 'V/VD7', 'V/viE7']);
  });

  it('draws key signatures and numbers every chord on request', () => {
    renderAt();
    expect(screen.queryByTestId('staff-2')).toBeNull();
    fireEvent.click(screen.getByLabelText('Key signatures'));
    expect(screen.getByTestId('staff-2')).toHaveAttribute('data-tip', 'D major and B minor: F♯ C♯.');
    expect(screen.getByTestId('staff-0')).toHaveClass('cof-staff-home');
    fireEvent.click(screen.getByLabelText('All numerals'));
    expect(cell('major:4')).toHaveAccessibleName('E, III');
  });

  it('shows Mode view from the URL, on C Dorian', () => {
    renderAt('?view=mode');
    expect(heading()).toHaveTextContent('C Dorian');
    expect(screen.getByTestId('mode-formula')).toHaveTextContent('1 2 ♭3 4 5 6 ♭7');
    expect(screen.getByRole('button', { name: 'Dorian' })).toHaveAttribute('aria-pressed', 'true');
    // The Key view's own checkboxes keep their room but are out of reach.
    expect(screen.getByLabelText('Parallel key')).toBeDisabled();
  });

  it('picks a mode from the rim, the parallel table or the relative cells', () => {
    renderAt('?view=mode');
    fireEvent.click(screen.getByRole('button', { name: 'Lydian' }));
    expect(heading()).toHaveTextContent('C Lydian');
    fireEvent.click(screen.getByRole('rowheader', { name: 'C Phrygian' }));
    expect(heading()).toHaveTextContent('C Phrygian');
    // C Phrygian's notes from D♭ instead.
    fireEvent.click(screen.getByRole('button', { name: 'D♭ Lydian' }));
    expect(heading()).toHaveTextContent('D♭ Lydian');
  });

  it('moves the root from the outer ring, keeping the mode', () => {
    renderAt('?view=mode');
    fireEvent.click(cell('major:1'));
    expect(heading()).toHaveTextContent('G Dorian');
    expect(chips('Chords')[0]).toBe('iGm');
  });

  it('keeps the root when switching views', () => {
    const page = renderAt();
    fireEvent.click(cell('minor:0'));
    fireEvent.click(screen.getByRole('button', { name: 'Mode' }));
    expect(nav.push).toHaveBeenLastCalledWith('/explore/circle?view=mode', { scroll: false });
    page.follow();
    expect(heading()).toHaveTextContent('A Aeolian');
    fireEvent.click(screen.getByRole('button', { name: 'Dorian' }));
    fireEvent.click(screen.getByRole('button', { name: 'Key' }));
    expect(nav.push).toHaveBeenLastCalledWith('/explore/circle', { scroll: false });
    page.follow();
    expect(heading()).toHaveTextContent('A major');
  });

  it('explains a cell after the mouse rests on it for a second', () => {
    vi.useFakeTimers();
    try {
      renderAt('?view=mode');
      fireEvent.pointerMove(cell('major:11'), { pointerType: 'mouse' });
      expect(screen.queryByRole('tooltip')).toBeNull();
      act(() => vi.advanceTimersByTime(TIP_DELAY_MS));
      expect(screen.getByRole('tooltip')).toHaveTextContent(/^F: IV in C Dorian\..*The Dorian sound/);
      fireEvent.pointerDown(cell('major:11'));
      expect(screen.queryByRole('tooltip')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
