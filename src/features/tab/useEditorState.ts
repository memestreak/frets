import { useRef, useState } from 'react';
import type { Duration, Part } from './clip';
import type { ClipAction, PartAction } from './clipState';
import { clampCursor, columnCount, START, type Cursor, type Selection } from './editing';
import type { LastDigit } from './editorKeys';
import type { WordHit } from './layoutText';
import { isInsideRest } from './grid';
import { cursorAtTime, rewrite, selectionAtTime } from './rewrite';
import type { MarkHit } from './marks';
import type { Notice } from './notice';
import { stringAtPitch } from './staffEntry';
import { placeAtTime, reBar, reBarEnd, SPLITS_TUPLET, timeOf } from './timeline';

/** A chord name, text, section, tempo, capo, ending, bar line or technique mark picked by a press. */
export type Picked = WordHit | MarkHit;

/**
 * The Tab page's editor: where the cursor is, what is selected or picked, the mode, and the one way an
 * edit is recorded (`commit`). The page and its hooks (`useTabPicking`, `useHeadPanels`) share it.
 */
export interface EditorState {
  /** The shown track, as edited. */
  clip: Part;
  /** Sends an edit of the shown track into the whole clip. */
  dispatch: (action: ClipAction | PartAction) => void;
  /** The cursor, kept on the clip: an undo can take away the column it was on. */
  cursor: Cursor;
  /** The cursor as last set; the playback line holds only while it stays the same. */
  cursorAsSet: Cursor;
  setCursor: (next: Cursor | ((c: Cursor) => Cursor)) => void;
  /** The selected columns while they are all in the clip. */
  selection: Selection | null;
  /** The selection as last set; the playback line holds only while it stays the same. */
  selectionAsSet: Selection | null;
  setSelection: (next: Selection | null) => void;
  /** Whether the tab has the keys. */
  editing: boolean;
  setEditing: (on: boolean) => void;
  /**
   * The cursor is on its column only, with no string picked (Jeremy, 2026-10-27): Esc on a string, or a
   * press above or below the staff while the playback controls are hidden. The tools and keys then work
   * on the whole column; ↑ ↓ or a press on a string pick a string again.
   */
  columnOnly: boolean;
  setColumnOnly: (on: boolean) => void;
  /**
   * The staff's own cursor (issue #136): the sounding pitch on the cursor's column that Enter adds or
   * takes away. Set by a press on the staff, which hands the keys to it; a press on the tab sets it to
   * null and hands them back.
   */
  staffPitch: number | null;
  setStaffPitch: (pitch: number | null) => void;
  /**
   * The word, bar line or technique mark picked by a press, drawn in the selection's blue, its Delete (and
   * Edit, for a word or a repeat's count) in a right-click menu (Jeremy, 2026-11-01, issue #276).
   */
  picked: Picked | null;
  setPicked: (hit: Picked | null) => void;
  /**
   * Note input (issue #238, as MuseScore's): N or the palette's pencil goes in and out, Esc out. In it the
   * cursor types and a press enters a note; out of it, in normal mode, a press selects what it is on.
   */
  inputMode: boolean;
  setInputMode: (on: boolean) => void;
  /**
   * Note input's length (`inputLength.ts`): the next note entered on a rest takes it, as MuseScore's
   * does. Set on the way in from the notes there, then by the length keys and the Duration buttons.
   */
  inputLength: Duration;
  setInputLength: (length: Duration) => void;
  /**
   * How many ticks into its rest note input's cursor is (`grid.ts`, issue #293): ← →, a press or Shift+Space
   * move it there, and every commit puts it back to 0. It counts only while the cursor is still on that rest.
   */
  cursorAt: number;
  setCursorAt: (at: Cursor, ticks: number) => void;
  /** The drawn clip's box, which takes the keys. */
  editorRef: React.RefObject<HTMLDivElement | null>;
  /** The digit just typed, so a second one soon after on the same spot makes a two-digit fret. */
  lastDigitRef: React.RefObject<LastDigit>;
  /** Records an edit as one undo step and moves the cursor; a change that changed nothing is not a step. */
  commit: (next: Part, nextCursor?: Cursor, nextSelection?: Selection | null) => void;
  /** A time signature or Pickup bar changed from bar `at`: every Track re-barred from there (step 4). */
  commitReBar: (changed: Part, at: number) => void;
  /** Says something on the line under the clip. */
  setNotice: (notice: Notice | null) => void;
  /**
   * Starting a run of selected columns lets go of the note the cursor was on (Jeremy, 2026-10-28): no
   * string is picked and the staff's cursor goes, so nothing stays lit when the run does.
   */
  startRegion: () => void;
  /** The cursor on the column at a pitch: its string boxed when a note there has it, else the column alone. */
  toPitch: (next: Part, at: Cursor, pitch: number, nextSelection?: Selection | null) => void;
}

/** The editor's state over the shown track `clip`. */
export function useEditorState({ clip, dispatch, setNotice }: {
  clip: Part;
  dispatch: (action: ClipAction | PartAction) => void;
  setNotice: (notice: Notice | null) => void;
}): EditorState {
  const [cursorAsSet, setCursor] = useState<Cursor>(START);
  const [selectionAsSet, setSelection] = useState<Selection | null>(null);
  const [editing, setEditing] = useState(false);
  const [columnOnly, setColumnOnly] = useState(false);
  const [staffPitch, setStaffPitch] = useState<number | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [inputMode, setInputMode] = useState(false);
  const [inputLength, setInputLength] = useState<Duration>({ value: 4, dots: 0 });
  const [restSpot, setRestSpot] = useState<{ bar: number; column: number; at: number } | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const lastDigitRef = useRef<LastDigit>(null);

  const cursor = clampCursor(clip, cursorAsSet);
  const cursorAt = inputMode && restSpot && restSpot.bar === cursor.bar && restSpot.column === cursor.column && isInsideRest(clip, cursor, restSpot.at) ? restSpot.at : 0;
  const setCursorAt = (at: Cursor, ticks: number) => setRestSpot(ticks > 0 ? { bar: at.bar, column: at.column, at: ticks } : null);
  const selection = selectionAsSet && Math.max(selectionAsSet.anchor, selectionAsSet.focus) < columnCount(clip) ? selectionAsSet : null;

  const commit = (next: Part, nextCursor: Cursor = cursor, nextSelection: Selection | null = selection) => {
    if (next !== clip) dispatch({ type: 'replacePart', part: next });
    // The dispatch writes the bars whose rhythm changed again by the meter; the cursor and selection follow by time.
    const written = next === clip ? next : rewrite(clip, next);
    setCursor(cursorAtTime(next, written, nextCursor));
    setSelection(selectionAtTime(next, written, nextSelection));
    setPicked(null);
    setNotice(null);
    setRestSpot(null);
  };

  /**
   * A time signature or Pickup bar changed from bar `at` (`changed`, its bars otherwise as they were):
   * the music from there to the next time signature change is re-barred in every Track, and the
   * cursor stays at the same time. A tuplet that would cross a new bar line refuses the change.
   */
  const commitReBar = (changed: Part, at: number) => {
    if (changed === clip) return;
    const to = reBarEnd(clip, at);
    const shown = reBar(clip, changed, at, to);
    if (!shown) {
      setNotice({ tone: 'error', lines: [SPLITS_TUPLET] });
      return;
    }
    dispatch({ type: 'reBarPart', part: changed, from: at, to });
    setCursor({ ...cursor, ...placeAtTime(shown, timeOf(clip, cursor.bar, cursor.column)) });
    setSelection(null);
    setPicked(null);
    setNotice(null);
    setRestSpot(null);
  };

  const startRegion = () => {
    setColumnOnly(true);
    setStaffPitch(null);
  };

  const toPitch = (next: Part, at: Cursor, pitch: number, nextSelection: Selection | null = null) => {
    const string = stringAtPitch(next, at, pitch);
    commit(next, { ...at, string: string ?? at.string }, nextSelection);
    setColumnOnly(string === null);
    setStaffPitch(pitch);
  };

  return {
    clip, dispatch, cursor, cursorAsSet, setCursor, selection, selectionAsSet, setSelection, editing, setEditing,
    columnOnly, setColumnOnly, staffPitch, setStaffPitch, picked, setPicked, inputMode, setInputMode,
    inputLength, setInputLength, cursorAt, setCursorAt, editorRef, lastDigitRef, commit, commitReBar, setNotice,
    startRegion, toPitch,
  };
}
