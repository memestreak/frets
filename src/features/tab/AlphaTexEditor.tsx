'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import type { TextSpot } from './ascii';
import type { Clip } from './clip';
import { writeAlphaTex } from './alphatex';
import { loadAlphaTab, readAlphaTexWith } from './alphatexRead';
import { commentSpots, lineMarks, type LineMark } from './alphatexText';

/** How long after the last key the text is read, and the clip changed if it reads cleanly. */
export const READ_DELAY_MS = 500;

/** What the last read of the text found wrong: errors with a spot in it, and errors with none (two tracks, say). */
interface Problems {
  text: string;
  spots: TextSpot[];
  unplaced: string[];
}
const NO_PROBLEMS: Omit<Problems, 'text'> = { spots: [], unplaced: [] };

type AlphaTab = Awaited<ReturnType<typeof loadAlphaTab>>;

/** Reads the text: the clip it says, if that differs from `current`, and what is wrong with it. */
function read(at: AlphaTab, typed: string, current: Clip): { clip: Clip | null; problems: Problems } {
  const result = readAlphaTexWith(at, typed);
  if (!result.ok) {
    const spots = result.spots ?? [];
    return { clip: null, problems: { text: typed, spots, unplaced: spots.length > 0 ? [] : result.errors } };
  }
  const changed = writeAlphaTex(result.clip) !== writeAlphaTex(current);
  return { clip: changed ? result.clip : null, problems: { text: typed, ...NO_PROBLEMS } };
}

/**
 * The AlphaTex view's editor (issue #126; `docs/specs/2026-10-27-tab-alphatex-editing-design.md`).
 * Half a second after typing stops, the text is read; if it reads cleanly the clip becomes what it
 * says (one undo step), and if not the clip stays as it was and the errors are marked: a red ⚠ in
 * the margin and a red underline under the text, each explaining itself on hover. Comments get a
 * grey ⚠: Frets drops them. The page keeps the text as typed until the view is left
 * (`text` and `onText`), then shows the clip in its own layout again.
 */
export function AlphaTexEditor({ clip, text, onText, onClip }: {
  clip: Clip;
  /** The text as typed, or the clip written out. */
  text: string;
  onText: (text: string) => void;
  /** A clip read from the text, different from `clip`; the text that says it goes with it. */
  onClip: (clip: Clip, text: string) => void;
}) {
  const [problems, setProblems] = useState<Problems>({ text, ...NO_PROBLEMS });
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  // alphaTab once loaded, so leaving the view can read the last keys at once.
  const alphaTab = useRef<AlphaTab | null>(null);
  const latest = useRef({ clip, text, onClip });
  useEffect(() => {
    latest.current = { clip, text, onClip };
  });

  // Read the text a moment after the last key; the clip written out needs no reading.
  useEffect(() => {
    let cancelled = false;
    void loadAlphaTab().then(at => { alphaTab.current = at; });
    if (text === writeAlphaTex(clip)) return;
    const timer = window.setTimeout(() => {
      void loadAlphaTab().then(at => {
        if (cancelled) return;
        const { clip: next, problems: found } = read(at, text, latest.current.clip);
        setProblems(found);
        if (next) latest.current.onClip(next, text);
      });
    }, READ_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // `clip` changes only with the text: an edit elsewhere puts the clip's own text back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  // Leaving the view before the read: the last keys still count, if they read cleanly.
  useEffect(() => () => {
    const { clip: current, text: typed, onClip: apply } = latest.current;
    const at = alphaTab.current;
    if (!at || typed === writeAlphaTex(current)) return;
    const { clip: next } = read(at, typed, current);
    if (next) apply(next, typed);
  }, []);

  // The errors found in an older text would sit on the wrong characters, so they wait for the next read.
  const fresh = problems.text === text;
  const errors = fresh ? problems.spots : [];
  const comments = commentSpots(text);
  const marks = lineMarks(text, errors, fresh ? problems.unplaced : [], comments);
  const lines = text.split('\n');
  const errorText = fresh ? [...problems.spots.map(s => s.message), ...problems.unplaced] : [];

  // The textarea lies over the underlines, so the pointer finds them by their boxes.
  useEffect(() => {
    const input = inputRef.current;
    const mirror = mirrorRef.current;
    if (!input || !mirror) return;
    const onMove = (e: PointerEvent) => {
      const hit = [...mirror.querySelectorAll<HTMLElement>('[data-error]')].find(el =>
        [...el.getClientRects()].some(r => e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top - 2 && e.clientY <= r.bottom + 2));
      const tip = hit?.dataset.error;
      if (tip) input.setAttribute('data-tip', tip);
      else input.removeAttribute('data-tip');
    };
    // A press or leaving drops the tip, so focusing the text never shows one under the editor.
    const clear = () => input.removeAttribute('data-tip');
    // Before the page's tips look for a data-tip, which they do as the move bubbles up.
    input.addEventListener('pointermove', onMove);
    input.addEventListener('pointerdown', clear);
    input.addEventListener('pointerleave', clear);
    return () => {
      input.removeEventListener('pointermove', onMove);
      input.removeEventListener('pointerdown', clear);
      input.removeEventListener('pointerleave', clear);
    };
  }, []);

  const gutterDigits = String(lines.length).length;
  return (
    <div className="tab-text-editor" style={{ ['--gutter-digits' as string]: gutterDigits }}>
      {/* The lines as typed, under the textarea: their numbers and ⚠ in the margin, and the error underlines. */}
      <div ref={mirrorRef} className="tab-text-mirror" data-testid="alphatex-mirror">
        {lines.map((line, i) => (
          <div key={i} className="tab-text-line">
            <span className="tab-text-margin" aria-hidden="true">
              {marks.has(i) && <MarginMark mark={marks.get(i)!} line={i + 1} />}
              <span className="tab-text-number">{i + 1}</span>
            </span>
            <span aria-hidden="true">{underlined(line, lineStart(lines, i), errors)}</span>
          </div>
        ))}
      </div>
      <textarea
        ref={inputRef} className="tab-text-input" value={text} spellCheck={false}
        autoCapitalize="off" autoComplete="off" autoCorrect="off"
        aria-label="alphaTex" aria-invalid={errorText.length > 0} aria-describedby="alphatex-errors"
        onChange={e => onText(e.target.value)}
      />
      <p id="alphatex-errors" className="sr-only">{errorText.join(' ')}</p>
    </div>
  );
}

/** A small ⚠ in the margin: red for an error, grey for a comment Frets won't keep. Its tip says why. */
function MarginMark({ mark, line }: { mark: LineMark; line: number }) {
  return (
    <span className={`tab-text-mark tab-text-mark-${mark.tone}`} data-tip={mark.message} data-testid={`margin-${mark.tone}-${line}`}>
      <svg viewBox="0 0 14 13" width={13} height={12} aria-hidden="true">
        <path d="M7 1 L13 12 L1 12 Z" fill="currentColor" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
        <text x={7} y={10.6} fontSize={8} fontWeight={800} fill="var(--surface-raised)" textAnchor="middle">!</text>
      </svg>
    </span>
  );
}

/** Where line `i` starts in the whole text. */
function lineStart(lines: string[], i: number): number {
  let start = 0;
  for (let n = 0; n < i; n++) start += lines[n].length + 1;
  return start;
}

/**
 * One line's text with its errors underlined. An error with no width (the text ends too soon) underlines
 * the character after it, or a space at the line's end.
 */
function underlined(line: string, start: number, errors: TextSpot[]) {
  const end = start + line.length;
  const here = errors
    .map(e => ({ from: e.from, to: Math.max(e.to, e.from + 1), message: e.message }))
    .filter(e => e.from <= end && e.to > start)
    .map(e => ({ from: Math.max(e.from, start) - start, to: Math.min(e.to, end + 1) - start, message: e.message }))
    .sort((a, b) => a.from - b.from);
  const parts: ReactNode[] = [];
  let at = 0;
  for (const e of here) {
    if (e.from < at) continue;
    if (e.from > at) parts.push(line.slice(at, e.from));
    parts.push(
      <span key={e.from} className="tab-text-error" data-error={e.message}>
        {/* Past the line's end there is no character to underline, so a space stands in. */}
        {e.to > line.length ? `${line.slice(e.from)} ` : line.slice(e.from, e.to)}
      </span>,
    );
    at = e.to;
  }
  if (at < line.length) parts.push(line.slice(at));
  return parts;
}
