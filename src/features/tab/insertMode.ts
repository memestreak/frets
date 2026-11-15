/**
 * Insert mode (`docs/specs/2026-11-14-tab-insert-mode-design.md`, issue #482 phase 2, Dorico's): while it is on,
 * entering a note makes room for it first, pushing the music after the caret later in every Voice of the
 * Track, and Delete takes the time away. These are the rules for when an entry pushes and when Delete takes
 * the time; the pushes and pulls themselves are the timeline's (`timeline.ts`), as Insert and Ctrl/⌘+Delete
 * already made them. Length changes push and pull in `noteEdits.ts` (`writeLength`).
 */
import { ticks, type Part } from './clip';
import { columnAt, cursorTime, insertTime, noteAt, type Cursor, type Selection } from './editing';
import { SPLITS_TUPLET, withoutAddedRests } from './timeline';
import { chainPlaces, chainStart } from './ties';
import { groupAt, tupletSpanTicks } from './tuplets';
import type { EditorKeys } from './editorKeys';

/**
 * The editor with room made at time `t`: a Gap `length` long there, the music after it pushed later in every
 * Voice, and the caret on the Gap, so the entry that follows writes into it; bars of rests the push adds at the
 * end are dropped (`withoutAddedRests`), so typing at the end of the music adds no empty bars. The page's own clip is untouched
 * until the entry commits, so the push and the note are one undo step. Null, with the line under the clip
 * saying why, when the push would put a tuplet across a bar line.
 */
export function withRoom(editor: EditorKeys, t: number, length: number): EditorKeys | null {
  const inserted = insertTime(editor.clip, t, length, editor.cursor);
  if (!inserted) {
    editor.onNotice({ tone: 'error', lines: [SPLITS_TUPLET] });
    return null;
  }
  return { ...editor, clip: withoutAddedRests(editor.clip, inserted.clip), cursor: inserted.cursor, cursorAt: 0 };
}

/** How long the room an entry needs is: the Input length, or with Tuplet entry on the new tuplet's whole span. */
function roomFor(editor: EditorKeys): number {
  return editor.tupletEntry !== null ? tupletSpanTicks(editor.tupletEntry, editor.inputLength) : ticks(editor.inputLength);
}

/**
 * Whether a note entered at the caret in Insert mode goes in without making room, as in Overwrite: with Grace
 * entry on (a grace note takes no time), inside a tuplet (no time can be put into one), or inside a tuplet
 * Tuplet entry already made room for (`,` began it).
 */
function entersWithoutRoom(editor: EditorKeys, t: number): boolean {
  const { clip, cursor, tupletFrom } = editor;
  if (editor.graceEntry) return true;
  const column = columnAt(clip, cursor);
  if (column && !column.grace && groupAt(clip, cursor)) return true;
  return editor.tupletEntry !== null && tupletFrom !== null && t > tupletFrom && t < tupletFrom + roomFor(editor);
}

/**
 * The editor a fret typed on the tab in note input mode works on. Out of Insert mode, the editor as it is. In
 * Insert mode, with room made at the caret (`withRoom`) unless the fret goes in without it: on an empty string
 * of a Column that has notes (it joins the chord), on the note the last digit typed (a second digit, or a fret
 * typed again straight away, retypes it), or as `entersWithoutRoom` says. On a note of a Tie chain the room
 * is made before the chain. Null when the push is refused.
 */
export function fretEditor(editor: EditorKeys): EditorKeys | null {
  if (!editor.insertMode) return editor;
  const { clip, cursor } = editor;
  const typedOn = noteAt(clip, cursor)?.tie ? chainStart(clip, cursor) : cursor;
  const spot = `${typedOn.bar}:${typedOn.column}:${typedOn.string}`;
  if (editor.lastDigit.current?.spot === spot) return editor;
  const column = columnAt(clip, cursor);
  if (column && editor.cursorAt === 0 && !column.grace && column.notes.some(Boolean) && !column.notes[cursor.string]) return editor;
  const t = cursorTime(clip, typedOn) + (typedOn === cursor ? editor.cursorAt : 0);
  if (entersWithoutRoom(editor, t)) return editor;
  return withRoom(editor, t, roomFor(editor));
}

/**
 * The editor a note entered on the staff in note input mode (a letter, Enter) works on. In Insert mode, room
 * is made at the caret, as Dorico's Insert mode makes it, but for Enter on a pitch the caret's Column already
 * sounds (it takes that note away, as in Overwrite) and as `entersWithoutRoom` says. Null when refused.
 */
export function staffEditor(editor: EditorKeys, pitchThere: boolean, toggle: boolean): EditorKeys | null {
  if (!editor.insertMode) return editor;
  if (toggle && pitchThere && editor.cursorAt === 0) return editor;
  const t = cursorTime(editor.clip, editor.cursor) + editor.cursorAt;
  if (entersWithoutRoom(editor, t)) return editor;
  return withRoom(editor, t, roomFor(editor));
}

/**
 * The editor `,` (a rest) works on in note input mode. In Insert mode room is made at the caret for the Gap it
 * leaves, so the music after it moves on, and with Tuplet entry for the tuplet it begins; inside a tuplet,
 * nothing moves. Null when refused.
 */
export function restEditor(editor: EditorKeys): EditorKeys | null {
  if (!editor.insertMode || editor.graceEntry) return editor;
  const t = cursorTime(editor.clip, editor.cursor) + editor.cursorAt;
  if (entersWithoutRoom(editor, t)) return editor;
  return withRoom(editor, t, roomFor(editor));
}

/**
 * Whether Delete (or `,` in normal mode) in Insert mode takes the time away, as Ctrl/⌘+Delete does, so the
 * music after it is pulled back with no Gap left. It does for a selection, a rest, a Column picked whole, and
 * a note that is the only note of its Column (its whole Tie chain's Columns). A note of a chord goes alone,
 * as in Overwrite, as the chord's other notes keep the time; a grace note takes no time.
 */
export function deleteTakesTime(clip: Part, cursor: Cursor, selection: Selection | null, columnOnly: boolean): boolean {
  if (selection) return true;
  const column = columnAt(clip, cursor);
  if (!column) return true;
  if (column.grace) return false;
  if (columnOnly || !noteAt(clip, cursor)) return true;
  return chainPlaces(clip, cursor).every(place => clip.bars[place.bar].columns[place.column].notes.every((note, s) => !note || s === cursor.string));
}
