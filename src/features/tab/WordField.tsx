'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { toggleBold, type TypedText } from './textMarks';
import type { WordKind } from './tools';
import { DYNAMICS, dynamicOf, type Dynamic } from './clip';
import { DYNAMIC_REACH, dynamicWord } from './dynamics';
import type { PopoverMove } from './popoverStep';
import { techniquesFor } from './techniques';

/**
 * What a field sets: a palette word, a picked ending bracket's number, or how many times a picked repeat
 * is played. A tempo has its own panel (`TempoPanel.tsx`).
 */
export type FieldKind = Exclude<WordKind, 'tempo'> | 'ending' | 'repeat' | 'technique';

const CAPTIONS: Record<FieldKind, string> = {
  chord: 'Chord name',
  text: 'Text annotation',
  section: 'Section',
  ending: 'Ending number',
  repeat: 'Times played, 2 to 9',
  dynamic: 'Dynamic',
  technique: 'Technique',
};
const PLACEHOLDERS: Record<FieldKind, string> = { chord: 'Am7', text: 'Start fog machines', section: 'Chorus', ending: '2', repeat: '3', dynamic: 'mf, or ↓ for the list', technique: 'let ring, pm, vib…' };
/** The words that are numbers: only digits can be typed, and only as many as the largest takes. */
const NUMBER_LENGTH: Partial<Record<FieldKind, number>> = { ending: 1, repeat: 1 };
/** The longest a word can be typed: free text may run to a few lines, as it wraps over its column (issue #323). */
const WORD_LENGTH = (kind: FieldKind) => (kind === 'text' ? 200 : kind === 'dynamic' ? 6 : 40);
/** What a ⚠ by the technique popover says when what is typed names nothing it can add. */
export const NOT_A_TECHNIQUE = 'Not a technique: press the Down arrow key for the list (let ring, pm, vib, bend, ho…)';
/** What a ⚠ by a dynamic's field says when what is typed isn't one. */
export const NOT_A_DYNAMIC = 'Not a dynamic: press the Down arrow key for the list (ppp to fff, sf, sfz, fp…)';

/**
 * Whether what is typed can be set: a dynamic's field takes only a dynamic, or nothing to take it away; the
 * technique popover only what its list offers, or nothing (it closes).
 */
function settable(kind: FieldKind, value: string): boolean {
  if (kind === 'technique') return value.trim() === '' || techniquesFor(value).length > 0;
  return kind !== 'dynamic' || value.trim() === '' || dynamicOf(value) !== null;
}

/** The Text annotation field's width as it opens (`.tab-word`); its corner drags it wider. */
const TEXT_FIELD_WIDTH = 180;

/** The most rows the Text field grows to as new lines are typed; past them it scrolls. */
const TEXT_ROWS = 6;

/**
 * A small field over the tab for a chord name, free text, a section, an ending or a repeat's count, at the spot it is drawn.
 * Enter or leaving the field sets what is typed (empty clears it); Esc leaves it as it was. The Text
 * field takes more: Shift+Enter starts a new line in it (issue #445), and Cmd+B makes the selected words
 * bold, `**` round them (issue #446).
 */

interface WordFieldProps {
  kind: FieldKind;
  /** What the field starts with. */
  initial: string;
  /** Where the field's middle and top go (its bottom with `up`), in the tab's own units. */
  x: number;
  y: number;
  /** The field hangs up from `y`, so a text annotation's new lines grow away from the line it is over. */
  up?: boolean;
  /** A text annotation's field: the size its corner was dragged to, kept as the popover moves on, and where a drag reports it. */
  size?: TextSize | null;
  onResize?: (size: TextSize) => void;
  /**
   * What was typed, or null for Esc; `byKey` when a key finished it, not leaving the field. A chord name's
   * field (the chord popover, issue #342) also gives where Space, Shift+Space, Tab or Shift+Tab moves it, and
   * a text annotation's field (the text annotation popover) where Tab or Shift+Tab does.
   */
  onDone: (value: string | null, byKey: boolean, move?: PopoverMove) => void;
}

/** The size a text annotation's field was dragged to, as CSS lengths ('' for one never dragged). */
export interface TextSize {
  width: string;
  height: string;
}

/** Every dynamic in alphabetical order, so a word comes before the longer ones it starts: p, pf, pp, ppp… */
const ALPHABETICAL = [...DYNAMICS].sort();

/**
 * The dynamics a dynamic's list offers for what is typed: those starting with it, every one for nothing typed,
 * alphabetically. The dynamic typed exactly is always first, so Enter sets it.
 */
export function dynamicsFor(typed: string): readonly Dynamic[] {
  const start = typed.trim().toLowerCase();
  return ALPHABETICAL.filter(d => d.startsWith(start));
}

export function WordField({ kind, initial, x, y, up = false, size = null, onResize, onDone }: WordFieldProps) {
  const [value, setValue] = useState(initial);
  const digits = NUMBER_LENGTH[kind];
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  // The field opens from a press or a key on the tab, so typing goes straight into it.
  useEffect(() => inputRef.current?.focus({ preventScroll: true }), []);
  // Enter and then the blur it causes would both finish; only the first counts.
  const done = useRef(false);
  const finish = (result: string | null, byKey: boolean, move?: PopoverMove) => {
    if (done.current) return;
    done.current = true;
    onDone(result, byKey, move);
  };
  // A drag of a text annotation field's corner sets its own size, kept for the next column (issue #342). The
  // pointer can end the drag off the field, so its size is watched rather than a pointerup on it.
  useEffect(() => {
    const field = inputRef.current;
    if (kind !== 'text' || !field || !onResize || typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(() => {
      const { width, height } = field.style;
      if (width || height) onResize({ width, height });
    });
    watch.observe(field);
    return () => watch.disconnect();
  }, [kind, onResize]);
  // Where the selection goes once a Cmd+B change is drawn.
  const selectAfter = useRef<TypedText | null>(null);
  useLayoutEffect(() => {
    const next = selectAfter.current;
    selectAfter.current = null;
    if (next) inputRef.current?.setSelectionRange(next.start, next.end);
  }, [value]);
  const isText = kind === 'text';
  // Enter on what isn't a dynamic keeps the field open with its ⚠, as Dorico's popover turns red.
  const [refused, setRefused] = useState(false);
  // A dynamic's list (Jeremy, 2026-11-09): ↓ opens it, filtered by what is typed; ↑ ↓ move, Enter or a press picks.
  const listId = useId();
  const [listOpen, setListOpen] = useState(false);
  const [active, setActive] = useState(0);
  // Over the field when the window has no room for it under the field, so it never runs off the page.
  const [listUp, setListUp] = useState(false);
  // A dynamic's list holds dynamics; the technique popover's (issue #501) the techniques whose names start with what is typed.
  const hasList = kind === 'dynamic' || kind === 'technique';
  const techniques = kind === 'technique' ? techniquesFor(value) : [];
  const choices: readonly string[] = kind === 'dynamic' ? dynamicsFor(value) : techniques.map(t => t.name);
  const activeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [active, listOpen]);
  /** Opens the list under the field, or over it when the window has no room under it. */
  const openList = (input: Element) => {
    const field = input.getBoundingClientRect();
    setListUp(window.innerHeight - field.bottom < LIST_ROOM && field.top > window.innerHeight - field.bottom);
    setListOpen(true);
  };
  const onListKey = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>): boolean => {
    if (!hasList) return false;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!listOpen) {
        openList(e.currentTarget);
        setActive(0);
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
    // With nothing typed the technique list is all there is: Esc closes the popover with it.
    if (e.key === 'Escape' && kind === 'technique' && value.trim() === '') return false;
    // Esc closes the list first, as a browser's own lists do; the next Esc leaves the field.
    if (e.key === 'Escape') {
      setListOpen(false);
      return true;
    }
    return false;
  };
  /**
   * The chord popover's own keys, as Dorico's Shift+Q popover has them: Space sets the name and moves to the
   * next column, Shift+Space to the one before, Tab to the next bar, Shift+Tab to the bar before. Alt+Space
   * types a space in the name without moving (Option+Space types a no-break space on a Mac, so it counts too).
   */
  const onChordKey = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>): boolean => {
    if (kind !== 'chord' || e.ctrlKey || e.metaKey) return false;
    const field = e.currentTarget;
    if (e.altKey && (e.key === ' ' || e.key === '\u00a0')) {
      e.preventDefault();
      const start = field.selectionStart ?? value.length;
      const end = field.selectionEnd ?? start;
      const next = value.slice(0, start) + ' ' + value.slice(end);
      if (next.length > WORD_LENGTH(kind)) return true;
      selectAfter.current = { value: next, start: start + 1, end: start + 1 };
      setValue(next);
      return true;
    }
    if (e.altKey) return false;
    const move: PopoverMove | null = e.key === ' ' ? (e.shiftKey ? 'back' : 'next') : e.key === 'Tab' ? (e.shiftKey ? 'backBar' : 'nextBar') : null;
    if (!move) return false;
    e.preventDefault();
    finish(value, true, move);
    return true;
  };
  /**
   * The text annotation popover's own keys (issue #342): Tab sets the text annotation and moves to the next column,
   * Shift+Tab to the one before, so a series of text annotations is typed in one go. Space types a space in a text
   * annotation, so Tab takes the job Space has in the chord popover.
   */
  const onTextKey = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>): boolean => {
    if (kind !== 'text' || e.key !== 'Tab' || e.ctrlKey || e.metaKey || e.altKey) return false;
    e.preventDefault();
    finish(value, true, e.shiftKey ? 'back' : 'next');
    return true;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.stopPropagation();
    if (onListKey(e) || onChordKey(e) || onTextKey(e)) return;
    // Enter in the technique popover adds what its list would light first (Esc closed the list); nothing typed closes it.
    if (kind === 'technique' && e.key === 'Enter') {
      e.preventDefault();
      if (value.trim() === '') finish(null, true);
      else if (choices[0]) finish(choices[0], true);
      else setRefused(true);
      return;
    }
    // Shift+Enter is a new line in a Text: the textarea's own.
    if (e.key === 'Enter' && !(isText && e.shiftKey)) {
      e.preventDefault();
      if (settable(kind, value)) finish(value, true);
      else setRefused(true);
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
    // Leaving a field with what can't be set leaves things as they were.
    onFocus: (e: { target: HTMLInputElement | HTMLTextAreaElement }) => e.target.select(), onKeyDown,
    // Leaving the technique popover adds nothing: it adds only on Enter or a press in its list.
    onBlur: () => finish(kind !== 'technique' && settable(kind, value) ? value : null, false),
  };
  const showList = hasList && listOpen;
  const problem = kind === 'technique' ? NOT_A_TECHNIQUE : NOT_A_DYNAMIC;
  return (
    <span
      className={`tab-word card${digits ? ' tab-word-fit' : ''}${isText ? ' tab-word-free' : ''}${up ? ' tab-word-up' : ''}${kind === 'technique' ? ' tab-word-technique' : ''}`}
      // A text annotation's field keeps its left edge where it opened, so dragging its corner wider grows it to the right.
      style={{ left: isText ? x - TEXT_FIELD_WIDTH / 2 : x, top: y }} role="dialog" aria-label={CAPTIONS[kind]}>
      <span className="tab-time-caption">{CAPTIONS[kind]}</span>
      {isText ? (
        <textarea
          {...shared} className="input tab-word-input tab-word-text" rows={Math.min(TEXT_ROWS, value.split('\n').length)}
          style={size ? { width: size.width || undefined, height: size.height || undefined } : undefined}
          onChange={e => setValue(e.target.value)}
        />
      ) : (
        <span className="tab-word-row">
          <input
            {...shared} className={`input ${digits ? 'tab-word-number' : 'tab-word-input'}`} inputMode={digits ? 'numeric' : 'text'}
            onChange={e => {
              setValue(digits ? e.target.value.replace(/\D/g, '') : e.target.value);
              setRefused(false);
              setActive(0);
              // The technique list shows as soon as anything is typed, as Dorico's Shift+P popover lists its matches.
              if (kind === 'technique') openList(e.target);
            }}
            aria-invalid={refused || undefined}
            {...(hasList && {
              role: 'combobox', 'aria-autocomplete': 'list' as const, 'aria-expanded': showList, 'aria-controls': listId,
              'aria-activedescendant': showList && choices[active] ? `${listId}-${active}` : undefined,
            })}
          />
          {refused && <span className="tab-word-problem" role="img" aria-label={problem} title={problem}>⚠</span>}
        </span>
      )}
      {showList && (
        // A press in the list keeps the field focused (its blur would set what is typed), and picks the option pressed.
        <div
          id={listId} role="listbox" aria-label={kind === 'technique' ? 'Techniques' : 'Dynamics'} tabIndex={-1} className={`tab-word-list${listUp ? ' tab-word-list-up' : ''}`}
          onMouseDown={e => e.preventDefault()}
          onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') setListOpen(false); }}
          onClick={e => {
            const option = (e.target as HTMLElement).closest<HTMLElement>('[role="option"]');
            const picked = option?.dataset.dynamic ?? option?.dataset.technique;
            if (picked) finish(picked, true);
          }}
        >
          {choices.map((d, i) => (
            <div
              key={d} id={`${listId}-${i}`} ref={i === active ? activeRef : undefined} role="option" aria-selected={i === active}
              tabIndex={-1} {...(kind === 'dynamic' ? { 'data-dynamic': d } : { 'data-technique': d })} className="tab-word-option"
              onMouseMove={() => { if (i !== active) setActive(i); }}
            >
              {kind === 'dynamic' ? (
                <>
                  <DynamicGlyph dynamic={d as Dynamic} />
                  <span className="tab-word-option-text">{d}</span>
                </>
              ) : (
                <>
                  <span>{d}</span>
                  <span className="tab-word-option-group">{techniques[i].group}</span>
                </>
              )}
            </div>
          ))}
          {choices.length === 0 && <div className="tab-word-none">No {kind === 'technique' ? 'technique' : 'dynamic'} starts with “{value.trim()}”</div>}
        </div>
      )}
    </span>
  );
}

/** The room a dynamic's list takes under its field: its most height (`.tab-word-list`) and a margin. */
const LIST_ROOM = 240;

/** The list's dynamics are drawn a little smaller than on the tab, to fit its rows. */
const LIST_SCALE = 0.8;

/** A dynamic in the letters it is drawn with on the tab, for its row in the list. */
function DynamicGlyph({ dynamic }: { dynamic: Dynamic }) {
  const { letters, box } = dynamicWord(dynamic, 0, 0);
  // Every row is as tall as an f reaches, top to tail, so no letter is cut off and the rows line up.
  const { top, bottom } = DYNAMIC_REACH;
  const height = bottom - top + 2;
  return (
    <svg width={(box.width + 4) * LIST_SCALE} height={height * LIST_SCALE} viewBox={`${box.x - 2} ${top - 1} ${box.width + 4} ${height}`} aria-hidden="true" fill="currentColor">
      {letters.map((letter, i) => <path key={i} d={letter.d} transform={letter.transform} />)}
    </svg>
  );
}
