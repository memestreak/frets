import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { useDeselect } from '@/hooks/useDeselect';

/** A thing to select, with a control, a menu and a dialog beside it. */
function Page({ escape }: { escape?: boolean }) {
  const [picked, setPicked] = useState(false);
  useDeselect(picked, () => setPicked(false), { escape });
  return (
    <main>
      <h1>Page</h1>
      <span role="button" tabIndex={0} aria-pressed={picked} onClick={() => setPicked(true)} onKeyDown={() => {}}>Thing</span>
      <button type="button">Tool</button>
      <div role="menu"><span>Menu item</span></div>
      <div role="dialog" aria-label="Panel"><input aria-label="Field" /></div>
    </main>
  );
}

const thing = () => screen.getByRole('button', { name: 'Thing' });
const pick = () => fireEvent.click(thing());

describe('useDeselect', () => {
  it('lets the selection go on a press off it and its controls', () => {
    render(<Page />);
    pick();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Tool' }));
    fireEvent.pointerDown(screen.getByText('Menu item'));
    fireEvent.pointerDown(screen.getByLabelText('Field'));
    expect(thing()).toHaveAttribute('aria-pressed', 'true');
    fireEvent.pointerDown(screen.getByRole('heading'));
    expect(thing()).toHaveAttribute('aria-pressed', 'false');
    pick();
    fireEvent.pointerDown(document.documentElement);
    expect(thing()).toHaveAttribute('aria-pressed', 'false');
  });

  it('lets it go on Esc, unless a menu or dialog has the key or something else took it', () => {
    render(<Page />);
    pick();
    // A dialog or menu closes on its own Esc; the page's selection stays.
    fireEvent.keyDown(screen.getByLabelText('Field'), { key: 'Escape' });
    fireEvent.keyDown(screen.getByText('Menu item'), { key: 'Escape' });
    expect(thing()).toHaveAttribute('aria-pressed', 'true');
    const taken = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    taken.preventDefault();
    window.dispatchEvent(taken);
    expect(thing()).toHaveAttribute('aria-pressed', 'true');
    expect(fireEvent.keyDown(document.body, { key: 'Escape' })).toBe(false);
    expect(thing()).toHaveAttribute('aria-pressed', 'false');
    // Nothing selected: Esc is left alone.
    expect(fireEvent.keyDown(document.body, { key: 'Escape' })).toBe(true);
  });

  it('leaves Esc to the page with escape off', () => {
    render(<Page escape={false} />);
    pick();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(thing()).toHaveAttribute('aria-pressed', 'true');
  });
});
