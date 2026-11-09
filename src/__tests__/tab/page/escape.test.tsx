import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { setUpPage, renderAt, SLOW, editor, keys, isLit } from './helpers';

setUpPage();

/** Esc leaves note input mode wherever the keys are on the page (Jeremy, 2026-11-03); an open panel takes it first. */
describe('Esc always leaves note input mode', () => {
  const pencil = () => screen.getByRole('button', { name: 'Note input mode' });
  const inNoteInputMode = () => {
    renderAt();
    act(() => editor().focus());
    keys('n');
    expect(pencil()).toHaveAttribute('aria-pressed', 'true');
  };

  it('after a press off the tab, with the keys on the page', () => {
    inNoteInputMode();
    act(() => editor().blur());
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(pencil()).toHaveAttribute('aria-pressed', 'false');
  });

  it('with the keys on a palette or rail button', () => {
    inNoteInputMode();
    const button = screen.getByRole('button', { name: 'Eighth note' });
    act(() => button.focus());
    fireEvent.keyDown(button, { key: 'Escape' });
    expect(pencil()).toHaveAttribute('aria-pressed', 'false');
  });

  it('with the title picked, letting it go too', async () => {
    inNoteInputMode();
    const title = await waitFor(() => screen.getByRole('button', { name: 'Untitled' }), SLOW);
    fireEvent.click(title);
    expect(title).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(title, { key: 'Escape' });
    expect(title).toHaveAttribute('aria-pressed', 'false');
    expect(pencil()).toHaveAttribute('aria-pressed', 'false');
  });

  it('with a modifier held', () => {
    inNoteInputMode();
    act(() => editor().blur());
    fireEvent.keyDown(document.body, { key: 'Escape', shiftKey: true });
    expect(pencil()).toHaveAttribute('aria-pressed', 'false');
  });

  it('closes an open palette panel first, then leaves on the next Esc', () => {
    inNoteInputMode();
    fireEvent.click(screen.getByRole('button', { name: /^Note input grid/ }));
    expect(screen.getByRole('dialog', { name: 'Note input grid' })).toBeInTheDocument();
    keys('Escape');
    expect(screen.queryByRole('dialog', { name: 'Note input grid' })).toBeNull();
    expect(pencil()).toHaveAttribute('aria-pressed', 'true');
    keys('Escape');
    expect(pencil()).toHaveAttribute('aria-pressed', 'false');
  });

  it('closes a panel open over the tab first, even with the keys on the tab', () => {
    inNoteInputMode();
    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    document.body.append(panel);
    keys('Escape');
    expect(pencil()).toHaveAttribute('aria-pressed', 'true');
    act(() => editor().blur());
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(pencil()).toHaveAttribute('aria-pressed', 'true');
    panel.remove();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(pencil()).toHaveAttribute('aria-pressed', 'false');
  });

  it('with a mark picked', async () => {
    renderAt(`#tab=${encodeURIComponent('5.1{v}.4 |')}`);
    await waitFor(() => expect(screen.getAllByTestId('vibrato').length).toBeGreaterThan(0), SLOW);
    act(() => editor().focus());
    keys('n');
    // Alt+→ steps through the notes and marks, as MuseScore's does, to the vibrato.
    for (let k = 0; k < 4 && !isLit(screen.getAllByTestId('vibrato')[0]); k++) keys({ key: 'ArrowRight', altKey: true });
    expect(isLit(screen.getAllByTestId('vibrato')[0])).toBe(true);
    expect(pencil()).toHaveAttribute('aria-pressed', 'true');
    keys('Escape');
    expect(pencil()).toHaveAttribute('aria-pressed', 'false');
  });
});
