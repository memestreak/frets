'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { WordKind } from './tools';

/** What a field sets: a palette word, or a picked ending bracket's number. A tempo has its own panel (`TempoPanel.tsx`). */
export type FieldKind = Exclude<WordKind, 'tempo'> | 'ending';

const CAPTIONS: Record<FieldKind, string> = {
  chord: 'Chord name',
  text: 'Text over the column',
  section: 'Section',
  capo: 'Capo on fret, 1 to 12',
  ending: 'Ending number',
};
const PLACEHOLDERS: Record<FieldKind, string> = { chord: 'Am7', text: 'let ring', section: 'Chorus', capo: '3', ending: '2' };
/** The words that are numbers: only digits can be typed, and only as many as the largest takes. */
const NUMBER_LENGTH: Partial<Record<FieldKind, number>> = { capo: 2, ending: 1 };

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
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') finish(value, true);
    if (e.key === 'Escape') finish(null, true);
  };
  return (
    <span className={`tab-word card${digits ? ' tab-word-fit' : ''}`} style={{ left: x, top: y }} role="dialog" aria-label={CAPTIONS[kind]}>
      <span className="tab-time-caption">{CAPTIONS[kind]}</span>
      <input
        ref={inputRef} className={`input ${digits ? 'tab-word-number' : 'tab-word-input'}`} aria-label={CAPTIONS[kind]} placeholder={PLACEHOLDERS[kind]}
        value={value} inputMode={digits ? 'numeric' : 'text'} maxLength={digits ?? 40}
        onChange={e => setValue(digits ? e.target.value.replace(/\D/g, '') : e.target.value)}
        onFocus={e => e.target.select()} onKeyDown={onKeyDown} onBlur={() => finish(value, false)}
      />
    </span>
  );
}
