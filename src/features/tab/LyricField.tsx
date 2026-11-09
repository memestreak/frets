'use client';

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { LyricMove } from './lyrics';

/** How far the field has been dragged from its place over the note, in the tab's own units. */
export type LyricNudge = { dx: number; dy: number };

/**
 * The Lyrics field over a note (issue #408), small as Dorico's lyrics popover, with its Lyric line's number in
 * front: Shift+L opens it. Space sets the syllable and moves to the next note, a hyphen joins it to the next
 * and moves there, Shift+Space goes back a note, Alt+Space types a space and Alt+hyphen a hyphen without
 * moving on, Down and Up go to the next or last Lyric line; Enter sets it and closes, Esc closes leaving it
 * as it was, and leaving the field sets it. Its grip drags it off what it covers; the page keeps it going note
 * to note, and keeps where it was dragged to while it does (`useHeadPanels`).
 */
export function LyricField({ initial, line, x, y, nudge, onNudge, zoom = 1, onDone }: {
  /** The syllable the note has on this line now. */
  initial: string;
  /** The Lyric line, from 0. */
  line: number;
  /** Where the field's top left goes over the note, in the tab's own units, before any drag. */
  x: number;
  y: number;
  nudge: LyricNudge;
  onNudge: (nudge: LyricNudge) => void;
  /** The Size, which zooms the tab and the field with it: a drag's pixels are that many of its units. */
  zoom?: number;
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
  /** Types `char` at the caret, over what is selected, and stays on this note. */
  const typeHere = (input: HTMLInputElement, char: string) => {
    const from = input.selectionStart ?? value.length;
    const to = input.selectionEnd ?? from;
    caret.current = from + 1;
    setValue(spaced(value.slice(0, from) + char + value.slice(to)));
  };
  // The caret goes after the character typed, before the next key can land anywhere else.
  const caret = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (caret.current === null) return;
    inputRef.current?.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  }, [value]);
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    // Alt+Space and Alt+hyphen type their character without moving on, as in Dorico. On a Mac, Option+Space
    // types a no-break space and Option+hyphen a dash, so those keys count too.
    if (e.altKey && !e.ctrlKey && !e.metaKey && [' ', ' ', '-', '–'].includes(e.key)) {
      e.preventDefault();
      typeHere(e.currentTarget, e.key === '-' || e.key === '–' ? '-' : ' ');
      return;
    }
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

  // Dragging by the grip: the press is held so the field keeps its focus and the caret.
  const drag = useRef<{ x: number; y: number; from: LyricNudge } | null>(null);
  const onGripDown = (e: PointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, from: nudge };
  };
  const onGripMove = (e: PointerEvent<HTMLSpanElement>) => {
    const from = drag.current;
    if (!from) return;
    onNudge({ dx: from.from.dx + (e.clientX - from.x) / zoom, dy: from.from.dy + (e.clientY - from.y) / zoom });
  };
  const onGripUp = () => {
    drag.current = null;
    inputRef.current?.focus();
  };

  const caption = `Lyric line ${line + 1}`;
  return (
    <span
      className="tab-lyric card" style={{ left: x + nudge.dx, top: y + nudge.dy }} role="dialog" aria-label="Lyrics"
      onPointerDown={e => e.stopPropagation()}
    >
      <span
        className="tab-lyric-grip" title="Drag to move it out of the way" aria-hidden="true"
        onPointerDown={onGripDown} onPointerMove={onGripMove} onPointerUp={onGripUp} onPointerCancel={onGripUp}
      >
        <svg viewBox="0 0 6 12" width="6" height="12">{[2, 6, 10].flatMap(cy => [1, 5].map(cx => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1" />))}</svg>
      </span>
      <span className="tab-lyric-line" title={caption} aria-hidden="true">{line + 1}</span>
      <input
        ref={inputRef} className="tab-lyric-input" aria-label={caption} placeholder="la"
        value={value} maxLength={40} title="Space next note, hyphen next syllable, Esc to close"
        onChange={e => setValue(spaced(e.target.value))}
        onFocus={e => e.target.select()} onKeyDown={onKeyDown} onBlur={() => finish('done', false)}
      />
    </span>
  );
}

/** What the field keeps of what was typed: no-break spaces as spaces, one space at most between words, no other whitespace. */
function spaced(text: string): string {
  return text.replace(/ /g, ' ').replace(/[^\S ]/g, '').replace(/ {2,}/g, ' ');
}
