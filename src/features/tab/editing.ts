/**
 * Editing a clip: the cursor, the selection, frets, and the edits that add,
 * move or take away columns and bars (paste, copy and filling a bar with
 * rests among them). The palette's changes to notes are in `noteEdits.ts`,
 * to words and bars in `barEdits.ts`. Pure; no React. Each change takes a
 * clip and returns a new one (the page keeps the old one for undo), and
 * `normalize` runs after it so marks that join a note to the one before it
 * stay true.
 */
import { barLength, barTicks, ticks, emptyPart, fewestRests, STRING_COUNT, timeAt, type Bar, type Part, type Column, type Duration, type Note, type TimeSignature } from './clip';
import { writePart } from './alphatex';

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

/** The first and last selected places, in order. */
export function selectedRange(selection: Selection): [number, number] {
  return [Math.min(selection.anchor, selection.focus), Math.max(selection.anchor, selection.focus)];
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
 * already in force is dropped, so a bar's `time` always marks a change.
 */
function tidyTimes(clip: Part): Part {
  let time = clip.bars[0]?.time ?? clip.time;
  const bars = clip.bars.map((bar, b) => {
    if (!bar.time) return bar;
    if (b > 0 && !sameTime(bar.time, time)) {
      time = bar.time;
      return bar;
    }
    return without(bar, 'time');
  });
  return { ...clip, time: clip.bars[0]?.time ?? clip.time, bars };
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

function isPlainRest(column: Column): boolean {
  return !column.grace && !column.duration.tuplet && !column.notes.some(Boolean);
}

/**
 * Before a note goes on a plain rest longer than the note before it (as → fills a bar with), the
 * rest is split: its first part takes that note's length and the rest of its time stays rests, the
 * fewest that fill it. So a run of quarters types on as before (Jeremy, 2026-10-26).
 *
 * With a `length` (note input's, issue #238) the note takes that length instead, shorter or longer: a
 * longer one takes its time from the plain rests after it in the bar, and past them runs over the bar.
 */
function splitRest(clip: Part, cursor: Cursor, length?: Duration): Part {
  const column = columnAt(clip, cursor);
  if (!column || !isPlainRest(column)) return clip;
  const want = length ?? lastNoteLength(clip, cursor);
  const bar = clip.bars[cursor.bar];
  let room = ticks(column.duration);
  if (!length && ticks(want) >= room) return clip;
  let end = cursor.column + 1;
  while (room < ticks(want) && end < bar.columns.length && isPlainRest(bar.columns[end])) room += ticks(bar.columns[end++].duration);
  const columns = [...bar.columns];
  const after = room > ticks(want) ? fewestRests(room - ticks(want)).map(emptyColumn) : [];
  columns.splice(cursor.column, end - cursor.column, { ...column, duration: { ...want } }, ...after);
  return replaceBar(clip, cursor.bar, { ...bar, columns });
}

/**
 * Puts a fret on the cursor's string, keeping the note's marks but not a tie or a dead note. On a rest
 * the note is the last note's length, or `length` when given (note input's, issue #238).
 */
export function setFret(clip: Part, cursor: Cursor, fret: number, length?: Duration): Part {
  return normalize(withColumn(splitRest(clip, cursor, length), cursor, column => ({
    ...column,
    notes: column.notes.map((note, s) => {
      if (s !== cursor.string) return note;
      const rest = without(note ?? { fret }, 'tie');
      return { ...rest, fret };
    }),
  }), length));
}

/** A dead note (x) on the cursor's string. */
export function setDead(clip: Part, cursor: Cursor): Part {
  return normalize(withColumn(splitRest(clip, cursor), cursor, column => ({
    ...column,
    notes: column.notes.map((note, s) => (s === cursor.string ? { fret: null, ...(note?.palmMute ? { palmMute: true } : {}) } : note)),
  })));
}

/** Clears the cursor's note. */
export function clearNote(clip: Part, cursor: Cursor): Part {
  if (!columnAt(clip, cursor)) return clip;
  return normalize(withColumn(clip, cursor, column => ({
    ...column,
    notes: column.notes.map((note, s) => (s === cursor.string ? null : note)),
  })));
}

function isFull(clip: Part, index: number): boolean {
  return barLength(clip.bars[index]) >= barTicks(timeAt(clip, index));
}

/** The rests that complete a bar: the fewest that fill the time it lacks. */
function restsToFill(clip: Part, bar: number): Duration[] {
  return fewestRests(barTicks(timeAt(clip, bar)) - barLength(clip.bars[bar]));
}

/**
 * A bar that doesn't add up yet, completed with the fewest rests after its last column; an empty bar
 * gets a whole bar's rest. A full bar, or a bar no plain rest can complete, comes back as it was.
 * With Settings' "Fill short bars with rests" on, the cursor leaving a bar (←, a press elsewhere, or
 * the tab losing focus) does this (Jeremy, 2026-10-27; off by default since 2026-10-29).
 */
export function fillBar(clip: Part, bar: number): Part {
  const here = clip.bars[bar];
  if (!here || isFull(clip, bar)) return clip;
  const rests = restsToFill(clip, bar);
  if (rests.length === 0) return clip;
  return normalize(replaceBar(clip, bar, { ...here, columns: [...here.columns, ...rests.map(emptyColumn)] }));
}

/**
 * One rest for the cursor to type on after a short bar's last column: as long as the column before
 * it, or the longest rest that fits when that would make the bar too long.
 */
function restToTypeOn(clip: Part, cursor: Cursor): Duration {
  const near = durationNear(clip, cursor);
  const room = barTicks(timeAt(clip, cursor.bar)) - barLength(clip.bars[cursor.bar]);
  return ticks(near) <= room ? near : fewestRests(room)[0] ?? near;
}

/** How the cursor moves: `grow` (off while selecting) lets → add columns; `fillBars` is Settings' "Fill short bars with rests". */
export interface MoveOptions {
  grow?: boolean;
  fillBars?: boolean;
}

/**
 * The cursor one column left or right.
 *
 * With `fillBars` on, left off a bar's first column fills the bar it leaves (`fillBar`), and right
 * from the last column of a bar that doesn't add up yet fills it at once with the fewest rests that
 * complete it, anywhere in the clip, an empty bar included (a whole rest in 4/4; Jeremy, 2026-10-26),
 * and the cursor goes to the first of them.
 *
 * With it off (the default; Jeremy, 2026-10-29), a short bar stays short: left adds nothing, and right
 * from a short bar's last column (or into an empty bar) adds one rest to type on (`restToTypeOn`),
 * so the bar grows a column at a time until it adds up.
 *
 * Either way, right from the clip's last column, once its bar is full, starts a new bar with a rest
 * as long as the cursor's column, so typing runs on, and the fewest rests after it that fill the bar.
 */
export function moveColumn(clip: Part, cursor: Cursor, step: 1 | -1, { grow = true, fillBars = false }: MoveOptions = {}): { clip: Part; cursor: Cursor } {
  const { bar, column } = cursor;
  if (step === -1) {
    if (column > 0) return { clip, cursor: { ...cursor, column: column - 1 } };
    if (bar === 0) return { clip, cursor };
    const columns = clip.bars[bar - 1].columns.length;
    // Rests go after the bar left behind, so the columns of the bar before keep their places.
    const left = grow && fillBars ? fillBar(clip, bar) : clip;
    return { clip: left, cursor: { ...cursor, bar: bar - 1, column: Math.max(0, columns - 1) } };
  }
  const here = clip.bars[bar];
  if (column < here.columns.length - 1) return { clip, cursor: { ...cursor, column: column + 1 } };
  // An emptied bar counts too: its first rest goes where the cursor waits.
  const short = grow && !isFull(clip, bar);
  const rests = !short ? [] : fillBars ? restsToFill(clip, bar) : [restToTypeOn(clip, cursor)];
  if (rests.length > 0) {
    const grown = replaceBar(clip, bar, { ...here, columns: [...here.columns, ...rests.map(emptyColumn)] });
    return { clip: normalize(grown), cursor: { ...cursor, column: here.columns.length } };
  }
  if (bar < clip.bars.length - 1) return { clip, cursor: { ...cursor, bar: bar + 1, column: 0 } };
  if (!grow || here.columns.length === 0) return { clip, cursor };
  // A new bar: a rest as long as the cursor's column, to type on, and the fewest rests after it that fill the bar.
  const first = durationNear(clip, cursor);
  const room = barTicks(timeAt(clip, bar)) - ticks(first);
  const columns = [first, ...(room > 0 ? fewestRests(room) : [])].map(emptyColumn);
  return { clip: { ...clip, bars: [...clip.bars, { columns }] }, cursor: { ...cursor, bar: bar + 1, column: 0 } };
}

/** A rest with the cursor column's duration, put before the cursor column (the Insert key). */
export function insertColumn(clip: Part, cursor: Cursor): Part {
  const bar = clip.bars[cursor.bar];
  const columns = [...bar.columns];
  columns.splice(cursor.column, 0, emptyColumn(durationNear(clip, cursor)));
  return normalize(replaceBar(clip, cursor.bar, { ...bar, columns }));
}

/**
 * A new bar before or after the cursor's bar, filled with the fewest rests that make up the time
 * signature in force where it goes (a whole rest in 4/4, a dotted half in 3/4). Before a bar that changes
 * the time, that is the time before the change, which the cursor's bar keeps. The cursor goes to
 * the new bar's first rest.
 */
export function insertBar(clip: Part, cursor: Cursor, where: 'before' | 'after'): { clip: Part; cursor: Cursor } {
  const index = where === 'before' ? cursor.bar : cursor.bar + 1;
  const time = index === 0 ? clip.time : timeAt(clip, index - 1);
  const rests = fewestRests(barTicks(time)).map(emptyColumn);
  const bars = [...clip.bars];
  bars.splice(index, 0, { columns: rests });
  return { clip: normalize({ ...clip, bars }), cursor: { ...cursor, bar: index, column: 0 } };
}

/* — removing, copying and pasting columns — */

/**
 * The clip without the columns in `range` (places, inclusive), and where the cursor goes: the
 * column after them while it is in the same bar, else the column before them, so deleting a bar's
 * last note leaves the cursor in that bar. Emptying one bar keeps it, empty, with the cursor in it,
 * so → can fill it with rests again (Jeremy, 2026-10-26); bars a wider range empties go, unless
 * none would be left.
 */
export function deleteColumns(clip: Part, [from, to]: [number, number]): { clip: Part; cursor: { bar: number; column: number } } {
  const first = placeOf(clip, from).bar;
  const oneBar = placeOf(clip, to).bar === first;
  let index = 0;
  const bars: Bar[] = [];
  for (const bar of clip.bars) {
    const columns = bar.columns.filter(() => {
      const keep = index < from || index > to;
      index++;
      return keep;
    });
    if (columns.length > 0 || bar.columns.length === 0 || oneBar) bars.push({ ...bar, columns });
  }
  const left = bars.length > 0 ? normalize({ ...clip, bars }) : { ...clip, bars: [{ columns: [] }] };
  if (oneBar && left.bars[first].columns.length === 0) return { clip: left, cursor: { bar: first, column: 0 } };
  const afterInSameBar = to + 1 < columnCount(clip) && placeOf(clip, to + 1).bar === first;
  const place = afterInSameBar ? from : Math.max(0, from - 1);
  return { clip: left, cursor: placeOf(left, Math.min(place, Math.max(0, columnCount(left) - 1))) };
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

/** The columns in `range` as a clip of their own, with the clip's time and tuning; bar lines between them are kept. */
export function sliceClip(clip: Part, [from, to]: [number, number]): Part {
  let index = 0;
  const bars: Bar[] = [];
  for (const bar of clip.bars) {
    const columns = bar.columns.filter(() => {
      const keep = index >= from && index <= to;
      index++;
      return keep;
    });
    if (columns.length > 0) bars.push({ ...bar, columns });
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

/**
 * `pasted` put in at the cursor, before the cursor's column, as text is pasted at a caret: its
 * first bar's columns join the cursor's bar, each later bar is a new bar, and the rest of the
 * cursor's bar follows its last one. Into an empty clip, the pasted clip comes whole, with its
 * name, time and tuning. The cursor ends on the last pasted column.
 */
export function pasteAt(clip: Part, cursor: Cursor, pasted: Part): { clip: Part; cursor: Cursor } {
  const incoming = pasted.bars.filter(b => b.columns.length > 0);
  if (incoming.length === 0) return { clip, cursor };
  if (isEmpty(clip)) {
    const last = incoming.length - 1;
    return { clip: normalize({ ...pasted, bars: incoming }), cursor: { ...cursor, bar: last, column: incoming[last].columns.length - 1 } };
  }
  const here = clip.bars[cursor.bar];
  // Pasting on an empty bar puts the columns in it; on a column, before it.
  const at = here.columns.length === 0 ? 0 : cursor.column;
  const head = here.columns.slice(0, at);
  const tail = here.columns.slice(at);
  // The cursor's bar keeps its own repeat and ending marks; the bars the paste adds keep theirs.
  const made: Bar[] = [{ ...here, columns: [...head, ...incoming[0].columns] }];
  for (const bar of incoming.slice(1)) made.push({ ...bar, columns: [...bar.columns] });
  const lastMade = made[made.length - 1];
  const lastColumn = lastMade.columns.length - 1;
  lastMade.columns = [...lastMade.columns, ...tail];
  const bars = [...clip.bars.slice(0, cursor.bar), ...made, ...clip.bars.slice(cursor.bar + 1)];
  return {
    clip: normalize({ ...clip, bars }),
    cursor: { ...cursor, bar: cursor.bar + made.length - 1, column: lastColumn },
  };
}
