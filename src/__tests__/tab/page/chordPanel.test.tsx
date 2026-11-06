/**
 * The Tab rail's Chords panel (`docs/specs/2026-11-05-tab-chord-panel-design.md`, issue #251): a chord
 * name's Edit opens it at that chord, a shape picked changes the `\chord` definition, an unused chord is
 * deleted, moving the cursor changes nothing, and Insert writes a name, notes or both at the cursor.
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
const dialog = (name: string | RegExp) => within(screen.getByRole('dialog', { name }));

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
    expect(list().getByRole('button', { name: 'Look up a chord' })).toBeInTheDocument();
  });
});

describe('the Chord dialog', () => {
  it('a chord name’s Edit opens the Chords panel and that chord’s dialog, its stored shape marked', async () => {
    const layout = await open();
    pressWord(layout, { kind: 'chord', index: 0 }, 2);
    fireEvent.click(within(screen.getByRole('menu', { name: 'Selected' })).getByRole('menuitem', { name: 'Edit' }));
    expect(railButton('Chords')).toHaveAttribute('aria-pressed', 'true');
    // Shapes are low string first, as the Chords page names them.
    expect(dialog('Edit G').getByRole('button', { name: 'Shape 3-2-0-0-0-3' })).toHaveAttribute('aria-pressed', 'true');
    expect(list().getByRole('button', { name: /^G/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Enter on a picked chord name opens it too', async () => {
    const layout = await open();
    pressWord(layout, { kind: 'chord', index: 0 });
    keys('Enter');
    expect(screen.getByRole('dialog', { name: 'Edit G' })).toBeInTheDocument();
  });

  it('a list entry’s Edit opens its dialog; another shape and OK gives the definition that shape, keeping its show props', async () => {
    await open();
    fireEvent.click(railButton('Chords'));
    fireEvent.click(list().getByRole('button', { name: 'Edit G' }));
    fireEvent.click(dialog('Edit G').getByRole('button', { name: 'Next shape' }));
    // Nothing changes until OK.
    expect(definitions()[0]).toBe('\\chord ("G" 3 0 0 0 2 3) {showname true}');
    fireEvent.click(list().getByRole('button', { name: 'Edit G' }));
    fireEvent.click(dialog('Edit G').getByRole('button', { name: 'Next shape' }));
    fireEvent.click(dialog('Edit G').getByRole('button', { name: 'OK' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    const [g, c] = definitions();
    expect(g).toMatch(/^\\chord \("G"( \S+){6}\) \{showname true\}$/);
    expect(g).not.toBe('\\chord ("G" 3 0 0 0 2 3) {showname true}');
    expect(c).toBe('\\chord ("C" 0 1 0 2 3 x)');
  });

  it('Cancel leaves the chord as it was', async () => {
    await open();
    fireEvent.click(railButton('Chords'));
    fireEvent.click(list().getByRole('button', { name: 'Edit C' }));
    const other = dialog('Edit C').getAllByRole('button', { name: /^Shape / }).find(b => b.getAttribute('aria-pressed') === 'false')!;
    fireEvent.click(other);
    expect(other).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(dialog('Edit C').getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(definitions()[1]).toBe('\\chord ("C" 0 1 0 2 3 x)');
  });

  it('+ looks a chord up: its shapes for the name typed, and the set unchanged', async () => {
    await open();
    fireEvent.click(railButton('Chords'));
    fireEvent.click(list().getByRole('button', { name: 'Look up a chord' }));
    const look = dialog('Look up a chord');
    expect(look.getByText('Type a chord name to see its shapes.')).toBeInTheDocument();
    fireEvent.change(look.getByRole('textbox', { name: 'Chord name' }), { target: { value: 'Dsus2' } });
    expect(look.getByRole('button', { name: 'Shape x-x-0-2-3-0' })).toBeInTheDocument();
    fireEvent.change(look.getByRole('textbox', { name: 'Chord name' }), { target: { value: 'N.C.' } });
    expect(look.getByText('“N.C.” isn’t a chord name, so it has no shapes.')).toBeInTheDocument();
    fireEvent.click(look.getByRole('button', { name: 'Close' }));
    expect(definitions()).toHaveLength(2);
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
