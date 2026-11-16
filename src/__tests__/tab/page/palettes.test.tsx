import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { LAYOUT_KEY, PALETTE_MIN, parseLayout, placeOn, type PanelId } from '@/features/tab/TabRail';
import { setUpPage, renderAt, alphaTex, openWith } from './helpers';
import { column, paletteHeader, paletteOf } from '../tool';

setUpPage();

// `docs/specs/2026-11-09-tab-palettes-design.md` (issue #454): several palettes open at once in a column;
// `docs/specs/2026-11-15-tab-palette-sides-design.md` (issue #490): a column on each side of the clip.

/** A side's palettes, top to bottom, each `name+` when open and `name-` when folded. */
const listed = (side: 'left' | 'right' = 'left') => [...column(side).querySelectorAll('.tab-stack > section')].map(r =>
  `${r.getAttribute('aria-label')}${r.querySelector('.tab-stack-toggle')!.getAttribute('aria-expanded') === 'true' ? '+' : '-'}`);
const kept = () => JSON.parse(localStorage.getItem(LAYOUT_KEY)!);
const collapseButton = (side = 'left') => screen.getByRole('button', { name: `Collapse ${side} palettes` });
const expandButton = (side = 'left') => screen.getByRole('button', { name: `Expand ${side} palettes` });
const FIRST_ORDER = ['notes', 'articulations', 'bars', 'chords', 'chat'];

/** The declarations of a rule in tab.css, found by its exact selector (the first such rule). */
const rule = (selector: string) => {
  const css = readFileSync(join(process.cwd(), 'src/features/tab/tab.css'), 'utf8');
  const start = css.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf('}', start));
};

describe('the palettes’ column (issue #454)', () => {
  it('lists every palette by its header, icon first; a first visit opens Notes only, Chat alone on the right', () => {
    renderAt();
    expect(listed()).toEqual(['Notes+', 'Articulations-', 'Bars-', 'Chords-']);
    expect(listed('right')).toEqual(['Chat-']);
    for (const name of ['Notes', 'Articulations', 'Bars', 'Chords', 'Chat']) {
      expect(paletteHeader(name).querySelector('.tab-stack-icon svg')).not.toBeNull();
    }
    // Articulations' icon is a vibrato's wavy line, not the accent's wedge (which read as an expand chevron).
    expect(paletteHeader('Articulations').querySelector('.tab-stack-icon svg path')).toHaveAttribute('d', 'M4 12 q2 -5 4 0 t4 0 t4 0 t4 0');
    expect(screen.getByRole('button', { name: 'Note input mode' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Quarter note/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Tuplet/ })).toBeInTheDocument();
    // A folded palette's tools are not shown.
    expect(screen.queryByRole('button', { name: /^Vibrato/ })).toBeNull();
    // No rail.
    expect(screen.queryByRole('navigation', { name: 'Panels' })).toBeNull();
  });

  it('opens and folds a palette from its header, several open at once', () => {
    renderAt();
    fireEvent.click(paletteHeader('Articulations'));
    fireEvent.click(paletteHeader('Bars'));
    expect(listed()).toEqual(['Notes+', 'Articulations+', 'Bars+', 'Chords-']);
    expect(screen.getByRole('button', { name: 'Note input mode' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Vibrato/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Double bar line at the end of this bar' })).toBeInTheDocument();
    fireEvent.click(paletteHeader('Notes'));
    expect(listed()).toEqual(['Notes-', 'Articulations+', 'Bars+', 'Chords-']);
    expect(screen.queryByRole('button', { name: 'Note input mode' })).toBeNull();
  });

  it('collapses a side to a strip with one button, and expands it with the same palettes open; the other side stays', () => {
    renderAt();
    fireEvent.click(paletteHeader('Chords'));
    fireEvent.click(collapseButton());
    expect(screen.queryByRole('complementary', { name: 'Left palettes' })).toBeNull();
    expect(listed('right')).toEqual(['Chat-']);
    expect(screen.queryByRole('button', { name: 'Note input mode' })).toBeNull();
    expect(expandButton()).toHaveAttribute('aria-expanded', 'false');
    // Under Expand, the side's palettes by their icons, in order, each named for its tip (issue #490).
    const strip = [...expandButton().parentElement!.querySelectorAll('.tab-stack-strip-icon')];
    expect(strip.map(b => b.getAttribute('aria-label'))).toEqual(['Show Notes', 'Show Articulations', 'Show Bars', 'Show Chords']);
    expect(strip.map(b => b.getAttribute('data-tip'))).toEqual(['Notes', 'Articulations', 'Bars', 'Chords']);
    expect(strip.every(b => b.querySelector('svg'))).toBe(true);
    fireEvent.click(expandButton());
    expect(listed()).toEqual(['Notes+', 'Articulations-', 'Bars-', 'Chords+']);
    expect(collapseButton()).toHaveAttribute('aria-expanded', 'true');
    // The right side alone: its strip on the clip's right, the left column still there.
    fireEvent.click(collapseButton('right'));
    expect(screen.queryByRole('complementary', { name: 'Right palettes' })).toBeNull();
    expect(expandButton('right').closest('.tab-rail-column')).toHaveAttribute('data-side', 'right');
    expect(listed()).toEqual(['Notes+', 'Articulations-', 'Bars-', 'Chords+']);
    fireEvent.click(expandButton('right'));
    expect(listed('right')).toEqual(['Chat-']);
  });

  it('a palette’s icon in a collapsed strip expands that side with it open, the others as they were (issue #490)', () => {
    renderAt();
    fireEvent.click(collapseButton());
    fireEvent.click(screen.getByRole('button', { name: 'Show Bars' }));
    expect(listed()).toEqual(['Notes+', 'Articulations-', 'Bars+', 'Chords-']);
    expect(kept().collapsed).toEqual({ left: false, right: false });
    // An icon of a palette already open just expands the side.
    fireEvent.click(collapseButton());
    fireEvent.click(screen.getByRole('button', { name: 'Show Notes' }));
    expect(listed()).toEqual(['Notes+', 'Articulations-', 'Bars+', 'Chords-']);
    // The right side's strip lists Chat.
    fireEvent.click(collapseButton('right'));
    fireEvent.click(screen.getByRole('button', { name: 'Show Chat' }));
    expect(listed('right')).toEqual(['Chat+']);
  });

  it('keeps the open palettes, their order, sides and heights, each side collapsed or not, and widths across visits', () => {
    renderAt();
    fireEvent.click(paletteHeader('Bars'));
    expect(kept()).toEqual({
      open: ['notes', 'bars'], order: FIRST_ORDER, right: ['chat'], heights: {},
      collapsed: { left: false, right: false }, width: { left: 272, right: 272 }, reach: { left: 272, right: 272 },
    });
    fireEvent.keyDown(paletteHeader('Bars'), { key: 'ArrowUp', altKey: true });
    fireEvent.keyDown(screen.getByRole('separator', { name: 'Notes height' }), { key: 'ArrowUp' });
    fireEvent.keyDown(paletteHeader('Chords'), { key: 'ArrowRight', altKey: true });
    fireEvent.click(collapseButton());
    cleanup();
    renderAt();
    expect(expandButton()).toBeInTheDocument();
    expect(listed('right')).toEqual(['Chat-', 'Chords-']);
    fireEvent.click(expandButton());
    expect(listed()).toEqual(['Notes+', 'Bars+', 'Articulations-']);
    expect(screen.getByRole('separator', { name: 'Notes height' })).toHaveAttribute('aria-valuenow', String(PALETTE_MIN));
  });

  it('keeps the tab’s cursor when a header and a tool are pressed', async () => {
    await openWith('5.1.1 |');
    fireEvent.click(paletteHeader('Articulations'));
    fireEvent.click(screen.getByRole('button', { name: 'Palm mute' }));
    expect(alphaTex()).toContain('5.1{pm}');
    // A clip from a link takes alphaTab a while to draw the first time in a busy run.
  }, 20000);

  it('opens a tool’s panel (Bend) fixed to the window, so a palette that scrolls can’t cut it off', () => {
    expect(rule('.tab-tool-panel')).toContain('position: fixed');
    expect(rule('.tab-stack')).toContain('overflow-y: auto');
  });
});

describe('moving a palette', () => {
  it('drags a header to where the pointer is let go; a press that hardly moves still opens or folds', () => {
    renderAt();
    // jsdom lays nothing out, so every palette's middle is at 0 and any pointer below lands it last.
    const notes = paletteHeader('Notes');
    fireEvent.pointerDown(notes, { button: 0, clientY: 10 });
    fireEvent.pointerMove(window, { clientY: 30 });
    expect(paletteOf('Notes')).toHaveAttribute('data-dragging');
    expect(paletteOf('Chords')).toHaveAttribute('data-drop', 'after');
    fireEvent.pointerUp(window, { clientY: 30 });
    fireEvent.click(notes);
    // Moved, and the click that ends the drag didn't fold it; Chat stays on the right.
    expect(listed()).toEqual(['Articulations-', 'Bars-', 'Chords-', 'Notes+']);
    expect(listed('right')).toEqual(['Chat-']);
    expect(paletteOf('Notes')).not.toHaveAttribute('data-dragging');
    expect(kept().order).toEqual(['articulations', 'bars', 'chords', 'notes', 'chat']);
    // 4px is a press, not a drag.
    fireEvent.pointerDown(paletteHeader('Bars'), { button: 0, clientY: 10 });
    fireEvent.pointerMove(window, { clientY: 14 });
    fireEvent.pointerUp(window, { clientY: 14 });
    fireEvent.click(paletteHeader('Bars'));
    expect(listed()).toEqual(['Articulations-', 'Bars+', 'Chords-', 'Notes+']);
  });

  it('ignores a right-button press on a header', () => {
    renderAt();
    fireEvent.pointerDown(paletteHeader('Notes'), { button: 2, clientY: 10 });
    fireEvent.pointerMove(window, { clientY: 60 });
    fireEvent.pointerUp(window, { clientY: 60 });
    expect(listed()[0]).toBe('Notes+');
  });

  it('moves the focused header’s palette with Alt+↑ ↓, and not past either end', () => {
    renderAt();
    fireEvent.keyDown(paletteHeader('Notes'), { key: 'ArrowDown', altKey: true });
    expect(listed()).toEqual(['Articulations-', 'Notes+', 'Bars-', 'Chords-']);
    fireEvent.keyDown(paletteHeader('Notes'), { key: 'ArrowUp', altKey: true });
    fireEvent.keyDown(paletteHeader('Notes'), { key: 'ArrowUp', altKey: true });
    expect(listed()).toEqual(['Notes+', 'Articulations-', 'Bars-', 'Chords-']);
    fireEvent.keyDown(paletteHeader('Chords'), { key: 'ArrowDown', altKey: true });
    expect(listed().at(-1)).toBe('Chords-');
    fireEvent.keyDown(paletteHeader('Chat'), { key: 'ArrowUp', altKey: true });
    expect(listed('right')).toEqual(['Chat-']);
    // Without Alt, ↑ ↓ do nothing to the order.
    fireEvent.keyDown(paletteHeader('Notes'), { key: 'ArrowDown' });
    expect(listed()[0]).toBe('Notes+');
  });

  it('placeOn puts a palette before the one at the index on its side, or last there, the other side unchanged', () => {
    const order = FIRST_ORDER as PanelId[];
    const one = { order, right: [] as PanelId[] };
    expect(placeOn(one, 'chat', 'left', 0).order).toEqual(['chat', 'notes', 'articulations', 'bars', 'chords']);
    expect(placeOn(one, 'notes', 'left', 5).order).toEqual(['articulations', 'bars', 'chords', 'chat', 'notes']);
    expect(placeOn(one, 'notes', 'left', 2).order).toEqual(['articulations', 'notes', 'bars', 'chords', 'chat']);
    expect(placeOn(one, 'bars', 'left', 2)).toEqual(one);
    expect(placeOn(one, 'bars', 'left', 3)).toEqual(one);
    // Across: Notes to the right, before Chat or last; Chat back to the left, first.
    const two = { order, right: ['chat'] as PanelId[] };
    expect(placeOn(two, 'notes', 'right', 0)).toEqual({ order: ['articulations', 'bars', 'chords', 'notes', 'chat'], right: ['chat', 'notes'] });
    expect(placeOn(two, 'notes', 'right', 1)).toEqual({ order: ['articulations', 'bars', 'chords', 'chat', 'notes'], right: ['chat', 'notes'] });
    expect(placeOn(two, 'chat', 'left', 0)).toEqual({ order: ['chat', 'notes', 'articulations', 'bars', 'chords'], right: [] });
    // To an empty side.
    expect(placeOn(one, 'bars', 'right', 0)).toEqual({ order: ['notes', 'articulations', 'chords', 'chat', 'bars'], right: ['bars'] });
  });
});

describe('moving a palette to the other side (issue #490)', () => {
  /** Lays the clip out from x 300 to 1100, so its middle is at 700. */
  const layClip = (container: HTMLElement) => {
    const clip = container.querySelector<HTMLElement>('.tab-rail-clip')!;
    clip.getBoundingClientRect = () => ({ left: 300, right: 1100, width: 800, top: 0, bottom: 600, height: 600, x: 300, y: 0, toJSON: () => ({}) });
  };
  /** Drags a header from x 100 to `x`, letting go there unless `hold`. */
  const dragTo = (name: string, x: number, hold = false) => {
    fireEvent.pointerDown(paletteHeader(name), { button: 0, clientX: 100, clientY: 10 });
    fireEvent.pointerMove(window, { clientX: x, clientY: 30 });
    if (!hold) fireEvent.pointerUp(window, { clientX: x, clientY: 30 });
  };

  it('Alt+→ moves the focused header’s palette to the right, last there; Alt+← brings it back, last; no further', () => {
    renderAt();
    fireEvent.keyDown(paletteHeader('Bars'), { key: 'ArrowRight', altKey: true });
    expect(listed()).toEqual(['Notes+', 'Articulations-', 'Chords-']);
    expect(listed('right')).toEqual(['Chat-', 'Bars-']);
    fireEvent.keyDown(paletteHeader('Bars'), { key: 'ArrowRight', altKey: true });
    expect(listed('right')).toEqual(['Chat-', 'Bars-']);
    fireEvent.keyDown(paletteHeader('Bars'), { key: 'ArrowLeft', altKey: true });
    expect(listed()).toEqual(['Notes+', 'Articulations-', 'Chords-', 'Bars-']);
    expect(kept().right).toEqual(['chat']);
    // Without Alt, ← → do nothing.
    fireEvent.keyDown(paletteHeader('Notes'), { key: 'ArrowRight' });
    expect(listed()[0]).toBe('Notes+');
  });

  it('a header dragged past the clip’s middle lands on the other side; short of it, on its own', () => {
    const { container } = renderAt();
    layClip(container);
    dragTo('Notes', 650);
    expect(listed()).toEqual(['Articulations-', 'Bars-', 'Chords-', 'Notes+']);
    dragTo('Notes', 750, true);
    expect(paletteOf('Chat')).toHaveAttribute('data-drop', 'after');
    fireEvent.pointerUp(window, { clientX: 750, clientY: 30 });
    expect(listed()).toEqual(['Articulations-', 'Bars-', 'Chords-']);
    expect(listed('right')).toEqual(['Chat-', 'Notes+']);
    // From the right, back past the middle.
    dragTo('Chat', 650);
    expect(listed()).toEqual(['Articulations-', 'Bars-', 'Chords-', 'Chat-']);
    expect(listed('right')).toEqual(['Notes+']);
  });

  it('a side with no palettes has no column; while a header is dragged it shows a drop band, blue when aimed at', () => {
    const { container } = renderAt();
    layClip(container);
    fireEvent.keyDown(paletteHeader('Chat'), { key: 'ArrowLeft', altKey: true });
    expect(screen.queryByRole('complementary', { name: 'Right palettes' })).toBeNull();
    expect(screen.queryByRole('button', { name: /right palettes/ })).toBeNull();
    expect(container.querySelector('.tab-rail-layout')).not.toHaveAttribute('data-right');
    expect(container.querySelector('.tab-rail-drop')).toBeNull();
    dragTo('Bars', 400, true);
    const band = () => container.querySelector('.tab-rail-drop[data-side="right"]')!;
    expect(band()).not.toHaveAttribute('data-target');
    fireEvent.pointerMove(window, { clientX: 900, clientY: 30 });
    expect(band()).toHaveAttribute('data-target');
    fireEvent.pointerUp(window, { clientX: 900, clientY: 30 });
    expect(container.querySelector('.tab-rail-drop')).toBeNull();
    expect(listed('right')).toEqual(['Bars-']);
  });

  it('a palette dropped on a collapsed side lands last there and expands it', () => {
    const { container } = renderAt();
    layClip(container);
    fireEvent.click(collapseButton('right'));
    dragTo('Bars', 900, true);
    expect(expandButton('right').parentElement).toHaveAttribute('data-drop');
    fireEvent.pointerUp(window, { clientX: 900, clientY: 30 });
    expect(listed('right')).toEqual(['Chat-', 'Bars-']);
    expect(kept().collapsed).toEqual({ left: false, right: false });
  });

  it('the right side’s width: ← widens it, a drag leftwards widens it, kept as its own', () => {
    renderAt();
    const divider = () => screen.getByRole('separator', { name: 'Right palette width' });
    fireEvent.keyDown(divider(), { key: 'ArrowLeft' });
    expect(divider()).toHaveAttribute('aria-valuenow', '288');
    fireEvent.pointerDown(divider(), { button: 0, clientX: 1000, pointerId: 1 });
    fireEvent.pointerMove(divider(), { clientX: 920, pointerId: 1 });
    fireEvent.pointerUp(divider(), { clientX: 920, pointerId: 1 });
    expect(kept().width).toEqual({ left: 272, right: 368 });
    expect(screen.getByRole('separator', { name: 'Left palette width' })).toHaveAttribute('aria-valuenow', '272');
  });
});

describe('a palette’s height', () => {
  const handle = () => screen.getByRole('separator', { name: 'Notes height' });
  const body = () => paletteOf('Notes').querySelector<HTMLElement>('.tab-stack-body')!;

  it('follows a drag of the line under it, kept on letting go, never under 48px', () => {
    renderAt();
    expect(handle()).not.toHaveAttribute('aria-valuenow');
    // Not laid out, it reads as 48px tall: a drag 100px down makes it 148px.
    fireEvent.pointerDown(handle(), { button: 0, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(handle(), { clientY: 200, pointerId: 1 });
    expect(body().style.height).toBe('148px');
    expect(localStorage.getItem(LAYOUT_KEY)).toBeNull();
    fireEvent.pointerUp(handle(), { clientY: 200, pointerId: 1 });
    expect(kept().heights).toEqual({ notes: 148 });
    expect(paletteOf('Notes')).toHaveAttribute('data-sized');
    fireEvent.pointerDown(handle(), { button: 0, clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(handle(), { clientY: -500, pointerId: 1 });
    fireEvent.pointerUp(handle(), { pointerId: 1 });
    expect(kept().heights).toEqual({ notes: PALETTE_MIN });
  });

  it('moves by 16px with ↑ ↓, 64px with Shift; a double-click gives back the full height', () => {
    renderAt();
    fireEvent.keyDown(handle(), { key: 'ArrowDown', shiftKey: true });
    expect(handle()).toHaveAttribute('aria-valuenow', '112');
    fireEvent.keyDown(handle(), { key: 'ArrowUp' });
    expect(handle()).toHaveAttribute('aria-valuenow', '96');
    fireEvent.doubleClick(handle());
    expect(handle()).not.toHaveAttribute('aria-valuenow');
    expect(body().style.height).toBe('');
    expect(kept().heights).toEqual({});
  });

  it('is gone, with its handle, while the palette is folded', () => {
    renderAt();
    fireEvent.click(paletteHeader('Notes'));
    expect(screen.queryByRole('separator', { name: 'Notes height' })).toBeNull();
  });
});

describe('parseLayout', () => {
  it('reads a first visit’s layout from nothing, or from anything unreadable', () => {
    const first = {
      open: ['notes'], order: FIRST_ORDER, right: ['chat'], heights: {},
      collapsed: { left: false, right: false }, width: { left: 272, right: 272 }, reach: { left: 272, right: 272 },
    };
    expect(parseLayout(null)).toEqual(first);
    expect(parseLayout('not json')).toEqual(first);
    expect(parseLayout(JSON.stringify(['bars']))).toEqual(first);
    expect(parseLayout(JSON.stringify({ open: 'bars', order: 'bars', right: 'bars', heights: [], collapsed: 'yes', width: '320' }))).toEqual(first);
    // The one-column shape before issue #490: collapsed and width as bare values read as a first visit.
    expect(parseLayout(JSON.stringify({ collapsed: true, width: 400 }))).toEqual(first);
  });

  it('reads the open palettes, dropping unknown ones; none open is kept', () => {
    expect(parseLayout(JSON.stringify({ open: ['chat', 'bars', 'tuplets'] })).open).toEqual(['bars', 'chat']);
    expect(parseLayout(JSON.stringify({ open: [] })).open).toEqual([]);
  });

  it('reads the order, each palette once, any missing put last in their first order', () => {
    expect(parseLayout(JSON.stringify({ order: ['chat', 'notes', 'chat', 'tuplets'] })).order)
      .toEqual(['chat', 'notes', 'articulations', 'bars', 'chords']);
  });

  it('reads heights in whole px, at least 48, dropping unknown palettes and non-numbers', () => {
    expect(parseLayout(JSON.stringify({ heights: { notes: 120.4, bars: 10, chat: '90', tuplets: 100 } })).heights)
      .toEqual({ notes: 120, bars: PALETTE_MIN });
  });

  it('reads the palettes on the right, dropping unknown ones; none is kept', () => {
    expect(parseLayout(JSON.stringify({ right: ['chat', 'notes', 'tuplets'] })).right).toEqual(['notes', 'chat']);
    expect(parseLayout(JSON.stringify({ right: [] })).right).toEqual([]);
  });

  it('reads each side’s collapsed, and its width: 272px (17rem) when missing, kept between 224 and 560', () => {
    expect(parseLayout(JSON.stringify({ collapsed: { right: true, left: 'no' } })).collapsed).toEqual({ left: false, right: true });
    const widthOf = (left: unknown) => parseLayout(JSON.stringify({ width: { left, right: 330 } })).width;
    expect(widthOf(320)).toEqual({ left: 320, right: 330 });
    expect(widthOf(null).left).toBe(272);
    expect(widthOf(100).left).toBe(224);
    expect(widthOf(9000).left).toBe(560);
    expect(widthOf(300.6).left).toBe(301);
  });
});

describe('dragging the line between the column and the clip (issue #431)', () => {
  const divider = () => screen.getByRole('separator', { name: 'Left palette width' });
  const layout = (container: HTMLElement) => container.querySelector<HTMLElement>('.tab-rail-layout')!;

  it('widens or narrows the column as far as the pointer moves, and keeps the width on letting go', () => {
    const { container } = renderAt();
    expect(divider()).toHaveAttribute('aria-valuenow', '272');
    fireEvent.pointerDown(divider(), { button: 0, clientX: 300, pointerId: 1 });
    fireEvent.pointerMove(divider(), { clientX: 380, pointerId: 1 });
    expect(layout(container).style.getPropertyValue('--rail-left')).toBe('352px');
    // Not kept until the drag ends.
    expect(localStorage.getItem(LAYOUT_KEY)).toBeNull();
    fireEvent.pointerUp(divider(), { clientX: 380, pointerId: 1 });
    expect(kept().width).toEqual({ left: 352, right: 272 });
  });

  it('stops at 224px and at 560px, however far the pointer goes', () => {
    const { container } = renderAt();
    fireEvent.pointerDown(divider(), { button: 0, clientX: 300, pointerId: 1 });
    fireEvent.pointerMove(divider(), { clientX: 0, pointerId: 1 });
    expect(layout(container).style.getPropertyValue('--rail-left')).toBe('224px');
    fireEvent.pointerMove(divider(), { clientX: 2000, pointerId: 1 });
    expect(layout(container).style.getPropertyValue('--rail-left')).toBe('560px');
    fireEvent.pointerUp(divider(), { pointerId: 1 });
    expect(kept().width.left).toBe(560);
  });

  it('ignores a right-button press', () => {
    renderAt();
    fireEvent.pointerDown(divider(), { button: 2, clientX: 300, pointerId: 1 });
    fireEvent.pointerMove(divider(), { clientX: 400, pointerId: 1 });
    expect(divider()).toHaveAttribute('aria-valuenow', '272');
  });

  it('moves by 16px with ← →, and 64px with Shift', () => {
    renderAt();
    fireEvent.keyDown(divider(), { key: 'ArrowRight' });
    expect(divider()).toHaveAttribute('aria-valuenow', '288');
    fireEvent.keyDown(divider(), { key: 'ArrowLeft', shiftKey: true });
    expect(divider()).toHaveAttribute('aria-valuenow', '224');
    expect(kept().width.left).toBe(224);
  });

  it('brings the width back on the next visit', () => {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify({ width: { left: 400 } }));
    const { container } = renderAt();
    expect(divider()).toHaveAttribute('aria-valuenow', '400');
    expect(layout(container).style.getPropertyValue('--rail-left')).toBe('400px');
  });

  it('is gone with the collapsed column, and hidden under 900px where the column sits over the clip', () => {
    renderAt();
    fireEvent.click(collapseButton());
    expect(screen.queryByRole('separator', { name: 'Left palette width' })).toBeNull();
    expect(screen.getByRole('separator', { name: 'Right palette width' })).toBeInTheDocument();
    const css = readFileSync(join(process.cwd(), 'src/features/tab/tab.css'), 'utf8');
    const narrow = css.slice(css.indexOf('/* Under 900px the columns sit over the clip'));
    expect(narrow.slice(0, narrow.indexOf('\n}'))).toContain('.tab-rail-divider { display: none; }');
    expect(rule('.tab-rail-layout')).toContain('grid-template-columns: var(--rail-left, 0px) minmax(0, var(--clip-width)) var(--rail-right, 0px)');
  });
});

// `docs/specs/2026-11-16-tab-palette-edges-design.md` (issue #521): the edge dragged follows the pointer.
describe('a column’s edges follow the pointer (issue #521)', () => {
  const edge = (side: 'Left' | 'Right', which: 'width' | 'outer edge') => screen.getByRole('separator', { name: `${side} palette ${which}` });
  const layout = (container: HTMLElement) => container.querySelector<HTMLElement>('.tab-rail-layout')!;
  const drag = (handle: HTMLElement, by: number) => {
    fireEvent.pointerDown(handle, { button: 0, clientX: 500, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 500 + by, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 500 + by, pointerId: 1 });
  };
  /** A wide window: at 1,600px, 184px of margin a side that a column may use, (1600 − 1240) / 2 + 4; at 2,000px, 384. */
  const wide = (px = 1600) => {
    const was = window.innerWidth;
    window.innerWidth = px;
    return () => { window.innerWidth = was; };
  };

  it('reads each side’s reach: its width when missing, 0 to 560 in whole px', () => {
    expect(parseLayout(JSON.stringify({ width: { left: 320 } })).reach).toEqual({ left: 320, right: 272 });
    expect(parseLayout(JSON.stringify({ reach: { left: 100.4, right: 'x' } })).reach).toEqual({ left: 100, right: 272 });
    expect(parseLayout(JSON.stringify({ reach: { left: -5, right: 9000 } })).reach).toEqual({ left: 0, right: 560 });
  });

  it('the inner edge widens into the clip, keeping the reach; away from the clip at its widest it does nothing', () => {
    const restore = wide(2000);
    try {
      const { container } = renderAt();
      drag(edge('Left', 'width'), -80);
      expect(edge('Left', 'width')).toHaveAttribute('aria-valuenow', '272');
      drag(edge('Left', 'width'), 80);
      expect(kept().width.left).toBe(352);
      expect(kept().reach.left).toBe(272);
      expect(layout(container).style.getPropertyValue('--rail-left-out')).toBe('272px');
    } finally {
      restore();
    }
  });

  it('the outer edge widens into the margin, up to its limit, and narrows toward the clip', () => {
    const restore = wide();
    try {
      renderAt();
      // 272 wide, 184 of it in the margin (the margin's limit) and 88 over the clip; outward, the margin is used up.
      drag(edge('Left', 'outer edge'), -80);
      expect(kept().width.left).toBe(272);
      expect(kept().reach.left).toBe(184);
      drag(edge('Left', 'outer edge'), 80);
      expect(kept().width.left).toBe(224);
      expect(kept().reach.left).toBe(136);
    } finally {
      restore();
    }
  });

  it('a column all in the margin widens outward from its outer edge as far as the margin goes', () => {
    const restore = wide();
    localStorage.setItem(LAYOUT_KEY, JSON.stringify({ width: { left: 224 }, reach: { left: 100 } }));
    try {
      renderAt();
      drag(edge('Left', 'outer edge'), -200);
      expect(kept().width.left).toBe(308);
      expect(kept().reach.left).toBe(184);
    } finally {
      restore();
    }
  });

  it('on the right, the outer edge’s → widens and ← narrows; the inner edge’s ← widens', () => {
    const restore = wide();
    localStorage.setItem(LAYOUT_KEY, JSON.stringify({ reach: { right: 100 } }));
    try {
      renderAt();
      fireEvent.keyDown(edge('Right', 'outer edge'), { key: 'ArrowRight' });
      expect(kept().width.right).toBe(288);
      expect(kept().reach.right).toBe(116);
      fireEvent.keyDown(edge('Right', 'outer edge'), { key: 'ArrowLeft', shiftKey: true });
      expect(kept().width.right).toBe(224);
      expect(kept().reach.right).toBe(52);
      fireEvent.keyDown(edge('Right', 'width'), { key: 'ArrowLeft' });
      expect(kept().width.right).toBe(240);
      expect(kept().reach.right).toBe(52);
    } finally {
      restore();
    }
  });

  it('sets the margins from each side’s reach, and shows the outer edge from 1,280px', () => {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify({ width: { left: 300 }, reach: { left: 400 }, collapsed: { right: true } }));
    const { container } = renderAt();
    expect(layout(container).style.getPropertyValue('--rail-left-out')).toBe('300px');
    expect(layout(container).style.getPropertyValue('--rail-right-out')).toBe('40px');
    expect(rule('.tab-rail-layout')).toContain('margin-left: calc(-1 * min(var(--rail-reach), var(--rail-left-out, 0px)))');
    expect(rule('.tab-rail-layout')).toContain('margin-right: calc(-1 * min(var(--rail-reach), var(--rail-right-out, 0px)))');
    const css = readFileSync(join(process.cwd(), 'src/features/tab/tab.css'), 'utf8');
    expect(css).toContain("@media (max-width: 1279px) { .tab-rail-divider[data-edge='outer'] { display: none; } }");
  });

  it('in a 1,024px window the inner edge narrows a column as before', () => {
    renderAt();
    drag(edge('Left', 'width'), -80);
    expect(kept().width.left).toBe(224);
  });
});

/* jsdom lays nothing out, so these pin the CSS that the browser check (issue: a short clip's page
   scrolled to show the footer) relied on. */
describe('the column’s height', () => {
  it('runs down the clip’s row, which takes the window’s spare height, not a whole window of its own', () => {
    const { container } = renderAt();
    const page = container.querySelector('.tab-page');
    expect(page?.querySelector(':scope > .tab-rail-layout')).not.toBeNull();
    expect(column().closest('.tab-rail-column')).toHaveAttribute('data-side', 'left');
    expect(rule('main:has(> .tab-page)')).toContain('flex-direction: column');
    expect(rule('.tab-page')).toContain('flex: 1');
    expect(rule('.tab-page > .tab-rail-layout')).toContain('flex: 1');
    expect(rule('.tab-rail-column')).toContain('align-self: stretch');
    const own = rule('.tab-rail-panel');
    expect(own).toContain('height: 100%');
    expect(own).toContain('max-height: calc(100vh - 32px)');
    expect(own).not.toMatch(/(^|[\s;])min-height:\s*calc\(100vh/);
  });
});
