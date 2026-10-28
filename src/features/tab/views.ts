/** The clip's three views: drawn (Notation), as ASCII tab, and as its alphaTex text. */
export type View = 'tab' | 'alphatex' | 'ascii';

/** The view switch's buttons, in their order (Jeremy, 2026-10-25/27). */
export const VIEWS: { id: View; label: string }[] = [
  { id: 'tab', label: 'Notation' }, { id: 'ascii', label: 'ASCII Tab' }, { id: 'alphatex', label: 'AlphaTex' },
];
