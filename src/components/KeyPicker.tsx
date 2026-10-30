'use client';

import { useRef, type KeyboardEvent } from 'react';
import { prettyNote } from '@/lib/theory/notes';

/** Twelve columns, as on a piano: a natural, or a sharp over its flat. */
const COLUMNS: readonly (string | readonly [string, string])[] = [
  'C', ['C#', 'Db'], 'D', ['D#', 'Eb'], 'E', 'F', ['F#', 'Gb'], 'G',
  ['G#', 'Ab'], 'A', ['A#', 'Bb'], 'B',
];

/** Every tile in reading order: C, C♯, D♭, D, … */
export const KEY_PICKER_NOTES: readonly string[] = COLUMNS.flat();

interface KeyPickerProps {
  /** The note shown as picked, in ASCII ("Eb"). */
  value: string;
  /** Called with the note a tile picks, in ASCII. */
  onPick: (note: string) => void;
  /**
   * The note a tile picks, where the page spells some roots only one way
   * ("C#" → "Db"). By default each tile picks its own note.
   */
  resolve?: (note: string) => string;
  label?: string;
}

const same = (note: string) => note;

/**
 * A root picker laid out like a piano's keys: the naturals full height,
 * each sharp stacked over its flat. A radio group: the arrow keys move
 * through the tiles in reading order, picking as they go and skipping a
 * tile that would pick the note already picked.
 */
export function KeyPicker({ value, onPick, resolve = same, label = 'Root' }: KeyPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  // The picked tile takes focus; with none picked, the first.
  const focusable = KEY_PICKER_NOTES.includes(value) ? value : KEY_PICKER_NOTES[0];

  const onKeyDown = (e: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const n = KEY_PICKER_NOTES.length;
    let i = KEY_PICKER_NOTES.indexOf((e.target as HTMLElement).dataset.note ?? '');
    let next: string;
    do {
      i = (i + step + n) % n;
      next = resolve(KEY_PICKER_NOTES[i]);
    } while (next === value);
    onPick(next);
    ref.current?.querySelector<HTMLElement>(`[data-note="${next}"]`)?.focus();
  };

  const tile = (note: string, half: boolean) => (
    <button
      key={note} type="button" role="radio" data-note={note}
      className={`key-tile${half ? ' key-tile-half' : ''}`}
      aria-checked={note === value}
      tabIndex={note === focusable ? 0 : -1}
      onClick={() => onPick(resolve(note))}
      onKeyDown={onKeyDown}
    >
      {prettyNote(note)}
    </button>
  );

  return (
    <div ref={ref} role="radiogroup" aria-label={label} className="key-picker">
      {COLUMNS.map(c => (typeof c === 'string'
        ? <div key={c} className="key-col">{tile(c, false)}</div>
        : <div key={c[0]} className="key-col">{tile(c[0], true)}{tile(c[1], true)}</div>
      ))}
    </div>
  );
}
