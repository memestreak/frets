/**
 * Export and copy selected bars (`docs/specs/2026-11-21-tab-export-bars-design.md`, issue #532): the right-click
 * menu's Copy as PNG and Export options…, on the bars a selection touches, else the bar pressed.
 */
import { vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { partOf } from '@/features/tab/clip';
import { layoutClip, stringY } from '@/features/tab/layout';
import { TAB_EXPORT_KEY } from '@/features/tab/exportTab';
import { setUpPage, openWith, editor, keys, notice, alphaTex, renderAt, SLOW } from './helpers';

const copied = vi.hoisted(() => [] as string[]);
vi.mock('@/components/chords/export/exportImage', async original => ({
  ...(await original<typeof import('@/components/chords/export/exportImage')>()),
  copySvgAsPng: async (svg: string) => {
    copied.push(svg);
    return 'Copied as PNG';
  },
}));

setUpPage();

const FOUR = '0.6.1 |\n2.6.1 |\n3.6.1 |\n5.6.1 |';
const read = (bars: string) => {
  const result = readAlphaTexWith(alphaTab, `\\ts (4 4)\n${bars}`);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return partOf(result.clip);
};
/** Where bar `bar`'s first column is drawn on string `string` (0 the top), jsdom drawing the tab 800 wide at 0, 0. */
function spot(bar: number, string: number) {
  const { systems } = layoutClip(read(FOUR), 800, 'tab');
  const system = systems.find(s => s.bars.some(b => b.index === bar))!;
  const drawn = system.bars.find(b => b.index === bar)!;
  return { clientX: drawn.columns[0].x, clientY: system.top + stringY(system.rows, string) };
}
function rightClick(at: { clientX: number; clientY: number }) {
  fireEvent.pointerDown(screen.getByRole('img', { name: /drawn as/ }), { ...at, button: 2 });
  fireEvent.contextMenu(editor(), at);
}
const items = (name: string) => within(screen.getByRole('menu', { name })).getAllByRole('menuitem').map(i => i.textContent);
const choose = (name: string) => fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name }));
/** Bars 2 and 3 selected: from bar 2's note into bar 3's. */
const selectBarsTwoAndThree = () => keys({ key: 'ArrowRight', ctrlKey: true }, { key: 'ArrowRight', shiftKey: true });
/** The bar numbers an image draws. */
const numbersIn = (svg: string) => [...svg.matchAll(/data-testid="bar-number"[^>]*>(\d+)</g)].map(m => Number(m[1]));

describe('export and copy selected bars', { timeout: 20000 }, () => {
  beforeEach(() => { copied.length = 0; });

  it('Export options… on a selection opens Export on just those bars, named in its heading', async () => {
    await openWith(FOUR);
    selectBarsTwoAndThree();
    rightClick(spot(2, 0));
    choose('Export options…');
    const dialog = screen.getByRole('dialog', { name: 'Export bars 2–3' });
    // The preview draws those two bars, numbered as in the song.
    const preview = within(dialog).getByTestId('export-preview');
    expect([...preview.querySelectorAll('[data-testid="bar-number"]')].map(n => n.textContent)).toEqual(['2', '3']);
    // Nothing in the clip changed.
    expect(alphaTex()).toBe(FOUR);
  });

  it('Bar numbers From 1 or Hide change the preview; Start with shows only for bars, and both are saved', async () => {
    await openWith(FOUR);
    selectBarsTwoAndThree();
    rightClick(spot(2, 0));
    choose('Export options…');
    const dialog = screen.getByRole('dialog', { name: 'Export bars 2–3' });
    const numbers = () => [...within(dialog).getByTestId('export-preview').querySelectorAll('[data-testid="bar-number"]')].map(n => n.textContent);
    const bars = within(dialog).getByRole('group', { name: 'Bar numbers' });
    fireEvent.click(within(bars).getByRole('button', { name: 'From 1' }));
    expect(numbers()).toEqual(['1', '2']);
    fireEvent.click(within(bars).getByRole('button', { name: 'None' }));
    expect(numbers()).toEqual([]);
    fireEvent.click(within(bars).getByRole('button', { name: 'From arrangement' }));
    expect(numbers()).toEqual(['2', '3']);
    const start = within(dialog).getByRole('group', { name: 'Start with' });
    const tempo = within(start).getByRole('button', { name: 'Tempo' });
    expect(tempo).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(tempo);
    expect(tempo).toHaveAttribute('aria-pressed', 'false');
    expect(JSON.parse(localStorage.getItem(TAB_EXPORT_KEY)!)).toMatchObject({ barNumbers: 'arrangement', startTempo: false, startKey: true });
    // The whole clip's Export has no Start with.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close export' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(screen.queryByRole('group', { name: 'Start with' })).toBeNull();
  });

  it('a press outside the dialog closes it, as Esc does; a press inside or a drag out of it doesn\'t', async () => {
    await openWith(FOUR);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const dialog = screen.getByRole('dialog', { name: /Export/ });
    const inner = within(dialog).getByRole('combobox', { name: 'Format' });
    fireEvent.pointerDown(inner);
    fireEvent.click(dialog);
    expect(dialog).toHaveAttribute('open');
    fireEvent.pointerDown(dialog);
    fireEvent.click(dialog);
    expect(dialog).not.toHaveAttribute('open');
  });

  it('offers Time signature, TAB and Rhythm only with the tab alone, and Text annotations in every format', async () => {
    await openWith(FOUR);
    fireEvent.click(screen.getByRole('button', { name: 'Tab' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const dialog = screen.getByRole('dialog', { name: /Export/ });
    expect(within(dialog).getByRole('group', { name: 'Time signature' })).toBeInTheDocument();
    expect(within(dialog).getByRole('group', { name: 'TAB' })).toBeInTheDocument();
    const previewHeight = () => Number(within(dialog).getByTestId('export-preview').querySelector('svg')!.getAttribute('height'));
    const tall = previewHeight();
    fireEvent.click(within(within(dialog).getByRole('group', { name: 'Rhythm' })).getByRole('button', { name: 'Hide' }));
    expect(previewHeight()).toBeLessThan(tall);
    expect(within(dialog).getByRole('group', { name: 'Background' })).toHaveTextContent('WhiteTransparent');
    fireEvent.click(within(within(dialog).getByRole('group', { name: 'TAB' })).getByRole('button', { name: 'Hide' }));
    const preview = within(dialog).getByTestId('export-preview');
    expect([...preview.querySelectorAll('text')].some(t => t.textContent === 'T')).toBe(false);
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Format' }), { target: { value: 'alphatex' } });
    expect(within(dialog).getByRole('group', { name: 'Text annotations' })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close export' }));
    fireEvent.click(screen.getByRole('button', { name: 'Both' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const both = screen.getByRole('dialog', { name: /Export/ });
    expect(within(both).queryByRole('group', { name: 'Time signature' })).toBeNull();
    expect(within(both).queryByRole('group', { name: 'TAB' })).toBeNull();
    expect(within(both).queryByRole('group', { name: 'Rhythm' })).toBeNull();
    expect(JSON.parse(localStorage.getItem(TAB_EXPORT_KEY)!)).toMatchObject({ tabLetters: false, rhythm: false });
  });

  it('with nothing selected, a right-click beside the notes exports the bar pressed', async () => {
    await openWith(FOUR);
    rightClick(spot(3, 0));
    choose('Export options…');
    expect(screen.getByRole('dialog', { name: 'Export bar 4' })).toBeInTheDocument();
  });

  it('saves the bars in every format, the file named after the bars', async () => {
    await openWith(FOUR);
    selectBarsTwoAndThree();
    rightClick(spot(2, 0));
    choose('Export options…');
    const dialog = screen.getByRole('dialog', { name: 'Export bars 2–3' });
    const saved: string[] = [];
    const texts: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      saved.push(this.download);
    });
    URL.createObjectURL = vi.fn((blob: Blob) => {
      void blob.text().then(t => texts.push(t));
      return 'blob:x';
    });
    URL.revokeObjectURL = vi.fn();
    try {
      fireEvent.change(within(dialog).getByRole('combobox', { name: 'Format' }), { target: { value: 'alphatex' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Download' }));
      await waitFor(() => expect(saved).toHaveLength(1));
      await waitFor(() => expect(texts).toHaveLength(1));
      expect(saved[0]).toMatch(/_bars_2-3\.alphatex\.txt$/);
      expect(texts[0]).toContain('2.6.1 |');
      expect(texts[0]).toContain('3.6.1 |');
      expect(texts[0]).not.toContain('0.6.1');
      expect(texts[0]).not.toContain('5.6.1');
    } finally {
      click.mockRestore();
    }
  });

  it('Export from the page\'s button still holds the whole clip', async () => {
    await openWith(FOUR);
    selectBarsTwoAndThree();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(screen.queryByRole('dialog', { name: /Export bars/ })).toBeNull();
    const preview = screen.getByTestId('export-preview');
    expect(preview.querySelectorAll('[data-testid="bar-number"]')).toHaveLength(4);
  });

  it('Copy as PNG copies the image of those bars and says which', async () => {
    await openWith(FOUR);
    selectBarsTwoAndThree();
    rightClick(spot(1, 0));
    choose('Copy as PNG');
    await waitFor(() => expect(notice()).toHaveTextContent('Copied bars 2–3 as PNG.'));
    expect(copied).toHaveLength(1);
    expect(numbersIn(copied[0])).toEqual([2, 3]);
  });

  it('the bars\' image has no tempo, tuning or Chord chart over it; the whole clip\'s keeps them', async () => {
    renderAt(`#tab=${encodeURIComponent('\\tempo 110\n\\ts (4 4)\n' + FOUR)}`);
    await waitFor(() => expect(alphaTex()).toContain('5.6.1'), SLOW);
    act(() => editor().focus());
    selectBarsTwoAndThree();
    rightClick(spot(2, 0));
    choose('Copy as PNG');
    await waitFor(() => expect(copied).toHaveLength(1));
    expect(copied[0]).not.toContain('score-tempo-drawn');
    rightClick(spot(2, 0));
    choose('Export options…');
    const dialog = screen.getByRole('dialog', { name: 'Export bars 2–3' });
    expect(within(dialog).getByTestId('export-preview').querySelector('[data-testid="score-tempo-drawn"]')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close export' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const whole = screen.getByRole('dialog', { name: /Export/ });
    expect(within(whole).getByTestId('export-preview').querySelector('[data-testid="score-tempo-drawn"]')).not.toBeNull();
  });

  it('on selected notes the note menu has them too; on one note with nothing selected, it hasn\'t', async () => {
    await openWith(FOUR);
    rightClick(spot(1, 5));
    expect(items('Note')).not.toContain('Export options…');
    fireEvent.keyDown(document.body, { key: 'Escape' });
    selectBarsTwoAndThree();
    rightClick(spot(3, 5));
    const labels = items('Note');
    expect(labels.slice(-3)).toEqual(['Copy as PNG', 'Export options…', 'Chat…']);
    choose('Export options…');
    // The press on bar 2 put the cursor there, so the keys selected from bar 3 into bar 4.
    expect(screen.getByRole('dialog', { name: 'Export bars 3–4' })).toBeInTheDocument();
  });

  it('Shift+F10 on a selection offers them in its menu', async () => {
    await openWith(FOUR);
    selectBarsTwoAndThree();
    fireEvent.contextMenu(editor());
    choose('Export options…');
    expect(screen.getByRole('dialog', { name: 'Export bars 2–3' })).toBeInTheDocument();
  });
});
