import type { ComponentProps } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { AppNav } from '@/components/AppNav';

// jsdom can't follow a link, so the stand-in keeps the click on the page.
vi.mock('next/link', () => ({
  default: ({ children, onClick, ...rest }: ComponentProps<'a'>) => (
    <a {...rest} onClick={e => { onClick?.(e); e.preventDefault(); }}>{children}</a>
  ),
}));

const nav = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

function renderAt(pathname: string) {
  nav.pathname = pathname;
  return render(<AppNav />);
}

const menuButton = () => screen.getByRole('button', { name: 'Menu' });
const menu = () => document.getElementById('site-menu')!;
const openMenu = () => fireEvent.click(menuButton());

describe('AppNav', () => {
  it('links the Frets wordmark home', () => {
    renderAt('/practice/notes');
    expect(screen.getByRole('link', { name: 'Frets' })).toHaveAttribute('href', '/');
  });

  it('names the section and page you are on', () => {
    const { unmount } = renderAt('/practice/notes');
    expect(screen.getByTestId('nav-location')).toHaveTextContent('Practice › Note trainer');
    unmount();
    renderAt('/explore/scales');
    expect(screen.getByTestId('nav-location')).toHaveTextContent('Explore › Scale lab');
  });

  it('shows no location at home', () => {
    renderAt('/');
    expect(screen.queryByTestId('nav-location')).toBeNull();
  });

  it('keeps the menu closed until Menu is pressed', () => {
    renderAt('/practice/notes');
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
    expect(menu()).not.toBeVisible();
    openMenu();
    expect(menuButton()).toHaveAttribute('aria-expanded', 'true');
    expect(menu()).toBeVisible();
    openMenu();
    expect(menu()).not.toBeVisible();
  });

  it('lists every page under its section and marks the current one', () => {
    renderAt('/practice/notes');
    openMenu();
    const practice = within(menu()).getByRole('list', { name: 'Practice' });
    expect(within(practice).getAllByRole('link').map(l => l.getAttribute('href')))
      .toEqual(['/practice/intervals', '/practice/notes']);
    const explore = within(menu()).getByRole('list', { name: 'Explore' });
    expect(within(explore).getByRole('link')).toHaveAttribute('href', '/explore/scales');
    const current = within(menu()).getByRole('link', { current: 'page' });
    expect(current).toHaveAttribute('href', '/practice/notes');
    expect(current).toHaveTextContent('You are here');
  });

  it('moves focus into the menu and returns it to Menu on Esc', () => {
    renderAt('/practice/notes');
    openMenu();
    const first = within(menu()).getAllByRole('link')[0];
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: 'Escape' });
    expect(menu()).not.toBeVisible();
    expect(menuButton()).toHaveFocus();
  });

  it('keeps keys pressed in the open menu from the page', () => {
    const onWindowKey = vi.fn();
    window.addEventListener('keydown', onWindowKey);
    renderAt('/practice/notes');
    openMenu();
    fireEvent.keyDown(within(menu()).getAllByRole('link')[0], { key: '1' });
    expect(onWindowKey).not.toHaveBeenCalled();
    fireEvent.keyDown(within(menu()).getAllByRole('link')[0], { key: 'Escape' });
    fireEvent.keyDown(menuButton(), { key: '1' });
    expect(onWindowKey).toHaveBeenCalledTimes(1);
    window.removeEventListener('keydown', onWindowKey);
  });

  it('closes on a press outside the bar and on picking a page', () => {
    renderAt('/practice/notes');
    openMenu();
    fireEvent.pointerDown(document.body);
    expect(menu()).not.toBeVisible();
    openMenu();
    fireEvent.click(within(menu()).getByRole('link', { current: 'page' }));
    expect(menu()).not.toBeVisible();
  });

  it('closes when the page changes', () => {
    const { rerender } = renderAt('/practice/notes');
    openMenu();
    nav.pathname = '/explore/scales';
    rerender(<AppNav />);
    expect(menu()).not.toBeVisible();
  });
});
