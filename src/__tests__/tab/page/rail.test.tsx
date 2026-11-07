import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { LAYOUT_KEY, parseLayout } from '@/features/tab/TabRail';
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
  it('opens Notes on a first visit, with the note input pencil, Duration and Rhythm', () => {
    renderAt();
    expect(railButton('Notes')).toHaveAttribute('aria-pressed', 'true');
    expect(panel()).toHaveAccessibleName('Notes');
    expect(screen.getByRole('button', { name: 'Note input' })).toBeInTheDocument();
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
    expect(screen.queryByRole('button', { name: 'Note input' })).toBeNull();
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
    expect(JSON.parse(localStorage.getItem(LAYOUT_KEY)!)).toEqual({ panel: 'bars' });
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
  it('reads a panel or none, and opens Notes for anything else', () => {
    expect(parseLayout(JSON.stringify({ panel: 'articulations' }))).toBe('articulations');
    expect(parseLayout(JSON.stringify({ panel: null }))).toBeNull();
    expect(parseLayout(null)).toBe('notes');
    expect(parseLayout('not json')).toBe('notes');
    expect(parseLayout(JSON.stringify({ panel: 'chords' }))).toBe('chords');
    expect(parseLayout(JSON.stringify(['bars']))).toBe('notes');
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

