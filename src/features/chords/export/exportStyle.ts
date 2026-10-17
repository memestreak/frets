import type { DiagramLook } from '@/components/chords/ChordDiagram';
import { DEGREES, type Degree, type DotColor } from '@/components/fretboard/theme';

export const EXPORT_STORAGE_KEY = 'frets.chords.export';

/** The Export dialog's choices; the menu's Copy as PNG uses the saved ones. */
export interface ExportStyle {
  colours: 'mono' | 'degrees';
  /** What the image will sit on: a light page gets dark ink, a dark slide light ink. */
  background: 'light' | 'dark';
  /** The interval inside each fretted dot. */
  intervals: boolean;
  /** The chord's name above the board. */
  name: boolean;
  /** How wide, in pixels, a diagram of the usual five frets comes out; a wider shape scales with it. */
  size: ExportSize;
  /** Nothing behind the diagram; otherwise the background's colour, as the preview shows it. */
  transparent: boolean;
}

/** The sizes offered, in pixels wide; all but the largest are smaller than the 600 there once was. */
export const EXPORT_SIZES = [150, 225, 300, 450, 600] as const;
export type ExportSize = (typeof EXPORT_SIZES)[number];

/** What an image that isn't transparent is filled with; the preview shows the same. */
export const BACKDROPS: Record<ExportStyle['background'], string> = {
  light: '#ffffff', dark: '#1b1b1b',
};

export const DEFAULT_EXPORT_STYLE: ExportStyle = {
  colours: 'mono', background: 'light', intervals: false, name: true, size: 300, transparent: true,
};

/** Saved choices, with a default for any field missing or invalid. */
export function parseExportStyle(raw: unknown): ExportStyle {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_EXPORT_STYLE;
  return {
    colours: o.colours === 'mono' || o.colours === 'degrees' ? o.colours : d.colours,
    background: o.background === 'light' || o.background === 'dark' ? o.background : d.background,
    intervals: typeof o.intervals === 'boolean' ? o.intervals : d.intervals,
    name: typeof o.name === 'boolean' ? o.name : d.name,
    size: EXPORT_SIZES.find(size => size === o.size) ?? d.size,
    transparent: typeof o.transparent === 'boolean' ? o.transparent : d.transparent,
  };
}

interface Palette {
  line: string;
  ink: string;
  muted: string;
  degree: Record<Degree, DotColor>;
}

const deg = (fill: string, fg: string): DotColor => ({ fill, fg });

/**
 * Fretwood's colours as plain values, for an image that leaves the page:
 * `light` is the light theme's (dark ink, for a light background), `dark`
 * the dark theme's. Copied from `fretwood.css`; a test keeps them in step.
 */
export const THEME_PALETTES: Record<ExportStyle['background'], Palette> = {
  light: {
    line: '#8f7e66', ink: '#2e2620', muted: '#66584b',
    degree: {
      root: deg('#a8462a', '#fffaf2'),
      second: deg('#c9a3b8', '#2e2620'),
      third: deg('#946a12', '#fffaf2'),
      extension: deg('#7a4862', '#fffaf2'),
      fifth: deg('#5c6e30', '#fffaf2'),
      sixth: deg('#9cbccb', '#2e2620'),
      seventh: deg('#3d6476', '#fffaf2'),
      other: deg('#7a6a59', '#fffaf2'),
    },
  },
  dark: {
    line: '#887a6c', ink: '#f2eadd', muted: '#bcae9b',
    degree: {
      root: deg('#e0805c', '#1e1915'),
      second: deg('#f0dde7', '#1e1915'),
      third: deg('#e6b65a', '#1e1915'),
      extension: deg('#b07a97', '#1e1915'),
      fifth: deg('#a6b86e', '#1e1915'),
      sixth: deg('#d6ecf3', '#1e1915'),
      seventh: deg('#5f9ab0', '#1e1915'),
      other: deg('#b3a492', '#1e1915'),
    },
  },
};

/** Black and white: one ink for everything, the paper's colour inside the dots. */
const MONO = {
  light: { ink: '#000000', paper: '#ffffff' },
  dark: { ink: '#ffffff', paper: '#000000' },
} as const;

/** The `ChordDiagram` look for an exported image, titled `name` if the style shows it. */
export function exportLook(style: ExportStyle, name: string): DiagramLook {
  const title = style.name ? name.trim() : '';
  if (style.colours === 'mono') {
    const { ink, paper } = MONO[style.background];
    return {
      line: ink, ink, muted: ink,
      tone: () => ({ fill: ink, fg: paper }),
      labels: style.intervals, title,
    };
  }
  const p = THEME_PALETTES[style.background];
  return {
    line: p.line, ink: p.ink, muted: p.muted,
    tone: tone => p.degree[DEGREES[tone.degree - 1]],
    labels: style.intervals, title,
  };
}
