import { locate, PRACTICE, SECTIONS, TOOLS } from '@/components/sections';

describe('SECTIONS', () => {
  it('groups the pages as Tools, then Practice', () => {
    expect(SECTIONS.map(s => s.label)).toEqual(['Tools', 'Practice']);
    expect(TOOLS.pages.map(p => p.href)).toEqual(
      ['/explore/scales', '/chords', '/explore/triads', '/explore/circle', '/tuner'],
    );
    expect(PRACTICE.pages.map(p => p.href)).toEqual(['/practice/intervals', '/practice/notes']);
  });
});

describe('locate', () => {
  it('finds the group and page of a page URL', () => {
    expect(locate('/practice/notes')).toEqual({
      section: PRACTICE,
      page: PRACTICE.pages[1],
    });
  });

  it('finds a tool whatever its path', () => {
    expect(locate('/explore/scales')).toEqual({ section: TOOLS, page: TOOLS.pages[0] });
    expect(locate('/chords')).toEqual({ section: TOOLS, page: TOOLS.pages[1] });
    expect(locate('/tuner')).toEqual({ section: TOOLS, page: TOOLS.pages[4] });
  });

  it('finds the group but no page on its index page', () => {
    expect(locate('/practice')).toEqual({ section: PRACTICE, page: undefined });
  });

  it('finds nothing at home, under a lookalike prefix or off the map', () => {
    expect(locate('/')).toEqual({});
    expect(locate('/practiced')).toEqual({});
    expect(locate('/explore')).toEqual({});
  });
});
