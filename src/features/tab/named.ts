/**
 * How the popovers that add a thing by name (the technique popover, Shift+P; the direction popover, Shift+R)
 * match what is typed against names and short forms. Pure.
 */

/** What is typed, as words are matched: any case, dots and hyphens left out, one space between words. */
function plain(text: string): string {
  return text.toLowerCase().replace(/[.-]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * What a popover's list offers for what is typed, from `items` each named by `names` (its name and short forms):
 * every one for nothing typed, else those with a name one of whose words starts with it, in `items`' order.
 * One named exactly comes first, so Enter adds it.
 */
export function namedFor<T>(items: readonly T[], names: (item: T) => readonly string[], typed: string): readonly T[] {
  const start = plain(typed);
  if (!start) return items;
  const all = (item: T) => names(item).map(plain);
  const exact = items.filter(item => all(item).includes(start));
  const starting = items.filter(item => !exact.includes(item) && all(item).some(name => name.startsWith(start) || name.includes(` ${start}`)));
  return [...exact, ...starting];
}
