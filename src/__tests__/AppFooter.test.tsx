import { render, screen } from '@testing-library/react';
import { AppFooter } from '@/components/AppFooter';

const REPO = 'https://github.com/memestreak/frets';

describe('AppFooter', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('links to the source code in a new tab', () => {
    render(<AppFooter />);
    const link = screen.getByRole('link', { name: 'Source Code' });
    expect(link).toHaveAttribute('href', REPO);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('credits the chord shapes\' source and licence', () => {
    render(<AppFooter />);
    expect(screen.getByRole('link', { name: 'Haus of Chords' }))
      .toHaveAttribute('href', 'https://github.com/dersergioni/haus-of-chords');
    expect(screen.getByRole('link', { name: 'CC BY 4.0' }))
      .toHaveAttribute('href', 'https://creativecommons.org/licenses/by/4.0/');
  });

  it('links the build hash to its commit', () => {
    vi.stubEnv('NEXT_PUBLIC_COMMIT_HASH', 'abcd123');
    render(<AppFooter />);
    expect(screen.getByText(/Built at commit/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'abcd123' });
    expect(link).toHaveAttribute('href', `${REPO}/commit/abcd123`);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it.each([undefined, 'dev'])(
    'shows an unlinked "dev" when the hash is %s',
    hash => {
      vi.stubEnv('NEXT_PUBLIC_COMMIT_HASH', hash);
      render(<AppFooter />);
      expect(screen.getByText('Built at commit dev')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'dev' })).toBeNull();
    },
  );
});
