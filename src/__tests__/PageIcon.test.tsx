import { render, screen } from '@testing-library/react';
import { PAGE_GLYPHS } from '@/components/PageIcon';
import { PageList } from '@/components/PageList';
import { GROUPS } from '@/components/sections';

/** Every card the home page draws. */
const cardHrefs = GROUPS.flatMap(s => s.pages.map(p => p.href));

describe('PageIcon', () => {
  it('has a pictogram for every card on the home page', () => {
    expect(Object.keys(PAGE_GLYPHS).sort()).toEqual([...cardHrefs].sort());
  });

  it('draws the icon inside each card, hidden from screen readers', () => {
    render(<PageList pages={GROUPS[0].pages} heading="h2" />);
    for (const page of GROUPS[0].pages) {
      const link = screen.getByRole('link', { name: new RegExp(page.title) });
      const icon = link.querySelector('[data-testid="page-icon"]');
      expect(icon).not.toBeNull();
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('draws no icon for a page without a pictogram', () => {
    render(<PageList pages={[{ href: '/nowhere', title: 'Nowhere', summary: 'No icon.' }]} heading="h2" />);
    expect(screen.queryByTestId('page-icon')).toBeNull();
  });
});
