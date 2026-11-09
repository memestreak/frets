'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { WordKind } from './tools';
import { DYNAMICS, dynamicOf, type Dynamic } from './clip';
import { dynamicWord } from './dynamics';

/**
 * What a field sets: a palette word, a picked ending bracket's number, or how many times a picked repeat
 * is played. A tempo has its own panel (`TempoPanel.tsx`).
 */
export type FieldKind = Exclude<WordKind, 'tempo'> | 'ending' | 'repeat';

const CAPTIONS: Record<FieldKind, string> = {
  chord: 'Chord name',
  text: 'Text over the column',
  section: 'Section',
  capo: 'Capo on fret, 1 to 12',
  ending: 'Ending number',
  repeat: 'Times played, 2 to 9',
  dynamic: 'Dynamic',
};
const PLACEHOLDERS: Record<FieldKind, string> = { chord: 'Am7', text: 'let ring', section: 'Chorus', capo: '3', ending: '2', repeat: '3', dynamic: 'mf, or ↓ for the list' };
/** The words that are numbers: only digits can be typed, and only as many as the largest takes. */
const NUMBER_LENGTH: Partial<Record<FieldKind, number>> = { capo: 2, ending: 1, repeat: 1 };
/** The longest a word can be typed: free text may run to a few lines, as it wraps over its column (issue #323). */
const WORD_LENGTH = (kind: FieldKind) => (kind === 'text' ? 200 : kind === 'dynamic' ? 6 : 40);
/** What a ⚠ by a dynamic's field says when what is typed isn't one. */
export const NOT_A_DYNAMIC = 'Not a dynamic: press the Down arrow key for the list (ppp to fff, sf, sfz, fp…)';

/** Whether what is typed can be set: a dynamic's field takes only a dynamic, or nothing to take it away. */
function settable(kind: FieldKind, value: string): boolean {
  return kind !== 'dynamic' || value.trim() === '' || dynamicOf(value) !== null;
}

/**
 * A small field over the tab for a chord name, free text, a section or the capo, at the spot it is drawn.
 * Enter or leaving the field sets what is typed (empty clears it); Esc leaves it as it was.
 */

interface WordFieldProps {
  kind: FieldKind;
  /** What the field starts with. */
  initial: string;
  /** Where the field's middle and top go, in the tab's own units. */
  x: number;
  y: number;
  /** What was typed, or null for Esc; `byKey` when Enter or Esc finished it, not leaving the field. */
  onDone: (value: string | null, byKey: boolean) => void;
}

/** The dynamics a dynamic's list offers for what is typed: those starting with it, every one for nothing typed. */
export function dynamicsFor(typed: string): readonly Dynamic[] {
  const start = typed.trim().toLowerCase();
  return DYNAMICS.filter(d => d.startsWith(start));
}

export function WordField({ kind, initial, x, y, onDone }: WordFieldProps) {
  const [value, setValue] = useState(initial);
  const digits = NUMBER_LENGTH[kind];
  const inputRef = useRef<HTMLInputElement>(null);
  // The field opens from a press or a key on the tab, so typing goes straight into it.
  useEffect(() => inputRef.current?.focus(), []);
  // Enter and then the blur it causes would both finish; only the first counts.
  const done = useRef(false);
  const finish = (result: string | null, byKey: boolean) => {
    if (done.current) return;
    done.current = true;
    onDone(result, byKey);
  };
  // Enter on what isn't a dynamic keeps the field open with its ⚠, as Dorico's popover turns red.
  const [refused, setRefused] = useState(false);
  // A dynamic's list (Jeremy, 2026-11-09): ↓ opens it, filtered by what is typed; ↑ ↓ move, Enter or a press picks.
  const listId = useId();
  const [listOpen, setListOpen] = useState(false);
  const [active, setActive] = useState(0);
  const choices = kind === 'dynamic' ? dynamicsFor(value) : [];
  const activeRef = useRef<HTMLDivElement>(null);
  /** Where the list starts for what is typed: on the dynamic typed exactly (pp, not pppppp), else its first. */
  const startFor = (typed: string) => Math.max(0, dynamicsFor(typed).indexOf(typed.trim().toLowerCase() as Dynamic));
  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [active, listOpen]);
  const onListKey = (e: KeyboardEvent<HTMLInputElement>): boolean => {
    if (kind !== 'dynamic') return false;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!listOpen) {
        setListOpen(true);
        setActive(startFor(value));
      } else setActive(a => Math.min(a + 1, choices.length - 1));
      return true;
    }
    if (!listOpen) return false;
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(a => Math.max(a - 1, 0));
      return true;
    }
    if (e.key === 'Enter' && choices[active]) {
      finish(choices[active], true);
      return true;
    }
    // Esc closes the list first, as a browser's own lists do; the next Esc leaves the field.
    if (e.key === 'Escape') {
      setListOpen(false);
      return true;
    }
    return false;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (onListKey(e)) return;
    if (e.key === 'Enter' && !settable(kind, value)) setRefused(true);
    else if (e.key === 'Enter') finish(value, true);
    if (e.key === 'Escape') finish(null, true);
  };
  const showList = kind === 'dynamic' && listOpen;
  return (
    <span className={`tab-word card${digits ? ' tab-word-fit' : ''}`} style={{ left: x, top: y }} role="dialog" aria-label={CAPTIONS[kind]}>
      <span className="tab-time-caption">{CAPTIONS[kind]}</span>
      <span className="tab-word-row">
        <input
          ref={inputRef} className={`input ${digits ? 'tab-word-number' : 'tab-word-input'}`} aria-label={CAPTIONS[kind]} placeholder={PLACEHOLDERS[kind]}
          value={value} inputMode={digits ? 'numeric' : 'text'} maxLength={digits ?? WORD_LENGTH(kind)}
          onChange={e => {
            setValue(digits ? e.target.value.replace(/\D/g, '') : e.target.value);
            setRefused(false);
            setActive(startFor(e.target.value));
          }}
          // Leaving a field with what can't be set leaves things as they were.
          onFocus={e => e.target.select()} onKeyDown={onKeyDown} onBlur={() => finish(settable(kind, value) ? value : null, false)}
          aria-invalid={refused || undefined}
          {...(kind === 'dynamic' && {
            role: 'combobox', 'aria-autocomplete': 'list' as const, 'aria-expanded': showList, 'aria-controls': listId,
            'aria-activedescendant': showList && choices[active] ? `${listId}-${choices[active]}` : undefined,
          })}
        />
        {refused && <span className="tab-word-problem" role="img" aria-label={NOT_A_DYNAMIC} title={NOT_A_DYNAMIC}>⚠</span>}
      </span>
      {showList && (
        // A press in the list keeps the field focused (its blur would set what is typed), and picks the option pressed.
        <div
          id={listId} role="listbox" aria-label="Dynamics" tabIndex={-1} className="tab-word-list"
          onMouseDown={e => e.preventDefault()}
          onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') setListOpen(false); }}
          onClick={e => {
            const picked = (e.target as HTMLElement).closest<HTMLElement>('[data-dynamic]')?.dataset.dynamic;
            if (picked) finish(picked, true);
          }}
        >
          {choices.map((d, i) => (
            <div
              key={d} id={`${listId}-${d}`} ref={i === active ? activeRef : undefined} role="option" aria-selected={i === active}
              tabIndex={-1} data-dynamic={d} className="tab-word-option"
              onMouseMove={() => { if (i !== active) setActive(i); }}
            >
              <DynamicGlyph dynamic={d} />
              <span className="tab-word-option-text">{d}</span>
            </div>
          ))}
          {choices.length === 0 && <div className="tab-word-none">No dynamic starts with “{value.trim()}”</div>}
        </div>
      )}
    </span>
  );
}

/** A dynamic in the letters it is drawn with on the tab, for its row in the list. */
function DynamicGlyph({ dynamic }: { dynamic: Dynamic }) {
  const { letters, box } = dynamicWord(dynamic, 0, 0);
  return (
    <svg width={box.width + 4} height={box.height + 2} viewBox={`${box.x - 2} ${box.y - 1} ${box.width + 4} ${box.height + 2}`} aria-hidden="true" fill="currentColor">
      {letters.map((letter, i) => <path key={i} d={letter.d} transform={letter.transform} />)}
    </svg>
  );
}
