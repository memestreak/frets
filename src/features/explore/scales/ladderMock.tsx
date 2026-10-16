
/*
 * MOCK ONLY, removed once an option is picked: ?mock=a puts the interval
 * brackets under the notes, ?mock=b keeps them above but smaller, and both
 * keep the notes still whether or not a chord is selected.
 */
export type LadderMock = 'a' | 'b' | null;

export function useLadderMock(): LadderMock {
  // Each switch reloads the page, so reading the URL once is enough.
  const m = new URLSearchParams(window.location.search).get('mock');
  return m === 'a' || m === 'b' ? m : null;
}

const OPTS = [
  ['now', 'Today'],
  ['a', 'A · brackets below'],
  ['b', 'B · smaller, above'],
] as const;

/** Shown only on a ?mock= link, so the page is unchanged without one. */
export function LadderMockBar() {
  const mock = useLadderMock() ?? 'now';
  if (new URLSearchParams(window.location.search).get('mock') === null) return null;
  return (
    <nav className="seg self-start" aria-label="Ladder mock">
      {OPTS.map(([id, label]) => (
        <a
          key={label} href={`?mock=${id}`}
          aria-current={mock === id ? 'page' : undefined}
          className={`seg-opt no-underline ${mock === id ? 'bg-(--surface-raised) text-(--ink)' : ''}`}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
