import type { ReactNode } from 'react';

interface ChordHeaderProps {
  /** "Am7", or a stand-in such as "No name". */
  title: string;
  /** "1 ♭3 5 ♭7"; left out when empty. */
  formula: string;
  /** Spelled notes, "A C E G"; left out when empty. */
  notes: string;
  /** Controls on the right of the title line. */
  children?: ReactNode;
}

/** A Chords page's title line: the chord and its formula, controls on the right, notes below. */
export function ChordHeader({ title, formula, notes, children }: ChordHeaderProps) {
  return (
    <header className="grid gap-1">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <h1 className="m-0" aria-live="polite">
          {title}
          {formula && (
            <>
              {' '}
              <span className="text-[0.6em] font-normal text-(--ink-muted)" data-testid="chord-formula">
                ({formula})
              </span>
            </>
          )}
        </h1>
        {children}
      </div>
      <p className="m-0 min-h-[1.5em] text-(--ink-muted)" data-testid="chord-notes">{notes}</p>
    </header>
  );
}
