import type { ComponentProps } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { AppNav } from '@/components/AppNav';

vi.mock('next/link', () => ({
  default: ({ children, ...rest }: ComponentProps<'a'>) => (
    <a {...rest}>{children}</a>
  ),
}));

// jsdom can't follow a link, so clicks on one stay on the page.
const stayOnPage = (e: MouseEvent) => e.preventDefault();
beforeAll(() => document.addEventListener('click', stayOnPage));
afterAll(() => document.removeEventListener('click', stayOnPage));

const nav = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

function renderAt(pathname: string) {
  nav.pathname = pathname;
  return render(<AppNav />);
}

const crumbs = () => screen.getByRole('button', { name: /show every page$/ });
const menu = () => document.getElementById('site-menu')!;
const openMenu = () => fireEvent.click(crumbs());

describe('AppNav', () => {
  it('links the logo home', () => {
    renderAt('/practice/notes');
    expect(screen.getByRole('link', { name: 'Frets' })).toHaveAttribute('href', '/');
  });

  it('shows the path to a page as breadcrumbs', () => {
    const { unmount } = renderAt('/explore/scales');
    expect(crumbs()).toHaveTextContent('›Explore›Scale lab');
    expect(crumbs()).toHaveAccessibleName('Explore › Scale lab: show every page');
    unmount();
    renderAt('/practice');
    expect(crumbs()).toHaveAccessibleName('Practice: show every page');
  });

  it('has no breadcrumbs at home, where the logo is the current page', () => {
    renderAt('/');
    expect(screen.queryByRole('button', { name: /show every page$/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Frets' }))
      .toHaveAttribute('aria-current', 'page');
  });

  it('opens and closes the menu from the breadcrumbs', () => {
    renderAt('/practice/notes');
    expect(crumbs()).toHaveAttribute('aria-expanded', 'false');
    expect(menu()).not.toBeVisible();
    openMenu();
    expect(crumbs()).toHaveAttribute('aria-expanded', 'true');
    expect(menu()).toBeVisible();
    openMenu();
    expect(menu()).not.toBeVisible();
  });

  it('lists every section and page, marking the current page', () => {
    renderAt('/practice/notes');
    openMenu();
    const practice = within(menu()).getByRole('list', { name: 'Practice' });
    expect(within(practice).getAllByRole('link').map(l => l.getAttribute('href')))
      .toEqual(['/practice/intervals', '/practice/notes']);
    expect(within(menu()).getByRole('link', { name: 'Explore' }))
      .toHaveAttribute('href', '/explore');
    const current = within(menu()).getByRole('link', { current: 'page' });
    expect(current).toHaveAttribute('href', '/practice/notes');
    expect(current).toHaveTextContent('You are here');
  });

  it('marks the section itself on its section page', () => {
    renderAt('/chords');
    openMenu();
    const current = within(menu()).getByRole('link', { current: 'page' });
    expect(current).toHaveAttribute('href', '/chords');
    expect(current).toHaveTextContent('You are here');
  });

  it('focuses the current page in the menu and returns to the breadcrumbs on Esc', () => {
    renderAt('/practice/notes');
    openMenu();
    const current = within(menu()).getByRole('link', { current: 'page' });
    expect(current).toHaveFocus();
    fireEvent.keyDown(current, { key: 'Escape' });
    expect(menu()).not.toBeVisible();
    expect(crumbs()).toHaveFocus();
  });

  it('keeps keys pressed in the open menu from the page', () => {
    const onWindowKey = vi.fn();
    window.addEventListener('keydown', onWindowKey);
    renderAt('/practice/notes');
    openMenu();
    const link = within(menu()).getAllByRole('link')[0];
    fireEvent.keyDown(link, { key: '1' });
    expect(onWindowKey).not.toHaveBeenCalled();
    fireEvent.keyDown(link, { key: 'Escape' });
    fireEvent.keyDown(crumbs(), { key: '1' });
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
