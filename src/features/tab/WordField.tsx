'use client';

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { toggleBold, type TypedText } from './textMarks';
import type { WordKind } from './tools';

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
};
const PLACEHOLDERS: Record<FieldKind, string> = { chord: 'Am7', text: 'let ring', section: 'Chorus', capo: '3', ending: '2', repeat: '3' };
/** The words that are numbers: only digits can be typed, and only as many as the largest takes. */
const NUMBER_LENGTH: Partial<Record<FieldKind, number>> = { capo: 2, ending: 1, repeat: 1 };
/** The longest a word can be typed: free text may run to a few lines, as it wraps over its column (issue #323). */
const WORD_LENGTH = (kind: FieldKind) => (kind === 'text' ? 200 : 40);

/** The most rows the Text field grows to as new lines are typed; past them it scrolls. */
const TEXT_ROWS = 6;

/**
 * A small field over the tab for a chord name, free text, a section or the capo, at the spot it is drawn.
 * Enter or leaving the field sets what is typed (empty clears it); Esc leaves it as it was. The Text
 * field takes more: Shift+Enter starts a new line in it (issue #445), and Cmd+B makes the selected words
 * bold, `**` round them (issue #446).
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
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  // The field opens from a press or a key on the tab, so typing goes straight into it.
  useEffect(() => inputRef.current?.focus(), []);
  // Enter and then the blur it causes would both finish; only the first counts.
  const done = useRef(false);
  const finish = (result: string | null, byKey: boolean) => {
    if (done.current) return;
    done.current = true;
    onDone(result, byKey);
  };
  // Where the selection goes once a Cmd+B change is drawn.
  const selectAfter = useRef<TypedText | null>(null);
  useLayoutEffect(() => {
    const next = selectAfter.current;
    selectAfter.current = null;
    if (next) inputRef.current?.setSelectionRange(next.start, next.end);
  }, [value]);
  const isText = kind === 'text';
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.stopPropagation();
    // Shift+Enter is a new line in a Text: the textarea's own.
    if (e.key === 'Enter' && !(isText && e.shiftKey)) {
      e.preventDefault();
      finish(value, true);
    }
    if (e.key === 'Escape') finish(null, true);
    // Cmd+B, as in Dorico's and MuseScore's text editors.
    if (isText && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      const field = e.currentTarget;
      const next = toggleBold({ value, start: field.selectionStart ?? value.length, end: field.selectionEnd ?? value.length });
      if (next.value.length > WORD_LENGTH(kind)) return;
      selectAfter.current = next;
      setValue(next.value);
    }
  };
  const shared = {
    ref: inputRef, 'aria-label': CAPTIONS[kind], placeholder: PLACEHOLDERS[kind], value, maxLength: digits ?? WORD_LENGTH(kind),
    onFocus: (e: { target: HTMLInputElement | HTMLTextAreaElement }) => e.target.select(), onKeyDown, onBlur: () => finish(value, false),
  };
  return (
    <span className={`tab-word card${digits ? ' tab-word-fit' : ''}`} style={{ left: x, top: y }} role="dialog" aria-label={CAPTIONS[kind]}>
      <span className="tab-time-caption">{CAPTIONS[kind]}</span>
      {isText ? (
        <textarea
          {...shared} className="input tab-word-input tab-word-text" rows={Math.min(TEXT_ROWS, value.split('\n').length)}
          onChange={e => setValue(e.target.value)}
        />
      ) : (
        <input
          {...shared} className={`input ${digits ? 'tab-word-number' : 'tab-word-input'}`} inputMode={digits ? 'numeric' : 'text'}
          onChange={e => setValue(digits ? e.target.value.replace(/\D/g, '') : e.target.value)}
        />
      )}
    </span>
  );
}
