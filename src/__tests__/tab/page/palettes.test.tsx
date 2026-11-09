import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { LAYOUT_KEY, PALETTE_MIN, moveTo, parseLayout, type PanelId } from '@/features/tab/TabRail';
import { setUpPage, renderAt, alphaTex, openWith } from './helpers';
import { column, paletteHeader, paletteOf } from '../tool';

setUpPage();

// `docs/specs/2026-11-09-tab-palettes-design.md` (issue #454): several palettes open at once in one column.

/** The palettes, top to bottom, each `name+` when open and `name-` when folded. */
const listed = () => [...column().querySelectorAll('.tab-stack > section')].map(r =>
  `${r.getAttribute('aria-label')}${r.querySelector('.tab-stack-toggle')!.getAttribute('aria-expanded') === 'true' ? '+' : '-'}`);
const kept = () => JSON.parse(localStorage.getItem(LAYOUT_KEY)!);
const collapseButton = () => screen.getByRole('button', { name: 'Collapse palettes' });
const expandButton = () => screen.getByRole('button', { name: 'Expand palettes' });

/** The declarations of a rule in tab.css, found by its exact selector (the first such rule). */
const rule = (selector: string) => {
  const css = readFileSync(join(process.cwd(), 'src/features/tab/tab.css'), 'utf8');
  const start = css.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf('}', start));
};

describe('the palettes’ column (issue #454)', () => {
  it('lists every palette by its header, icon first; a first visit opens Notes only', () => {
    renderAt();
    expect(listed()).toEqual(['Notes+', 'Articulations-', 'Bars-', 'Chords-', 'Chat-']);
    for (const name of ['Notes', 'Articulations', 'Bars', 'Chords', 'Chat']) {
      expect(paletteHeader(name).querySelector('.tab-stack-icon svg')).not.toBeNull();
    }
    // Articulations' icon is "mf", its two letters, not the accent's wedge (which read as an expand chevron).
    expect(paletteHeader('Articulations').querySelectorAll('.tab-stack-icon svg g path')).toHaveLength(2);
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
    expect(listed()).toEqual(['Notes+', 'Articulations+', 'Bars+', 'Chords-', 'Chat-']);
    expect(screen.getByRole('button', { name: 'Note input mode' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Vibrato/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Double bar line at the end of this bar' })).toBeInTheDocument();
    fireEvent.click(paletteHeader('Notes'));
    expect(listed()).toEqual(['Notes-', 'Articulations+', 'Bars+', 'Chords-', 'Chat-']);
    expect(screen.queryByRole('button', { name: 'Note input mode' })).toBeNull();
  });

  it('collapses to a strip with one button, and expands with the same palettes open', () => {
    renderAt();
    fireEvent.click(paletteHeader('Chords'));
    fireEvent.click(collapseButton());
    expect(screen.queryByRole('complementary', { name: 'Palettes' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Note input mode' })).toBeNull();
    expect(expandButton()).toHaveAttribute('aria-expanded', 'false');
    // Nothing else in the strip: no palette icons.
    expect(expandButton().parentElement!.children).toHaveLength(1);
    fireEvent.click(expandButton());
    expect(listed()).toEqual(['Notes+', 'Articulations-', 'Bars-', 'Chords+', 'Chat-']);
    expect(collapseButton()).toHaveAttribute('aria-expanded', 'true');
  });

  it('keeps the open palettes, their order and heights, collapsed or not, and the width across visits', () => {
    renderAt();
    fireEvent.click(paletteHeader('Bars'));
    expect(kept()).toEqual({
      open: ['notes', 'bars'], order: ['notes', 'articulations', 'bars', 'chords', 'chat'], heights: {}, collapsed: false, width: 272,
    });
    fireEvent.keyDown(paletteHeader('Bars'), { key: 'ArrowUp', altKey: true });
    fireEvent.keyDown(screen.getByRole('separator', { name: 'Notes height' }), { key: 'ArrowUp' });
    fireEvent.click(collapseButton());
    cleanup();
    renderAt();
    expect(expandButton()).toBeInTheDocument();
    fireEvent.click(expandButton());
    expect(listed()).toEqual(['Notes+', 'Bars+', 'Articulations-', 'Chords-', 'Chat-']);
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
    expect(paletteOf('Chat')).toHaveAttribute('data-drop', 'after');
    fireEvent.pointerUp(window, { clientY: 30 });
    fireEvent.click(notes);
    // Moved, and the click that ends the drag didn't fold it.
    expect(listed()).toEqual(['Articulations-', 'Bars-', 'Chords-', 'Chat-', 'Notes+']);
    expect(paletteOf('Notes')).not.toHaveAttribute('data-dragging');
    expect(kept().order).toEqual(['articulations', 'bars', 'chords', 'chat', 'notes']);
    // 4px is a press, not a drag.
    fireEvent.pointerDown(paletteHeader('Bars'), { button: 0, clientY: 10 });
    fireEvent.pointerMove(window, { clientY: 14 });
    fireEvent.pointerUp(window, { clientY: 14 });
    fireEvent.click(paletteHeader('Bars'));
    expect(listed()).toEqual(['Articulations-', 'Bars+', 'Chords-', 'Chat-', 'Notes+']);
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
    expect(listed()).toEqual(['Articulations-', 'Notes+', 'Bars-', 'Chords-', 'Chat-']);
    fireEvent.keyDown(paletteHeader('Notes'), { key: 'ArrowUp', altKey: true });
    fireEvent.keyDown(paletteHeader('Notes'), { key: 'ArrowUp', altKey: true });
    expect(listed()).toEqual(['Notes+', 'Articulations-', 'Bars-', 'Chords-', 'Chat-']);
    fireEvent.keyDown(paletteHeader('Chat'), { key: 'ArrowDown', altKey: true });
    expect(listed().at(-1)).toBe('Chat-');
    // Without Alt, ↑ ↓ do nothing to the order.
    fireEvent.keyDown(paletteHeader('Notes'), { key: 'ArrowDown' });
    expect(listed()[0]).toBe('Notes+');
  });

  it('moveTo puts a palette before the one at the index, or last', () => {
    const order: PanelId[] = ['notes', 'articulations', 'bars', 'chords', 'chat'];
    expect(moveTo(order, 'chat', 0)).toEqual(['chat', 'notes', 'articulations', 'bars', 'chords']);
    expect(moveTo(order, 'notes', 5)).toEqual(['articulations', 'bars', 'chords', 'chat', 'notes']);
    expect(moveTo(order, 'notes', 2)).toEqual(['articulations', 'notes', 'bars', 'chords', 'chat']);
    expect(moveTo(order, 'bars', 2)).toEqual(order);
    expect(moveTo(order, 'bars', 3)).toEqual(order);
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
    const first = { open: ['notes'], order: ['notes', 'articulations', 'bars', 'chords', 'chat'], heights: {}, collapsed: false, width: 272 };
    expect(parseLayout(null)).toEqual(first);
    expect(parseLayout('not json')).toEqual(first);
    expect(parseLayout(JSON.stringify(['bars']))).toEqual(first);
    expect(parseLayout(JSON.stringify({ open: 'bars', order: 'bars', heights: [], collapsed: 'yes', width: '320' }))).toEqual(first);
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

  it('reads collapsed, and the width: 272px (17rem) when missing, kept between 224 and 560', () => {
    expect(parseLayout(JSON.stringify({ collapsed: true })).collapsed).toBe(true);
    const widthOf = (width: unknown) => parseLayout(JSON.stringify({ width })).width;
    expect(widthOf(320)).toBe(320);
    expect(widthOf(null)).toBe(272);
    expect(widthOf(100)).toBe(224);
    expect(widthOf(9000)).toBe(560);
    expect(widthOf(300.6)).toBe(301);
  });
});

describe('dragging the line between the column and the clip (issue #431)', () => {
  const divider = () => screen.getByRole('separator', { name: 'Palette width' });
  const layout = (container: HTMLElement) => container.querySelector<HTMLElement>('.tab-rail-layout')!;

  it('widens or narrows the column as far as the pointer moves, and keeps the width on letting go', () => {
    const { container } = renderAt();
    expect(divider()).toHaveAttribute('aria-valuenow', '272');
    fireEvent.pointerDown(divider(), { button: 0, clientX: 300, pointerId: 1 });
    fireEvent.pointerMove(divider(), { clientX: 380, pointerId: 1 });
    expect(layout(container).style.getPropertyValue('--rail-panel-width')).toBe('352px');
    // Not kept until the drag ends.
    expect(localStorage.getItem(LAYOUT_KEY)).toBeNull();
    fireEvent.pointerUp(divider(), { clientX: 380, pointerId: 1 });
    expect(kept().width).toBe(352);
  });

  it('stops at 224px and at 560px, however far the pointer goes', () => {
    const { container } = renderAt();
    fireEvent.pointerDown(divider(), { button: 0, clientX: 300, pointerId: 1 });
    fireEvent.pointerMove(divider(), { clientX: 0, pointerId: 1 });
    expect(layout(container).style.getPropertyValue('--rail-panel-width')).toBe('224px');
    fireEvent.pointerMove(divider(), { clientX: 2000, pointerId: 1 });
    expect(layout(container).style.getPropertyValue('--rail-panel-width')).toBe('560px');
    fireEvent.pointerUp(divider(), { pointerId: 1 });
    expect(kept().width).toBe(560);
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
    expect(kept().width).toBe(224);
  });

  it('brings the width back on the next visit', () => {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify({ width: 400 }));
    const { container } = renderAt();
    expect(divider()).toHaveAttribute('aria-valuenow', '400');
    expect(layout(container).style.getPropertyValue('--rail-panel-width')).toBe('400px');
  });

  it('is gone with the collapsed column, and hidden under 900px where the column sits over the clip', () => {
    renderAt();
    fireEvent.click(collapseButton());
    expect(screen.queryByRole('separator', { name: 'Palette width' })).toBeNull();
    const css = readFileSync(join(process.cwd(), 'src/features/tab/tab.css'), 'utf8');
    const narrow = css.slice(css.indexOf('/* Under 900px the column sits over the clip'));
    expect(narrow.slice(0, narrow.indexOf('\n}'))).toContain('.tab-rail-divider { display: none; }');
    expect(rule('.tab-rail-layout[data-open]')).toContain('var(--rail-panel-width, 17rem)');
  });
});

/* jsdom lays nothing out, so these pin the CSS that the browser check (issue: a short clip's page
   scrolled to show the footer) relied on. */
describe('the column’s height', () => {
  it('runs down the clip’s row, which takes the window’s spare height, not a whole window of its own', () => {
    const { container } = renderAt();
    const page = container.querySelector('.tab-page');
    expect(page?.querySelector(':scope > .tab-rail-layout')).not.toBeNull();
    expect(column().parentElement).toHaveClass('tab-rail-column');
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
