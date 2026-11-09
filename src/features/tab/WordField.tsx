'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { WordKind } from './tools';
import { dynamicOf } from './clip';

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
const PLACEHOLDERS: Record<FieldKind, string> = { chord: 'Am7', text: 'let ring', section: 'Chorus', capo: '3', ending: '2', repeat: '3', dynamic: 'mf' };
/** The words that are numbers: only digits can be typed, and only as many as the largest takes. */
const NUMBER_LENGTH: Partial<Record<FieldKind, number>> = { capo: 2, ending: 1, repeat: 1 };
/** The longest a word can be typed: free text may run to a few lines, as it wraps over its column (issue #323). */
const WORD_LENGTH = (kind: FieldKind) => (kind === 'text' ? 200 : kind === 'dynamic' ? 6 : 40);
/** What a ⚠ by a dynamic's field says when what is typed isn't one. */
export const NOT_A_DYNAMIC = 'Not a dynamic: type one of ppp, pp, p, mp, mf, f, ff, fff, or sf, sfz, fp, fz and the like';

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
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter' && !settable(kind, value)) setRefused(true);
    else if (e.key === 'Enter') finish(value, true);
    if (e.key === 'Escape') finish(null, true);
  };
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
          }}
          // Leaving a field with what can't be set leaves things as they were.
          onFocus={e => e.target.select()} onKeyDown={onKeyDown} onBlur={() => finish(settable(kind, value) ? value : null, false)}
          aria-invalid={refused || undefined}
        />
        {refused && <span className="tab-word-problem" role="img" aria-label={NOT_A_DYNAMIC} title={NOT_A_DYNAMIC}>⚠</span>}
      </span>
    </span>
  );
}
