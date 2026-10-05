import { EXPLORE, locate, PRACTICE } from '@/components/sections';

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
  });

  it('finds nothing at home, at a section path or under a lookalike', () => {
    expect(locate('/')).toEqual({});
    expect(locate('/practice')).toEqual({});
    expect(locate('/practice/notesy')).toEqual({});
  });
});
