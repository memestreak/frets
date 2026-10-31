import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { LetGoAfterUse } from '@/components/LetGoAfterUse';
import { letGoOfFields } from '@/hooks/useLetGoAfterUse';

afterEach(cleanup);

/** A press with the mouse or a finger: the browser focuses the widget, then clicks it with a `detail` of 1. */
function press(el: HTMLElement) {
  fireEvent.pointerDown(el);
  act(() => el.focus());
  fireEvent.click(el, { detail: 1 });
  act(() => { vi.runAllTimers(); });
}

/** A button whose click moves the focus to a field, as a button opening a popover does. */
function Opener() {
  const field = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" onClick={() => field.current?.focus()}>Open</button>
      <input ref={field} aria-label="Inside" />
    </>
  );
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('LetGoAfterUse', () => {
  it('lets go of a pressed button or link, but not one pressed from the keyboard', () => {
    render(<><LetGoAfterUse /><button type="button">Tab</button><a href="#x">Scale lab</a></>);
    const button = screen.getByRole('button', { name: 'Tab' });
    press(button);
    expect(button).not.toHaveFocus();
    press(screen.getByRole('link', { name: 'Scale lab' }));
    expect(screen.getByRole('link', { name: 'Scale lab' })).not.toHaveFocus();

    // Enter or Space on a focused button clicks it with a detail of 0.
    act(() => button.focus());
    fireEvent.click(button, { detail: 0 });
    act(() => { vi.runAllTimers(); });
    expect(button).toHaveFocus();
  });

  it('leaves the focus where the click moved it', () => {
    render(<><LetGoAfterUse /><Opener /></>);
    press(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('textbox', { name: 'Inside' })).toHaveFocus();
  });

  it('keeps the focus in a dialog, a menu, a radio group and under data-keep-focus', () => {
    render(
      <>
        <LetGoAfterUse />
        <div role="dialog" aria-label="D"><button type="button">In dialog</button></div>
        <div role="menu"><button type="button" role="menuitem">In menu</button></div>
        <div role="radiogroup" aria-label="R"><button type="button" role="radio" aria-checked="true">C</button></div>
        <div data-keep-focus><button type="button">Kept</button></div>
      </>,
    );
    for (const el of [
      screen.getByRole('button', { name: 'In dialog' }),
      screen.getByRole('menuitem', { name: 'In menu' }),
      screen.getByRole('radio', { name: 'C' }),
      screen.getByRole('button', { name: 'Kept' }),
    ]) {
      press(el);
      expect(el).toHaveFocus();
    }
  });

  it('lets go of a list once a choice is made in it after a press, but not one stepped from the keyboard', () => {
    render(
      <>
        <LetGoAfterUse />
        <select aria-label="Track" defaultValue="0"><option value="0">A</option><option value="1">B</option></select>
      </>,
    );
    const list = screen.getByRole('combobox', { name: 'Track' });
    fireEvent.pointerDown(list);
    act(() => list.focus());
    fireEvent.change(list, { target: { value: '1' } });
    expect(list).not.toHaveFocus();

    // Tabbed to and stepped with the arrows: each step keeps the focus.
    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => list.focus());
    fireEvent.change(list, { target: { value: '0' } });
    expect(list).toHaveFocus();
  });

  it('lets go of a pressed button again when the dialog it opened closes and hands the focus back', () => {
    render(
      <>
        <LetGoAfterUse />
        <button type="button" onClick={() => (document.getElementById('d') as HTMLDialogElement).showModal()}>Export</button>
        <dialog id="d" aria-label="Export"><button type="button">Inside</button></dialog>
      </>,
    );
    const opener = screen.getByRole('button', { name: 'Export' });
    const dialog = document.getElementById('d') as HTMLDialogElement;
    /** Closes the dialog as Esc does, the browser giving the focus back to the opener. */
    const close = () => {
      act(() => {
        dialog.close();
        dialog.dispatchEvent(new Event('close'));
        opener.focus();
      });
      act(() => { vi.runAllTimers(); });
    };
    press(opener);
    close();
    expect(opener).not.toHaveFocus();

    // Opened from the keyboard, it keeps the focus when the dialog closes.
    act(() => opener.focus());
    fireEvent.click(opener, { detail: 0 });
    close();
    expect(opener).toHaveFocus();
  });

  it('lets go of a list opened by a press and closed with no choice, at the mouse’s next move', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(0);
    render(<><LetGoAfterUse /><select aria-label="Sound"><option>A</option></select><p>Page</p></>);
    const list = screen.getByRole('combobox', { name: 'Sound' });
    fireEvent.pointerDown(list);
    act(() => list.focus());
    // A move as the list opens isn't one over the page.
    fireEvent.pointerMove(screen.getByText('Page'), { pointerType: 'mouse' });
    expect(list).toHaveFocus();
    now.mockReturnValue(1000);
    fireEvent.pointerMove(screen.getByText('Page'), { pointerType: 'mouse' });
    expect(list).not.toHaveFocus();
    now.mockRestore();
  });

  it('letGoOfFields lets go of a field being typed in, but not its own', () => {
    render(<><input aria-label="Swing" /><span data-testid="field"><input aria-label="Clicks" /></span></>);
    const swing = screen.getByRole('textbox', { name: 'Swing' });
    act(() => swing.focus());
    letGoOfFields();
    expect(swing).not.toHaveFocus();
    const clicks = screen.getByRole('textbox', { name: 'Clicks' });
    act(() => clicks.focus());
    letGoOfFields(screen.getByTestId('field'));
    expect(clicks).toHaveFocus();
  });
});
