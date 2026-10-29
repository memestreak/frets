/**
 * The app's map: the two groups of pages, Tools and Practice, and the site
 * menu's More (pages about Frets itself, not on the home page). The nav, the
 * home page and the Practice index page are all drawn from this list, so a
 * new feature is one entry here plus its route under `src/app/`. A page's
 * group says nothing about its URL: the Scale lab is a tool at
 * `/explore/scales`.
 */
export interface Page {
  href: string;
  /** Name for headings, cards and the nav's "you are here". */
  title: string;
  summary: string;
}

export interface Section {
  label: string;
  summary: string;
  /** The group's own index page, when it has one. */
  href?: string;
  pages: readonly Page[];
}

export const TOOLS: Section = {
  label: 'Tools',
  summary: 'See how scales and chords lie on the neck, look up a chord, tune up.',
  pages: [
    {
      href: '/explore/scales',
      title: 'Scale lab',
      summary: 'Pick a root and a scale, see it on the neck and stack its chords.',
    },
    {
      href: '/chords',
      title: 'Chords',
      summary: 'Look up a chord and every way to play it, or tap notes on the neck to name them.',
    },
    {
      href: '/explore/triads',
      title: 'Triads',
      summary: 'Every inversion of a triad on three neighbouring strings, all the way up the neck.',
    },
    {
      href: '/explore/circle',
      title: 'Circle of fifths',
      summary: 'See how keys and modes relate: their chords, signatures and neighbours.',
    },
    {
      href: '/tuner',
      title: 'Tuner',
      summary: 'Tune your guitar through the mic, on a dial or a strobe, and hear each string.',
    },
    {
      href: '/tab',
      title: 'Tab',
      summary: 'Write a riff as tab and notation, play it back, and export it as an image or text.',
    },
  ],
};

export const PRACTICE: Section = {
  label: 'Practice',
  summary: 'Quizzes that drill the fretboard until you know it cold.',
  href: '/practice',
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

/** Pages about Frets rather than music: in the site menu, not on the home page. */
export const MORE: Section = {
  label: 'More',
  summary: 'Frets beyond the browser.',
  pages: [
    {
      href: '/agents',
      title: 'Agents',
      summary: 'Skills that let an agent write chords and tab that open in Frets.',
    },
  ],
};

/** The groups on the home page. */
export const SECTIONS: readonly Section[] = [TOOLS, PRACTICE];

/** The groups in the site menu: the home page's, then More. */
export const MENU_SECTIONS: readonly Section[] = [...SECTIONS, MORE];

/** The group and page a pathname belongs to; either may be undefined. */
export function locate(pathname: string): { section?: Section; page?: Page } {
  for (const section of MENU_SECTIONS) {
    const page = section.pages.find(p => pathname === p.href);
    if (page || pathname === section.href) return { section, page };
  }
  return {};
}
