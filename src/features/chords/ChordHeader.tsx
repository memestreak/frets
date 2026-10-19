import type { ReactNode } from 'react';

interface ChordHeaderProps {
  /** "Am7", or a stand-in such as "No name". */
  title: string;
  /** "1 ♭3 5 ♭7"; left out when empty. */
  formula: string;
  /** Spelled notes, "A C E G"; left out when empty. */
  notes: string;
  /** Controls on the right, their top level with the title's. */
  children?: ReactNode;
}

/** A Chords page's header: the chord, its formula and notes, controls on the right. */
export function ChordHeader({ title, formula, notes, children }: ChordHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="grid gap-1">
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
        <p className="m-0 min-h-[1.5em] text-(--ink-muted)" data-testid="chord-notes">{notes}</p>
      </div>
      {children}
    </header>
  );
}
