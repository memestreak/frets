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

  it('highlights a chord’s secondary dominant while the chord or the chip is hovered', () => {
    renderAt();
    fireEvent.click(screen.getByLabelText('Secondary dominants'));
    const hot = () => [...document.querySelectorAll('.cof-hot')].map(g => g.getAttribute('data-cell'));
    expect(hot()).toEqual([]);
    // Dm (ii, on F's spoke) resolves from A7.
    fireEvent.pointerEnter(cell('minor:11'));
    expect(hot()).toEqual(['major:3']);
    fireEvent.pointerLeave(cell('minor:11'));
    expect(hot()).toEqual([]);
    // G resolves from D7.
    fireEvent.pointerEnter(cell('major:1'));
    expect(hot()).toEqual(['major:2']);
    fireEvent.pointerLeave(cell('major:1'));
    const e7 = within(screen.getByRole('region', { name: 'Secondary dominants' })).getByText('E7').closest('li')!;
    fireEvent.pointerEnter(e7);
    expect(hot()).toEqual(['major:4']);
    fireEvent.pointerLeave(e7);
    expect(hot()).toEqual([]);
    expect(document.querySelector('marker, .cof-arrow')).toBeNull();
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

  it('shows the Advanced view from the URL, on C Dorian', () => {
    renderAt('?view=advanced');
    expect(heading()).toHaveTextContent('C Dorian');
    expect(screen.getByTestId('mode-formula')).toHaveTextContent('1 2 ♭3 4 5 6 ♭7');
    expect(screen.getByRole('button', { name: 'C Dorian' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('row', { selected: true })).toHaveTextContent(/^C Dorian/);
    // The Key view's own checkboxes keep their room but are out of reach.
    expect(screen.getByLabelText('Parallel key')).toBeDisabled();
  });

  it('picks a mode from the parallel table or a lit note on the ring', () => {
    renderAt('?view=advanced');
    fireEvent.click(screen.getByRole('rowheader', { name: 'C Phrygian' }));
    expect(heading()).toHaveTextContent('C Phrygian');
    // C Phrygian's notes from D♭ instead: only the root moves.
    fireEvent.click(screen.getByRole('button', { name: 'D♭ Lydian' }));
    expect(heading()).toHaveTextContent('D♭ Lydian');
    expect(screen.getByRole('button', { name: 'D♭ Lydian' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('previews a parallel mode’s notes on the ring while its row is hovered', () => {
    renderAt('?view=advanced');
    expect(screen.queryByTestId('run-preview')).toBeNull();
    fireEvent.pointerEnter(screen.getByRole('rowheader', { name: 'C Lydian' }).closest('tr')!);
    expect(screen.getByTestId('run-preview')).toBeInTheDocument();
    fireEvent.pointerLeave(screen.getByRole('rowheader', { name: 'C Lydian' }).closest('tbody')!);
    expect(screen.queryByTestId('run-preview')).toBeNull();
  });

  it('moves the root from the outer ring, keeping the mode, and spells it from its key', () => {
    renderAt('?view=advanced');
    fireEvent.click(cell('major:1'));
    expect(heading()).toHaveTextContent('G Dorian');
    fireEvent.click(screen.getByRole('rowheader', { name: 'G Locrian' }));
    fireEvent.click(cell('major:7'));
    // D♭ Locrian uses D major's notes, so it is spelled C♯ Locrian.
    expect(heading()).toHaveTextContent('C♯ Locrian');
    expect(cell('dim:2')).toHaveAccessibleName('C♯°, i°');
  });

  it('keeps the root when switching views', () => {
    const page = renderAt();
    fireEvent.click(cell('minor:0'));
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    expect(nav.push).toHaveBeenLastCalledWith('/explore/circle?view=advanced', { scroll: false });
    page.follow();
    expect(heading()).toHaveTextContent('A Aeolian');
    fireEvent.click(screen.getByRole('rowheader', { name: 'A Dorian' }));
    fireEvent.click(screen.getByRole('button', { name: 'Circle' }));
    expect(nav.push).toHaveBeenLastCalledWith('/explore/circle', { scroll: false });
    page.follow();
    expect(heading()).toHaveTextContent('A major');
  });

  it('explains a cell after the mouse rests on it for a second', () => {
    vi.useFakeTimers();
    try {
      renderAt('?view=advanced');
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
