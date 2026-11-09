import { fireEvent, screen, within } from '@testing-library/react';
import { setUpPage, openWith, editor, keys, alphaTex, undo } from './helpers';

setUpPage();

const THREE = '0.6.1 |\n2.6.1 |\n3.6.1 |';
const menu = () => {
  fireEvent.contextMenu(editor());
  return screen.getByRole('menu', { name: 'Tab' });
};
const choose = (name: string | RegExp) => fireEvent.click(within(menu()).getByRole('menuitem', { name }));
/** Insert › and one of its items. */
const insert = (name: string) => {
  const top = menu();
  const item = within(top).getByRole('menuitem', { name: /^Insert›?$/ });
  fireEvent.mouseEnter(item.parentElement!);
  fireEvent.click(within(screen.getByRole('menu', { name: 'Insert' })).getByRole('menuitem', { name }));
};

describe('the bar menu (right-click on the tab)', () => {
  it('puts Insert › first, then Delete bar', async () => {
    await openWith(THREE);
    const labels = within(menu()).getAllByRole('menuitem').map(i => i.textContent);
    expect(labels.slice(0, 2)).toEqual(['Insert›', 'Delete bar']);
    expect(labels).not.toContain('Insert bar before');
    expect(labels).not.toContain('Insert bar after');
  });

  it('Insert › Bar before and Bar after add a bar of rests round the pressed bar', async () => {
    await openWith(THREE);
    keys({ key: 'ArrowRight', ctrlKey: true });
    insert('Bar before');
    expect(alphaTex()).toBe('0.6.1 |\nr.1 |\n2.6.1 |\n3.6.1 |');
    undo();
    insert('Bar after');
    expect(alphaTex()).toBe('0.6.1 |\n2.6.1 |\nr.1 |\n3.6.1 |');
  });

  it('Delete bar takes away the pressed bar, and undo brings it back', async () => {
    await openWith(THREE);
    keys({ key: 'ArrowRight', ctrlKey: true });
    choose('Delete bar');
    expect(alphaTex()).toBe('0.6.1 |\n3.6.1 |');
    undo();
    expect(alphaTex()).toBe(THREE);
  });

  it('with a selection, deletes every bar it touches, counted in the label, and nothing stays selected', async () => {
    await openWith(THREE);
    // From bar 1's note into bar 2: two bars touched, neither covered whole by time alone.
    keys({ key: 'ArrowRight', ctrlKey: true }, { key: 'ArrowRight', shiftKey: true });
    choose('Delete 2 bars');
    expect(alphaTex()).toBe('0.6.1 |');
    expect(within(menu()).getByRole('menuitem', { name: 'Delete bar' })).toBeInTheDocument();
  });

  it('deleting every bar leaves one bar of rests', async () => {
    await openWith(THREE);
    keys({ key: 'a', ctrlKey: true });
    choose('Delete 3 bars');
    expect(alphaTex()).toBe('r.1 |');
  });
});
