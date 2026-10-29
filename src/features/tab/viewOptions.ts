/**
 * The Tab page's view options (Jeremy, 2026-10-28): how each view shows things that are the reader's
 * choice, not the music's. Notation: bar numbers, the drawing's size and the clip's own line breaks; ASCII Tab: the rhythm line;
 * AlphaTex: line numbers; and for every view, the colours. Saved per viewer, not in the clip; exports
 * and copies follow them.
 *
 * Each is saved as its Settings section (issue #195): `frets.tab.notation` (with Staff | Tab | Both),
 * `frets.tab.colours`, `frets.tab.ascii` and `frets.tab.alphatex`. The page puts them together as one
 * `TabView` for the drawing, the text views and the exports.
 */

import type { Clip } from './clip';
import { PARTS, type Parts } from './layout';

export const NOTATION_KEY = 'frets.tab.notation';
export const COLOURS_KEY = 'frets.tab.colours';
export const ASCII_KEY = 'frets.tab.ascii';
export const ALPHATEX_KEY = 'frets.tab.alphatex';

/** Bar numbers over every bar, over the first bar of each line, or none. */
export type BarNumbers = 'every' | 'lines' | 'none';
export const BAR_NUMBERS: readonly BarNumbers[] = ['every', 'lines', 'none'];
export const BAR_NUMBER_NAMES: Record<BarNumbers, string> = { every: 'Every bar', lines: 'Each line', none: 'None' };

/** The drawing's size, in percent: 50% to 200% in steps of 10 (Jeremy, 2026-10-28). */
export const MIN_SIZE = 50;
export const MAX_SIZE = 200;
export const SIZE_STEP = 10;

/**
 * The colours the clip is shown in (Jeremy, 2026-10-28): the theme's, a named scheme, or two
 * colours of the viewer's own. They apply to every view: the drawing, the ASCII and the alphaTex.
 */
export type Colours = 'theme' | 'paper' | 'sepia' | 'night' | 'custom';
export const COLOURS: readonly Colours[] = ['theme', 'paper', 'sepia', 'night', 'custom'];
export const COLOUR_NAMES: Record<Colours, string> = { theme: 'Theme', paper: 'Paper', sepia: 'Sepia', night: 'Night', custom: 'Custom' };

/** Text on a background, as #rrggbb. */
export interface ColourPair {
  text: string;
  background: string;
}

/** The named schemes' colours. Theme has none of its own: it follows the page's light or dark theme. */
export const SCHEMES: Record<Exclude<Colours, 'theme' | 'custom'>, ColourPair> = {
  paper: { text: '#000000', background: '#ffffff' },
  sepia: { text: '#3b2a1a', background: '#f4ecd8' },
  night: { text: '#e8e2d6', background: '#1c1a17' },
};

export interface TabView {
  barNumbers: BarNumbers;
  /** How big the clip is drawn, in percent; a smaller drawing fits more bars to a line. */
  size: number;
  /**
   * Notation: lines break where the clip says (`\systemsLayout`), as the book it came from does; off,
   * they fill the width (Jeremy, 2026-10-28: an option, off by default).
   */
  lineBreaks: boolean;
  /** ASCII Tab: the rhythm line over the strings (w h q e s…). */
  asciiRhythm: boolean;
  /** AlphaTex: each line's number in the margin. */
  lineNumbers: boolean;
  colours: Colours;
  /** Custom's two colours, kept while another scheme is shown. */
  custom: ColourPair;
}

/** Bar numbers on every bar, as Guitar Pro prints them, at full size; the rhythm line and line numbers shown; the theme's colours. */
export const DEFAULT_VIEW: TabView = {
  barNumbers: 'every', size: 100, lineBreaks: false, asciiRhythm: true, lineNumbers: true, colours: 'theme', custom: SCHEMES.paper,
};

/** A size as offered: a whole step from 50% to 200%. */
function isSize(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= MIN_SIZE && n <= MAX_SIZE && n % SIZE_STEP === 0;
}

const HEX = /^#[0-9a-f]{6}$/i;

/** A saved object's fields, or none. */
const fieldsOf = (raw: unknown) => (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

/** Tab › Notation: Staff | Tab | Both (the switch over the clip), and the View options' Notation group. */
export interface NotationPrefs {
  show: Parts;
  barNumbers: BarNumbers;
  size: number;
  lineBreaks: boolean;
}
export const DEFAULT_NOTATION: NotationPrefs = { show: 'tab', barNumbers: 'every', size: 100, lineBreaks: false };

export function parseNotation(raw: unknown): NotationPrefs {
  const o = fieldsOf(raw);
  const d = DEFAULT_NOTATION;
  return {
    show: PARTS.find(p => p === o.show) ?? d.show,
    barNumbers: BAR_NUMBERS.find(b => b === o.barNumbers) ?? d.barNumbers,
    size: isSize(o.size) ? o.size : d.size,
    lineBreaks: bool(o.lineBreaks, d.lineBreaks),
  };
}

/** Tab › Colours: the scheme, and Custom's two colours (kept while another scheme is shown). */
export interface ColourPrefs {
  scheme: Colours;
  text: string;
  background: string;
}
export const DEFAULT_COLOURS: ColourPrefs = { scheme: 'theme', ...SCHEMES.paper };

export function parseColours(raw: unknown): ColourPrefs {
  const o = fieldsOf(raw);
  const d = DEFAULT_COLOURS;
  const hex = (v: unknown, fallback: string) => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : fallback);
  return { scheme: COLOURS.find(c => c === o.scheme) ?? d.scheme, text: hex(o.text, d.text), background: hex(o.background, d.background) };
}

/** Tab › ASCII Tab: the rhythm line over the strings. */
export interface AsciiPrefs {
  rhythm: boolean;
}
export const DEFAULT_ASCII: AsciiPrefs = { rhythm: true };
export const parseAscii = (raw: unknown): AsciiPrefs => ({ rhythm: bool(fieldsOf(raw).rhythm, DEFAULT_ASCII.rhythm) });

/** Tab › AlphaTex: each line's number in the margin. */
export interface AlphaTexPrefs {
  lineNumbers: boolean;
}
export const DEFAULT_ALPHATEX: AlphaTexPrefs = { lineNumbers: true };
export const parseAlphaTex = (raw: unknown): AlphaTexPrefs => ({ lineNumbers: bool(fieldsOf(raw).lineNumbers, DEFAULT_ALPHATEX.lineNumbers) });

/** The four sections as the page shows them: one view. */
export function viewOf(notation: NotationPrefs, colours: ColourPrefs, ascii: AsciiPrefs, alphatex: AlphaTexPrefs): TabView {
  return {
    barNumbers: notation.barNumbers, size: notation.size, lineBreaks: notation.lineBreaks,
    asciiRhythm: ascii.rhythm, lineNumbers: alphatex.lineNumbers,
    colours: colours.scheme, custom: { text: colours.text, background: colours.background },
  };
}

/** A view changed in the View options panel, as its sections again (Staff | Tab | Both kept as it was). */
export function sectionsOf(view: TabView, show: Parts) {
  return {
    notation: { show, barNumbers: view.barNumbers, size: view.size, lineBreaks: view.lineBreaks } satisfies NotationPrefs,
    colours: { scheme: view.colours, text: view.custom.text, background: view.custom.background } satisfies ColourPrefs,
    ascii: { rhythm: view.asciiRhythm } satisfies AsciiPrefs,
    alphatex: { lineNumbers: view.lineNumbers } satisfies AlphaTexPrefs,
  };
}

/** The two colours shown, or null for the theme's own. */
export function shownColours(view: TabView): ColourPair | null {
  return view.colours === 'theme' ? null : view.colours === 'custom' ? view.custom : SCHEMES[view.colours];
}

/**
 * Everything the clip is drawn and written in, from its two colours: the ink, the muted ink (the
 * alphaTex margin, credits), the string and staff lines and the faint lines, each a mix of the text
 * into the background, about as far as the theme's own tokens sit from its ink.
 */
export function paletteOf({ text, background }: ColourPair) {
  return {
    ink: text,
    inkMuted: mix(text, background, 0.3),
    lineStrong: mix(text, background, 0.55),
    line: mix(text, background, 0.82),
    paper: background,
  };
}

/** `a` moved `t` of the way to `b`, both #rrggbb. */
export function mix(a: string, b: string, t: number): string {
  const channel = (hex: string, k: number) => parseInt(hex.slice(1 + 2 * k, 3 + 2 * k), 16);
  return '#' + [0, 1, 2].map(k => Math.round(channel(a, k) + (channel(b, k) - channel(a, k)) * t).toString(16).padStart(2, '0')).join('');
}

/** Whether a bar shows its number: every bar, or only the first on its line. */
export function showsBarNumber(barNumbers: BarNumbers, firstOnLine: boolean): boolean {
  return barNumbers === 'every' || (barNumbers === 'lines' && firstOnLine);
}

/** The clip as the view lays it out: without its own line breaks unless the view keeps them. */
export function laidOut(clip: Clip, view: TabView): Clip {
  if (view.lineBreaks || (clip.systemsLayout === undefined && clip.defaultSystemsLayout === undefined)) return clip;
  return { ...clip, systemsLayout: undefined, defaultSystemsLayout: undefined };
}
