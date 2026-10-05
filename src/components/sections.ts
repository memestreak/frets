/**
 * The app's map: top-level sections and the pages inside each. The nav's
 * location and menu and the home page are drawn from this list, so a new
 * feature is one entry here plus its route under `src/app/`.
 */
export interface Page {
  href: string;
  /** Name for headings, cards, the nav's location and its menu. */
  title: string;
  summary: string;
}

export interface Section {
  label: string;
  summary: string;
  pages: readonly Page[];
}

export const PRACTICE: Section = {
  label: 'Practice',
  summary: 'Quizzes that drill the fretboard until you know it cold.',
  pages: [
    {
      href: '/practice/intervals',
      title: 'Interval trainer',
      summary: 'Name the interval between two notes, or find it on the neck.',
    },
    {
      href: '/practice/notes',
      title: 'Note trainer',
      summary: 'Name the note at a fret, or find a note on a string.',
    },
  ],
};

export const EXPLORE: Section = {
  label: 'Explore',
  summary: 'Tools for seeing how scales and chords lie on the neck.',
  pages: [
    {
      href: '/explore/scales',
      title: 'Scale lab',
      summary: 'Pick a root and a scale, see it on the neck and stack its chords.',
    },
  ],
};

export const SECTIONS: readonly Section[] = [PRACTICE, EXPLORE];

/** The page at a pathname and its section; both undefined off the map. */
export function locate(pathname: string): { section?: Section; page?: Page } {
  for (const section of SECTIONS) {
    const page = section.pages.find(p => p.href === pathname);
    if (page) return { section, page };
  }
  return {};
}
