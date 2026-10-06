import type { ComponentProps } from 'react';
import { render, screen, within } from '@testing-library/react';
import { AppNav } from '@/components/AppNav';

vi.mock('next/link', () => ({
  default: ({ children, ...rest }: ComponentProps<'a'>) => (
    <a {...rest}>{children}</a>
  ),
}));

const nav = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

function renderAt(pathname: string) {
  nav.pathname = pathname;
  return render(<AppNav />);
}

const crumbs = () => within(screen.getByRole('navigation', { name: 'Breadcrumb' }))
  .getAllByRole('listitem')
  .map(li => li.textContent);

describe('AppNav', () => {
  it('shows the path to a page, linking every crumb but the last', () => {
    renderAt('/explore/scales');
    expect(crumbs()).toEqual(['Frets', '›Explore', '›Scale lab']);
    expect(screen.getByRole('link', { name: 'Frets' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Explore' }))
      .toHaveAttribute('href', '/explore');
    expect(screen.queryByRole('link', { name: 'Scale lab' })).toBeNull();
    expect(screen.getByText('Scale lab')).toHaveAttribute('aria-current', 'page');
  });

  it('ends at the section on its section page', () => {
    renderAt('/practice');
    expect(crumbs()).toEqual(['Frets', '›Practice']);
    expect(screen.queryByRole('link', { name: 'Practice' })).toBeNull();
    expect(screen.getByText('Practice')).toHaveAttribute('aria-current', 'page');
  });

  it('is just Frets at home, marked as the current page', () => {
    renderAt('/');
    expect(crumbs()).toEqual(['Frets']);
    expect(screen.getByRole('link', { name: 'Frets' }))
      .toHaveAttribute('aria-current', 'page');
  });

  it('does not mark Frets as current away from home', () => {
    renderAt('/chords/lab');
    expect(screen.getByRole('link', { name: 'Frets' }))
      .not.toHaveAttribute('aria-current');
  });

  it('keeps the theme switch outside the breadcrumb', () => {
    renderAt('/practice/notes');
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(breadcrumb).queryByRole('button')).toBeNull();
    expect(screen.getByRole('button', { name: /^Theme: / })).toBeInTheDocument();
  });
});
