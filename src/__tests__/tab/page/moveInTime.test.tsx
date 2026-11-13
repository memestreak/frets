/**
 * Alt+← → move the picked chord, note or selection by the grid (issue #473,
 * `docs/specs/2026-11-13-tab-move-in-time-design.md`), as Dorico's do.
 */
import { act, screen } from '@testing-library/react';
import { setUpPage, renderAt, SLOW, undo, editor, keys, alphaTex } from './helpers';

setUpPage();

const open = async (text: string) => {
  renderAt(`#tab=${encodeURIComponent(`\\title "Moves"\n\\ts (4 4)\n${text}`)}`);
  await screen.findByRole('heading', { name: 'Moves' }, SLOW);
  act(() => editor().focus());
};
const alt = (key: string, more: { ctrlKey?: boolean; shiftKey?: boolean } = {}) => keys({ key, altKey: true, ...more });

describe('TabPage: Alt+← → move by the grid (issue #473)', () => {
  it('moves the picked sixteenth chord a sixteenth earlier, by its own length with no fixed grid, as one undo step', async () => {
    await open('r.4 r.4 (5.1 3.2 4.3 5.4).16 r.16 r.8 r.4 |');
    const before = alphaTex();
    keys('ArrowRight', 'ArrowRight');
    alt('ArrowLeft');
    expect(alphaTex()).toBe('r.4 r.8 r.16 (5.1 3.2 4.3 5.4).16 r.2 |');
    // Again: it keeps moving, the chord still picked.
    alt('ArrowLeft');
    expect(alphaTex()).toBe('r.4 r.8 (5.1 3.2 4.3 5.4).16 r.16 r.2 |');
    undo();
    undo();
    expect(alphaTex()).toBe(before);
  });

  it('with the fixed grid on, moves by the grid: an eighth', async () => {
    localStorage.setItem('frets.tab.editing', JSON.stringify({ fixedGrid: true, grid: 8 }));
    await open('5.1.4 r.4 r.2 |');
    alt('ArrowRight');
    expect(alphaTex()).toBe('r.8 5.1.4 r.8 r.2 |');
  });

  it('does nothing in note input mode, and Ctrl/⌘+Alt+← → still step through notes', async () => {
    await open('5.1.4 7.1.4 r.2 |');
    const before = alphaTex();
    keys('n');
    alt('ArrowRight');
    keys('Escape');
    expect(alphaTex()).toBe(before);
    alt('ArrowRight', { ctrlKey: true });
    expect(alphaTex()).toBe(before);
    expect(screen.getByTestId('selected-note')).toBeInTheDocument();
  });
});
