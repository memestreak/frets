/**
 * The Tab rail's Chords panel (`docs/specs/2026-11-05-tab-chord-panel-design.md`, issues #251 and #400): the
 * Chord set as tiles, a page at a time; a tile's double-click or its menu's Edit opens Edit chord, where a
 * shape picked is the chord's at once and the name is renamed apart; Change chord opens the chord dialog +
 * opens (renames it, or another shape, or Save as new chord); the menu copies, renames and deletes an unused
 * chord; + adds a chord (looked up, the cursor column's, or drawn); moving the cursor changes nothing, and
 * Insert writes a name, notes or both at the cursor (in note input mode, at the Input length).
 */
import { act, fireEvent, screen, within } from '@testing-library/react';
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { partOf } from '@/features/tab/clip';
import { layoutClip, type Layout } from '@/features/tab/layout';
import { textBox, type WordHit } from '@/features/tab/layoutText';
import { CHORD_PANEL_KEY, countBadge, parseChordPanel } from '@/features/tab/ChordPanel';
import { setUpPage, renderAt, SLOW, editor, keys, alphaTexText } from './helpers';
import { paletteHeader } from '../tool';

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
const panel = () => screen.getByRole('region', { name: 'Chords' });
const inPanel = () => within(panel());

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
  const box = textBox(layout, hit)!;
  const at = { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 };
  fireEvent.pointerDown(drawing(), { ...at, button });
  if (button === 2) fireEvent.contextMenu(editor(), at);
}

const list = () => within(inPanel().getByRole('region', { name: 'Chord set' }));
const editorOf = (name: string) => within(inPanel().getByRole('group', { name }));
/** A chord's tile, named "G, Used 1 time" or "C, Not used". */
const tile = (name: string) => list().getByRole('button', { name: new RegExp(`^${name}, `) });
const queryTile = (name: string) => list().queryByRole('button', { name: new RegExp(`^${name}, `) });
/** The Insert under the tiles: "Insert at bar 1, beat 3" with the cursor on the tab, else "Insert". */
const insertButton = () => inPanel().getByRole('button', { name: /^Insert( at |$)/ });
/** Opens a tile's right-click menu. */
function menuOf(name: string) {
  fireEvent.contextMenu(tile(name), { clientX: 5, clientY: 5 });
  return within(screen.getByRole('menu', { name }));
}
/** Edit chord on a chord, from its menu. */
function editFromMenu(name: string) {
  fireEvent.click(menuOf(name).getByRole('menuitem', { name: 'Edit' }));
  return editorOf(`Edit ${name}`);
}
/** The chord dialog on a chord: Edit chord, then Change chord. */
function changeChord(name: string) {
  fireEvent.click(editFromMenu(name).getByRole('button', { name: 'Change chord' }));
  return editorOf(`Change ${name}`);
}

describe('a Chord set tile\'s dot', () => {
  it('counts the uses: none for an unused chord, 99 spelled out, 99+ past it', () => {
    expect(countBadge(0)).toBeNull();
    expect(countBadge(1)).toBe('1');
    expect(countBadge(99)).toBe('99');
    expect(countBadge(100)).toBe('99+');
  });
});

describe('the Chords panel', () => {
  it('shows the Chord set as tiles: a used one says how often on hover and in its dot, an unused one has no dot or tint; no icons, no name field or shapes', async () => {
    await open();
    fireEvent.click(paletteHeader('Chords'));
    expect(tile('G')).toHaveAttribute('title', 'Used 1 time');
    expect(tile('G').querySelector('.chord-panel-count')).toHaveTextContent('1');
    expect(tile('C')).toHaveAttribute('title', 'Not used');
    expect(tile('C').querySelector('.chord-panel-count')).toBeNull();
    expect(tile('C')).not.toHaveAttribute('data-unused');
    expect(tile('G').querySelector('svg')).not.toBeNull();
    expect(inPanel().queryByRole('textbox')).toBeNull();
    expect(inPanel().queryByRole('button', { name: /^Shape / })).toBeNull();
    // No Edit or Delete icons: the menu and a double-click do those. + sits in the heading.
    expect(list().queryByRole('button', { name: 'Edit G' })).toBeNull();
    expect(list().queryByRole('button', { name: 'Delete C' })).toBeNull();
    expect(list().getByRole('button', { name: 'Add a chord' })).toBeInTheDocument();
    // Two chords make one page: no pager.
    expect(inPanel().queryByRole('button', { name: 'More chords' })).toBeNull();
  });

  it('shows eight tiles a page; the carets page through them, the count saying where, a short last page keeping its room', async () => {
    const many = [
      '\\title "Many"', '\\ts (4 4)',
      ...['A', 'B', 'C', 'D', 'E', 'F', 'G', 'Am', 'Bm', 'Em'].map(n => `\\chord ("${n}")`),
      'r.1 |',
    ].join('\n');
    renderAt(`#tab=${encodeURIComponent(many)}`);
    await screen.findByRole('heading', { name: 'Many' }, SLOW);
    fireEvent.click(paletteHeader('Chords'));
    const tiles = () => within(list().getByRole('group', { name: 'Chords' })).getAllByRole('button');
    expect(tiles().map(t => t.getAttribute('aria-label')!.split(',')[0])).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'Am']);
    expect(inPanel().getByText('1 / 2')).toBeInTheDocument();
    expect(inPanel().getByRole('button', { name: 'Previous chords' })).toBeDisabled();
    fireEvent.click(inPanel().getByRole('button', { name: 'More chords' }));
    expect(tiles().map(t => t.getAttribute('aria-label')!.split(',')[0])).toEqual(['Bm', 'Em']);
    expect(inPanel().getByText('2 / 2')).toBeInTheDocument();
    expect(inPanel().getByRole('button', { name: 'More chords' })).toBeDisabled();
    expect(list().getByRole('group', { name: 'Chords' }).querySelectorAll('.chord-panel-tile-empty')).toHaveLength(6);
  });

  it('puts as many tiles on a row as the panel holds, two rows a page: ten fit one page at 532px, six a page at 200px (issue #431)', async () => {
    const many = [
      '\\title "Many"', '\\ts (4 4)',
      ...['A', 'B', 'C', 'D', 'E', 'F', 'G', 'Am', 'Bm', 'Em'].map(n => `\\chord ("${n}")`),
      'r.1 |',
    ].join('\n');
    // jsdom lays nothing out: give the Chords panel's contents a width.
    let width = 532;
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get(this: HTMLElement) { return this.classList.contains('chord-panel') ? width : 0; },
    });
    try {
      renderAt(`#tab=${encodeURIComponent(many)}`);
      await screen.findByRole('heading', { name: 'Many' }, SLOW);
      fireEvent.click(paletteHeader('Chords'));
      const grid = () => list().getByRole('group', { name: 'Chords' });
      // (532 + 4) / 60: eight to a row.
      expect(grid().style.gridTemplateColumns).toBe('repeat(8, minmax(0, 1fr))');
      expect(within(grid()).getAllByRole('button')).toHaveLength(10);
      expect(inPanel().queryByRole('button', { name: 'More chords' })).toBeNull();
      // Narrower, on a fresh open: three to a row, six a page.
      width = 200;
      fireEvent.click(paletteHeader('Chords'));
      fireEvent.click(paletteHeader('Chords'));
      expect(grid().style.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))');
      expect(within(grid()).getAllByRole('button')).toHaveLength(6);
      expect(inPanel().getByText('1 / 2')).toBeInTheDocument();
    } finally {
      // Back to jsdom's own, on Element.
      delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
    }
  });

  it('a right-click on a tile picks it and opens its menu: Insert, Edit, Rename, Copy to new chord, and Delete only when unused', async () => {
    await open();
    fireEvent.click(paletteHeader('Chords'));
    expect(menuOf('C').getAllByRole('menuitem').map(i => i.textContent)).toEqual(['Insert', 'Edit', 'Rename', 'Copy to new chord', 'Delete']);
    expect(tile('C')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(screen.getByRole('menu', { name: 'C' }), { key: 'Escape' });
    expect(menuOf('G').queryByRole('menuitem', { name: 'Delete' })).toBeNull();
  });
});

describe('Edit chord', () => {
  it('a chord name’s Edit opens the Chords panel and that chord’s editor, its stored shape picked', async () => {
    const layout = await open();
    pressWord(layout, { kind: 'chord', index: 0 }, 2);
    fireEvent.click(within(screen.getByRole('menu', { name: 'Selected' })).getByRole('menuitem', { name: 'Edit' }));
    expect(paletteHeader('Chords')).toHaveAttribute('aria-expanded', 'true');
    // Shapes are low string first, as the Chords page names them.
    expect(editorOf('Edit G').getByRole('button', { name: 'Shape 3-2-0-0-0-3' })).toHaveAttribute('aria-pressed', 'true');
    expect(tile('G')).toHaveAttribute('aria-pressed', 'true');
    // In the panel, not a modal.
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('a Chord chart chord’s Edit expands a collapsed column, Chords open and the palettes open before still open (issue #454)', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse palettes' }));
    fireEvent.doubleClick(screen.getByRole('button', { name: 'G, edit' }));
    expect(paletteHeader('Chords')).toHaveAttribute('aria-expanded', 'true');
    expect(paletteHeader('Notes')).toHaveAttribute('aria-expanded', 'true');
    expect(editorOf('Edit G').getByRole('button', { name: 'Shape 3-2-0-0-0-3' })).toHaveAttribute('aria-pressed', 'true');
    // Folding Chords drops the ask: opening it again shows the Chord set, not Edit G.
    fireEvent.click(paletteHeader('Chords'));
    fireEvent.click(paletteHeader('Chords'));
    expect(screen.queryByRole('group', { name: 'Edit G' })).toBeNull();
  });

  it('a Chord chart chord: a press picks it, Esc lets it go; a double-click, Enter and its right-click Edit open it (Jeremy, 2026-11-07)', async () => {
    await open();
    const chartChord = () => screen.getByRole('button', { name: 'G, edit' });
    fireEvent.click(chartChord());
    expect(chartChord()).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(chartChord(), { key: 'Escape' });
    expect(chartChord()).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('group', { name: 'Edit G' })).toBeNull();

    fireEvent.doubleClick(chartChord());
    expect(paletteHeader('Chords')).toHaveAttribute('aria-expanded', 'true');
    expect(editorOf('Edit G').getByRole('button', { name: 'Shape 3-2-0-0-0-3' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(inPanel().getByRole('button', { name: 'Done' }));
    expect(inPanel().queryByRole('group', { name: 'Edit G' })).toBeNull();

    chartChord().focus();
    fireEvent.keyDown(chartChord(), { key: 'Enter' });
    expect(inPanel().getByRole('group', { name: 'Edit G' })).toBeInTheDocument();
    fireEvent.click(inPanel().getByRole('button', { name: 'Done' }));

    fireEvent.contextMenu(chartChord(), { clientX: 5, clientY: 5 });
    expect(chartChord()).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(screen.getByRole('menu', { name: 'Chord' })).getByRole('menuitem', { name: 'Edit' }));
    expect(screen.queryByRole('menu', { name: 'Chord' })).toBeNull();
    expect(inPanel().getByRole('group', { name: 'Edit G' })).toBeInTheDocument();
    expect(chartChord()).toHaveAttribute('aria-pressed', 'false');
  });

  it('a Chord chart chord of another track shows that track and opens there', async () => {
    const two = [
      '\\title "Two"',
      '\\track "Gtr I"', '\\ts (4 4)', '\\chord ("G" 3 0 0 0 2 3)', '3.6.1{ch "G"} |',
      '\\track "Gtr II"', '\\chord ("D" 2 3 2 0 x x)', '0.4.1{ch "D"} |',
    ].join('\n');
    renderAt(`#tab=${encodeURIComponent(two)}`);
    await screen.findByRole('heading', { name: 'Two' }, SLOW);
    fireEvent.doubleClick(screen.getByRole('button', { name: 'D, edit' }));
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'Track' }).value).toBe('1');
    expect(inPanel().getByRole('group', { name: 'Edit D' })).toBeInTheDocument();
  });

  it('Enter on a picked chord name opens it too', async () => {
    const layout = await open();
    pressWord(layout, { kind: 'chord', index: 0 });
    keys('Enter');
    expect(inPanel().getByRole('group', { name: 'Edit G' })).toBeInTheDocument();
  });

  it('picking a tile doesn’t open it; a double-click and its menu’s Edit do; + stays in the heading', async () => {
    await open();
    fireEvent.click(paletteHeader('Chords'));
    fireEvent.click(tile('G'));
    expect(inPanel().queryByRole('group', { name: 'Edit G' })).toBeNull();
    fireEvent.doubleClick(tile('G'));
    expect(inPanel().getByRole('heading', { name: 'Edit chord' })).toBeInTheDocument();
    expect(list().getByRole('button', { name: 'Add a chord' })).toBeInTheDocument();
    fireEvent.click(editorOf('Edit G').getByRole('button', { name: 'Done' }));
    expect(inPanel().queryByRole('group', { name: 'Edit G' })).toBeNull();
    expect(editFromMenu('C').getByRole('button', { name: 'C: double-click or F2 to rename' })).toBeInTheDocument();
  });

  it('shows only the chord’s own shapes and Change chord: no root, type, name field or Draw your own', async () => {
    await open();
    fireEvent.click(paletteHeader('Chords'));
    const edit = editFromMenu('G');
    expect(edit.getByText('Shapes')).toBeInTheDocument();
    expect(edit.getAllByRole('button', { name: /^Shape / }).length).toBeGreaterThan(1);
    expect(edit.queryByRole('radio')).toBeNull();
    expect(edit.queryByRole('combobox', { name: 'Type' })).toBeNull();
    expect(edit.queryByRole('textbox')).toBeNull();
    expect(edit.queryByRole('button', { name: 'Draw your own' })).toBeNull();
    expect(edit.getByRole('button', { name: 'Change chord' })).toBeInTheDocument();
    expect(edit.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  it('a shape picked is the chord’s at once, the column naming it kept; undo takes it back; Done and Esc close', async () => {
    await open();
    fireEvent.click(paletteHeader('Chords'));
    const edit = editFromMenu('G');
    const other = edit.getAllByRole('button', { name: /^Shape / }).find(b => b.getAttribute('aria-pressed') === 'false')!;
    const key = other.getAttribute('aria-label')!.replace('Shape ', '');
    fireEvent.click(other);
    expect(other).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(edit.getByRole('button', { name: 'Done' }));
    expect(definitions()[0]).toBe(`\\chord ("G" ${key.split('-').reverse().join(' ')}) {showname true}`);
    expect(written()).toContain('{ch "G"}');
    keys({ key: 'z', ctrlKey: true });
    expect(definitions()[0]).toBe('\\chord ("G" 3 0 0 0 2 3) {showname true}');
    editFromMenu('G');
    act(() => (document.activeElement as HTMLElement | null)?.blur());
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(inPanel().queryByRole('group', { name: 'Edit G' })).toBeNull();
  });

  it.each([
    ['a double-click on its name', (edit: ReturnType<typeof editorOf>) => fireEvent.doubleClick(edit.getByRole('button', { name: /double-click or F2 to rename/ }))],
    ['F2 on its name', (edit: ReturnType<typeof editorOf>) => fireEvent.keyDown(edit.getByRole('button', { name: /double-click or F2 to rename/ }), { key: 'F2' })],
  ] as const)('%s renames it, and every column naming it; a name in the set is refused; Esc leaves it', async (_how, startRename) => {
    await open();
    fireEvent.click(paletteHeader('Chords'));
    let edit = editFromMenu('G');
    startRename(edit);
    const field = () => editorOf('Edit G').getByRole('textbox', { name: 'Name' });
    expect(field()).toHaveValue('G');
    fireEvent.change(field(), { target: { value: 'C' } });
    expect(editorOf('Edit G').getByText('“C” is already in the Chord set.')).toBeInTheDocument();
    fireEvent.keyDown(field(), { key: 'Escape' });
    expect(definitions()[0]).toBe('\\chord ("G" 3 0 0 0 2 3) {showname true}');
    edit = editorOf('Edit G');
    startRename(edit);
    fireEvent.change(field(), { target: { value: 'G barre' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    // Only the name changes; Edit chord stays open on it.
    expect(definitions()[0]).toBe('\\chord ("G barre" 3 0 0 0 2 3) {showname true}');
    expect(written()).toContain('{ch "G barre"}');
    expect(tile('G barre')).toHaveAttribute('title', 'Used 1 time');
    expect(inPanel().getByRole('group', { name: 'Edit G barre' })).toBeInTheDocument();
  });

  it('the menu’s Rename opens it with the name field open', async () => {
    await open();
    fireEvent.click(paletteHeader('Chords'));
    fireEvent.click(menuOf('C').getByRole('menuitem', { name: 'Rename' }));
    const field = editorOf('Edit C').getByRole('textbox', { name: 'Name' });
    expect(field).toHaveFocus();
    fireEvent.change(field, { target: { value: 'C open' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(definitions()[1]).toBe('\\chord ("C open" 0 1 0 2 3 x)');
  });
});

describe('Change chord: the chord dialog + opens, on the chord', () => {
  it('opens on the chord’s root and type, its name following it; another shape and Save keeps its show props, back on Edit chord', async () => {
    await open();
    fireEvent.click(paletteHeader('Chords'));
    let edit = changeChord('G');
    expect(inPanel().getByRole('heading', { name: 'Change chord' })).toBeInTheDocument();
    expect(edit.getByRole('radio', { name: 'G' })).toHaveAttribute('aria-checked', 'true');
    expect(edit.getByRole('combobox', { name: 'Type' })).toHaveValue('M');
    expect(edit.getByRole('textbox', { name: 'Name' })).toHaveValue('');
    expect(edit.getByRole('textbox', { name: 'Name' })).toHaveAttribute('placeholder', 'G');
    expect(edit.getByRole('button', { name: 'Draw your own' })).toBeInTheDocument();
    expect(edit.getByText('Leave it empty and the name follows the chord (G).')).toBeInTheDocument();
    // Save chord can be pressed with nothing changed: it goes back, saving nothing (Jeremy, 2026-11-07).
    expect(edit.getByRole('button', { name: 'Save chord' })).toBeEnabled();
    fireEvent.click(edit.getByRole('button', { name: 'Save chord' }));
    expect(inPanel().getByRole('group', { name: 'Edit G' })).toBeInTheDocument();
    expect(definitions()[0]).toBe('\\chord ("G" 3 0 0 0 2 3) {showname true}');
    fireEvent.click(editorOf('Edit G').getByRole('button', { name: 'Change chord' }));
    edit = editorOf('Change G');
    const other = edit.getAllByRole('button', { name: /^Shape / }).find(b => b.getAttribute('aria-pressed') === 'false')!;
    fireEvent.click(other);
    // Nothing changes until Save.
    expect(definitions()[0]).toBe('\\chord ("G" 3 0 0 0 2 3) {showname true}');
    fireEvent.click(editorOf('Change G').getByRole('button', { name: 'Save chord' }));
    expect(inPanel().queryByRole('group', { name: 'Change G' })).toBeNull();
    expect(inPanel().getByRole('group', { name: 'Edit G' })).toBeInTheDocument();
    const [g, c] = definitions();
    expect(g).toMatch(/^\\chord \("G"( \S+){6}\) \{showname true\}$/);
    expect(g).not.toBe('\\chord ("G" 3 0 0 0 2 3) {showname true}');
    expect(c).toBe('\\chord ("C" 0 1 0 2 3 x)');
  });

  it('Cancel and Esc go back to Edit chord, changing nothing', async () => {
    await open();
    fireEvent.click(paletteHeader('Chords'));
    let edit = changeChord('C');
    const other = edit.getAllByRole('button', { name: /^Shape / }).find(b => b.getAttribute('aria-pressed') === 'false')!;
    fireEvent.click(other);
    expect(other).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(edit.getByRole('button', { name: 'Cancel' }));
    expect(inPanel().queryByRole('group', { name: 'Change C' })).toBeNull();
    expect(inPanel().getByRole('group', { name: 'Edit C' })).toBeInTheDocument();
    fireEvent.click(editorOf('Edit C').getByRole('button', { name: 'Change chord' }));
    edit = editorOf('Change C');
    fireEvent.change(edit.getByRole('textbox', { name: 'Name' }), { target: { value: 'Cee' } });
    fireEvent.keyDown(edit.getByRole('textbox', { name: 'Name' }), { key: 'Escape' });
    expect(inPanel().queryByRole('group', { name: 'Change C' })).toBeNull();
    expect(inPanel().getByRole('group', { name: 'Edit C' })).toBeInTheDocument();
    expect(definitions()[1]).toBe('\\chord ("C" 0 1 0 2 3 x)');
  });

  it('a new name renames the chord and the columns naming it; a name in the set can’t be taken', async () => {
    await open();
    fireEvent.click(paletteHeader('Chords'));
    const edit = changeChord('G');
    const field = edit.getByRole('textbox', { name: 'Name' });
    fireEvent.change(field, { target: { value: 'C' } });
    expect(edit.getByText('“C” is already in the Chord set.')).toBeInTheDocument();
    expect(edit.getByRole('button', { name: 'Save chord' })).toBeDisabled();
    fireEvent.change(field, { target: { value: 'G barre' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(definitions()[0]).toBe('\\chord ("G barre" 3 0 0 0 2 3) {showname true}');
    expect(written()).toContain('{ch "G barre"}');
    expect(tile('G barre')).toHaveAttribute('title', 'Used 1 time');
  });

  it('Save as new chord adds a changed copy under a new name, picked; the chord opened and its column stay as they were', async () => {
    await open();
    fireEvent.click(paletteHeader('Chords'));
    const edit = changeChord('G');
    const saveNew = edit.getByRole('button', { name: 'Save as new chord' });
    expect(saveNew).toBeDisabled();
    expect(edit.queryByText('Give it a new name to save it as a new chord.')).toBeNull();
    const other = edit.getAllByRole('button', { name: /^Shape / }).find(b => b.getAttribute('aria-pressed') === 'false')!;
    fireEvent.click(other);
    // Only the shape changed: Save chord would change G; a new chord needs a new name.
    expect(saveNew).toBeDisabled();
    expect(edit.getByText('Give it a new name to save it as a new chord.')).toBeInTheDocument();
    const field = edit.getByRole('textbox', { name: 'Name' });
    fireEvent.change(field, { target: { value: 'C' } });
    expect(saveNew).toBeDisabled();
    fireEvent.change(field, { target: { value: 'G high' } });
    fireEvent.click(saveNew);
    expect(inPanel().queryByRole('group', { name: 'Change G' })).toBeNull();
    const key = other.getAttribute('aria-label')!.replace('Shape ', '');
    expect(definitions()).toEqual([
      '\\chord ("G" 3 0 0 0 2 3) {showname true}',
      '\\chord ("C" 0 1 0 2 3 x)',
      `\\chord ("G high" ${key.split('-').reverse().join(' ')})`,
    ]);
    expect(written()).toContain('{ch "G"}');
    expect(written()).not.toContain('{ch "G high"}');
    expect(tile('G high')).toHaveAttribute('aria-pressed', 'true');
    expect(tile('G high')).toHaveAttribute('title', 'Not used');
  });

  it('a change that makes another chord names it, so it can be saved as a new chord straight away', async () => {
    await open();
    fireEvent.click(paletteHeader('Chords'));
    const edit = changeChord('C');
    fireEvent.change(edit.getByRole('combobox', { name: 'Type' }), { target: { value: 'm' } });
    expect(edit.getByRole('textbox', { name: 'Name' })).toHaveAttribute('placeholder', 'Cm');
    expect(edit.queryByText('Give it a new name to save it as a new chord.')).toBeNull();
    fireEvent.click(edit.getByRole('button', { name: 'Save as new chord' }));
    expect(definitions()[1]).toBe('\\chord ("C" 0 1 0 2 3 x)');
    expect(definitions()[2]).toMatch(/^\\chord \("Cm" /);
  });

  it('Copy to new chord opens the dialog on a copy named "C 2", Add chord adding it', async () => {
    await open();
    fireEvent.click(paletteHeader('Chords'));
    fireEvent.click(menuOf('C').getByRole('menuitem', { name: 'Copy to new chord' }));
    const copy = editorOf('Copy C to a new chord');
    expect(copy.getByRole('textbox', { name: 'Name' })).toHaveValue('C 2');
    fireEvent.click(copy.getByRole('button', { name: 'Add chord' }));
    expect(definitions()).toContain('\\chord ("C 2" 0 1 0 2 3 x)');
  });

  it('Save as new chord is offered only on a chord opened, not on +', async () => {
    await open();
    fireEvent.click(paletteHeader('Chords'));
    fireEvent.click(list().getByRole('button', { name: 'Add a chord' }));
    expect(editorOf('Add a chord').queryByRole('button', { name: 'Save as new chord' })).toBeNull();
  });
});

describe('Edit chord and Change chord follow the chord picked (Jeremy, 2026-11-07)', () => {
  it('a tile pressed moves Edit chord to it', async () => {
    await open();
    fireEvent.click(paletteHeader('Chords'));
    editFromMenu('G');
    fireEvent.click(tile('C'));
    expect(inPanel().queryByRole('group', { name: 'Edit G' })).toBeNull();
    expect(editorOf('Edit C').getByRole('button', { name: 'Shape x-3-2-0-1-0' })).toHaveAttribute('aria-pressed', 'true');
    expect(tile('C')).toHaveAttribute('aria-pressed', 'true');
  });

  it('following never scrolls the page: the editor takes the keys with preventScroll', async () => {
    await open();
    fireEvent.click(paletteHeader('Chords'));
    editFromMenu('G');
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    fireEvent.click(tile('C'));
    expect(focus).toHaveBeenCalled();
    for (const [options] of focus.mock.calls) expect(options).toEqual({ preventScroll: true });
    focus.mockRestore();
  });

  it('a tile pressed moves Change chord to it, dropping what wasn’t saved', async () => {
    await open();
    fireEvent.click(paletteHeader('Chords'));
    const change = changeChord('G');
    fireEvent.click(change.getAllByRole('button', { name: /^Shape / }).find(b => b.getAttribute('aria-pressed') === 'false')!);
    fireEvent.click(tile('C'));
    expect(inPanel().queryByRole('group', { name: 'Change G' })).toBeNull();
    expect(editorOf('Change C').getByRole('radio', { name: 'C' })).toHaveAttribute('aria-checked', 'true');
    expect(definitions()[0]).toBe('\\chord ("G" 3 0 0 0 2 3) {showname true}');
  });

  it('a chord name picked in the tab, and a Chord chart chord pressed, move it too', async () => {
    const layout = await open();
    fireEvent.click(paletteHeader('Chords'));
    editFromMenu('C');
    pressWord(layout, { kind: 'chord', index: 0 });
    expect(inPanel().getByRole('group', { name: 'Edit G' })).toBeInTheDocument();
    editFromMenu('C');
    fireEvent.click(screen.getByRole('button', { name: 'G, edit' }));
    expect(inPanel().getByRole('group', { name: 'Edit G' })).toBeInTheDocument();
  });

  it('a new chord’s dialog stays: + and Copy to new chord don’t follow', async () => {
    await open();
    fireEvent.click(paletteHeader('Chords'));
    fireEvent.click(list().getByRole('button', { name: 'Add a chord' }));
    fireEvent.click(tile('C'));
    expect(inPanel().getByRole('group', { name: 'Add a chord' })).toBeInTheDocument();
  });
});

describe('Add a chord (+)', () => {
  /** Opens + on the panel. */
  async function openAdd() {
    await open();
    fireEvent.click(paletteHeader('Chords'));
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
    expect(tile('Dsus2')).toHaveAttribute('title', 'Not used');
    expect(tile('Dsus2')).toHaveAttribute('aria-pressed', 'true');
    expect(insertButton()).toBeInTheDocument();
  });

  it('Esc closes it after a shape is pressed, the focus let go to the page; Esc in the search closes the search only', async () => {
    const add = await openAdd();
    fireEvent.click(add.getByRole('radio', { name: 'A' }));
    fireEvent.click(add.getAllByRole('button', { name: /^Shape / })[0]);
    // A pressed button lets go of the focus (useLetGoAfterUse), so Esc comes from the page.
    act(() => (document.activeElement as HTMLElement | null)?.blur());
    fireEvent.click(add.getByRole('button', { name: 'Find a chord by name' }));
    fireEvent.keyDown(add.getByRole('textbox', { name: 'Chord name to look up' }), { key: 'Escape' });
    expect(add.queryByRole('textbox', { name: 'Chord name to look up' })).toBeNull();
    expect(inPanel().getByRole('group', { name: 'Add a chord' })).toBeInTheDocument();
    act(() => (document.activeElement as HTMLElement | null)?.blur());
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(inPanel().queryByRole('group', { name: 'Add a chord' })).toBeNull();
    expect(definitions()).not.toContain('\\chord ("A"');
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
    expect(add.getByText('“G” is already in the Chord set.')).toBeInTheDocument();
    expect(add.getByRole('button', { name: 'Add chord' })).toBeDisabled();
    fireEvent.change(field, { target: { value: 'Riff A' } });
    fireEvent.click(add.getByRole('button', { name: 'Add chord' }));
    expect(definitions()).toContain('\\chord ("Riff A")');
  });

  it('with the cursor on a column of notes: offers their fingering first, picked, and names them', async () => {
    await open();
    act(() => editor().focus());
    keys('ArrowRight');
    fireEvent.click(paletteHeader('Chords'));
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
    expect(tile('My C').querySelector('svg')).not.toBeNull();
    const change = changeChord('My C');
    expect(change.getByRole('radio', { name: 'C' })).toHaveAttribute('aria-checked', 'true');
    expect(change.getByRole('combobox', { name: 'Type' })).toHaveValue('M');
    expect(change.getByRole('textbox', { name: 'Name' })).toHaveValue('My C');
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
  it('moving the cursor changes nothing in the panel but where Insert says it writes (Jeremy, 2026-11-06 and 2026-11-07)', async () => {
    await open();
    act(() => editor().focus());
    fireEvent.click(paletteHeader('Chords'));
    // Nothing picked yet: the cursor's G is not picked.
    expect(tile('G')).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(tile('C'));
    expect(insertButton()).toHaveTextContent('Insert at bar 1, beat 1');
    /** The panel, Insert's place left out. */
    const rest = () => panel().innerHTML.replace(/Insert at bar \d+, beat [^<]+/, '');
    const before = rest();
    keys('ArrowRight');
    expect(insertButton()).toHaveTextContent('Insert at bar 1, beat 2');
    expect(rest()).toBe(before);
    keys('ArrowRight');
    expect(insertButton()).toHaveTextContent('Insert at bar 1, beat 3');
    expect(rest()).toBe(before);
    expect(tile('C')).toHaveAttribute('aria-pressed', 'true');
  });

  it.each([
    ['Name', /\{ch "C"\}/, false],
    ['Notes', /\(0\.1 1\.2 0\.3 2\.4 3\.5\)\.4 \(0\.1 1\.2 0\.3 2\.4 3\.5\)\.4/, true],
    ['Both', /\(0\.1 1\.2 0\.3 2\.4 3\.5\)\.4\{ch "C"\}/, true],
  ] as const)('Insert %s writes at the cursor', async (what, expected, notes) => {
    await open();
    act(() => editor().focus());
    keys('ArrowRight', 'ArrowRight');
    fireEvent.click(paletteHeader('Chords'));
    fireEvent.click(tile('C'));
    fireEvent.click(within(inPanel().getByRole('group', { name: 'Insert' })).getByRole('button', { name: what }));
    fireEvent.click(insertButton());
    expect(written()).toMatch(expected);
    // The third column had no notes; Name leaves it a rest.
    expect(written().includes('r.4{ch "C"}')).toBe(!notes);
  });
});

describe('Insert in note input mode', () => {
  /** The cursor on the third column (a quarter rest), in note input mode with an eighth as its length. */
  async function inputAtRest() {
    await open();
    act(() => editor().focus());
    keys('ArrowRight', 'ArrowRight', 'n', { key: '$', shiftKey: true, code: 'Digit4' });
    fireEvent.click(paletteHeader('Chords'));
    fireEvent.click(tile('C'));
  }

  it('writes the chord at the Input length and moves on, as a note typed does: twice is two eighths', async () => {
    await inputAtRest();
    fireEvent.click(insertButton());
    fireEvent.click(insertButton());
    // The written text wraps long lines; the bar is read as one.
    expect(written().replace(/\s+/g, ' ')).toContain('(0.1 1.2 0.3 2.4 3.5).8{ch "C"} (0.1 1.2 0.3 2.4 3.5).8{ch "C"} r.4 |');
  });

  it('Notes writes the notes alone at the Input length', async () => {
    await inputAtRest();
    fireEvent.click(within(inPanel().getByRole('group', { name: 'Insert' })).getByRole('button', { name: 'Notes' }));
    fireEvent.click(insertButton());
    expect(written()).toContain('(0.1 1.2 0.3 2.4 3.5).8 r.8 r.4 |');
  });

  it('Name puts the name over the cursor’s column, its length kept, the cursor where it was', async () => {
    await inputAtRest();
    fireEvent.click(within(inPanel().getByRole('group', { name: 'Insert' })).getByRole('button', { name: 'Name' }));
    fireEvent.click(insertButton());
    expect(written()).toContain('r.4{ch "C"} r.4 |');
  });
});

describe('deleting a chord', () => {
  it('an unused chord’s menu has Delete, which takes it out of the set, nothing left picked', async () => {
    await open();
    fireEvent.click(paletteHeader('Chords'));
    fireEvent.click(menuOf('C').getByRole('menuitem', { name: 'Delete' }));
    expect(definitions()).toEqual(['\\chord ("G" 3 0 0 0 2 3) {showname true}']);
    expect(queryTile('C')).toBeNull();
    expect(tile('G')).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('Hear', () => {
  it('is off at first, in the panel’s head; its toggle turns it on and keeps it in the Playback preferences', async () => {
    await open();
    fireEvent.click(paletteHeader('Chords'));
    const toggle = within(panel()).getByRole('button', { name: 'Hear chords as you pick them' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    // Right of the palette's name in its header, not in its sections.
    expect(toggle.closest('.tab-stack-head')).not.toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(JSON.parse(localStorage.getItem('frets.tab.playback')!)).toMatchObject({ hearChords: true });
  });
});

describe('folding the list', () => {
  it('folds from its heading, kept across visits', async () => {
    await open();
    fireEvent.click(paletteHeader('Chords'));
    const heading = () => inPanel().getByRole('button', { name: 'Chord set' });
    fireEvent.click(heading());
    expect(heading()).toHaveAttribute('aria-expanded', 'false');
    expect(inPanel().queryByRole('button', { name: /^G, / })).toBeNull();
    // + stays in the heading, folded or not.
    expect(inPanel().getByRole('button', { name: 'Add a chord' })).toBeInTheDocument();
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
