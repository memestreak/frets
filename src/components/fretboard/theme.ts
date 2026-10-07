/**
 * Fretboard colours. Every value is a Fretwood token, so the board follows
 * the light / dark theme without a theme prop.
 */
export const BOARD = {
  fill: 'var(--fretboard)',
  fret: 'var(--fret-wire)',
  nut: 'var(--nut)',
  inlay: 'var(--inlay)',
  string: 'var(--string)',
  /** String names and fret numbers, drawn off the board. */
  label: 'var(--ink-muted)',
  /** Ring around every dot, so dots read on the board and on each other. */
  dotRing: 'var(--dot-ring)',
  /** Outline of a fret range (`Fretboard`'s `box`). */
  box: 'var(--primary)',
} as const;

/** A dot's fill and the colour of its label. */
export interface DotColor {
  fill: string;
  fg: string;
}

/** Scale-degree colours from the design system's degree palette. */
export type Degree =
  | 'root' | 'second' | 'third' | 'extension' | 'fifth' | 'sixth' | 'seventh'
  | 'other';

/** Degree colours by degree number 1–7 (9 is a 2, 11 a 4, 13 a 6). */
export const DEGREES: readonly Degree[] = [
  'root', 'second', 'third', 'extension', 'fifth', 'sixth', 'seventh',
];

export const degreeColor = (d: Degree): DotColor => ({
  fill: `var(--degree-${d})`,
  fg: `var(--on-degree-${d})`,
});

/** Dot colours for quiz states. */
export const DOT = {
  root: degreeColor('root'),
  /** A question mark. Never a degree colour, which would give the answer away. */
  quiz: { fill: 'var(--dot-quiz)', fg: 'var(--on-dot-quiz)' },
  correct: { fill: 'var(--success)', fg: 'var(--on-primary)' },
  wrong: { fill: 'var(--danger)', fg: 'var(--on-primary)' },
  other: degreeColor('other'),
} as const satisfies Record<string, DotColor>;
