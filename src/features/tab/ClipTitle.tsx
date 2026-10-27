'use client';

/**
 * The clip's title over the page (Jeremy, 2026-10-27): a click on it turns it into a field. Enter or
 * leaving the field keeps what was typed, Esc keeps the old title; an empty title is "Untitled clip".
 */
import { useState, type KeyboardEvent } from 'react';

export const UNTITLED = 'Untitled clip';

export function ClipTitle({ name, onRename }: {
  /** The clip's own name; '' when it has none. */
  name: string;
  onRename: (name: string) => void;
}) {
  // What is being typed; null when the title shows.
  const [draft, setDraft] = useState<string | null>(null);
  const keep = () => {
    if (draft === null) return;
    setDraft(null);
    const next = draft.trim();
    if (next !== name) onRename(next);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // The page's own keys (Space plays) stay out of the field.
    e.stopPropagation();
    if (e.key === 'Enter') keep();
    else if (e.key === 'Escape') setDraft(null);
  };
  return (
    <h1 className="m-0 tab-title">
      {draft === null ? (
        <button type="button" className="tab-title-text" onClick={() => setDraft(name)}>
          {name.trim() || UNTITLED}
        </button>
      ) : (
        <input
          type="text" className="tab-title-input" aria-label="Clip title" placeholder={UNTITLED} value={draft}
          // eslint-disable-next-line jsx-a11y/no-autofocus -- it opens on a click on the title, to type in
          autoFocus onFocus={e => e.currentTarget.select()}
          onChange={e => setDraft(e.target.value)} onBlur={keep} onKeyDown={onKeyDown}
        />
      )}
    </h1>
  );
}
