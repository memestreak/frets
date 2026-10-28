/**
 * The Tab page's view options (Jeremy, 2026-10-28): how the drawn clip shows things that are the
 * reader's choice, not the music's. Saved per viewer, not in the clip; exports follow them.
 */

export const VIEW_KEY = 'frets.tab.view';

/** Bar numbers over every bar, over the first bar of each line, or none. */
export type BarNumbers = 'every' | 'lines' | 'none';
export const BAR_NUMBERS: readonly BarNumbers[] = ['every', 'lines', 'none'];
export const BAR_NUMBER_NAMES: Record<BarNumbers, string> = { every: 'Every bar', lines: 'Each line', none: 'None' };

export interface TabView {
  barNumbers: BarNumbers;
}

/** Bar numbers on every bar, as Guitar Pro prints them. */
export const DEFAULT_VIEW: TabView = { barNumbers: 'every' };

/** Saved options, with the default for any field missing or invalid. */
export function parseView(raw: unknown): TabView {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    barNumbers: BAR_NUMBERS.find(b => b === o.barNumbers) ?? DEFAULT_VIEW.barNumbers,
  };
}

/** Whether a bar shows its number: every bar, or only the first on its line. */
export function showsBarNumber(barNumbers: BarNumbers, firstOnLine: boolean): boolean {
  return barNumbers === 'every' || (barNumbers === 'lines' && firstOnLine);
}
