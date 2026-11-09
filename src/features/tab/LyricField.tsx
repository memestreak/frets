'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { LyricMove } from './lyrics';

/**
 * The Lyrics field under a note (issue #408), as Dorico's lyrics popover: Shift+L opens it. Space sets the
 * syllable and moves to the next note, a hyphen joins it to the next and moves there, Shift+Space goes back
 * a note, Down and Up go to the next or last Lyric line; Enter sets it and closes, Esc closes leaving it as
 * it was, and leaving the field sets it. The page keeps the field going note to note (`useHeadPanels`).
 */
export function LyricField({ initial, line, x, y, onDone }: {
  /** The syllable the note has on this line now. */
  initial: string;
  /** The Lyric line, from 0. */
  line: number;
  /** Where the field's middle and top go, in the tab's own units. */
  x: number;
  y: number;
  /** What was typed and what comes next; `byKey` when a key finished it, not leaving the field. */
  onDone: (value: string, move: LyricMove, byKey: boolean) => void;
}) {
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);
  // A key and then the blur it causes would both finish; only the first counts.
  const done = useRef(false);
  const finish = (move: LyricMove, byKey: boolean) => {
    if (done.current) return;
    done.current = true;
    onDone(value, move, byKey);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const plain = !e.ctrlKey && !e.metaKey && !e.altKey;
    const move: LyricMove | null =
      e.key === ' ' && plain ? (e.shiftKey ? 'back' : 'next')
        : e.key === '-' && plain ? 'hyphen'
          : e.key === 'ArrowDown' && plain && !e.shiftKey ? 'down'
            : e.key === 'ArrowUp' && plain && !e.shiftKey ? 'up'
              : e.key === 'Enter' ? 'done'
                : e.key === 'Escape' ? 'cancel' : null;
    if (!move) return;
    e.preventDefault();
    finish(move, true);
  };
  const caption = `Lyric line ${line + 1}`;
  return (
    <span className="tab-word tab-lyric card" style={{ left: x, top: y }} role="dialog" aria-label="Lyrics">
      <input
        ref={inputRef} className="input tab-word-input" aria-label={caption} placeholder="la"
        value={value} maxLength={40}
        onChange={e => setValue(e.target.value.replace(/\s/g, ''))}
        onFocus={e => e.target.select()} onKeyDown={onKeyDown} onBlur={() => finish('done', false)}
      />
      <span className="tab-time-caption">{caption}: Space next note, hyphen next syllable</span>
    </span>
  );
}
