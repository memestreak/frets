'use client';

import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import type { WordKind } from './tools';

const CAPTIONS: Record<WordKind, string> = {
  chord: 'Chord name',
  text: 'Text over the column',
  section: 'Section',
  tempo: 'Tempo (bpm)',
  capo: 'Capo on fret, 1 to 12',
};
const PLACEHOLDERS: Record<WordKind, string> = { chord: 'Am7', text: 'let ring', section: 'Chorus', tempo: '120', capo: '3' };
/** The words that are numbers: only digits can be typed, and only as many as the largest takes. */
const NUMBER_LENGTH: Partial<Record<WordKind, number>> = { capo: 2 };

/**
 * A small field over the tab for a chord name, free text, a section, a tempo or the capo, at the spot it is drawn.
 * Enter or leaving the field sets what is typed (empty clears it); Esc leaves it as it was.
 */
export function WordField(props: WordFieldProps) {
  return props.kind === 'tempo' ? <TempoField {...props} /> : <OneWordField {...props} />;
}

interface WordFieldProps {
  kind: WordKind;
  /** What the field starts with; a tempo's is bpm, then its label (`tempoText`). */
  initial: string;
  /** Where the field's middle and top go, in the tab's own units. */
  x: number;
  y: number;
  /** What was typed, or null for Esc; `byKey` when Enter or Esc finished it, not leaving the field. A tempo's is bpm, then its label. */
  onDone: (value: string | null, byKey: boolean) => void;
}

function OneWordField({ kind, initial, x, y, onDone }: WordFieldProps) {
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
    <span className="tab-word card" style={{ left: x, top: y }} role="dialog" aria-label={CAPTIONS[kind]}>
      <span className="tab-time-caption">{CAPTIONS[kind]}</span>
      <input
        ref={inputRef} className="input tab-word-input" aria-label={CAPTIONS[kind]} placeholder={PLACEHOLDERS[kind]}
        value={value} inputMode={digits ? 'numeric' : 'text'} maxLength={digits ?? 40}
        onChange={e => setValue(digits ? e.target.value.replace(/\D/g, '') : e.target.value)}
        onFocus={e => e.target.select()} onKeyDown={onKeyDown} onBlur={() => finish(value, false)}
      />
    </span>
  );
}

/**
 * A tempo's field: bpm in one box and its label, marked optional, in another (Jeremy, 2026-10-27).
 * Enter in either, or leaving both, sets them; Tab goes from one to the other; Esc leaves the tempo as it was.
 */
function TempoField({ initial, x, y, onDone }: WordFieldProps) {
  const [, bpmAtFirst = '', labelAtFirst = ''] = /^(\d*)\s*(.*)$/.exec(initial) ?? [];
  const [bpm, setBpm] = useState(bpmAtFirst);
  const [label, setLabel] = useState(labelAtFirst);
  const bpmRef = useRef<HTMLInputElement>(null);
  useEffect(() => bpmRef.current?.focus(), []);
  const done = useRef(false);
  const finish = (result: string | null, byKey: boolean) => {
    if (done.current) return;
    done.current = true;
    onDone(result, byKey);
  };
  // An empty bpm clears the tempo, label and all.
  const typed = () => (bpm === '' ? '' : `${bpm} ${label.trim()}`.trim());
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') finish(typed(), true);
    if (e.key === 'Escape') finish(null, true);
  };
  // Moving between the two boxes isn't leaving the field.
  const box = useRef<HTMLSpanElement>(null);
  const onBlur = (e: FocusEvent<HTMLInputElement>) => {
    if (!box.current?.contains(e.relatedTarget as Node | null)) finish(typed(), false);
  };
  return (
    <span className="tab-word tab-word-tempo card" style={{ left: x, top: y }} role="dialog" aria-label="Tempo" ref={box}>
      <label className="grid gap-1.5">
        <span className="tab-time-caption">Tempo (bpm)</span>
        <input
          ref={bpmRef} className="input tab-word-input" aria-label="Tempo (bpm)" placeholder="120" value={bpm} inputMode="numeric" maxLength={3} onBlur={onBlur}
          onChange={e => setBpm(e.target.value.replace(/\D/g, ''))} onFocus={e => e.target.select()} onKeyDown={onKeyDown}
        />
      </label>
      <label className="grid gap-1.5">
        <span className="tab-time-caption">Label (optional)</span>
        <input
          className="input tab-word-input" aria-label="Label (optional)" placeholder="Slowly" value={label} maxLength={40} onBlur={onBlur}
          onChange={e => setLabel(e.target.value)} onKeyDown={onKeyDown}
        />
      </label>
    </span>
  );
}
