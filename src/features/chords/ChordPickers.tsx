import {
  useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode,
} from 'react';
import { KeyPicker } from '@/components/KeyPicker';
import { SearchIcon } from '@/components/icons';
import {
  chordRootOf, CHORD_GROUPS, CHORD_TYPES, type ChordRoot,
} from '@/lib/theory/chords';
import { findChord } from '@/lib/theory/chordSearch';

interface ChordPickersProps {
  root: ChordRoot;
  /** '' for notes no type names: the menu shows "—". */
  typeId: string;
  onRoot: (root: ChordRoot) => void;
  onType: (typeId: string) => void;
  /** A chord found by name in the search box. */
  onChord: (root: ChordRoot, typeId: string) => void;
  /** Drawn after the magnifier: the page's Clear button. */
  after?: ReactNode;
}

/**
 * The root picker and the Type dropdown, each labelled from the top, and
 * the magnifier that swaps the dropdown for a search box of the same size
 * (docs/specs/2026-10-16-chord-search-design.md). Types are grouped. The
 * controls' tops are level (docs/specs/2026-10-19-chords-header-design.md).
 */
export function ChordPickers({
  root, typeId, onRoot, onType, onChord, after,
}: ChordPickersProps) {
  const fieldId = useId();
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  // The query Enter found nothing for, until the next keystroke.
  const [missed, setMissed] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const open = () => {
    setQuery('');
    setMissed(null);
    setSearching(true);
  };
  const close = () => setSearching(false);
  const closeToButton = () => {
    close();
    buttonRef.current?.focus();
  };

  useEffect(() => {
    if (searching) inputRef.current?.focus();
  }, [searching]);

  // "/" opens the box from anywhere on the page but a field, a menu or a dialog.
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key !== '/' || e.altKey || e.ctrlKey || e.metaKey) return;
      if ((e.target as Element | null)?.closest?.('input, select, textarea, dialog, [role="menu"]')) return;
      e.preventDefault();
      open();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeToButton();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const found = findChord(query);
      if (!found) {
        setMissed(query.trim());
        return;
      }
      closeToButton();
      onChord(found.root, found.type);
    }
  };

  const typeField = searching ? (
    <span className="relative block">
      <input
        ref={inputRef} id={fieldId} type="text" className="input chord-search"
        aria-label="Chord name" placeholder="e.g. Am7, F#m7b5"
        autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}
        enterKeyHint="search"
        value={query}
        onChange={e => {
          setQuery(e.target.value);
          setMissed(null);
        }}
        onKeyDown={onKeyDown}
        onBlur={close}
      />
      {missed !== null && (
        <span role="status" className="chord-search-miss">
          {missed ? `No chord "${missed}". ` : ''}
          Try a root then a type: Am7, F#m7b5, Cmaj9.
        </span>
      )}
    </span>
  ) : (
    <select
      id={fieldId} className="input chord-type" value={typeId}
      onChange={e => onType(e.target.value)}
    >
      {!typeId && <option value="" disabled>—</option>}
      {CHORD_GROUPS.map(g => (
        <optgroup key={g} label={g}>
          {CHORD_TYPES.filter(t => t.group === g).map(t => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );

  const magnifier = (
    <button
      ref={buttonRef} type="button" className="btn btn-secondary btn-icon chord-search-toggle"
      aria-label="Find a chord by name" aria-pressed={searching}
      title="Find a chord by name (/)"
      // Keep focus in the box, so a click closes it rather than blurring and reopening.
      onMouseDown={e => e.preventDefault()}
      onClick={() => (searching ? closeToButton() : open())}
    >
      <SearchIcon />
    </button>
  );

  return (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
      <div>
        {/* The picker names itself (aria-label "Root"); this is the visible label. */}
        <span className="field-label" aria-hidden>Root</span>
        <KeyPicker
          value={root} resolve={chordRootOf}
          onPick={n => onRoot(n as ChordRoot)}
        />
      </div>
      <div className="min-w-0">
        <label htmlFor={fieldId} className="field-label">Type</label>
        <div className="flex min-w-0 items-center gap-2">
          {typeField}
          {magnifier}
          {after}
        </div>
      </div>
    </div>
  );
}
