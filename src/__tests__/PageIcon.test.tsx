import { render, screen } from '@testing-library/react';
import { PAGE_GLYPHS } from '@/components/PageIcon';
import { PageList } from '@/components/PageList';
import { SECTIONS } from '@/components/sections';

/** Every card the home page draws: each page, or the section when it has none. */
const cardHrefs = SECTIONS.flatMap(s => (s.pages.length ? s.pages.map(p => p.href) : [s.href]));

describe('PageIcon', () => {
  it('has a pictogram for every card on the home page', () => {
    expect(Object.keys(PAGE_GLYPHS).sort()).toEqual([...cardHrefs].sort());
  });

  it('draws the icon inside each card, hidden from screen readers', () => {
    render(<PageList pages={SECTIONS[0].pages} heading="h2" />);
    for (const page of SECTIONS[0].pages) {
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
