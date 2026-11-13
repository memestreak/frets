import { useRef, useState } from 'react';
import type { Clip, Duration, Part } from './clip';
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
import { clashMessage } from './voices';

/** A chord name, text, section, tempo, ending, bar line or technique mark picked by a press. */
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
  tabFocused: boolean;
  setTabFocused: (on: boolean) => void;
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
   * One Tied note picked alone (Alt+press, `docs/specs/2026-11-04-tab-ties-forward-design.md`): the cursor
   * is on it, and marks go on it alone; every other edit still takes its whole Tie chain. Any commit lets it go.
   */
  alone: boolean;
  setAlone: (on: boolean) => void;
  /**
   * Note input mode (issue #238, as MuseScore's): N or the palette's pencil goes in and out, Esc out. In it the
   * cursor types and a press enters a note; out of it, in normal mode, a press selects what it is on.
   */
  noteInputMode: boolean;
  setNoteInputMode: (on: boolean) => void;
  /**
   * Note input mode's length (`inputLength.ts`): the next note entered on a rest takes it, as MuseScore's
   * does. Set on the way in from the notes there, then by the length keys and the Duration buttons.
   */
  inputLength: Duration;
  setInputLength: (length: Duration) => void;
  /**
   * Tuplet entry (`docs/specs/2026-11-04-tab-tuplets-grace-rest-design.md`): in note input mode, the tuplet the
   * typed notes go in as, picked from the Tuplet panel, or null. Leaving note input mode turns it off.
   */
  tupletEntry: number | null;
  setTupletEntry: (n: number | null) => void;
  /** Grace entry: in note input mode, typed frets go in as grace notes before the cursor's time (`/`). Leaving note input mode turns it off. */
  graceEntry: boolean;
  setGraceEntry: (on: boolean) => void;
  /**
   * Where a tuplet Tuplet entry began with a rest (`,`) starts, in ticks, until its first note makes it;
   * null when none is waiting.
   */
  tupletFrom: number | null;
  setTupletFrom: (at: number | null) => void;
  /**
   * How many ticks into its rest note input mode's cursor is (`grid.ts`, issue #293): ← →, a press or Shift+Space
   * move it there, and every commit puts it back to 0. It counts only while the cursor is still on that rest.
   */
  cursorAt: number;
  setCursorAt: (at: Cursor, ticks: number) => void;
  /** The drawn clip's box, which takes the keys. */
  editorRef: React.RefObject<HTMLDivElement | null>;
  /** The digit just typed, so a second one soon after on the same spot makes a two-digit fret. */
  lastDigitRef: React.RefObject<LastDigit>;
  /**
   * Records an edit as one undo step and moves the cursor; a change that changed nothing is not a step. An
   * edit that would sound a string in two Voices at once is refused, and the line under the clip says why
   * (step 9, Q10); it returns whether the edit went in.
   */
  commit: (next: Part, nextCursor?: Cursor, nextSelection?: Selection | null) => boolean;
  /**
   * An edit of several Voices at once (step 9, Q19) as one undo step: the whole clip `next`, and the Active
   * voice's Part of it, `part`. With `follow` the cursor and selection are the Part's as it was, and follow
   * by time; else they are already `part`'s. Refused as `commit` refuses.
   */
  commitVoices: (next: Clip, part: Part, nextCursor?: Cursor, nextSelection?: Selection | null, follow?: boolean) => boolean;
  /** A time signature or Pickup bar changed from bar `at`: every Track re-barred from there (step 4). */
  commitReBar: (changed: Part, at: number) => void;
  /** Says something on the line under the clip. */
  setNotice: (notice: Notice | null) => void;
  /**
   * Starting a run of selected columns lets go of the note the cursor was on (Jeremy, 2026-10-28): no
   * string is picked and the staff's cursor goes, so nothing stays lit when the run does.
   */
  startRegion: () => void;
  /**
   * The cursor on the column at a pitch: its string boxed when a note there has it, else the column alone.
   * With `filled`, `next` is the clip with its empty bars written out, already put in: no edit of its own.
   */
  toPitch: (next: Part, at: Cursor, pitch: number, nextSelection?: Selection | null, filled?: boolean) => void;
}

/** The editor's state over the shown track `clip`. */
export function useEditorState({ clip, dispatch, replace, setNotice }: {
  clip: Part;
  /** Puts an edited whole clip in, as one undo step. */
  replace: (next: Clip) => void;
  dispatch: (action: ClipAction | PartAction) => void;
  setNotice: (notice: Notice | null) => void;
}): EditorState {
  const [cursorAsSet, setCursor] = useState<Cursor>(START);
  const [selectionAsSet, setSelection] = useState<Selection | null>(null);
  const [tabFocused, setTabFocused] = useState(false);
  const [columnOnly, setColumnOnly] = useState(false);
  const [staffPitch, setStaffPitch] = useState<number | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [alone, setAlone] = useState(false);
  const [noteInputMode, setNoteInputModeOnly] = useState(false);
  const [inputLength, setInputLength] = useState<Duration>({ value: 4, dots: 0 });
  const [tupletEntry, setTupletEntry] = useState<number | null>(null);
  const [graceEntry, setGraceEntry] = useState(false);
  const [tupletFrom, setTupletFrom] = useState<number | null>(null);
  // Leaving note input mode turns Tuplet entry and Grace entry off.
  const setNoteInputMode = (on: boolean) => {
    setNoteInputModeOnly(on);
    if (!on) {
      setTupletEntry(null);
      setGraceEntry(false);
      setTupletFrom(null);
    }
  };
  const [restSpot, setRestSpot] = useState<{ bar: number; column: number; at: number } | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const lastDigitRef = useRef<LastDigit>(null);

  const cursor = clampCursor(clip, cursorAsSet);
  const cursorAt = noteInputMode && restSpot && restSpot.bar === cursor.bar && restSpot.column === cursor.column && isInsideRest(clip, cursor, restSpot.at) ? restSpot.at : 0;
  const setCursorAt = (at: Cursor, ticks: number) => setRestSpot(ticks > 0 ? { bar: at.bar, column: at.column, at: ticks } : null);
  const selection = selectionAsSet && Math.max(selectionAsSet.anchor, selectionAsSet.focus) < columnCount(clip) ? selectionAsSet : null;

  /** An edit's clash with another Voice, said under the clip; true when there is one. */
  const refused = (next: Part) => {
    const clash = next === clip ? null : clashMessage(clip, next);
    if (clash) setNotice({ tone: 'error', lines: [clash] });
    return clash !== null;
  };
  /** After an edit: the cursor and selection follow by time, and what was picked goes. */
  const followed = (next: Part, written: Part, nextCursor: Cursor, nextSelection: Selection | null) => {
    setCursor(cursorAtTime(next, written, nextCursor));
    setSelection(selectionAtTime(next, written, nextSelection));
    setPicked(null);
    setAlone(false);
    setNotice(null);
    // The caret keeps its place inside a rest while only its string or staff line changes (Jeremy, 2026-11-08,
    // issue #396: ↑ after → in an empty bar sent it back to the bar's start).
    const sameRest = next === clip && nextCursor.bar === cursor.bar && nextCursor.column === cursor.column;
    if (!sameRest) setRestSpot(null);
  };
  const commit = (next: Part, nextCursor: Cursor = cursor, nextSelection: Selection | null = selection) => {
    if (refused(next)) return false;
    if (next !== clip) dispatch({ type: 'replacePart', part: next });
    // The dispatch writes the bars whose rhythm changed again by the meter; the cursor and selection follow by time.
    followed(next, next === clip ? next : rewrite(clip, next), nextCursor, nextSelection);
    return true;
  };
  const commitVoices = (next: Clip, part: Part, nextCursor: Cursor = cursor, nextSelection: Selection | null = selection, follow = false) => {
    if (refused(part)) return false;
    replace(next);
    followed(follow ? clip : part, part, nextCursor, nextSelection);
    return true;
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

  const toPitch = (next: Part, at: Cursor, pitch: number, nextSelection: Selection | null = null, filled = false) => {
    const string = stringAtPitch(next, at, pitch);
    const nextCursor = { ...at, string: string ?? at.string };
    // `filled`: `next` is the clip with its empty bars written out, already put in as the same music (issues
    // #421, #422), not an edit: no undo step of its own.
    if (filled) followed(next, next, nextCursor, nextSelection);
    else commit(next, nextCursor, nextSelection);
    setColumnOnly(string === null);
    setStaffPitch(pitch);
  };

  return {
    clip, dispatch, cursor, cursorAsSet, setCursor, selection, selectionAsSet, setSelection, tabFocused, setTabFocused,
    columnOnly, setColumnOnly, staffPitch, setStaffPitch, picked, setPicked, alone, setAlone, noteInputMode, setNoteInputMode,
    inputLength, setInputLength, tupletEntry, setTupletEntry, graceEntry, setGraceEntry, tupletFrom, setTupletFrom, cursorAt, setCursorAt, editorRef, lastDigitRef, commit, commitVoices, commitReBar, setNotice,
    startRegion, toPitch,
  };
}
