import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ChordsPage from '@/features/chords/ChordsPage';

/** Renders the page at /chords plus `search`. */
function renderAt(search = '') {
  window.history.replaceState(null, '', `/chords${search}`);
  return render(<ChordsPage />);
}

const heading = () => screen.getByRole('heading', { level: 1 });
const group = (name: 'Open' | 'Moveable') => screen.getByRole('region', { name: `${name} shapes` });
const shapes = (name: 'Open' | 'Moveable') => within(group(name)).queryAllByRole('button');
const caption = () => screen.getByTestId('shape-caption');
const cell = (s: number, f: number) => screen.getByTestId(`cell-${s}-${f}`);
/** The board's dots as "string:fret" pairs, low E first. */
const boardDots = () =>
  screen.queryAllByTestId(/^dot-/).map(d => `${d.dataset.s}:${d.dataset.f}`).sort();
/** The board's × marks, by test id, low E first. */
const mutedMarks = () => screen.queryAllByTestId(/^muted-/).map(m => m.dataset.testid);
const names = () => within(screen.getByRole('region', { name: 'Name it' })).queryAllByRole('button');
const arpeggio = () => screen.getByRole('button', { name: 'Arpeggio' });
const typePicker = () => screen.getByRole('combobox', { name: 'Type' });
const rootPicker = () => screen.getByRole('radiogroup', { name: 'Root' });
/** The picked root's tile text, "E♭". */
const pickedRoot = () => within(rootPicker()).getByRole('radio', { checked: true }).textContent;
const pickRoot = (note: string) => fireEvent.click(within(rootPicker()).getByRole('radio', { name: note }));
/** The board's dot at a string and fret. */
const dotAt = (s: number, f: number) =>
  screen.queryAllByTestId(/^dot-/).find(d => d.dataset.s === `${s}` && d.dataset.f === `${f}`)!;
const here = () => window.location.pathname + window.location.search;
const OPEN_C = ['1:3', '2:2', '3:0', '4:1', '5:0'];

describe('ChordsPage, looking a chord up', () => {
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

  it('marks the muted strings of the shape on the neck, but not of the arpeggio', () => {
    // A shape that plays every string has none.
    const barre = renderAt('?chord=am7&shape=5-7-5-5-5-5');
    expect(boardDots()).toHaveLength(6);
    expect(mutedMarks()).toEqual([]);
    barre.unmount();

    renderAt('?chord=d&shape=x-x-0-2-3-2');
    expect(mutedMarks()).toEqual(['muted-0', 'muted-1']);
    fireEvent.click(screen.getByRole('button', { name: 'Arpeggio' }));
    expect(mutedMarks()).toEqual([]);
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

  it('opens on the shape the URL names, listing every shape when it is not among the best few', () => {
    renderAt('?chord=am7&shape=5-7-5-5-5-5');
    expect(boardDots()).toEqual(['0:5', '1:7', '2:5', '3:5', '4:5', '5:5']);
    expect(screen.getByRole('button', { name: /Show all/ })).toBeInTheDocument();

    renderAt('?chord=am7&shape=5-x-5-2-1-x');
    expect(screen.getAllByTestId(/^dot-/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Show the best few' }).length).toBe(1);
  });

  it('opens on the first shape for a shape it cannot read', () => {
    renderAt('?chord=am7&shape=9-9-9');
    expect(caption()).toHaveTextContent('Open 1 of 3');
    renderAt('?chord=am7&shape=x-0-2-0-1-16'); // past the neck's last fret
    expect(screen.getAllByTestId('shape-caption').at(-1)).toHaveTextContent('Open 1 of 3');
  });

  it('shows Am7 for a chord it does not know', () => {
    renderAt('?chord=h7');
    expect(heading()).toHaveTextContent('Am7');
  });

  it('puts the first shape of the chord picked in the menus on the neck, and in the URL', () => {
    renderAt('?chord=fsharpm7');
    const entries = window.history.length;
    pickRoot('C');
    expect(heading()).toHaveTextContent(/^Cm7 /);
    expect(here()).toBe(`/chords?chord=cm7&shape=${shapes('Open').length ? shapes('Open')[0].dataset.voicing : shapes('Moveable')[0].dataset.voicing}`);
    fireEvent.change(typePicker(), { target: { value: '7#9' } });
    expect(heading()).toHaveTextContent(/^C7♯9 /);
    expect(here()).toMatch(/^\/chords\?chord=c7sharp9&shape=/);
    expect(window.history.length).toBe(entries + 2);
  });

  it('picks a root the chords spell the other way as its enharmonic', () => {
    renderAt('?chord=am7');
    pickRoot('C♯');
    expect(heading()).toHaveTextContent(/^D♭m7 /);
    expect(pickedRoot()).toBe('D♭');
    pickRoot('G♭');
    expect(heading()).toHaveTextContent(/^F♯m7 /);
  });

  it('goes back to the chord before a pick', async () => {
    renderAt('?chord=am7');
    pickRoot('C');
    expect(heading()).toHaveTextContent(/^Cm7 /);
    window.history.back();
    await waitFor(() => expect(heading()).toHaveTextContent(/^Am7 /));
    expect(boardDots()).toEqual(['1:0', '2:2', '3:0', '4:1', '5:0']);
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

  it('shows the arpeggio in place of a shape, until a shape is chosen', () => {
    renderAt();
    expect(arpeggio()).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(arpeggio());
    expect(arpeggio()).toHaveAttribute('aria-pressed', 'true');
    // Every A, C, E and G from the nut to fret 15, all at full strength, and no shape chosen.
    expect(boardDots()).toHaveLength(34);
    expect(screen.getAllByTestId(/^dot-/).every(d => d.getAttribute('opacity') === '1')).toBe(true);
    expect([...shapes('Open'), ...shapes('Moveable')]
      .some(b => b.getAttribute('aria-pressed') === 'true')).toBe(false);
    expect(caption()).toHaveTextContent('Arpeggio · every A, C, E and G up to fret 15');
    expect(screen.getByRole('button', { name: 'Previous shape' })).toBeDisabled();
    // It stays picked for the next chord.
    pickRoot('C');
    fireEvent.change(typePicker(), { target: { value: 'M' } });
    expect(arpeggio()).toHaveAttribute('aria-pressed', 'true');
    expect(heading()).toHaveTextContent(/^C \(/);
    expect(caption()).toHaveTextContent('Arpeggio · every C, E and G up to fret 15');

    // Choosing a shape puts it back on the neck alone.
    fireEvent.click(shapes('Open')[0]);
    expect(arpeggio()).toHaveAttribute('aria-pressed', 'false');
    expect(boardDots()).toEqual(['1:3', '2:2', '3:0', '4:1', '5:0']);
  });

  it('swaps the chosen shape for the arpeggio and back, with the button or space', () => {
    renderAt();
    fireEvent.click(shapes('Open')[1]);
    const shape = boardDots();

    fireEvent.click(arpeggio());
    expect(boardDots()).toHaveLength(34);
    fireEvent.click(arpeggio());
    expect(arpeggio()).toHaveAttribute('aria-pressed', 'false');
    expect(shapes('Open')[1]).toHaveAttribute('aria-pressed', 'true');
    expect(boardDots()).toEqual(shape);

    // Space on the shape just clicked toggles the arpeggio, without clicking the shape again.
    shapes('Open')[1].focus();
    const press = fireEvent.keyDown(shapes('Open')[1], { key: ' ' });
    expect(press).toBe(false); // default prevented
    // ...and takes focus off it, so the browser draws no focus ring there.
    expect(document.activeElement).toBe(document.body);
    expect(arpeggio()).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(window, { key: ' ', repeat: true }); // held down
    expect(arpeggio()).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(window, { key: ' ' });
    expect(arpeggio()).toHaveAttribute('aria-pressed', 'false');
    expect(boardDots()).toEqual(shape);
  });

  it('leaves space alone in the chord menus', () => {
    renderAt();
    const menu = screen.getAllByRole('combobox')[0];
    expect(fireEvent.keyDown(menu, { key: ' ' })).toBe(true);
    expect(screen.getByRole('button', { name: 'Arpeggio' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('steps from the arpeggio to the first shape', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Arpeggio' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next shape' }));
    expect(caption()).toHaveTextContent(/^Open 1 of 3/);
    fireEvent.click(screen.getByRole('button', { name: 'Arpeggio' }));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(shapes('Open')[0]).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Arpeggio' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('says so when a chord has no open shape', () => {
    renderAt('?chord=cm6');
    expect(within(group('Open')).getByText('No open shape for Cm6.')).toBeInTheDocument();
    expect(caption()).toHaveTextContent(/^Moveable 1 of /);
  });
});

describe('ChordsPage, naming what is played', () => {
  it('opens on an open C for C, named', () => {
    renderAt('?chord=c');
    expect(heading()).toHaveTextContent(/^C \(1 3 5\)$/);
    expect(boardDots()).toEqual(OPEN_C);
    expect(names()[0]).toHaveTextContent('C');
    expect(names()[0]).toHaveAttribute('aria-pressed', 'true');
    expect(arpeggio()).toHaveAttribute('aria-pressed', 'false');
  });

  it('names the notes after a tap, and mutes a string tapped again', () => {
    renderAt('?chord=c');
    fireEvent.click(cell(5, 0)); // mutes the high E, which plays open
    expect(boardDots()).not.toContain('5:0');
    fireEvent.click(cell(4, 3)); // B string, fret 3: a D
    expect(heading()).toHaveTextContent(/^Cadd9/);
  });

  it('relabels against the root of the name picked', () => {
    renderAt('?chord=c');
    fireEvent.click(cell(5, 0));
    fireEvent.click(cell(5, 5)); // x-3-2-0-1-5: C E G C A
    expect(heading()).toHaveTextContent(/^C6 /);
    const am7 = names().find(n => n.textContent?.startsWith('Am7/C'))!;
    fireEvent.click(am7);
    expect(heading()).toHaveTextContent(/^Am7\/C /);
    expect(screen.getByTestId('chord-notes')).toHaveTextContent('A C E G');
  });

  it('clears the neck', () => {
    renderAt('?chord=c');
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(boardDots()).toEqual([]);
    expect(heading()).toHaveTextContent('Tap the neck');
    expect(screen.getByText('Tap two or more notes to name them.')).toBeInTheDocument();
    expect(arpeggio()).toBeDisabled();
    expect(typePicker()).toHaveValue('');
    expect(here()).toBe('/chords');
  });

  it('keeps the chord of a shape chosen from its list', () => {
    renderAt('?chord=c');
    const moveable = shapes('Moveable');
    fireEvent.click(moveable[0]);
    expect(moveable[0]).toHaveAttribute('aria-pressed', 'true');
    expect(heading()).toHaveTextContent(/^C /);
  });

  describe('with Gm7add11 on the neck', () => {
    const shape = (key: string) => document.querySelector<HTMLElement>(`[data-voicing="${key}"]`)!;
    /** Clears the neck and barres fret 3: G C F B♭ D G. */
    const barreGm7add11 = () => {
      fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
      for (let s = 0; s < 6; s++) fireEvent.click(cell(s, 3));
    };

    it('keeps the chord when a shape that leaves out its 5th is chosen', () => {
      renderAt('?chord=c');
      barreGm7add11();
      expect(heading()).toHaveTextContent(/^Gm7add11 /);
      fireEvent.click(shape('3-x-3-3-1-x')); // G F B♭ C: also every tone of C7sus4
      expect(heading()).toHaveTextContent(/^Gm7add11 \(no 5\) /);
      expect(screen.getByTestId('chord-notes')).toHaveTextContent('G B♭ D F C');
      expect(shape('3-x-3-3-1-x')).toHaveAttribute('aria-pressed', 'true');
      expect(shape('3-3-3-3-3-3')).toBeInTheDocument(); // still Gm7add11's shapes
      expect(names().map(n => n.querySelector('b')!.textContent)).toEqual(
        ['Gm7add11 (no 5)', 'C7sus4/G', 'G4', 'Fsus24/G'],
      );
    });

    it('keeps the chord through every shape stepped to with the arrow keys', () => {
      renderAt('?chord=c');
      barreGm7add11();
      const count = document.querySelectorAll('[data-voicing]').length;
      for (let i = 0; i < count; i++) {
        fireEvent.keyDown(window, { key: 'ArrowRight' });
        expect(heading()).toHaveTextContent(/^Gm7add11 /);
      }
    });

    it('keeps every shape showing when one of them is chosen', () => {
      renderAt('?chord=c');
      barreGm7add11();
      fireEvent.click(screen.getByRole('button', { name: /^Show all/ }));
      const all = document.querySelectorAll('[data-voicing]').length;
      fireEvent.click(shape('3-x-3-3-1-x'));
      expect(document.querySelectorAll('[data-voicing]')).toHaveLength(all);
    });

    it('still reads the shape as another chord when that name is picked', () => {
      renderAt('?chord=c');
      barreGm7add11();
      fireEvent.click(shape('3-x-3-3-1-x'));
      fireEvent.click(names()[1]);
      expect(heading()).toHaveTextContent(/^C7sus4\/G /);
    });

    it('names the notes afresh once the neck is tapped', () => {
      renderAt('?chord=c');
      barreGm7add11();
      fireEvent.click(shape('3-x-3-3-1-x'));
      fireEvent.click(cell(5, 3)); // another G: the same four notes, now tapped in
      expect(heading()).toHaveTextContent(/^C7sus4\/G /);
    });
  });

  it('swaps the shape for the arpeggio and back, with the button or space', () => {
    renderAt('?chord=c');
    fireEvent.click(arpeggio());
    expect(arpeggio()).toHaveAttribute('aria-pressed', 'true');
    // Every C, E and G up to fret 15, such as the open low E and its 3rd fret G.
    expect(boardDots()).toEqual(expect.arrayContaining(['0:0', '0:3', '5:15']));
    expect(caption()).toHaveTextContent('Arpeggio · every C, E and G up to fret 15');
    fireEvent.keyDown(window, { key: ' ' });
    expect(arpeggio()).toHaveAttribute('aria-pressed', 'false');
    expect(boardDots()).toEqual(OPEN_C);
    fireEvent.keyDown(window, { key: ' ' });
    fireEvent.keyDown(window, { key: ' ', repeat: true }); // held down
    expect(arpeggio()).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps the arpeggio on for another name, and relabels it', () => {
    renderAt('?chord=c');
    fireEvent.click(cell(5, 0));
    fireEvent.click(cell(5, 5)); // C6, or Am7/C
    fireEvent.click(arpeggio());
    fireEvent.click(names().find(n => n.textContent?.startsWith('Am7/C'))!);
    expect(arpeggio()).toHaveAttribute('aria-pressed', 'true');
    expect(caption()).toHaveTextContent('every A, C, E and G');
  });

  it('keeps the arpeggio on when a note is played, labelling only the notes played', () => {
    renderAt('?chord=c');
    fireEvent.click(arpeggio());
    fireEvent.click(cell(4, 3)); // B string, fret 3: Cadd9
    expect(arpeggio()).toHaveAttribute('aria-pressed', 'true');
    expect(heading()).toHaveTextContent(/^Cadd9/);
    expect(dotAt(4, 3)).toHaveTextContent('9');
    expect(dotAt(0, 0).textContent).toBe(''); // the open low E isn't played
  });

  it('toggles the arpeggio with space on a focused fret, without tapping it', () => {
    renderAt('?chord=c');
    cell(4, 3).focus();
    fireEvent.keyDown(cell(4, 3), { key: ' ' });
    fireEvent.keyUp(cell(4, 3), { key: ' ' });
    expect(arpeggio()).toHaveAttribute('aria-pressed', 'true');
    expect(heading()).toHaveTextContent(/^C /);
    expect(cell(4, 3)).not.toHaveFocus(); // no focus ring left on it
  });

  it('turns the arpeggio off when a shape is chosen or the neck cleared', () => {
    renderAt('?chord=c');
    fireEvent.click(arpeggio());
    const moveable = within(screen.getByRole('region', { name: 'Moveable shapes' })).getAllByRole('button');
    fireEvent.click(moveable[0]);
    expect(arpeggio()).toHaveAttribute('aria-pressed', 'false');
    expect(moveable[0]).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(arpeggio());
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(arpeggio()).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('ChordsPage, looking a chord up and changing it', () => {
  it('names the notes once a fret is moved, and the menus and URL follow', () => {
    renderAt('?chord=am7');
    fireEvent.click(cell(3, 2)); // x-0-2-2-1-0: the open Am
    expect(heading()).toHaveTextContent(/^Am \(/);
    expect(pickedRoot()).toBe('A');
    expect(typePicker()).toHaveValue('m');
    expect(here()).toBe('/chords?chord=am&shape=x-0-2-2-1-0');
    expect(caption()).toHaveTextContent(/^Open 1 of \d+ · /);
  });

  it('says when the frets are not one of the shapes, and › goes to the first', () => {
    renderAt('?chord=c');
    fireEvent.click(cell(5, 0));
    fireEvent.click(cell(5, 5)); // x-3-2-0-1-5
    expect(caption()).toHaveTextContent(/^Your shape · /);
    fireEvent.click(screen.getByRole('button', { name: 'Next shape' }));
    expect(caption()).toHaveTextContent(/^Open 1 of /);
  });

  it('names a shape linked without a chord afresh', () => {
    renderAt('?shape=x-3-2-0-1-0');
    expect(heading()).toHaveTextContent(/^C \(/);
    expect(here()).toBe('/chords?chord=c&shape=x-3-2-0-1-0');
  });

  it('puts the chosen name in the URL', () => {
    renderAt('?chord=c');
    fireEvent.click(cell(5, 0));
    fireEvent.click(cell(5, 5)); // C6, or Am7/C
    fireEvent.click(names().find(n => n.textContent?.startsWith('Am7/C'))!);
    expect(here()).toBe('/chords?chord=am7&shape=x-3-2-0-1-5');
  });

  it('shows no type in the menu for notes with no name, and picks from their lowest note', () => {
    renderAt('?shape=x-3-4-x-x-x'); // C and F♯: no chord
    expect(heading()).toHaveTextContent('No name');
    expect(typePicker()).toHaveValue('');
    expect(here()).toBe('/chords?shape=x-3-4-x-x-x');
    fireEvent.change(typePicker(), { target: { value: 'M' } });
    expect(heading()).toHaveTextContent(/^C \(/);
  });

  it('marks the muted strings of tapped frets on the neck', () => {
    renderAt('?chord=c');
    expect(mutedMarks()).toEqual(['muted-0']);
    fireEvent.click(cell(5, 0));
    expect(mutedMarks()).toEqual(['muted-0', 'muted-5']);
    expect(dotAt(4, 1)).toBeDefined();
  });
});

describe('ChordsPage, finding a chord by name', () => {
  const magnifier = () => screen.getByRole('button', { name: 'Find a chord by name' });
  const box = () => screen.getByRole('textbox', { name: 'Chord name' });
  const search = (text: string) => {
    fireEvent.change(box(), { target: { value: text } });
    fireEvent.keyDown(box(), { key: 'Enter' });
  };

  it('swaps the Type dropdown for a search box and finds a chord on Enter', () => {
    renderAt();
    const entries = window.history.length;
    fireEvent.click(magnifier());
    expect(screen.queryByRole('combobox', { name: 'Type' })).toBeNull();
    expect(box()).toHaveFocus();
    expect(magnifier()).toHaveAttribute('aria-pressed', 'true');
    search('f#m7b5');
    expect(heading()).toHaveTextContent('F♯m7♭5');
    expect(pickedRoot()).toBe('F♯');
    expect(typePicker()).toHaveValue('m7b5');
    expect(magnifier()).toHaveFocus();
    expect(here()).toMatch(/^\/chords\?chord=fsharpm7b5&shape=/);
    expect(window.history.length).toBe(entries + 1);
  });

  it('keeps the box open with a hint when nothing matches', () => {
    renderAt();
    fireEvent.click(magnifier());
    search('Hm7');
    expect(screen.getByText(/^No chord "Hm7"\./)).toBeInTheDocument();
    expect(box()).toHaveValue('Hm7');
    expect(heading()).toHaveTextContent('Am7');
    fireEvent.change(box(), { target: { value: 'Hm' } });
    expect(screen.queryByText(/^No chord/)).toBeNull();
  });

  it('closes on Esc, the magnifier or a click away, dropping the text', () => {
    renderAt();
    fireEvent.click(magnifier());
    fireEvent.change(box(), { target: { value: 'C7' } });
    fireEvent.keyDown(box(), { key: 'Escape' });
    expect(typePicker()).toHaveValue('m7');
    expect(magnifier()).toHaveFocus();

    fireEvent.click(magnifier());
    expect(box()).toHaveValue('');
    fireEvent.click(magnifier());
    expect(screen.queryByRole('textbox')).toBeNull();

    fireEvent.click(magnifier());
    fireEvent.blur(box());
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(heading()).toHaveTextContent('Am7');
  });

  it('opens on / but not while typing in a field', () => {
    renderAt();
    fireEvent.keyDown(document.body, { key: '/' });
    expect(box()).toHaveFocus();
    fireEvent.keyDown(box(), { key: '/' });
    expect(box()).toBeInTheDocument();
  });
});
