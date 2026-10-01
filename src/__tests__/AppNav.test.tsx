import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import { AppNav } from '@/components/AppNav';

vi.mock('next/link', () => ({
  default: ({ children, ...rest }: ComponentProps<'a'>) => (
    <a {...rest}>{children}</a>
  ),
}));

describe('AppNav', () => {
  it('links the two trainers and marks the active one', () => {
    render(<AppNav active="notes" />);
    expect(screen.getByRole('link', { name: 'Intervals' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Notes' }))
      .toHaveAttribute('aria-current', 'page');
  });

  it('shows no placeholders for unbuilt sections', () => {
    render(<AppNav active="intervals" />);
    for (const label of ['Chords', 'Scales', 'Ear training']) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });
});
