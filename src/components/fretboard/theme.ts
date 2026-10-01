/** Fretboard colors. Only the `maple` theme ships. */
export interface FretboardTheme {
  board: string;
  string: string;
  fret: string;
  nut: string;
  inlay: string;
  muted: string;
  rootFill: string;
  rootFg: string;
  tgtFill: string;
  tgtFg: string;
  hintFill: string;
  hintStroke: string;
  hintFg: string;
  legend: string;
}

export const MAPLE_THEME: FretboardTheme = {
  board: 'var(--color-board)',
  string: 'var(--color-neutral-700)',
  fret: 'var(--color-board-fret)',
  nut: 'var(--color-neutral-800)',
  inlay: 'var(--color-board-inlay)',
  muted: 'color-mix(in srgb, var(--color-text) 60%, transparent)',
  rootFill: 'var(--color-accent)',
  rootFg: 'var(--color-bg)',
  tgtFill: 'var(--color-text)',
  tgtFg: 'var(--color-bg)',
  hintFill: 'var(--color-accent-200)',
  hintStroke: 'var(--color-accent)',
  hintFg: 'var(--color-accent-800)',
  legend: 'color-mix(in srgb, var(--color-text) 70%, transparent)',
};

export const STATUS = {
  green: 'var(--color-success)',
  greenDeep: 'var(--color-success-deep)',
  red: 'var(--color-danger)',
} as const;
