import { CHORDS, EXPLORE, locate, PRACTICE } from '@/components/sections';

describe('locate', () => {
  it('finds the section and page of a page URL', () => {
    expect(locate('/practice/notes')).toEqual({
      section: PRACTICE,
      page: PRACTICE.pages[1],
    });
  });

  it('finds pages in every section', () => {
    expect(locate('/explore/scales')).toEqual({
      section: EXPLORE,
      page: EXPLORE.pages[0],
    });
    expect(locate('/chords/library')).toEqual({
      section: CHORDS,
      page: CHORDS.pages[0],
    });
  });

  it('finds the section but no page on a section index', () => {
    expect(locate('/practice')).toEqual({ section: PRACTICE, page: undefined });
  });

  it('finds nothing at home or under a lookalike prefix', () => {
    expect(locate('/')).toEqual({ section: undefined, page: undefined });
    expect(locate('/practiced')).toEqual({ section: undefined, page: undefined });
  });
});
