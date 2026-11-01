import { locate, MORE, PRACTICE, SECTIONS, TOOLS } from '@/components/sections';

describe('SECTIONS', () => {
  it('groups the pages as Tools, Practice, then More', () => {
    expect(SECTIONS.map(s => s.label)).toEqual(['Tools', 'Practice', 'More']);
    expect(TOOLS.pages.map(p => p.href)).toEqual(
      ['/explore/scales', '/chords', '/explore/triads', '/explore/circle', '/tuner', '/metronome', '/tab'],
    );
    expect(PRACTICE.pages.map(p => p.href)).toEqual(['/practice/intervals', '/practice/notes']);
    expect(MORE.pages.map(p => p.href)).toEqual(['/agents']);
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
    expect(locate('/metronome')).toEqual({ section: TOOLS, page: TOOLS.pages[5] });
    expect(locate('/tab')).toEqual({ section: TOOLS, page: TOOLS.pages[6] });
  });

  it('finds a More page', () => {
    expect(locate('/agents')).toEqual({ section: MORE, page: MORE.pages[0] });
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
