/**
 * Fretboard colors. Only the `line` theme ships; `surface` and `steel`
 * from the prototypes can be added here as further entries.
 */
export interface FretboardTheme {
  frameBg: string;
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

export const LINE_THEME: FretboardTheme = {
  frameBg: 'transparent',
  board: 'transparent',
  string: 'var(--color-text)',
  fret: 'color-mix(in srgb, var(--color-text) 28%, transparent)',
  nut: 'var(--color-text)',
  inlay: 'var(--color-neutral-400)',
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
