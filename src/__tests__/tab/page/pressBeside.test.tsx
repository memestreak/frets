import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { setUpPage, renderAt, alphaTex, SLOW, editor } from './helpers';

setUpPage();

/** A press picks a note only when it lands on it; beside it, normal mode selects the bar (issue #478). */
describe('TabPage: a press beside a note (issue #478)', () => {
  const TEX = '\\ts (4 4)\n3.1.4 5.1.4 3.1.4 3.2.4 |';
  const open = async (show: 'tab' | 'both' | 'staff') => {
    localStorage.setItem('frets.tab.notation', JSON.stringify({ show }));
    renderAt(`#tab=${encodeURIComponent(TEX)}`);
    await waitFor(() => expect(screen.getAllByTestId('tab-system').length).toBeGreaterThan(0), SLOW);
    act(() => editor().focus());
  };
  const svg = () => screen.getByRole('img', { name: /drawn as/ });
  const press = (at: { clientX: number; clientY: number }, button = 0) => {
    fireEvent.pointerDown(svg(), { ...at, button });
    fireEvent.pointerUp(svg(), { ...at, button });
  };
  /** Where the k-th fret number on the tab (the clip's are 3s and 5s, the time signature's 4s) is drawn (jsdom places the drawing at 0, 0), on its string. */
  const numberAt = (k: number) => {
    const text = [...document.querySelectorAll('[data-testid="tab-system"] text')].filter(t => /^[35]$/.test(t.textContent ?? ''))[k];
    const system = text.closest('[data-testid="tab-system"]')!;
    const top = Number(/translate\(0 ([\d.-]+)\)/.exec(system.getAttribute('transform')!)![1]);
    return { clientX: Number(text.getAttribute('x')), clientY: top + Number(text.getAttribute('y')) - 4 };
  };

  it('on the tab, a press on a number selects its note', async () => {
    await open('tab');
    press(numberAt(0));
    expect(screen.getByTestId('selected-note')).toBeInTheDocument();
    expect(screen.queryByTestId('range-box')).toBeNull();
  });

  it('on the tab, a press on the string halfway to the next note selects the bar, not the note', async () => {
    await open('tab');
    const [a, b] = [numberAt(0), numberAt(1)];
    press({ clientX: (a.clientX + b.clientX) / 2 - 2, clientY: a.clientY });
    expect(screen.queryByTestId('selected-note')).toBeNull();
    expect(screen.getAllByTestId('range-box')).toHaveLength(1);
  });

  it('on the tab, a press a little right of a one-digit number, past its box, selects the bar', async () => {
    await open('tab');
    const a = numberAt(0);
    press({ clientX: a.clientX + 10, clientY: a.clientY });
    expect(screen.queryByTestId('selected-note')).toBeNull();
    expect(screen.getAllByTestId('range-box')).toHaveLength(1);
    // Just inside it, the note.
    press({ clientX: a.clientX + 7, clientY: a.clientY });
    expect(screen.getByTestId('selected-note')).toBeInTheDocument();
  });

  it('on the tab, a right-click beside a note opens the bar’s menu, not the note’s', async () => {
    await open('tab');
    const a = numberAt(0);
    press({ clientX: a.clientX + 14, clientY: a.clientY }, 2);
    fireEvent.contextMenu(svg(), { clientX: a.clientX + 14, clientY: a.clientY });
    expect(await screen.findByRole('menuitem', { name: /Delete bar/ })).toBeInTheDocument();
  });

  it('in note input mode, a press beside a note on its string writes nothing over it', async () => {
    await open('tab');
    fireEvent.keyDown(editor(), { key: 'n' });
    const a = numberAt(0);
    press({ clientX: a.clientX + 10, clientY: a.clientY });
    expect(alphaTex()).toBe('3.1.4 5.1.4 3.1.4 3.2.4 |');
  });

  it.each(['both', 'staff'] as const)('on the staff (%s), a press a line above a head selects the bar, not the note', async show => {
    await open(show);
    const path = screen.getAllByTestId('staff-head')[0].querySelector('path')!;
    const [, x, y] = /translate\(([\d.-]+) ([\d.-]+)\)/.exec(path.getAttribute('transform')!)!.map(Number);
    press({ clientX: x + 5, clientY: y });
    expect(screen.getByTestId('staff-selected')).toBeInTheDocument();
    fireEvent.keyDown(editor(), { key: 'Escape' });
    // A whole space up: the next line, which held the head before (it reached a space up or down).
    press({ clientX: x + 5, clientY: y - 9 });
    expect(screen.queryByTestId('staff-selected')).toBeNull();
    expect(screen.getAllByTestId('range-box')).toHaveLength(1);
  });
});
