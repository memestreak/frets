import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { LetGoAfterUse } from '@/components/LetGoAfterUse';

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
});
