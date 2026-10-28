/**
 * The Tab page's view options (Jeremy, 2026-10-28): how the drawn clip shows things that are the
 * reader's choice, not the music's: bar numbers and the drawing's size. Saved per viewer, not in the clip; exports follow them.
 */

export const VIEW_KEY = 'frets.tab.view';

/** Bar numbers over every bar, over the first bar of each line, or none. */
export type BarNumbers = 'every' | 'lines' | 'none';
export const BAR_NUMBERS: readonly BarNumbers[] = ['every', 'lines', 'none'];
export const BAR_NUMBER_NAMES: Record<BarNumbers, string> = { every: 'Every bar', lines: 'Each line', none: 'None' };

/** The drawing's size, in percent: 50% to 200% in steps of 10 (Jeremy, 2026-10-28). */
export const MIN_SIZE = 50;
export const MAX_SIZE = 200;
export const SIZE_STEP = 10;

export interface TabView {
  barNumbers: BarNumbers;
  /** How big the clip is drawn, in percent; a smaller drawing fits more bars to a line. */
  size: number;
}

/** Bar numbers on every bar, as Guitar Pro prints them, at full size. */
export const DEFAULT_VIEW: TabView = { barNumbers: 'every', size: 100 };

/** A size as offered: a whole step from 50% to 200%. */
function isSize(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= MIN_SIZE && n <= MAX_SIZE && n % SIZE_STEP === 0;
}

/** Saved options, with the default for any field missing or invalid. */
export function parseView(raw: unknown): TabView {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    barNumbers: BAR_NUMBERS.find(b => b === o.barNumbers) ?? DEFAULT_VIEW.barNumbers,
    size: isSize(o.size) ? o.size : DEFAULT_VIEW.size,
  };
}

/** Whether a bar shows its number: every bar, or only the first on its line. */
export function showsBarNumber(barNumbers: BarNumbers, firstOnLine: boolean): boolean {
  return barNumbers === 'every' || (barNumbers === 'lines' && firstOnLine);
}
