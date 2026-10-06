import { fireEvent, render, screen, within } from '@testing-library/react';
import ChordLibrary from '@/features/chords/library/ChordLibrary';

/** The page's URL query, and the URLs it pushed. */
const nav = vi.hoisted(() => ({ search: '', push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ push: nav.push }),
}));

/** Renders the page at /chords/library plus `search`. */
function renderAt(search = '') {
  nav.search = search;
  return render(<ChordLibrary />);
}

const heading = () => screen.getByRole('heading', { level: 1 });
const group = (name: 'Open' | 'Moveable') => screen.getByRole('region', { name: `${name} shapes` });
const shapes = (name: 'Open' | 'Moveable') => within(group(name)).queryAllByRole('button');
const caption = () => screen.getByTestId('shape-caption');
/** The board's dots as "string:fret" pairs, low E first. */
const boardDots = () =>
  screen.getAllByTestId(/^dot-/).map(d => `${d.dataset.s}:${d.dataset.f}`).sort();

describe('ChordLibrary', () => {
  beforeEach(() => nav.push.mockClear());

  it('opens on Am7 with its formula, notes and first open shape on the neck', () => {
    renderAt();
    expect(heading()).toHaveTextContent('Am7');
    expect(screen.getByTestId('chord-formula')).toHaveTextContent('(1 ♭3 5 ♭7)');
    expect(screen.getByTestId('chord-notes')).toHaveTextContent('A C E G');
    expect(caption()).toHaveTextContent('Open 1 of 3 · root on A · frets 1–2');
    // x-0-2-0-1-0: only the chosen shape is on the neck.
    expect(boardDots()).toEqual(['1:0', '2:2', '3:0', '4:1', '5:0']);
    expect(shapes('Open')[0]).toHaveAttribute('aria-pressed', 'true');
  });

  it('names the dot colours of the shape diagrams', () => {
    renderAt('?chord=c9');
    const key = screen.getByRole('list', { name: 'Dot colours' });
    expect(within(key).getAllByRole('listitem').map(li => li.textContent))
      .toEqual(['R', '3', '5', '♭7', '9']);
  });

  it('shows the chord the URL names', () => {
    renderAt('?chord=c');
    expect(heading()).toHaveTextContent(/^C \(/);
    expect(screen.getByTestId('chord-notes')).toHaveTextContent('C E G');
    expect(shapes('Open')[0]).toHaveAttribute('data-voicing', 'x-3-2-0-1-0');
  });

  it('shows Am7 for a chord it does not know', () => {
    renderAt('?chord=h7');
    expect(heading()).toHaveTextContent('Am7');
  });

  it('goes to the URL of the chord picked in the dropdowns', () => {
    renderAt('?chord=fsharpm7');
    fireEvent.change(screen.getByRole('combobox', { name: 'Root' }), { target: { value: 'C' } });
    expect(nav.push).toHaveBeenLastCalledWith('/chords/library?chord=cm7', { scroll: false });
    fireEvent.change(screen.getByRole('combobox', { name: 'Type' }), { target: { value: '7#9' } });
    expect(nav.push).toHaveBeenLastCalledWith('/chords/library?chord=fsharp7sharp9', { scroll: false });
  });

  it('puts a tapped shape on the neck', () => {
    renderAt();
    const barre = within(group('Moveable')).getByRole('button', { name: /root on E · frets 5–7/ });
    fireEvent.click(barre);
    expect(barre).toHaveAttribute('aria-pressed', 'true');
    expect(boardDots()).toEqual(['0:5', '1:7', '2:5', '3:5', '4:5', '5:5']);
    expect(caption()).toHaveTextContent(/^Moveable \d+ of \d+ · root on E · frets 5–7$/);
  });

  it('steps through the open shapes, then the moveable ones', () => {
    renderAt();
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

  it('steps through the shapes with the arrow keys', () => {
    renderAt();
    const open = shapes('Open');
    fireEvent.keyDown(window, { key: 'ArrowLeft' }); // already at the first shape
    expect(open[0]).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(shapes('Open')[1]).toHaveAttribute('aria-pressed', 'true');
    expect(caption()).toHaveTextContent(/^Open 2 of/);
    for (let i = 1; i < open.length; i++) fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(shapes('Moveable')[0]).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(shapes('Open').at(-1)).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows every moveable shape on request, and the best few again', () => {
    renderAt();
    const few = shapes('Moveable').length;
    fireEvent.click(screen.getByRole('button', { name: /^Show all \d+ shapes$/ }));
    expect(shapes('Moveable').length).toBeGreaterThan(few);
    fireEvent.click(screen.getByRole('button', { name: 'Show the best few' }));
    expect(shapes('Moveable')).toHaveLength(few);
  });

  it('shows the arpeggio across the neck behind the chosen shape', () => {
    const { rerender } = renderAt();
    const toggle = screen.getByRole('button', { name: 'Arpeggio' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    // Every A, C, E and G from the nut to fret 15.
    expect(boardDots()).toHaveLength(34);
    // x-0-2-0-1-0 stays at full strength; the rest is faint.
    const full = screen.getAllByTestId(/^dot-/).filter(d => !d.hasAttribute('opacity') || d.getAttribute('opacity') === '1');
    expect(full.map(d => `${d.dataset.s}:${d.dataset.f}`).sort())
      .toEqual(['1:0', '2:2', '3:0', '4:1', '5:0']);
    expect(screen.getByRole('img', { name: /Am7 arpeggio/ })).toBeInTheDocument();

    // It stays on for the next chord.
    nav.search = '?chord=c';
    rerender(<ChordLibrary />);
    expect(screen.getByRole('button', { name: 'Arpeggio' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('img', { name: /^C arpeggio/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Arpeggio' }));
    expect(boardDots()).toEqual(['1:3', '2:2', '3:0', '4:1', '5:0']);
  });

  it('says so when a chord has no open shape', () => {
    renderAt('?chord=cm6');
    expect(within(group('Open')).getByText('No open shape for Cm6.')).toBeInTheDocument();
    expect(caption()).toHaveTextContent(/^Moveable 1 of /);
  });
});
