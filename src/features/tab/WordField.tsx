'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { WordKind } from './tools';

const CAPTIONS: Record<WordKind, string> = {
  chord: 'Chord name',
  section: 'Section',
  tempo: 'Tempo, quarter notes a minute',
};
const PLACEHOLDERS: Record<WordKind, string> = { chord: 'Am7', section: 'Chorus', tempo: '120' };

/**
 * A small field over the tab for a chord name, a section or a tempo, at the spot it is drawn.
 * Enter or leaving the field sets what is typed (empty clears it); Esc leaves it as it was.
 */
export function WordField({ kind, initial, x, y, onDone }: {
  kind: WordKind;
  initial: string;
  /** Where the field's middle and top go, in the tab's own units. */
  x: number;
  y: number;
  /** What was typed, or null for Esc; `byKey` when Enter or Esc finished it, not leaving the field. */
  onDone: (value: string | null, byKey: boolean) => void;
}) {
  const [value, setValue] = useState(initial);
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
    <span className="tab-word card" style={{ left: x, top: y }} role="dialog" aria-label={CAPTIONS[kind]}>
      <span className="tab-time-caption">{CAPTIONS[kind]}</span>
      <input
        ref={inputRef} className="input tab-word-input" aria-label={CAPTIONS[kind]} placeholder={PLACEHOLDERS[kind]}
        value={value} inputMode={kind === 'tempo' ? 'numeric' : 'text'} maxLength={kind === 'tempo' ? 3 : 40}
        onChange={e => setValue(kind === 'tempo' ? e.target.value.replace(/\D/g, '') : e.target.value)}
        onFocus={e => e.target.select()} onKeyDown={onKeyDown} onBlur={() => finish(value, false)}
      />
    </span>
  );
}
