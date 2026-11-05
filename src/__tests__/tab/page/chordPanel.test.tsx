/**
 * The Tab rail's Chords panel (`docs/specs/2026-11-05-tab-chord-panel-design.md`, issue #251): a chord
 * name's Edit opens it at that chord, a shape picked changes the `\chord` definition, New chord defines
 * one, the cursor column's notes are named, and Insert writes a name, notes or both at the cursor.
 */
import { act, fireEvent, screen, within } from '@testing-library/react';
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { partOf } from '@/features/tab/clip';
import { layoutClip, type Layout } from '@/features/tab/layout';
import { textBox, type WordHit } from '@/features/tab/layoutText';
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

describe('opening the Chords panel', () => {
  it('a chord name’s Edit opens it at that chord, its stored shape marked', async () => {
    const layout = await open();
    pressWord(layout, { kind: 'chord', index: 0 }, 2);
    fireEvent.click(within(screen.getByRole('menu', { name: 'Selected' })).getByRole('menuitem', { name: 'Edit' }));
    expect(railButton('Chords')).toHaveAttribute('aria-pressed', 'true');
    expect(inPanel().getByRole('textbox', { name: 'Chord name' })).toHaveValue('G');
    const shapes = within(inPanel().getByRole('region', { name: 'Shapes' }));
    // Shapes are low string first, as the Chords page names them.
    expect(shapes.getByRole('button', { name: 'Shape 3-2-0-0-0-3' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Enter on a picked chord name opens it too', async () => {
    const layout = await open();
    pressWord(layout, { kind: 'chord', index: 0 });
    keys('Enter');
    expect(inPanel().getByRole('textbox', { name: 'Chord name' })).toHaveValue('G');
  });

  it('lists the track’s chords: each used one with its count, an unused one with ○', async () => {
    await open();
    fireEvent.click(railButton('Chords'));
    const list = within(inPanel().getByRole('region', { name: 'This track’s chords' }));
    expect(list.getByRole('button', { name: /^G/ })).toHaveTextContent('G1');
    expect(within(list.getByRole('button', { name: /^C/ })).getByRole('img', { name: 'Not used' })).toBeInTheDocument();
  });
});

describe('changing a chord’s shape', () => {
  it('Next shape gives the definition the next shape, keeping its show props and dropping nothing else', async () => {
    const layout = await open();
    pressWord(layout, { kind: 'chord', index: 0 });
    keys('Enter');
    fireEvent.click(inPanel().getByRole('button', { name: 'Next shape' }));
    const [g, c] = definitions();
    expect(g).toMatch(/^\\chord \("G"( \S+){6}\) \{showname true\}$/);
    expect(g).not.toBe('\\chord ("G" 3 0 0 0 2 3) {showname true}');
    expect(c).toBe('\\chord ("C" 0 1 0 2 3 x)');
  });

  it('a shape picked from the list is the one marked', async () => {
    await open();
    fireEvent.click(railButton('Chords'));
    fireEvent.click(within(inPanel().getByRole('region', { name: 'This track’s chords' })).getByRole('button', { name: /^C/ }));
    const shapes = within(inPanel().getByRole('region', { name: 'Shapes' }));
    const other = shapes.getAllByRole('button').find(b => b.getAttribute('aria-pressed') === 'false')!;
    fireEvent.click(other);
    expect(other).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('New chord', () => {
  it('names a chord for the set, with its first shape, unused, and gives the keys back to the tab', async () => {
    await open();
    fireEvent.click(railButton('Chords'));
    fireEvent.click(inPanel().getByRole('button', { name: '+ New chord' }));
    const field = inPanel().getByRole('textbox', { name: 'New chord name' });
    expect(field).toHaveFocus();
    fireEvent.change(field, { target: { value: 'Dsus2' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(definitions()).toContain('\\chord ("Dsus2" 0 3 2 0 x x)');
    // The tab's columns are as they were.
    expect(written()).not.toContain('{ch "Dsus2"}');
    const list = within(inPanel().getByRole('region', { name: 'This track’s chords' }));
    expect(within(list.getByRole('button', { name: /^Dsus2/ })).getByRole('img', { name: 'Not used' })).toBeInTheDocument();
    expect(inPanel().getByRole('textbox', { name: 'Chord name' })).toHaveValue('Dsus2');
  });

  it('a name that isn’t a chord is defined with no shape', async () => {
    await open();
    fireEvent.click(railButton('Chords'));
    fireEvent.click(inPanel().getByRole('button', { name: '+ New chord' }));
    const field = inPanel().getByRole('textbox', { name: 'New chord name' });
    fireEvent.change(field, { target: { value: 'Riff A' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(definitions()).toContain('\\chord ("Riff A")');
    expect(inPanel().getByText('“Riff A” isn’t a chord name, so it has no shapes.')).toBeInTheDocument();
  });

  it('Escape leaves the set as it was', async () => {
    await open();
    fireEvent.click(railButton('Chords'));
    fireEvent.click(inPanel().getByRole('button', { name: '+ New chord' }));
    const field = inPanel().getByRole('textbox', { name: 'New chord name' });
    fireEvent.change(field, { target: { value: 'Em' } });
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(definitions()).toHaveLength(2);
  });
});

describe('the cursor column', () => {
  it('names its notes; a name picked goes over the column', async () => {
    await open();
    act(() => editor().focus());
    keys('ArrowRight');
    fireEvent.click(railButton('Chords'));
    const chips = within(inPanel().getByRole('region', { name: 'These notes are' }));
    fireEvent.click(chips.getByRole('button', { name: 'C' }));
    expect(written()).toContain('{ch "C"}');
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
