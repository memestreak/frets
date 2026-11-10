import { act, fireEvent, screen } from '@testing-library/react';
import { emptyClip, partOf } from '@/features/tab/clip';
import { layoutClip, stringY, type Parts } from '@/features/tab/layout';
import { setUpPage, renderAt, editor } from './helpers';

setUpPage();

/** A press in the middle of the first page's one empty bar (jsdom draws the tab 800 wide at 0, 0), on a string or the staff. */
function pressEmptyBar(parts: Parts) {
  const { systems } = layoutClip(partOf(emptyClip()), 800, parts);
  const [system] = systems;
  const [bar] = system.bars;
  const y = system.top + (system.rows.tab ? stringY(system.rows, 2) : system.rows.score!.top + 8);
  const at = { clientX: (bar.x0 + bar.x1) / 2, clientY: y, button: 0 };
  const svg = screen.getByRole('img', { name: /drawn as/ });
  act(() => editor().focus());
  fireEvent.pointerDown(svg, at);
  fireEvent.pointerUp(svg, at);
  return bar;
}

describe('a press in an empty bar (issue #317)', () => {
  it.each(['tab', 'both', 'staff'] as const)('boxes the whole bar in normal mode (%s), not one column', async parts => {
    localStorage.setItem('frets.tab.notation', JSON.stringify({ show: parts }));
    renderAt();
    await screen.findAllByTestId('tab-system');
    const bar = pressEmptyBar(parts);
    const box = screen.getByTestId('bar-cursor');
    expect(Number(box.getAttribute('x'))).toBe(bar.x0);
    expect(Number(box.getAttribute('width'))).toBe(bar.x1 - bar.x0);
    expect(screen.queryByTestId('column-cursor')).toBeNull();
    // With the staff alone, no cursor head is drawn over the bar's box.
    expect(screen.queryByTestId('staff-cursor')).toBeNull();
    expect(screen.queryByTestId('staff-selected')).toBeNull();
    // Esc lets it go.
    fireEvent.keyDown(editor(), { key: 'Escape' });
    expect(screen.queryByTestId('bar-cursor')).toBeNull();
  });

  it('keeps note input mode’s own cursor there: no box round the bar', async () => {
    renderAt();
    await screen.findAllByTestId('tab-system');
    act(() => editor().focus());
    fireEvent.keyDown(editor(), { key: 'n' });
    pressEmptyBar('tab');
    expect(screen.queryByTestId('bar-cursor')).toBeNull();
  });
});

/** A double-click on the staff of the first page's one empty bar, Both view, at its middle line's height. */
function doubleClickStaff() {
  const { systems } = layoutClip(partOf(emptyClip()), 800, 'both');
  const [system] = systems;
  const [bar] = system.bars;
  const at = { clientX: (bar.x0 + bar.x1) / 2, clientY: system.top + system.rows.score!.top + 8 };
  fireEvent.doubleClick(screen.getByRole('img', { name: /drawn as/ }), at);
}

const pencil = () => screen.getByRole('button', { name: 'Note input mode' });
/** The ticks of the Grid's ruler: the lines in its group but the ruler's own. */
const gridTicks = () => screen.getByTestId('grid-lines').querySelectorAll('line').length - 1;

describe('note input mode in a new arrangement (issues #421, #422)', () => {
  it('a double-click on the staff in Both view puts the caret on the staff, with its Grid', async () => {
    localStorage.setItem('frets.tab.notation', JSON.stringify({ show: 'both' }));
    renderAt();
    await screen.findAllByTestId('tab-system');
    doubleClickStaff();
    expect(pencil()).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('staff-caret')).toBeInTheDocument();
    expect(screen.queryByTestId('tab-caret')).toBeNull();
    expect(screen.queryByTestId('input-cursor')).toBeNull();
    expect(screen.getByTestId('grid-lines')).toHaveAttribute('data-part', 'staff');
    // A quarter note's Grid over a 4/4 bar: a tick on each beat.
    expect(gridTicks()).toBe(4);
    // The bar as its rest is the same music: nothing to save.
    expect(screen.queryByTestId('unsaved')).toBeNull();
  });

  it('N draws the Grid with its ticks, and the bar as its Whole-bar rest is no change to save', async () => {
    renderAt();
    await screen.findAllByTestId('tab-system');
    act(() => editor().focus());
    fireEvent.keyDown(editor(), { key: 'n' });
    expect(gridTicks()).toBe(4);
    expect(screen.queryByTestId('unsaved')).toBeNull();
    // Still an empty arrangement, so the line under it still says how to start.
    expect(screen.getByTestId('tab-notice')).toHaveTextContent('Click the tab and type frets');
    // → steps along the Grid inside the rest, as in any rest.
    const caretX = () => screen.getByTestId('input-cursor').getAttribute('x');
    const x = caretX();
    fireEvent.keyDown(editor(), { key: 'ArrowRight' });
    expect(caretX()).not.toBe(x);
  });
});

describe('a press that takes the caret away ends note input mode', () => {
  it('on blank space below the clip', async () => {
    renderAt();
    await screen.findAllByTestId('tab-system');
    act(() => editor().focus());
    fireEvent.keyDown(editor(), { key: 'n' });
    expect(pencil()).toHaveAttribute('aria-pressed', 'true');
    const svg = screen.getByRole('img', { name: /drawn as/ });
    const { height } = layoutClip(partOf(emptyClip()), 800, 'tab');
    fireEvent.pointerDown(svg, { clientX: 790, clientY: height + 200, button: 0 });
    fireEvent.pointerUp(svg, { clientX: 790, clientY: height + 200, button: 0 });
    fireEvent.mouseDown(document.body);
    fireEvent.pointerDown(document.body);
    expect(pencil()).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('a press above the staff in note input mode', () => {
  it('places the playback line and ends note input mode', async () => {
    renderAt();
    await screen.findAllByTestId('tab-system');
    act(() => editor().focus());
    fireEvent.keyDown(editor(), { key: 'n' });
    const [bar] = layoutClip(partOf(emptyClip()), 800, 'tab').systems[0].bars;
    // Just above the drawing, where a press places the playback line.
    const at = { clientX: (bar.x0 + bar.x1) / 2, clientY: -8, button: 0 };
    const svg = screen.getByRole('img', { name: /drawn as/ });
    fireEvent.pointerDown(svg, at);
    fireEvent.pointerUp(svg, at);
    expect(pencil()).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('the focus moving off the clip in note input mode', () => {
  it('ends note input mode (Tab to another control), but not for the clip’s own fields', async () => {
    renderAt();
    await screen.findAllByTestId('tab-system');
    act(() => editor().focus());
    fireEvent.keyDown(editor(), { key: 'n' });
    // Shift+Q opens the chord popover over the tab: still note input mode, and Esc brings the caret back.
    fireEvent.keyDown(editor(), { key: 'Q', shiftKey: true });
    await act(async () => { await new Promise(r => setTimeout(r, 10)); });
    expect(pencil()).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await act(async () => { await new Promise(r => setTimeout(r, 10)); });
    expect(pencil()).toHaveAttribute('aria-pressed', 'true');
    act(() => screen.getByRole('button', { name: 'New' }).focus());
    await act(async () => { await new Promise(r => setTimeout(r, 10)); });
    expect(pencil()).toHaveAttribute('aria-pressed', 'false');
  });
});
