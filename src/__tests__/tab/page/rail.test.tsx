import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { LAYOUT_KEY, PANEL_WIDTH, parseLayout } from '@/features/tab/TabRail';
import { setUpPage, renderAt, alphaTex, openWith } from './helpers';

setUpPage();

const railButton = (name: string) => screen.getByRole('button', { name });
const panel = () => screen.queryByRole('complementary');

/** The declarations of a rule in tab.css, found by its exact selector (the first such rule). */
const rule = (selector: string) => {
  const css = readFileSync(join(process.cwd(), 'src/features/tab/tab.css'), 'utf8');
  const start = css.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf('}', start));
};

describe('the rail of panels (issue #301)', () => {
  it('opens Notes on a first visit, with the note input mode pencil, Duration and Rhythm', () => {
    renderAt();
    expect(railButton('Notes')).toHaveAttribute('aria-pressed', 'true');
    expect(panel()).toHaveAccessibleName('Notes');
    expect(screen.getByRole('button', { name: 'Note input mode' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Quarter note/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Tuplet/ })).toBeInTheDocument();
    // The other panels' tools are not shown.
    expect(screen.queryByRole('button', { name: /^Vibrato/ })).toBeNull();
  });

  it('shows one panel at a time; its rail button again, or the panel’s chevron, closes it', () => {
    renderAt();
    fireEvent.click(railButton('Articulations'));
    expect(panel()).toHaveAccessibleName('Articulations');
    expect(railButton('Notes')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /^Vibrato/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Note input mode' })).toBeNull();
    fireEvent.click(railButton('Articulations'));
    expect(panel()).toBeNull();
    fireEvent.click(railButton('Bars'));
    expect(screen.getByRole('button', { name: 'Double bar line at the end of this bar' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close Bars' }));
    expect(panel()).toBeNull();
    expect(railButton('Bars')).toHaveAttribute('aria-pressed', 'false');
  });

  it('keeps the open panel, or none, across visits', () => {
    renderAt();
    fireEvent.click(railButton('Bars'));
    expect(JSON.parse(localStorage.getItem(LAYOUT_KEY)!)).toEqual({ panel: 'bars', width: PANEL_WIDTH.start });
    cleanup();
    renderAt();
    expect(panel()).toHaveAccessibleName('Bars');
    fireEvent.click(railButton('Bars'));
    cleanup();
    renderAt();
    expect(panel()).toBeNull();
  });

  it('keeps the tab’s cursor when a rail button and a tool are pressed', async () => {
    await openWith('5.1.1 |');
    fireEvent.click(railButton('Articulations'));
    fireEvent.click(screen.getByRole('button', { name: 'Palm mute' }));
    expect(alphaTex()).toContain('5.1{pm}');
    // A clip from a link takes alphaTab a while to draw the first time in a busy run.
  }, 20000);
});

describe('parseLayout', () => {
  const panelOf = (text: string | null) => parseLayout(text).panel;
  const widthOf = (text: string | null) => parseLayout(text).width;

  it('reads a panel or none, and opens Notes for anything else', () => {
    expect(panelOf(JSON.stringify({ panel: 'articulations' }))).toBe('articulations');
    expect(panelOf(JSON.stringify({ panel: null }))).toBeNull();
    expect(panelOf(null)).toBe('notes');
    expect(panelOf('not json')).toBe('notes');
    expect(panelOf(JSON.stringify({ panel: 'chords' }))).toBe('chords');
    expect(panelOf(JSON.stringify({ panel: 'tuplets' }))).toBe('notes');
    expect(panelOf(JSON.stringify(['bars']))).toBe('notes');
  });

  it('reads the panels’ width, 272px (17rem) when missing or unreadable, kept between 224 and 560', () => {
    expect(widthOf(JSON.stringify({ panel: 'bars', width: 320 }))).toBe(320);
    expect(widthOf(JSON.stringify({ panel: 'bars' }))).toBe(272);
    expect(widthOf(null)).toBe(272);
    expect(widthOf(JSON.stringify({ width: '320' }))).toBe(272);
    expect(widthOf(JSON.stringify({ width: null }))).toBe(272);
    expect(widthOf(JSON.stringify({ width: 100 }))).toBe(224);
    expect(widthOf(JSON.stringify({ width: 9000 }))).toBe(560);
    expect(widthOf(JSON.stringify({ width: 300.6 }))).toBe(301);
    // A width alone keeps the first visit's panel.
    expect(panelOf(JSON.stringify({ width: 320 }))).toBe('notes');
  });
});

describe('dragging the line between the panel and the clip (issue #431)', () => {
  const divider = () => screen.getByRole('separator', { name: 'Panel width' });
  const layout = (container: HTMLElement) => container.querySelector<HTMLElement>('.tab-rail-layout')!;
  const kept = () => JSON.parse(localStorage.getItem(LAYOUT_KEY)!);

  it('widens or narrows every panel as far as the pointer moves, and keeps the width on letting go', () => {
    const { container } = renderAt();
    expect(divider()).toHaveAttribute('aria-valuenow', '272');
    fireEvent.pointerDown(divider(), { button: 0, clientX: 300, pointerId: 1 });
    fireEvent.pointerMove(divider(), { clientX: 380, pointerId: 1 });
    expect(layout(container).style.getPropertyValue('--rail-panel-width')).toBe('352px');
    // Not kept until the drag ends.
    expect(localStorage.getItem(LAYOUT_KEY)).toBeNull();
    fireEvent.pointerUp(divider(), { clientX: 380, pointerId: 1 });
    expect(kept()).toEqual({ panel: 'notes', width: 352 });
    // Switching panels keeps the width: the clip doesn't move.
    fireEvent.click(railButton('Bars'));
    expect(divider()).toHaveAttribute('aria-valuenow', '352');
    expect(kept()).toEqual({ panel: 'bars', width: 352 });
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
    localStorage.setItem(LAYOUT_KEY, JSON.stringify({ panel: 'chords', width: 400 }));
    const { container } = renderAt();
    expect(panel()).toHaveAccessibleName('Chords');
    expect(divider()).toHaveAttribute('aria-valuenow', '400');
    expect(layout(container).style.getPropertyValue('--rail-panel-width')).toBe('400px');
  });

  it('is gone with the panel, and hidden under 900px where the panel sits over the clip', () => {
    renderAt();
    fireEvent.click(railButton('Notes'));
    expect(screen.queryByRole('separator', { name: 'Panel width' })).toBeNull();
    const css = readFileSync(join(process.cwd(), 'src/features/tab/tab.css'), 'utf8');
    const narrow = css.slice(css.indexOf('@media (max-width: 899px)'));
    expect(narrow.slice(0, narrow.indexOf('\n}'))).toContain('.tab-rail-divider { display: none; }');
    expect(rule('.tab-rail-layout[data-open]')).toContain('var(--rail-panel-width, 17rem)');
  });
});

/* jsdom lays nothing out, so these pin the CSS that the browser check (issue: a short clip's page
   scrolled to show the footer) relied on. */
describe('the panel’s height', () => {
  it('runs down the clip’s row, which takes the window’s spare height, not a whole window of its own', () => {
    const { container } = renderAt();
    const page = container.querySelector('.tab-page');
    expect(page?.querySelector(':scope > .tab-rail-layout')).not.toBeNull();
    expect(panel()?.parentElement).toHaveClass('tab-rail-column');
    expect(rule('main:has(> .tab-page)')).toContain('flex-direction: column');
    expect(rule('.tab-page')).toContain('flex: 1');
    expect(rule('.tab-page > .tab-rail-layout')).toContain('flex: 1');
    expect(rule('.tab-rail-column')).toContain('align-self: stretch');
    const own = rule('.tab-rail-panel');
    expect(own).toContain('height: 100%');
    expect(own).toContain('max-height: calc(100vh - 32px)');
    // No height of its own taken from the window: that put the footer a scroll away under a short clip.
    expect(own).not.toMatch(/(^|[\s;])min-height:\s*calc\(100vh/);
  });
});

