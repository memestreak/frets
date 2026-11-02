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

  it('keeps note input’s own cursor there: no box round the bar', async () => {
    renderAt();
    await screen.findAllByTestId('tab-system');
    act(() => editor().focus());
    fireEvent.keyDown(editor(), { key: 'n' });
    pressEmptyBar('tab');
    expect(screen.queryByTestId('bar-cursor')).toBeNull();
  });
});
