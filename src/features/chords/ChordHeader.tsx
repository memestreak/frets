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
  /**
   * MOCK: where the controls go. inline: right, centred on the title
   * (today); right: right, level with the title's top; under: a row under
   * the notes; above: a row above the title; level: right, the controls
   * in the notes' row, as in the Scale lab, the notes centred on them.
   */
  layout?: 'inline' | 'right' | 'under' | 'above' | 'level';
}

/** A Chords page's title line: the chord and its formula, controls on the right, notes below. */
export function ChordHeader({
  title, formula, notes, children, layout = 'inline',
}: ChordHeaderProps) {
  const heading = (
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
  );
  const notesLine = (
    <p className="m-0 min-h-[1.5em] text-(--ink-muted)" data-testid="chord-notes">{notes}</p>
  );
  if (layout === 'right') {
    return (
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="grid gap-1">{heading}{notesLine}</div>
        {children}
      </header>
    );
  }
  if (layout === 'level') {
    return (
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="grid">
          {heading}
          <p className="m-0 flex min-h-[52px] items-center text-(--ink-muted)" data-testid="chord-notes">{notes}</p>
        </div>
        {children}
      </header>
    );
  }
  if (layout === 'under' || layout === 'above') {
    return (
      <header className="grid gap-1">
        {layout === 'above' && <div className="mb-3">{children}</div>}
        {heading}
        {notesLine}
        {layout === 'under' && <div className="mt-3">{children}</div>}
      </header>
    );
  }
  return (
    <header className="grid gap-1">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        {heading}
        {children}
      </div>
      {notesLine}
    </header>
  );
}
