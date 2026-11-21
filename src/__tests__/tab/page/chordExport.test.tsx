/**
 * Exporting the Tab page's chords as the Chords page does (issue #531,
 * `docs/specs/2026-11-21-tab-chord-export-design.md`): a Chord set tile's, a Chord chart chord's and a chord
 * name's menu add Copy as PNG and Export options…, for a chord with a diagram only; the image is drawn on the
 * track's own tuning and named as the Chord set names the chord; the Export dialog is the Chords page's.
 */
import { act, fireEvent, screen, within } from '@testing-library/react';
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { partOf } from '@/features/tab/clip';
import { layoutClip, type Layout } from '@/features/tab/layout';
import { textBox, type WordHit } from '@/features/tab/layoutText';
import { exportShapeOf, lowFirst } from '@/features/tab/chordShapes';
import { diagramSvg } from '@/components/chords/export/exportImage';
import { DEFAULT_EXPORT_STYLE, LIGHT_PALETTE } from '@/components/chords/export/exportStyle';
import { COPY_AS_PNG, EXPORT_OPTIONS } from '@/components/chords/export/useShapeExport';
import { chordOf } from '@/lib/theory/chords';
import { TUNING } from '@/lib/music';
import { setUpPage, renderAt, SLOW, editor } from './helpers';
import { paletteHeader } from '../tool';

setUpPage();

/** jsdom draws no images, so the clipboard copy is stubbed; the SVG is real. */
const copied = vi.hoisted(() => ({ png: vi.fn(() => Promise.resolve('Copied as PNG')) }));
vi.mock('@/components/chords/export/exportImage', async importOriginal => ({
  ...await importOriginal<typeof import('@/components/chords/export/exportImage')>(),
  copyPng: copied.png,
}));

/**
 * Drop D: a D whose open low D is its root (a shape that fits no chord in standard tuning), a G with a
 * shape, and an Am typed over a column with no definition, so no diagram.
 */
const TEXT = [
  '\\title "Drop D chords"',
  '\\tuning (E4 B3 G3 D3 A2 D2)',
  '\\ts (4 4)',
  '\\chord ("D" 2 3 2 0 0 0)',
  '\\chord ("G" 3 0 0 0 2 5)',
  '0.6.4{ch "D"} 5.6.4{ch "G"} 0.5.4{ch "Am"} r.4 |',
].join('\n');

async function open(): Promise<Layout> {
  renderAt(`#tab=${encodeURIComponent(TEXT)}`);
  await screen.findByRole('heading', { name: 'Drop D chords' }, SLOW);
  return layoutClip(part(), 800);
}
function part() {
  const read = readAlphaTexWith(alphaTab, TEXT);
  if (!read.ok) throw new Error(read.errors.join('\n'));
  return partOf(read.clip);
}

const drawing = () => screen.getByRole('img', { name: /drawn as/ });
const panel = () => within(screen.getByRole('region', { name: 'Chords' }));
const tile = (name: string) => panel().getByRole('button', { name: new RegExp(`^${name}, `) });
const items = (menu: HTMLElement) => within(menu).getAllByRole('menuitem').map(i => i.textContent);

function rightClickWord(layout: Layout, hit: WordHit) {
  const box = textBox(layout, hit)!;
  const at = { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2, button: 2 };
  fireEvent.pointerDown(drawing(), at);
  fireEvent.contextMenu(editor(), at);
  return screen.getByRole('menu', { name: 'Selected' });
}

/** The D as the export takes it: its own shape, low string first, on the track's drop D. */
const D_EXPORT = { chord: chordOf('D', 'M'), shape: [0, 0, 0, 2, 3, 2], name: 'D', tuning: lowFirst(part()) };

beforeEach(() => copied.png.mockClear());

it('names its items as the Chords page does, from one place', () => {
  expect([COPY_AS_PNG, EXPORT_OPTIONS]).toEqual(['Copy as PNG', 'Export options…']);
});

describe('the chord the export takes', () => {
  it('is the definition\'s shape on the track\'s tuning, named as the set names it', () => {
    const shape = exportShapeOf(part(), 'D');
    expect(shape).toEqual(D_EXPORT);
    // Drop D, low string first: its lowest string a D.
    expect(shape!.tuning![0] % 12).toBe(2);
  });

  it('is none for a name with no definition, or a shape with no notes', () => {
    expect(exportShapeOf(part(), 'Am')).toBeNull();
    expect(exportShapeOf({ ...part(), chords: [{ name: 'Am', frets: [null, null, null, null, null, null] }] }, 'Am')).toBeNull();
  });

  it('colours each dot by its tone on that tuning, not standard\'s', () => {
    const style = { ...DEFAULT_EXPORT_STYLE, colours: 'degrees' as const };
    // The low string's 10th fret: D, D7's root, in standard tuning; C, its ♭7, on drop D.
    const one = { chord: chordOf('D', '7'), shape: [10, null, null, null, null, null], name: 'D7' };
    // As the browser writes a colour set in a style.
    const fill = (hex: string) => `fill: rgb(${[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
    const { root, seventh } = LIGHT_PALETTE.degree;
    expect(diagramSvg({ ...one, tuning: TUNING }, style)).toContain(fill(root.fill));
    const dropD = diagramSvg({ ...one, tuning: lowFirst(part()) }, style);
    expect(dropD).toContain(fill(seventh.fill));
    expect(dropD).not.toContain(fill(root.fill));
  });
});

describe('a Chord set tile', () => {
  it('has Copy as PNG and Export options… before Delete, and copies the chord on its track\'s tuning', async () => {
    await open();
    fireEvent.click(paletteHeader('Chords'));
    fireEvent.contextMenu(tile('D'), { clientX: 5, clientY: 5 });
    const menu = screen.getByRole('menu', { name: 'D' });
    expect(items(menu)).toEqual(['Insert', 'Edit', 'Rename', 'Copy to new chord', 'Copy as PNG', 'Export options…']);
    await act(async () => {
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Copy as PNG' }));
    });
    expect(copied.png).toHaveBeenCalledWith(D_EXPORT, DEFAULT_EXPORT_STYLE);
    expect(screen.getByText('Copied as PNG')).toBeInTheDocument();
  });

  it('has no export items for a chord with no diagram', async () => {
    await open();
    fireEvent.click(paletteHeader('Chords'));
    fireEvent.contextMenu(tile('Am'), { clientX: 5, clientY: 5 });
    expect(items(screen.getByRole('menu', { name: 'Am' }))).toEqual(['Insert', 'Edit', 'Rename', 'Copy to new chord']);
  });

  it('opens the Chords page\'s Export dialog on Export options…, its Name the chord\'s', async () => {
    await open();
    fireEvent.click(paletteHeader('Chords'));
    fireEvent.contextMenu(tile('G'), { clientX: 5, clientY: 5 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export options…' }));
    // Its shape's lowest string named by the track's tuning: D on drop D.
    const dialog = screen.getByRole('dialog', { name: 'Export G, root on D · frets 2–5' });
    expect(within(dialog).getByRole<HTMLInputElement>('textbox', { name: 'Name' }).value).toBe('G');
    expect(within(dialog).getByRole('button', { name: 'Copy SVG' })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog', { name: /^Export G/ })).toBeNull();
  });
});

describe('a Chord chart chord', () => {
  it('has Edit, then Copy as PNG and Export options…', async () => {
    await open();
    fireEvent.contextMenu(screen.getByRole('button', { name: 'D, edit' }), { clientX: 5, clientY: 5 });
    const menu = screen.getByRole('menu', { name: 'Chord' });
    expect(items(menu)).toEqual(['Edit', 'Copy as PNG', 'Export options…']);
    await act(async () => {
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Copy as PNG' }));
    });
    expect(copied.png).toHaveBeenCalledWith(D_EXPORT, DEFAULT_EXPORT_STYLE);
  });
});

describe('a chord name over the music', () => {
  it('with a diagram: Edit, Copy as PNG, Export options…, Delete', async () => {
    const layout = await open();
    expect(items(rightClickWord(layout, { kind: 'chord', index: 0 }))).toEqual(['Edit', 'Copy as PNG', 'Export options…', 'Delete']);
  });

  it('with none: Edit and Delete only', async () => {
    const layout = await open();
    expect(items(rightClickWord(layout, { kind: 'chord', index: 2 }))).toEqual(['Edit', 'Delete']);
  });
});
