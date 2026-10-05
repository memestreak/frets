/**
 * The app's map: top-level sections and the pages inside each. The nav, the
 * home page and each section's index page are all drawn from this list, so a
 * new feature is one entry here plus its route under `src/app/`.
 */
export interface Page {
  href: string;
  /** Name for headings, cards and the nav's "you are here". */
  title: string;
  summary: string;
}

export interface Section {
  href: string;
  label: string;
  summary: string;
  pages: readonly Page[];
}

export const PRACTICE: Section = {
  href: '/practice',
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
  href: '/explore',
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

export const CHORDS: Section = {
  href: '/chords',
  label: 'Chords',
  summary: 'Look up a chord and every way to play it, or name the one you play.',
  pages: [
    {
      href: '/chords/library',
      title: 'Chord library',
      summary: 'Pick a root and a chord type, see its open and moveable shapes.',
    },
    {
      href: '/chords/lab',
      title: 'Chord lab',
      summary: 'Tap notes on the neck to name a chord, or build one tone by tone.',
    },
  ],
};

export const SECTIONS: readonly Section[] = [PRACTICE, EXPLORE, CHORDS];

/** The section and page a pathname belongs to; either may be undefined. */
export function locate(pathname: string): { section?: Section; page?: Page } {
  const section = SECTIONS.find(
    s => pathname === s.href || pathname.startsWith(`${s.href}/`),
  );
  const page = section?.pages.find(p => pathname === p.href);
  return { section, page };
}
