/**
 * Editing a clip: the cursor, the selection, frets, and the edits that add,
 * move or take away columns and bars (paste, copy and filling a bar with
 * rests among them). The palette's changes to notes are in `noteEdits.ts`,
 * to words and bars in `barEdits.ts`. Pure; no React. Each change takes a
 * clip and returns a new one (the page keeps the old one for undo), and
 * `normalize` runs after it so marks that join a note to the one before it
 * stay true.
 */
import { barSpan, beatGroupsAt, defaultGroupCounts, hasPickup, isGroupingOf, sameGroups, isRest, ticks, emptyPart, ownVoice, STRING_COUNT, timeAt, type Bar, type Part, type Column, type Duration, type Note, type TimeSignature } from './clip';
import { emptyBarRests } from './sounding';
import { placeAtTime, pullTime, pushTime, timeOf, writeOver, writeSpan } from './timeline';
import { writePart } from './alphatex';
import { chainPlaces, chainStart, isTaken, takenNotes } from './ties';

/** Where the cursor is: a column of a bar, and a string (0 = high e). In an empty bar the column is 0. */
export interface Cursor {
  bar: number;
  column: number;
  string: number;
}

/**
 * Selected columns, by their place in the whole clip counting from 0 (see `indexOf`). The anchor
 * is where Shift+arrows started, the focus where the cursor is now; either may be the larger.
 */
export interface Selection {
  anchor: number;
  focus: number;
}

export const START: Cursor = { bar: 0, column: 0, string: 0 };
export const MAX_FRET = 24;

/** A copy of `obj` without `key`, for turning a mark off. */
export function without<T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  const copy = { ...obj };
  delete copy[key];
  return copy;
}

/* — places — */

/** A column's place in the whole clip, counting from 0. An empty bar has no columns, so no place. */
export function indexOf(clip: Part, bar: number, column: number): number {
  let index = column;
  for (let b = 0; b < bar; b++) index += clip.bars[b].columns.length;
  return index;
}

/** The bar and column at a place in the whole clip. */
export function placeOf(clip: Part, index: number): { bar: number; column: number } {
  let left = index;
  for (let b = 0; b < clip.bars.length; b++) {
    const n = clip.bars[b].columns.length;
    if (left < n) return { bar: b, column: left };
    left -= n;
  }
  const last = clip.bars.length - 1;
  return { bar: last, column: Math.max(0, clip.bars[last].columns.length - 1) };
}

export function columnCount(clip: Part): number {
  return clip.bars.reduce((n, b) => n + b.columns.length, 0);
}

/** A whole bar selected, as a press beside its notes selects it (issue #238). */
export function barSelection(clip: Part, bar: number): Selection {
  return { anchor: indexOf(clip, bar, 0), focus: indexOf(clip, bar, clip.bars[bar].columns.length - 1) };
}

/** The first and last selected places, in order. */
export function selectedRange(selection: Selection): [number, number] {
  return [Math.min(selection.anchor, selection.focus), Math.max(selection.anchor, selection.focus)];
}

/**
 * A Shift+press's selection (issue #366): the selection, or the cursor's column `cursor` when nothing is
 * selected, grown to take in the columns `from`–`to` pressed. It only ever grows, never moves or shrinks:
 * a press before it moves its start, one after it its end, as MuseScore's does. The focus is the edge that
 * moved, so Shift+arrows go on from there. A press inside it trims it from the end nearer the press
 * (Jeremy, 2026-11-05); halfway, from its focus, the end last grown.
 */
export function growSelection(selection: Selection | null, cursor: number, from: number, to = from): Selection {
  const [start, end] = selection ? selectedRange(selection) : [cursor, cursor];
  const first = Math.min(start, from, to);
  const last = Math.max(end, from, to);
  if (last > end) return { anchor: first, focus: last };
  if (first < start) return { anchor: last, focus: first };
  if (!selection) return { anchor: cursor, focus: cursor };
  const toStart = from - start;
  const toEnd = end - to;
  const fromStart = toStart < toEnd || (toStart === toEnd && selection.focus < selection.anchor);
  return fromStart ? { anchor: end, focus: from } : { anchor: start, focus: to };
}

/** The cursor moved inside the clip, as after an undo that took columns away. */
export function clampCursor(clip: Part, cursor: Cursor): Cursor {
  const bar = Math.min(Math.max(cursor.bar, 0), clip.bars.length - 1);
  const columns = clip.bars[bar].columns.length;
  return {
    bar,
    column: Math.min(Math.max(cursor.column, 0), Math.max(0, columns - 1)),
    string: Math.min(Math.max(cursor.string, 0), STRING_COUNT - 1),
  };
}

/** The column under the cursor, or null in an empty bar. */
export function columnAt(clip: Part, cursor: Cursor): Column | null {
  return clip.bars[cursor.bar]?.columns[cursor.column] ?? null;
}

export function noteAt(clip: Part, cursor: Cursor): Note | null {
  return columnAt(clip, cursor)?.notes[cursor.string] ?? null;
}

/** The nearest note before the cursor on its string, in this bar or an earlier one. */
export function noteBefore(clip: Part, cursor: Cursor): Note | null {
  for (let b = cursor.bar; b >= 0; b--) {
    const columns = clip.bars[b].columns;
    for (let c = b === cursor.bar ? cursor.column - 1 : columns.length - 1; c >= 0; c--) {
      const note = columns[c].notes[cursor.string];
      if (note) return note;
    }
  }
  return null;
}

/**
 * The places of the run of columns round `index` that all have a mark (`has`), as the P.M. and let
 * ring lines run: across bars and lines of tab, as far as the mark goes.
 */
export function runAround(clip: Part, index: number, has: (column: Column) => boolean): [number, number] {
  const columns = clip.bars.flatMap(b => b.columns);
  let from = index;
  let to = index;
  while (from > 0 && has(columns[from - 1])) from--;
  while (to < columns.length - 1 && has(columns[to + 1])) to++;
  return [from, to];
}

/* — keeping joins true — */

/**
 * Makes every mark that joins a note to the one before it on its string agree with that note:
 * a tie takes its fret, a hammer-on or pull-off is named by which way the frets go, and a mark
 * with no earlier note to join (or a dead one) is dropped; a slide from it becomes a slide from below.
 */
export function normalize(clip: Part): Part {
  const last: (Note | null)[] = Array(STRING_COUNT).fill(null);
  const bars = clip.bars.map(bar => ({
    ...bar,
    columns: bar.columns.map(column => ({
      ...column,
      notes: column.notes.map((note, s) => {
        if (!note) return null;
        const before = last[s];
        const joinable = before !== null && before.fret !== null && note.fret !== null;
        const n: Note = { ...note };
        if (n.tie) {
          if (before && before.fret !== null) n.fret = before.fret;
          else delete n.tie;
        }
        if (n.legato) {
          if (joinable && !n.tie) n.legato = note.fret! < before.fret! ? 'p' : 'h';
          else delete n.legato;
        }
        if ((n.slide === 'legato' || n.slide === 'shift') && !joinable) n.slide = 'below';
        last[s] = n;
        return n;
      }),
    })),
  }));
  return tidyTimes({ ...clip, bars });
}


const sameTime = (a: TimeSignature, b: TimeSignature) => a.beats === b.beats && a.value === b.value;

/**
 * A time signature set on the first bar becomes the clip's, and one that repeats the time signature
 * already in force, meter and Beat groups both, is dropped, so a bar's `time` always marks a change.
 * Beat groups are kept only with a time signature, and only when they add up and aren't its default.
 */
function tidyTimes(clip: Part): Part {
  let time = clip.bars[0]?.time ?? clip.time;
  let groups = defaultGroupCounts(time);
  const bars = clip.bars.map((bar, b) => {
    const own = b === 0 || bar.time ? ownGroups(bar.beatGroups, b === 0 ? time : bar.time!) : undefined;
    let out: Bar = own ? { ...bar, beatGroups: own } : without(bar, 'beatGroups');
    if (b === 0) {
      groups = own ?? defaultGroupCounts(time);
      return out;
    }
    if (!bar.time) return out;
    const next = own ?? defaultGroupCounts(bar.time);
    if (!sameTime(bar.time, time) || !sameGroups(next, groups)) {
      time = bar.time;
      groups = next;
      return out;
    }
    out = without(out, 'time');
    return without(out, 'beatGroups');
  });
  return { ...clip, time: clip.bars[0]?.time ?? clip.time, bars };
}

/** A time signature's own Beat groups, kept when they add up and differ from its default. */
function ownGroups(counts: number[] | undefined, time: TimeSignature): number[] | undefined {
  if (!counts || !isGroupingOf(counts, time) || sameGroups(counts, defaultGroupCounts(time))) return undefined;
  return counts;
}

/* — changing columns and notes — */

/** The duration a new column gets: the cursor column's, else the nearest column's before it, else a quarter. */
function durationNear(clip: Part, cursor: Cursor): Duration {
  const here = columnAt(clip, cursor);
  if (here) return { ...here.duration };
  for (let b = cursor.bar; b >= 0; b--) {
    const columns = clip.bars[b].columns;
    if (columns.length > 0) return { ...columns[columns.length - 1].duration };
  }
  return { value: 4, dots: 0 };
}

export function emptyColumn(duration: Duration): Column {
  return { duration, notes: Array<Note | null>(STRING_COUNT).fill(null) };
}

/**
 * Marks of a Column's time rather than its notes: a rest left where Delete or cut took the notes keeps
 * them, as Dorico and MuseScore do (issue #393). Only taking the time away (Ctrl/⌘+Delete) removes them.
 * A pick stroke, tremolo, whammy bar and Beam override belong to the notes and go with them.
 */
const TIME_MARKS = ['chord', 'text', 'fermata', 'wah', 'hairpin', 'ottava', 'extra'] as const;

/** The rest a Column becomes when its notes are deleted: its length and its time's marks. */
export function restOf(column: Column): Column {
  const rest: Column = emptyColumn(column.duration);
  for (const key of TIME_MARKS) {
    if (column[key] !== undefined) Object.assign(rest, { [key]: column[key] });
  }
  return rest;
}

/** Whether a Column carries any mark of its time (`restOf` keeps them). */
export function hasTimeMarks(column: Column): boolean {
  return TIME_MARKS.some(key => column[key] !== undefined);
}

export function replaceBar(clip: Part, index: number, bar: Bar): Part {
  return { ...clip, bars: clip.bars.map((b, i) => (i === index ? bar : b)) };
}

/**
 * The clip with the cursor's column changed by `change`; in an empty bar a column is made first, `length`
 * long when given, else as long as the column nearest before it.
 */
export function withColumn(clip: Part, cursor: Cursor, change: (column: Column) => Column, length?: Duration): Part {
  const bar = clip.bars[cursor.bar];
  if (bar.columns.length === 0) {
    return replaceBar(clip, cursor.bar, { ...bar, columns: [change(emptyColumn(length ?? durationNear(clip, cursor)))] });
  }
  return replaceBar(clip, cursor.bar, {
    ...bar,
    columns: bar.columns.map((c, i) => (i === cursor.column ? change(c) : c)),
  });
}

/** The clip with every column in `range` (places, inclusive) changed by `change`. */
function withColumns(clip: Part, [from, to]: [number, number], change: (column: Column) => Column): Part {
  let index = 0;
  const bars = clip.bars.map(bar => ({
    ...bar,
    columns: bar.columns.map(column => {
      const inside = index >= from && index <= to;
      index++;
      return inside ? change(column) : column;
    }),
  }));
  return { ...clip, bars };
}

/** What a change applies to: the selected columns when there is a selection, else the cursor's column or note. */
export interface Target {
  cursor: Cursor;
  selection: Selection | null;
  /** One Tied note picked alone (Alt+press): a mark goes on it, not along its Tie chain. */
  alone?: boolean;
}

export function changeColumns(clip: Part, { cursor, selection }: Target, change: (column: Column) => Column): Part {
  return normalize(selection ? withColumns(clip, selectedRange(selection), change) : withColumn(clip, cursor, change));
}

/** The length of the last column with a note before the cursor's, in the clip; a quarter when none. */
/** The length of the last note before the cursor's column, or a quarter with none. */
export function lastNoteLength(clip: Part, cursor: Cursor): Duration {
  for (let b = cursor.bar; b >= 0; b--) {
    const columns = clip.bars[b].columns;
    for (let c = (b === cursor.bar ? cursor.column : columns.length) - 1; c >= 0; c--) {
      if (!columns[c].grace && columns[c].notes.some(Boolean)) return { value: columns[c].duration.value, dots: columns[c].duration.dots };
    }
  }
  return { value: 4, dots: 0 };
}

/** A rest that takes time and is no tuplet's or grace's: one note input mode may split. */
export function isPlainRest(column: Column): boolean {
  return !column.grace && !column.duration.tuplet && !column.notes.some(Boolean);
}

/** Where the cursor's Column starts in the Part, in ticks. */
export function cursorTime(clip: Part, cursor: Cursor): number {
  return timeOf(clip, cursor.bar, cursor.column);
}

/** Whether the cursor's bar holds no note: one Whole-bar rest. */
function isEmptyBar(clip: Part, bar: number): boolean {
  return clip.bars[bar].columns.every(isPlainRest);
}

/**
 * A note going on the cursor's rest, `change` making the rest's Column a note
 * (`docs/specs/2026-11-04-tab-bars-always-full-design.md`): with note input mode's `length` it is that long,
 * written over what follows, split and tied by the meter; in normal mode it takes the rest's own
 * length, or the whole bar on a Whole-bar rest stored as more than one rest (5/8) or a bar with
 * nothing in it. With note input mode's `length`, a lone note retyped at another length is written over
 * the same way. Null otherwise, where the note just goes in its Column.
 */
function noteOnRest(clip: Part, cursor: Cursor, change: (column: Column) => Column, length?: Duration): Part | null {
  const bar = clip.bars[cursor.bar];
  const column = bar.columns.length === 0 ? emptyColumn({ value: 4, dots: 0 }) : columnAt(clip, cursor);
  if (!column) return null;
  const at = cursorTime(clip, cursor);
  // Retyping a lone note (not a chord's, a tuplet's or a grace note) at a new length writes over too, as Dorico's note input mode does.
  const lone = !isRest(column) && !column.grace && !column.duration.tuplet && column.notes.every((note, s) => !note || s === cursor.string);
  if (length && lone && ticks(column.duration) !== ticks(length)) return writeOver(clip, at, [change({ ...column, duration: { ...length } })]) ?? clip;
  if (!isPlainRest(column)) return null;
  if (length) return writeOver(clip, at, [change({ ...column, duration: { ...length } })]) ?? clip;
  if (cursor.column === 0 && isEmptyBar(clip, cursor.bar) && bar.columns.length !== 1) {
    return writeSpan(clip, at, change(column), barSpan(clip, cursor.bar)) ?? clip;
  }
  return null;
}

/** The cursor's Column changed by `change`: on a rest, as `noteOnRest` puts a note there. */
function noteAtCursor(clip: Part, cursor: Cursor, change: (column: Column) => Column, length?: Duration): Part {
  return normalize(noteOnRest(clip, cursor, change, length) ?? withColumn(clip, cursor, change, length));
}

/**
 * Puts a fret on the cursor's string, keeping the note's marks but not a dead note. On a note of a Tie
 * chain the whole chain takes it, as one note (`docs/specs/2026-11-04-tab-ties-forward-design.md`). On a
 * rest the note is the rest's length, or `length` when given (note input mode's), written over what follows.
 */
export function setFret(clip: Part, at: Cursor, fret: number, length?: Duration): Part {
  const cursor = noteAt(clip, at)?.tie ? chainStart(clip, at) : at;
  return noteAtCursor(clip, cursor, column => ({
    ...column,
    notes: column.notes.map((note, s) => {
      if (s !== cursor.string) return note;
      const rest = without(note ?? { fret }, 'tie');
      return { ...rest, fret };
    }),
  }), length);
}

/** A dead note (x) on the cursor's string. */
export function setDead(clip: Part, cursor: Cursor): Part {
  return noteAtCursor(clip, cursor, column => ({
    ...column,
    notes: column.notes.map((note, s) => (s === cursor.string ? { fret: null, ...(note?.palmMute ? { palmMute: true } : {}) } : note)),
  }));
}

/** Clears the cursor's note, its whole Tie chain with it. */
export function clearNote(clip: Part, cursor: Cursor): Part {
  if (!columnAt(clip, cursor)) return clip;
  const places = chainPlaces(clip, cursor);
  const cleared = places.reduce((next, place) => withColumn(next, { ...place, string: cursor.string }, column => {
    const notes = column.notes.map((note, s) => (s === cursor.string ? null : note));
    // A Column left with no note is a rest: it keeps its time's marks, not its notes' (issue #393).
    return notes.some(Boolean) || column.grace ? { ...column, notes } : restOf(column);
  }), clip);
  return normalize(cleared);
}

/** How the cursor moves: `grow` (off while selecting) lets → start a new bar past the clip's end. */
export interface MoveOptions {
  grow?: boolean;
}

/**
 * The cursor one column left or right. Bars are always full, so → never adds a rest inside a bar; it
 * moves on, out of a short imported bar too. Right from the clip's last column starts a new bar, a
 * Whole-bar rest to type on (`docs/specs/2026-11-04-tab-bars-always-full-design.md`).
 */
export function moveColumn(clip: Part, cursor: Cursor, step: 1 | -1, { grow = true }: MoveOptions = {}): { clip: Part; cursor: Cursor } {
  const { bar, column } = cursor;
  if (step === -1) {
    if (column > 0) return { clip, cursor: { ...cursor, column: column - 1 } };
    if (bar === 0) return { clip, cursor };
    const columns = clip.bars[bar - 1].columns.length;
    return { clip, cursor: { ...cursor, bar: bar - 1, column: Math.max(0, columns - 1) } };
  }
  const here = clip.bars[bar];
  if (column < here.columns.length - 1) return { clip, cursor: { ...cursor, column: column + 1 } };
  if (bar < clip.bars.length - 1) return { clip, cursor: { ...cursor, bar: bar + 1, column: 0 } };
  if (!grow || here.columns.length === 0) return { clip, cursor };
  const time = timeAt(clip, bar);
  return { clip: { ...clip, bars: [...clip.bars, { columns: emptyBarRests(time, beatGroupsAt(clip, bar)).map(emptyColumn) }] }, cursor: { ...cursor, bar: bar + 1, column: 0 } };
}

/**
 * Insert: a Gap `length` long at time `at`, the music after it in every Voice later, across bar lines
 * (`docs/specs/2026-11-04-tab-bars-always-full-design.md`). The cursor goes to the Gap's first rest.
 * Null when that would put a tuplet across a bar line.
 */
export function insertTime(clip: Part, at: number, length: number, cursor: Cursor): { clip: Part; cursor: Cursor } | null {
  const pushed = pushTime(clip, at, length);
  if (!pushed) return null;
  const next = normalize(pushed);
  return { clip: next, cursor: { ...cursor, ...placeAtTime(next, at) } };
}

/**
 * A new bar before or after the cursor's bar, filled with the fewest rests that make up the time
 * signature in force where it goes (a whole rest in 4/4, a dotted half in 3/4). Before a bar that changes
 * the time, that is the time before the change, which the cursor's bar keeps. The cursor goes to
 * the new bar's first rest.
 */
export function insertBar(clip: Part, cursor: Cursor, where: 'before' | 'after'): { clip: Part; cursor: Cursor } {
  // A Pickup bar stays the first bar: a bar put in before it goes after it.
  const index = where === 'before' && !(cursor.bar === 0 && hasPickup(clip)) ? cursor.bar : cursor.bar + 1;
  const time = index === 0 ? clip.time : timeAt(clip, index - 1);
  const rests = emptyBarRests(time, index === 0 ? beatGroupsAt(clip, 0) : beatGroupsAt(clip, index - 1)).map(emptyColumn);
  const bars = [...clip.bars];
  bars.splice(index, 0, { columns: rests });
  return { clip: normalize({ ...clip, bars }), cursor: { ...cursor, bar: index, column: 0 } };
}

/* — removing, copying and pasting columns — */

/**
 * Ctrl/⌘+Delete: the time of the columns in `range` (places, inclusive) taken away, the music after it
 * in every Voice pulled back across bar lines (`docs/specs/2026-11-04-tab-bars-always-full-design.md`).
 * Bars the range covers whole go, marks and all; what it takes from a bar covered in part pulls the
 * following music back, and the clip's last bar ends in a Gap: no other bar comes off the end. The
 * cursor goes where the removed time began. With every bar gone, one empty bar is left.
 */
export function deleteColumns(clip: Part, [from, to]: [number, number]): { clip: Part; cursor: { bar: number; column: number } } {
  const first = placeOf(clip, from);
  const last = placeOf(clip, to);
  const whole = (b: number) =>
    isEmptyBar(clip, b) || ((b > first.bar || first.column === 0) && (b < last.bar || last.column === clip.bars[b].columns.length - 1));
  const at = cursorTime(clip, { ...first, string: 0 });
  // The time the range takes from the bars it covers in part.
  let partial = 0;
  for (let b = first.bar; b <= last.bar; b++) {
    if (whole(b)) continue;
    const columns = clip.bars[b].columns;
    const c0 = b === first.bar ? first.column : 0;
    const c1 = b === last.bar ? last.column : columns.length - 1;
    for (let c = c0; c <= c1; c++) if (!columns[c].grace) partial += ticks(columns[c].duration);
  }
  const kept = clip.bars.filter((_, b) => b < first.bar || b > last.bar || !whole(b));
  if (kept.length === 0) return { clip: { ...clip, bars: [{ columns: [] }] }, cursor: { bar: 0, column: 0 } };
  let left = normalize({ ...clip, bars: kept });
  if (partial > 0) left = normalize(pullTime(left, at, at + partial) ?? left);
  const end = timeOf(left, left.bars.length - 1, left.bars[left.bars.length - 1].columns.length);
  return { clip: left, cursor: placeAtTime(left, Math.min(at, Math.max(0, end - 1))) };
}

/**
 * The clip without an empty bar (Delete in it), and the cursor on the last column before it, else
 * the first after it. The only bar stays.
 */
export function removeEmptyBar(clip: Part, bar: number): { clip: Part; cursor: { bar: number; column: number } } {
  if (clip.bars.length === 1 || clip.bars[bar].columns.length > 0) return { clip, cursor: { bar, column: 0 } };
  const left = normalize({ ...clip, bars: clip.bars.filter((_, i) => i !== bar) });
  if (bar === 0) return { clip: left, cursor: { bar: 0, column: 0 } };
  return { clip: left, cursor: { bar: bar - 1, column: Math.max(0, left.bars[bar - 1].columns.length - 1) } };
}

/**
 * The columns in `range` as a clip of their own, with the clip's time and tuning, its own Voice only;
 * bar lines between them are kept. It takes the notes an edit on the range takes (`takenNotes`): a Tie
 * chain starting inside runs on to its end, and a note held on from before is left out.
 */
export function sliceClip(clip: Part, [from, to]: [number, number]): Part {
  const taken = takenNotes(clip, { anchor: from, focus: to });
  let index = 0;
  const bars: Bar[] = [];
  for (const bar of clip.bars) {
    const columns: Column[] = [];
    for (const column of bar.columns) {
      const i = index++;
      if (i < from || i > taken.last) continue;
      const notes = column.notes.map((note, s) => (note && isTaken(taken.notes, i, s) ? note : null));
      // Past the range only the chains run on: a Column's own things there aren't copied.
      columns.push(i <= to ? { ...column, notes } : { duration: column.duration, notes });
    }
    // Copy takes the part's own Voice only (`docs/specs/2026-11-03-tab-voices-design.md`).
    if (columns.length > 0) bars.push({ ...ownVoice(bar), columns });
  }
  const first = placeOf(clip, from).bar;
  return normalize({ ...emptyPart(), time: timeAt(clip, first), tuning: clip.tuning, bars: bars.length > 0 ? bars : [{ columns: [] }] });
}

/** The columns in `range` as alphaTex, for the clipboard. */
export function copyText(clip: Part, range: [number, number]): string {
  return writePart(sliceClip(clip, range));
}

export function isEmpty(clip: Part): boolean {
  return clip.bars.every(b => b.columns.length === 0);
}

/** The pasted part's own Voice as one run of Columns, bar lines dropped, and how long it is. */
function pastedColumns(pasted: Part): { columns: Column[]; length: number; last: number } {
  const columns = pasted.bars.flatMap(b => b.columns.map(c => ({ ...c })));
  const length = columns.reduce((sum, c) => sum + (c.grace ? 0 : ticks(c.duration)), 0);
  const lastTimed = [...columns].reverse().find(c => !c.grace);
  return { columns, length, last: lastTimed ? ticks(lastTimed.duration) : 0 };
}

/**
 * Insert paste (issue #238: the right-click menu's "Insert paste", Ctrl/⌘+Shift+V): `pasted` put in at
 * the cursor's column, the music after it in every Voice pushed on by its length, across bar lines
 * (`docs/specs/2026-11-04-tab-bars-always-full-design.md`). The pasted bar lines are not kept. Into
 * an empty clip, the pasted clip comes whole, with its name, time and tuning. The cursor ends on the
 * last pasted column.
 */
export function insertPaste(clip: Part, cursor: Cursor, pasted: Part): { clip: Part; cursor: Cursor } {
  const incoming = pasted.bars.filter(b => b.columns.length > 0);
  if (incoming.length === 0) return { clip, cursor };
  if (isEmpty(clip)) {
    const last = incoming.length - 1;
    return { clip: normalize({ ...pasted, bars: incoming }), cursor: { ...cursor, bar: last, column: incoming[last].columns.length - 1 } };
  }
  const { columns, length, last } = pastedColumns({ ...pasted, bars: incoming });
  const at = clip.bars[cursor.bar].columns.length === 0 ? timeOf(clip, cursor.bar, 0) : cursorTime(clip, cursor);
  const pushed = pushTime(clip, at, length);
  const written = pushed && writeOver(pushed, at, columns);
  if (!written) return { clip, cursor };
  const next = normalize(written);
  return { clip: next, cursor: { ...cursor, ...placeAtTime(next, at + length - last) } };
}

/**
 * Paste, as MuseScore pastes (issue #238: bars stay full): `pasted` written over the clip's time from
 * the cursor's column on, bar lines and all, split and tied by the meter where it crosses them, a
 * covered note's uncovered part a Gap; bars are added past the clip's end. Into an empty clip the
 * pasted clip comes whole, with its name, time and tuning. The cursor ends on the last pasted column.
 */
export function pasteOver(clip: Part, cursor: Cursor, pasted: Part): { clip: Part; cursor: Cursor } {
  const incoming = pasted.bars.filter(b => b.columns.length > 0);
  if (incoming.length === 0) return { clip, cursor };
  if (isEmpty(clip)) return insertPaste(clip, cursor, pasted);
  const { columns, length, last } = pastedColumns({ ...pasted, bars: incoming });
  const at = clip.bars[cursor.bar].columns.length === 0 ? timeOf(clip, cursor.bar, 0) : cursorTime(clip, cursor);
  const written = writeOver(clip, at, columns);
  if (!written) return { clip, cursor };
  const next = normalize(written);
  return { clip: next, cursor: { ...cursor, ...placeAtTime(next, at + length - last) } };
}
