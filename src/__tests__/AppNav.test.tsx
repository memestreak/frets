import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
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

describe('AppNav', () => {
  it('links the FRETS wordmark home', () => {
    renderAt('/practice/notes');
    expect(screen.getByRole('link', { name: 'FRETS' })).toHaveAttribute('href', '/');
  });

  it('has no page switcher inside a section', () => {
    renderAt('/practice/notes');
    expect(screen.getAllByRole('link').map(l => l.textContent))
      .toEqual(['FRETS', 'Note trainer']);
  });

  it('names the current page in place of its section', () => {
    const { unmount } = renderAt('/practice/notes');
    expect(screen.getByRole('link', { name: 'Note trainer' }))
      .toHaveAttribute('href', '/practice');
    unmount();
    renderAt('/practice/intervals');
    expect(screen.getByText('Interval trainer')).toBeInTheDocument();
  });

  it('marks the section itself on its index page', () => {
    renderAt('/practice');
    expect(screen.getByRole('link', { name: 'Practice' }))
      .toHaveAttribute('aria-current', 'page');
  });

  it('shows the section by name on the home page', () => {
    renderAt('/');
    expect(screen.getByRole('link', { name: 'Practice' }))
      .not.toHaveAttribute('aria-current');
  });
});
