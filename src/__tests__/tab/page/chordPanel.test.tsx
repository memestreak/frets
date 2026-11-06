/**
 * The Tab rail's Chords panel (`docs/specs/2026-11-05-tab-chord-panel-design.md`, issue #251): a chord
 * name's Edit opens its chord editor in the panel, which renames it or gives it another shape; an unused
 * chord is deleted; + adds a chord (looked up, the cursor column's, or drawn); moving the cursor
 * changes nothing, and Insert writes a name, notes or both at the cursor (in note input, at the Input length).
 */
import { act, fireEvent, screen, within } from '@testing-library/react';
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { partOf } from '@/features/tab/clip';
import { layoutClip, type Layout } from '@/features/tab/layout';
import { textBox, type WordHit } from '@/features/tab/layoutText';
import { CHORD_PANEL_KEY, parseChordPanel } from '@/features/tab/ChordPanel';
import { setUpPage, renderAt, SLOW, editor, keys, alphaTexText } from './helpers';

setUpPage();

/** A G with a definition that shows its name, an unused C, and a column of C's notes. */
const TEXT = [
  '\\title "Chords"',
  '\\ts (4 4)',
  '\\chord ("G" 3 0 0 0 2 3) {showname true}',
  '\\chord ("C" 0 1 0 2 3 x)',
  '3.1.4{ch "G"} (0.1 1.2 0.3 2.4 3.5).4 r.4 r.4 |',
].join('\n');

async function open(): Promise<Layout> {
  renderAt(`#tab=${encodeURIComponent(TEXT)}`);
  await screen.findByRole('heading', { name: 'Chords' }, SLOW);
  const read = readAlphaTexWith(alphaTab, TEXT);
  if (!read.ok) throw new Error(read.errors.join('\n'));
  return layoutClip(partOf(read.clip), 800);
}

const drawing = () => screen.getByRole('img', { name: /drawn as/ });
const panel = () => screen.getByRole('complementary', { name: 'Chords' });
const inPanel = () => within(panel());
const railButton = (name: string) => within(screen.getByRole('navigation', { name: 'Panels' })).getByRole('button', { name });
/** The clip as alphaTex, read from the AlphaTex view, then back on the tab with the keys there. */
function written(): string {
  fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
  const text = alphaTexText();
  fireEvent.click(screen.getByRole('button', { name: 'Notation' }));
  act(() => editor().focus());
  return text;
}
const definitions = () => written().split('\n').filter(l => l.startsWith('\\chord'));

function pressWord(layout: Layout, hit: WordHit, button = 0) {
  const box = textBox(layout, hit, null)!;
  const at = { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 };
  fireEvent.pointerDown(drawing(), { ...at, button });
  if (button === 2) fireEvent.contextMenu(editor(), at);
}

const list = () => within(inPanel().getByRole('region', { name: 'This track’s chords' }));
const editorOf = (name: string) => within(inPanel().getByRole('group', { name }));

describe('the Chords panel', () => {
  it('lists the track’s chords: each used one with its count, an unused one with ○; no name field or shapes', async () => {
    await open();
    fireEvent.click(railButton('Chords'));
    expect(list().getByRole('button', { name: /^G/ })).toHaveTextContent('G1');
    expect(within(list().getByRole('button', { name: /^C/ })).getByRole('img', { name: 'Not used' })).toBeInTheDocument();
    expect(inPanel().queryByRole('textbox')).toBeNull();
    expect(inPanel().queryByRole('button', { name: /^Shape / })).toBeNull();
    // Each chord has Edit; + under the list looks one up.
    expect(list().getByRole('button', { name: 'Edit G' })).toBeInTheDocument();
    expect(list().getByRole('button', { name: 'Add a chord' })).toBeInTheDocument();
  });
});

describe('the chord editor: Edit', () => {
  it('a chord name’s Edit opens the Chords panel and that chord’s editor, its stored shape picked', async () => {
    const layout = await open();
    pressWord(layout, { kind: 'chord', index: 0 }, 2);
    fireEvent.click(within(screen.getByRole('menu', { name: 'Selected' })).getByRole('menuitem', { name: 'Edit' }));
    expect(railButton('Chords')).toHaveAttribute('aria-pressed', 'true');
    // Shapes are low string first, as the Chords page names them.
    expect(editorOf('Edit G').getByRole('button', { name: 'Shape 3-2-0-0-0-3' })).toHaveAttribute('aria-pressed', 'true');
    expect(list().getByRole('button', { name: /^G/ })).toHaveAttribute('aria-pressed', 'true');
    // In the panel, not a modal.
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Enter on a picked chord name opens it too', async () => {
    const layout = await open();
    pressWord(layout, { kind: 'chord', index: 0 });
    keys('Enter');
    expect(inPanel().getByRole('group', { name: 'Edit G' })).toBeInTheDocument();
  });

  it('picking a chord in the list doesn’t open it; its Edit and a double-click do', async () => {
    await open();
    fireEvent.click(railButton('Chords'));
    fireEvent.click(list().getByRole('button', { name: /^G/ }));
    expect(inPanel().queryByRole('group', { name: 'Edit G' })).toBeNull();
    expect(list().getByRole('button', { name: 'Add a chord' })).toBeInTheDocument();
    fireEvent.click(list().getByRole('button', { name: 'Edit G' }));
    expect(inPanel().getByRole('group', { name: 'Edit G' })).toBeInTheDocument();
    // The + is hidden while the editor is open.
    expect(list().queryByRole('button', { name: 'Add a chord' })).toBeNull();
    fireEvent.click(editorOf('Edit G').getByRole('button', { name: 'Cancel' }));
    fireEvent.doubleClick(list().getByRole('button', { name: /^C/ }));
    expect(inPanel().getByRole('group', { name: 'Edit C' })).toBeInTheDocument();
  });

  it('opens on the chord’s root and type, its name following it; another shape and Save keeps its show props', async () => {
    await open();
    fireEvent.click(railButton('Chords'));
    fireEvent.click(list().getByRole('button', { name: 'Edit G' }));
    const edit = editorOf('Edit G');
    expect(edit.getByRole('radio', { name: 'G' })).toHaveAttribute('aria-checked', 'true');
    expect(edit.getByRole('combobox', { name: 'Type' })).toHaveValue('M');
    expect(edit.getByRole('textbox', { name: 'Name' })).toHaveValue('');
    expect(edit.getByRole('textbox', { name: 'Name' })).toHaveAttribute('placeholder', 'G');
    expect(edit.getByRole('button', { name: 'Save chord' })).toBeDisabled();
    const other = edit.getAllByRole('button', { name: /^Shape / }).find(b => b.getAttribute('aria-pressed') === 'false')!;
    fireEvent.click(other);
    fireEvent.click(edit.getByRole('button', { name: 'Save chord' }));
    expect(inPanel().queryByRole('group', { name: 'Edit G' })).toBeNull();
    const [g, c] = definitions();
    expect(g).toMatch(/^\\chord \("G"( \S+){6}\) \{showname true\}$/);
    expect(g).not.toBe('\\chord ("G" 3 0 0 0 2 3) {showname true}');
    expect(c).toBe('\\chord ("C" 0 1 0 2 3 x)');
  });

  it('Cancel and Esc close it, changing nothing', async () => {
    await open();
    fireEvent.click(railButton('Chords'));
    fireEvent.click(list().getByRole('button', { name: 'Edit C' }));
    const other = editorOf('Edit C').getAllByRole('button', { name: /^Shape / }).find(b => b.getAttribute('aria-pressed') === 'false')!;
    fireEvent.click(other);
    expect(other).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(editorOf('Edit C').getByRole('button', { name: 'Cancel' }));
    expect(inPanel().queryByRole('group', { name: 'Edit C' })).toBeNull();
    fireEvent.click(list().getByRole('button', { name: 'Edit C' }));
    fireEvent.change(editorOf('Edit C').getByRole('textbox', { name: 'Name' }), { target: { value: 'Cee' } });
    fireEvent.keyDown(editorOf('Edit C').getByRole('textbox', { name: 'Name' }), { key: 'Escape' });
    expect(inPanel().queryByRole('group', { name: 'Edit C' })).toBeNull();
    expect(definitions()[1]).toBe('\\chord ("C" 0 1 0 2 3 x)');
  });

  it('a new name renames the chord and the columns naming it; a name in the set can’t be taken', async () => {
    await open();
    fireEvent.click(railButton('Chords'));
    fireEvent.click(list().getByRole('button', { name: 'Edit G' }));
    const field = editorOf('Edit G').getByRole('textbox', { name: 'Name' });
    fireEvent.change(field, { target: { value: 'C' } });
    expect(editorOf('Edit G').getByText('“C” is already in this track’s chords.')).toBeInTheDocument();
    expect(editorOf('Edit G').getByRole('button', { name: 'Save chord' })).toBeDisabled();
    fireEvent.change(field, { target: { value: 'G barre' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(definitions()[0]).toBe('\\chord ("G barre" 3 0 0 0 2 3) {showname true}');
    expect(written()).toContain('{ch "G barre"}');
    expect(list().getByRole('button', { name: /^G barre/ })).toHaveTextContent('G barre1');
  });
});

describe('the chord editor: Add', () => {
  /** Opens + on the panel. */
  async function openAdd() {
    await open();
    fireEvent.click(railButton('Chords'));
    fireEvent.click(list().getByRole('button', { name: 'Add a chord' }));
    return editorOf('Add a chord');
  }

  it('looks a chord up by root and type and adds it with the shape picked, unused and picked, the columns as they were', async () => {
    const add = await openAdd();
    // The cursor's first column is one note: nothing to name, no fingering, no name yet.
    expect(add.queryByRole('group', { name: 'The notes at the cursor are' })).toBeNull();
    expect(add.getByRole('button', { name: 'Add chord' })).toBeDisabled();
    fireEvent.click(add.getByRole('radio', { name: 'D' }));
    fireEvent.change(add.getByRole('combobox', { name: 'Type' }), { target: { value: 'sus2' } });
    // The first shape is picked until another is.
    expect(add.getByRole('button', { name: 'Shape x-x-0-2-3-0' })).toHaveAttribute('aria-pressed', 'true');
    expect(add.getByRole('textbox', { name: 'Name' })).toHaveAttribute('placeholder', 'Dsus2');
    fireEvent.click(add.getByRole('button', { name: 'Add chord' }));
    expect(inPanel().queryByRole('group', { name: 'Add a chord' })).toBeNull();
    expect(definitions()).toContain('\\chord ("Dsus2" 0 3 2 0 x x)');
    expect(written()).not.toContain('{ch "Dsus2"}');
    expect(within(list().getByRole('button', { name: /^Dsus2/ })).getByRole('img', { name: 'Not used' })).toBeInTheDocument();
    expect(list().getByRole('button', { name: /^Dsus2/ })).toHaveAttribute('aria-pressed', 'true');
    expect(inPanel().getByRole('button', { name: 'Insert Dsus2' })).toBeInTheDocument();
  });

  it('adds the shape picked, not the first, under its own name; Enter in Name adds too', async () => {
    const add = await openAdd();
    fireEvent.click(add.getByRole('button', { name: 'Find a chord by name' }));
    const search = add.getByRole('textbox', { name: 'Chord name to look up' });
    fireEvent.change(search, { target: { value: 'Hendrix' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(add.getByText(/No chord “Hendrix”/)).toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'Em' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(add.getByRole('radio', { name: 'E' })).toHaveAttribute('aria-checked', 'true');
    expect(add.getByRole('combobox', { name: 'Type' })).toHaveValue('m');
    const [first, second] = add.getAllByRole('button', { name: /^Shape / });
    fireEvent.click(second);
    expect(first).toHaveAttribute('aria-pressed', 'false');
    const key = second.getAttribute('aria-label')!.replace('Shape ', '');
    const field = add.getByRole('textbox', { name: 'Name' });
    fireEvent.change(field, { target: { value: 'E minor/7' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(definitions()).toContain(`\\chord ("E minor/7" ${key.split('-').reverse().join(' ')})`);
  });

  it('a name with no shape is added with none; a name in the set isn’t added again', async () => {
    const add = await openAdd();
    const field = add.getByRole('textbox', { name: 'Name' });
    fireEvent.change(field, { target: { value: 'G' } });
    expect(add.getByText('“G” is already in this track’s chords.')).toBeInTheDocument();
    expect(add.getByRole('button', { name: 'Add chord' })).toBeDisabled();
    fireEvent.change(field, { target: { value: 'Riff A' } });
    fireEvent.click(add.getByRole('button', { name: 'Add chord' }));
    expect(definitions()).toContain('\\chord ("Riff A")');
  });

  it('with the cursor on a column of notes: offers their fingering first, picked, and names them', async () => {
    await open();
    act(() => editor().focus());
    keys('ArrowRight');
    fireEvent.click(railButton('Chords'));
    fireEvent.click(list().getByRole('button', { name: 'Add a chord' }));
    const add = editorOf('Add a chord');
    const field = add.getByRole('textbox', { name: 'Name' });
    expect(field).toHaveAttribute('placeholder', 'C');
    expect(add.getByRole('button', { name: 'Shape x-3-2-0-1-0, at the cursor' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(add.getByRole('group', { name: 'The notes at the cursor are' })).getByRole('button', { name: 'C' }));
    expect(field).toHaveValue('C');
    fireEvent.change(field, { target: { value: 'My C' } });
    fireEvent.click(add.getByRole('button', { name: 'Add chord' }));
    expect(definitions()).toContain('\\chord ("My C" 0 1 0 2 3 x)');
    // Its diagram in the list, though "My C" isn't a chord name; and it opens on C major, its name its own.
    expect(list().getByRole('button', { name: /^My C/ }).querySelector('svg')).not.toBeNull();
    fireEvent.click(list().getByRole('button', { name: 'Edit My C' }));
    expect(editorOf('Edit My C').getByRole('radio', { name: 'C' })).toHaveAttribute('aria-checked', 'true');
    expect(editorOf('Edit My C').getByRole('combobox', { name: 'Type' })).toHaveValue('M');
    expect(editorOf('Edit My C').getByRole('textbox', { name: 'Name' })).toHaveValue('My C');
  });

  it('draws your own: a press puts a finger on a string, again lifts it; beside the nut, open turns muted', async () => {
    const add = await openAdd();
    fireEvent.click(add.getByRole('button', { name: 'Draw your own' }));
    const editor = within(add.getByRole('group', { name: 'Draw a fingering' }));
    fireEvent.click(editor.getByRole('button', { name: 'String 1, fret 3' }));
    expect(editor.getByRole('button', { name: 'String 1, fret 3' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(editor.getByRole('button', { name: 'String 6, fret 3' }));
    fireEvent.click(editor.getByRole('button', { name: 'String 5, fret 2' }));
    for (const s of [2, 3, 4]) fireEvent.click(editor.getByRole('button', { name: `String ${s}: muted` }));
    // The drawn notes are named: x-x-x-x-x-3 and so on make G.
    expect(within(add.getByRole('group', { name: 'These notes are' })).getByRole('button', { name: 'G' })).toBeInTheDocument();
    fireEvent.click(editor.getByRole('button', { name: 'String 2: open' }));
    expect(editor.getByRole('button', { name: 'String 2: muted' })).toBeInTheDocument();
    fireEvent.click(editor.getByRole('button', { name: 'String 2: muted' }));
    // "Higher frets" moves the frets shown, not the shape.
    fireEvent.click(add.getByRole('button', { name: 'Higher frets' }));
    expect(add.getByText('Fret 2')).toBeInTheDocument();
    expect(editor.getByRole('button', { name: 'String 1, fret 3' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(add.getByRole('textbox', { name: 'Name' }), { target: { value: 'G mine' } });
    fireEvent.click(add.getByRole('button', { name: 'Add chord' }));
    expect(definitions()).toContain('\\chord ("G mine" 3 0 0 0 2 3)');
  });
});

describe('the cursor column', () => {
  it('moving the cursor changes nothing in the panel (Jeremy, 2026-11-06)', async () => {
    await open();
    act(() => editor().focus());
    fireEvent.click(railButton('Chords'));
    // Nothing picked yet: the cursor's G is not picked.
    expect(list().getByRole('button', { name: /^G/ })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(list().getByRole('button', { name: /^C/ }));
    const before = panel().innerHTML;
    keys('ArrowRight');
    expect(panel().innerHTML).toBe(before);
    keys('ArrowRight');
    expect(panel().innerHTML).toBe(before);
    expect(inPanel().getByRole('button', { name: 'Insert C' })).toBeInTheDocument();
  });

  it.each([
    ['Name', /\{ch "C"\}/, false],
    ['Notes', /\(0\.1 1\.2 0\.3 2\.4 3\.5\)\.4 \(0\.1 1\.2 0\.3 2\.4 3\.5\)\.4/, true],
    ['Both', /\(0\.1 1\.2 0\.3 2\.4 3\.5\)\.4\{ch "C"\}/, true],
  ] as const)('Insert %s writes at the cursor', async (what, expected, notes) => {
    await open();
    act(() => editor().focus());
    keys('ArrowRight', 'ArrowRight');
    fireEvent.click(railButton('Chords'));
    fireEvent.click(within(inPanel().getByRole('region', { name: 'This track’s chords' })).getByRole('button', { name: /^C/ }));
    fireEvent.click(within(inPanel().getByRole('group', { name: 'Insert' })).getByRole('button', { name: what }));
    fireEvent.click(inPanel().getByRole('button', { name: 'Insert C' }));
    expect(written()).toMatch(expected);
    // The third column had no notes; Name leaves it a rest.
    expect(written().includes('r.4{ch "C"}')).toBe(!notes);
  });
});

describe('Insert in note input', () => {
  /** The cursor on the third column (a quarter rest), in note input with an eighth as its length. */
  async function inputAtRest() {
    await open();
    act(() => editor().focus());
    keys('ArrowRight', 'ArrowRight', 'n', { key: '$', shiftKey: true, code: 'Digit4' });
    fireEvent.click(railButton('Chords'));
    fireEvent.click(list().getByRole('button', { name: /^C/ }));
  }

  it('writes the chord at the Input length and moves on, as a note typed does: twice is two eighths', async () => {
    await inputAtRest();
    fireEvent.click(inPanel().getByRole('button', { name: 'Insert C' }));
    fireEvent.click(inPanel().getByRole('button', { name: 'Insert C' }));
    // The written text wraps long lines; the bar is read as one.
    expect(written().replace(/\s+/g, ' ')).toContain('(0.1 1.2 0.3 2.4 3.5).8{ch "C"} (0.1 1.2 0.3 2.4 3.5).8{ch "C"} r.4 |');
  });

  it('Notes writes the notes alone at the Input length', async () => {
    await inputAtRest();
    fireEvent.click(within(inPanel().getByRole('group', { name: 'Insert' })).getByRole('button', { name: 'Notes' }));
    fireEvent.click(inPanel().getByRole('button', { name: 'Insert C' }));
    expect(written()).toContain('(0.1 1.2 0.3 2.4 3.5).8 r.8 r.4 |');
  });

  it('Name puts the name over the cursor’s column, its length kept, the cursor where it was', async () => {
    await inputAtRest();
    fireEvent.click(within(inPanel().getByRole('group', { name: 'Insert' })).getByRole('button', { name: 'Name' }));
    fireEvent.click(inPanel().getByRole('button', { name: 'Insert C' }));
    expect(written()).toContain('r.4{ch "C"} r.4 |');
  });
});

describe('deleting a chord', () => {
  const list = () => within(inPanel().getByRole('region', { name: 'This track’s chords' }));

  it('an unused chord has a trash can, which takes it out of the set, nothing left picked', async () => {
    await open();
    fireEvent.click(railButton('Chords'));
    fireEvent.click(list().getByRole('button', { name: /^C/ }));
    fireEvent.click(list().getByRole('button', { name: 'Delete C' }));
    expect(definitions()).toEqual(['\\chord ("G" 3 0 0 0 2 3) {showname true}']);
    expect(list().queryByRole('button', { name: /^C/ })).toBeNull();
    expect(list().getByRole('button', { name: /^G/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('a chord a column uses has none', async () => {
    await open();
    fireEvent.click(railButton('Chords'));
    expect(list().queryByRole('button', { name: 'Delete G' })).toBeNull();
  });
});

describe('Hear', () => {
  it('is off at first, in the panel’s head; its toggle turns it on and keeps it in the Playback preferences', async () => {
    await open();
    fireEvent.click(railButton('Chords'));
    const toggle = within(screen.getByRole('complementary', { name: 'Chords' })).getByRole('button', { name: 'Hear chords as you pick them' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    // Right of the panel's title, not in its sections.
    expect(toggle.closest('.tab-rail-panel-head')).not.toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(JSON.parse(localStorage.getItem('frets.tab.playback')!)).toMatchObject({ hearChords: true });
  });
});

describe('folding the list', () => {
  it('folds from its heading, kept across visits', async () => {
    await open();
    fireEvent.click(railButton('Chords'));
    const heading = () => inPanel().getByRole('button', { name: 'This track’s chords' });
    fireEvent.click(heading());
    expect(heading()).toHaveAttribute('aria-expanded', 'false');
    expect(inPanel().queryByRole('button', { name: /^G1/ })).toBeNull();
    expect(JSON.parse(localStorage.getItem(CHORD_PANEL_KEY)!)).toEqual({ folded: ['chords'] });
    fireEvent.click(heading());
    expect(JSON.parse(localStorage.getItem(CHORD_PANEL_KEY)!)).toEqual({ folded: [] });
  });

  it('reads what was kept, each id checked', () => {
    expect(parseChordPanel(JSON.stringify({ folded: ['chords', 'shape', 3] }))).toEqual(['chords']);
    expect(parseChordPanel('not json')).toEqual([]);
    expect(parseChordPanel(null)).toEqual([]);
  });
});
