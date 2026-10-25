/**
 * Editing a clip: the cursor, the selection and every change the keys and
 * the palette make. Pure; no React. Each change takes a clip and returns a
 * new one (the page keeps the old one for undo), and `normalize` runs after
 * it so marks that join a note to the one before it stay true.
 */
import {
  barTicks, BEND_QUARTERS, emptyClip, NOTE_VALUES, STRING_COUNT, ticks,
  type Bar, type BendQuarters, type Clip, type Column, type Duration, type Note, type Slide,
} from './clip';
import { writeAlphaTex } from './alphatex';

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
function without<T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  const copy = { ...obj };
  delete copy[key];
  return copy;
}

/* — places — */

/** A column's place in the whole clip, counting from 0. An empty bar has no columns, so no place. */
export function indexOf(clip: Clip, bar: number, column: number): number {
  let index = column;
  for (let b = 0; b < bar; b++) index += clip.bars[b].columns.length;
  return index;
}

/** The bar and column at a place in the whole clip. */
export function placeOf(clip: Clip, index: number): { bar: number; column: number } {
  let left = index;
  for (let b = 0; b < clip.bars.length; b++) {
    const n = clip.bars[b].columns.length;
    if (left < n) return { bar: b, column: left };
    left -= n;
  }
  const last = clip.bars.length - 1;
  return { bar: last, column: Math.max(0, clip.bars[last].columns.length - 1) };
}

export function columnCount(clip: Clip): number {
  return clip.bars.reduce((n, b) => n + b.columns.length, 0);
}

/** The first and last selected places, in order. */
export function selectedRange(selection: Selection): [number, number] {
  return [Math.min(selection.anchor, selection.focus), Math.max(selection.anchor, selection.focus)];
}

/** The cursor moved inside the clip, as after an undo that took columns away. */
export function clampCursor(clip: Clip, cursor: Cursor): Cursor {
  const bar = Math.min(Math.max(cursor.bar, 0), clip.bars.length - 1);
  const columns = clip.bars[bar].columns.length;
  return {
    bar,
    column: Math.min(Math.max(cursor.column, 0), Math.max(0, columns - 1)),
    string: Math.min(Math.max(cursor.string, 0), STRING_COUNT - 1),
  };
}

/** The column under the cursor, or null in an empty bar. */
export function columnAt(clip: Clip, cursor: Cursor): Column | null {
  return clip.bars[cursor.bar]?.columns[cursor.column] ?? null;
}

export function noteAt(clip: Clip, cursor: Cursor): Note | null {
  return columnAt(clip, cursor)?.notes[cursor.string] ?? null;
}

/** The nearest note before the cursor on its string, in this bar or an earlier one. */
export function noteBefore(clip: Clip, cursor: Cursor): Note | null {
  for (let b = cursor.bar; b >= 0; b--) {
    const columns = clip.bars[b].columns;
    for (let c = b === cursor.bar ? cursor.column - 1 : columns.length - 1; c >= 0; c--) {
      const note = columns[c].notes[cursor.string];
      if (note) return note;
    }
  }
  return null;
}

/* — keeping joins true — */

/**
 * Makes every mark that joins a note to the one before it on its string agree with that note:
 * a tie takes its fret, a hammer-on or pull-off is named by which way the frets go, and a mark
 * with no earlier note to join (or a dead one) is dropped; a slide from it becomes a slide from below.
 */
export function normalize(clip: Clip): Clip {
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
  return { ...clip, bars };
}

/* — changing columns and notes — */

/** The duration a new column gets: the cursor column's, else the nearest column's before it, else a quarter. */
function durationNear(clip: Clip, cursor: Cursor): Duration {
  const here = columnAt(clip, cursor);
  if (here) return { ...here.duration };
  for (let b = cursor.bar; b >= 0; b--) {
    const columns = clip.bars[b].columns;
    if (columns.length > 0) return { ...columns[columns.length - 1].duration };
  }
  return { value: 4, dots: 0, triplet: false };
}

function emptyColumn(duration: Duration): Column {
  return { duration, notes: Array<Note | null>(STRING_COUNT).fill(null) };
}

function replaceBar(clip: Clip, index: number, bar: Bar): Clip {
  return { ...clip, bars: clip.bars.map((b, i) => (i === index ? bar : b)) };
}

/** The clip with the cursor's column changed by `change`; in an empty bar a column is made first. */
function withColumn(clip: Clip, cursor: Cursor, change: (column: Column) => Column): Clip {
  const bar = clip.bars[cursor.bar];
  if (bar.columns.length === 0) {
    return replaceBar(clip, cursor.bar, { ...bar, columns: [change(emptyColumn(durationNear(clip, cursor)))] });
  }
  return replaceBar(clip, cursor.bar, {
    ...bar,
    columns: bar.columns.map((c, i) => (i === cursor.column ? change(c) : c)),
  });
}

/** The clip with every column in `range` (places, inclusive) changed by `change`. */
function withColumns(clip: Clip, [from, to]: [number, number], change: (column: Column) => Column): Clip {
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

function changeColumns(clip: Clip, { cursor, selection }: Target, change: (column: Column) => Column): Clip {
  return normalize(selection ? withColumns(clip, selectedRange(selection), change) : withColumn(clip, cursor, change));
}

/** Puts a fret on the cursor's string, keeping the note's marks but not a tie or a dead note. */
export function setFret(clip: Clip, cursor: Cursor, fret: number): Clip {
  return normalize(withColumn(clip, cursor, column => ({
    ...column,
    notes: column.notes.map((note, s) => {
      if (s !== cursor.string) return note;
      const rest = without(note ?? { fret }, 'tie');
      return { ...rest, fret };
    }),
  })));
}

/** A dead note (x) on the cursor's string. */
export function setDead(clip: Clip, cursor: Cursor): Clip {
  return normalize(withColumn(clip, cursor, column => ({
    ...column,
    notes: column.notes.map((note, s) => (s === cursor.string ? { fret: null, ...(note?.palmMute ? { palmMute: true } : {}) } : note)),
  })));
}

/** Clears the cursor's note. */
export function clearNote(clip: Clip, cursor: Cursor): Clip {
  if (!columnAt(clip, cursor)) return clip;
  return normalize(withColumn(clip, cursor, column => ({
    ...column,
    notes: column.notes.map((note, s) => (s === cursor.string ? null : note)),
  })));
}

/** Makes the target columns rests. */
export function makeRest(clip: Clip, target: Target): Clip {
  return changeColumns(clip, target, column => ({ ...emptyColumn(column.duration), ...(column.extra ? { extra: column.extra } : {}) }));
}

/**
 * A longer (+1) or shorter (−1) note value for the target columns, from a whole to a sixteenth.
 * A dotted sixteenth can't be written with what Frets reads, so its dots go.
 */
export function stepDuration(clip: Clip, target: Target, step: 1 | -1): Clip {
  return changeColumns(clip, target, column => {
    const i = NOTE_VALUES.indexOf(column.duration.value);
    const value = NOTE_VALUES[Math.min(NOTE_VALUES.length - 1, Math.max(0, i - step))];
    return { ...column, duration: { ...column.duration, value, dots: value === 16 ? 0 : column.duration.dots } };
  });
}

/** Sets the note value of the target columns. */
export function setValue(clip: Clip, target: Target, value: Duration['value']): Clip {
  return changeColumns(clip, target, column => ({
    ...column,
    duration: { ...column.duration, value, dots: value === 16 ? 0 : column.duration.dots },
  }));
}

/** Cycles none, one dot, two dots on the target columns (a sixteenth takes none). */
export function cycleDots(clip: Clip, target: Target): Clip {
  return changeColumns(clip, target, column => {
    const { duration } = column;
    const dots = duration.value === 16 ? 0 : ((duration.dots + 1) % 3) as Duration['dots'];
    return { ...column, duration: { ...duration, dots } };
  });
}

export function toggleTriplet(clip: Clip, target: Target): Clip {
  const on = !(columnAt(clip, target.cursor)?.duration.triplet ?? false);
  return changeColumns(clip, target, column => ({ ...column, duration: { ...column.duration, triplet: on } }));
}

/** A pick or strum stroke on the target columns; the same stroke again clears it. */
export function toggleStroke(clip: Clip, target: Target, stroke: 'down' | 'up'): Clip {
  const on = columnAt(clip, target.cursor)?.stroke !== stroke;
  return changeColumns(clip, target, column => {
    const rest = without(column, 'stroke');
    return on ? { ...rest, stroke } : rest;
  });
}

/* — note marks — */

/** Marks a note can carry that are simply on or off. */
export type NoteFlag = 'vibrato' | 'harmonic' | 'tap' | 'palmMute';

/**
 * Changes the notes a note mark applies to: with a selection every note in its columns, else the
 * cursor's note. Returns the clip unchanged when there is no note to mark.
 */
function changeNotes(clip: Clip, { cursor, selection }: Target, change: (note: Note, before: Note | null) => Note): Clip {
  if (!selection) {
    const note = noteAt(clip, cursor);
    if (!note) return clip;
    const before = noteBefore(clip, cursor);
    return normalize(withColumn(clip, cursor, column => ({
      ...column,
      notes: column.notes.map((n, s) => (s === cursor.string && n ? change(n, before) : n)),
    })));
  }
  const last: (Note | null)[] = Array(STRING_COUNT).fill(null);
  const [from, to] = selectedRange(selection);
  let index = 0;
  const bars = clip.bars.map(bar => ({
    ...bar,
    columns: bar.columns.map(column => {
      const inside = index >= from && index <= to;
      index++;
      return {
        ...column,
        notes: column.notes.map((note, s) => {
          if (!note) return null;
          const changed = inside ? change(note, last[s]) : note;
          last[s] = note;
          return changed;
        }),
      };
    }),
  }));
  return normalize({ ...clip, bars });
}

/** The notes a note mark would apply to, to read whether they all have it. */
function targetNotes(clip: Clip, { cursor, selection }: Target): Note[] {
  if (!selection) {
    const note = noteAt(clip, cursor);
    return note ? [note] : [];
  }
  const [from, to] = selectedRange(selection);
  const notes: Note[] = [];
  for (let i = from; i <= to; i++) {
    const { bar, column } = placeOf(clip, i);
    for (const n of clip.bars[bar].columns[column]?.notes ?? []) if (n) notes.push(n);
  }
  return notes;
}

/** Turns a mark on for the target notes, or off when they all have it already. */
export function toggleFlag(clip: Clip, target: Target, flag: NoteFlag): Clip {
  const notes = targetNotes(clip, target);
  const on = !notes.every(n => n[flag]);
  return changeNotes(clip, target, note => {
    const rest = without(note, flag);
    return on ? { ...rest, [flag]: true } : rest;
  });
}

/** A hammer-on or pull-off from the note before (named by the frets), or off again. */
export function toggleLegato(clip: Clip, target: Target): Clip {
  const on = !targetNotes(clip, target).every(n => n.legato);
  return changeNotes(clip, target, (note, before) => {
    const rest = without(note, 'legato');
    return on && before ? { ...rest, legato: 'h' } : rest;
  });
}

/** A tie to the note before on the string: the same fret, held. */
export function toggleTie(clip: Clip, target: Target): Clip {
  const on = !targetNotes(clip, target).every(n => n.tie);
  return changeNotes(clip, target, (note, before) => {
    const rest = without(note, 'tie');
    return on && before && before.fret !== null ? { ...rest, tie: true, fret: before.fret } : rest;
  });
}

/** Sets a slide on the target notes, or clears it when they all have that one. */
export function setSlide(clip: Clip, target: Target, slide: Slide): Clip {
  const off = targetNotes(clip, target).every(n => n.slide === slide);
  return changeNotes(clip, target, note => {
    const rest = without(note, 'slide');
    return off ? rest : { ...rest, slide };
  });
}

/** The order "/" steps through; slides from the note before are skipped when there is none. */
const SLIDE_CYCLE: (Slide | undefined)[] = ['legato', 'shift', 'below', 'above', undefined];

/** The cursor note's next slide kind, for the "/" key. */
export function cycleSlide(clip: Clip, cursor: Cursor): Clip {
  const note = noteAt(clip, cursor);
  if (!note) return clip;
  const before = noteBefore(clip, cursor);
  const canJoin = before !== null && before.fret !== null && note.fret !== null;
  const offered = SLIDE_CYCLE.filter(s => canJoin || (s !== 'legato' && s !== 'shift'));
  const next = offered[(offered.indexOf(note.slide) + 1) % offered.length];
  return changeNotes(clip, { cursor, selection: null }, n => {
    const rest = without(n, 'slide');
    return next ? { ...rest, slide: next } : rest;
  });
}

/** Sets the bend amount of the target notes, or clears the bend when they all bend that much. */
export function setBend(clip: Clip, target: Target, quarters: BendQuarters): Clip {
  const off = targetNotes(clip, target).every(n => n.bend?.quarters === quarters);
  return changeNotes(clip, target, note => {
    const { bend, ...rest } = note;
    if (off) return rest;
    // A ¼-tone curl is never pre-bent.
    return { ...rest, bend: { quarters, pre: quarters === 1 ? false : bend?.pre ?? false, release: bend?.release ?? false } };
  });
}

/** The cursor note's next bend amount, for the "b" key: ¼, ½, full, 1½, 2, none. */
export function cycleBend(clip: Clip, cursor: Cursor): Clip {
  const note = noteAt(clip, cursor);
  if (!note) return clip;
  const i = note.bend ? BEND_QUARTERS.indexOf(note.bend.quarters) : -1;
  const next = BEND_QUARTERS[i + 1];
  return changeNotes(clip, { cursor, selection: null }, n => {
    const { bend, ...rest } = n;
    return next ? { ...rest, bend: { quarters: next, pre: next === 1 ? false : bend?.pre ?? false, release: bend?.release ?? false } } : rest;
  });
}

/** Turns a bend's release or pre-bend on or off; a note with no bend gets a full one. */
export function toggleBendPart(clip: Clip, target: Target, part: 'pre' | 'release'): Clip {
  const on = !targetNotes(clip, target).every(n => n.bend?.[part]);
  return changeNotes(clip, target, note => {
    const bend = note.bend ?? { quarters: 4 as BendQuarters, pre: false, release: false };
    const quarters = part === 'pre' && on && bend.quarters === 1 ? 2 : bend.quarters;
    return { ...note, bend: { ...bend, quarters, [part]: on } };
  });
}

/** The cursor note's next bend shape, for Shift+B: release, pre-bend, pre-bend and release, plain. */
export function cycleBendShape(clip: Clip, cursor: Cursor): Clip {
  const note = noteAt(clip, cursor);
  if (!note) return clip;
  const shapes = [{ pre: false, release: true }, { pre: true, release: false }, { pre: true, release: true }, { pre: false, release: false }];
  const bend = note.bend ?? { quarters: 4 as BendQuarters, pre: false, release: false };
  const now = shapes.findIndex(s => s.pre === bend.pre && s.release === bend.release);
  const next = note.bend ? shapes[(now + 1) % shapes.length] : shapes[0];
  const quarters = next.pre && bend.quarters === 1 ? 2 : bend.quarters;
  return changeNotes(clip, { cursor, selection: null }, n => ({ ...n, bend: { quarters, ...next } }));
}

/* — bars — */

/** A repeat starting at the cursor's bar, or none. */
export function toggleRepeatStart(clip: Clip, cursor: Cursor): Clip {
  const bar = clip.bars[cursor.bar];
  const { repeatStart, ...rest } = bar;
  return replaceBar(clip, cursor.bar, repeatStart ? rest : { ...rest, repeatStart: true });
}

/** The cursor bar's repeat end, stepping through played twice, three times, four times and none. */
export function cycleRepeatEnd(clip: Clip, cursor: Cursor): Clip {
  const bar = clip.bars[cursor.bar];
  const { repeatEnd, ...rest } = bar;
  const next = repeatEnd === undefined ? 2 : repeatEnd < 4 ? repeatEnd + 1 : undefined;
  return replaceBar(clip, cursor.bar, next ? { ...rest, repeatEnd: next } : rest);
}

/** The cursor bar's ending bracket, stepping through 1., 2. and none. */
export function cycleEnding(clip: Clip, cursor: Cursor): Clip {
  const bar = clip.bars[cursor.bar];
  const { ending, ...rest } = bar;
  const next = ending === undefined ? 1 : ending < 2 ? ending + 1 : undefined;
  return replaceBar(clip, cursor.bar, next ? { ...rest, ending: next } : rest);
}

/* — moving — */

function isFull(clip: Clip, bar: Bar): boolean {
  return bar.columns.reduce((t, c) => t + ticks(c.duration), 0) >= barTicks(clip.time);
}

/**
 * The cursor one column left or right. Right from the clip's last column adds a column with the
 * same duration, in that bar while it has room and in a new bar once it is full, so typing runs on.
 */
export function moveColumn(clip: Clip, cursor: Cursor, step: 1 | -1, grow = true): { clip: Clip; cursor: Cursor } {
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
  const column0 = emptyColumn(durationNear(clip, cursor));
  if (!isFull(clip, here)) {
    const grown = replaceBar(clip, bar, { ...here, columns: [...here.columns, column0] });
    return { clip: grown, cursor: { ...cursor, column: here.columns.length } };
  }
  return { clip: { ...clip, bars: [...clip.bars, { columns: [column0] }] }, cursor: { ...cursor, bar: bar + 1, column: 0 } };
}

/** A rest with the cursor column's duration, put before the cursor column (the Insert key). */
export function insertColumn(clip: Clip, cursor: Cursor): Clip {
  const bar = clip.bars[cursor.bar];
  const columns = [...bar.columns];
  columns.splice(cursor.column, 0, emptyColumn(durationNear(clip, cursor)));
  return normalize(replaceBar(clip, cursor.bar, { ...bar, columns }));
}

/* — removing, copying and pasting columns — */

/**
 * The clip without the columns in `range` (places, inclusive), and where the cursor goes: the
 * column after them, or the last one left. A bar left empty goes too, unless it is the only one.
 */
export function deleteColumns(clip: Clip, [from, to]: [number, number]): { clip: Clip; cursor: { bar: number; column: number } } {
  let index = 0;
  const bars: Bar[] = [];
  for (const bar of clip.bars) {
    const columns = bar.columns.filter(() => {
      const keep = index < from || index > to;
      index++;
      return keep;
    });
    if (columns.length > 0 || bar.columns.length === 0) bars.push({ ...bar, columns });
  }
  const left = bars.length > 0 ? normalize({ ...clip, bars }) : { ...clip, bars: [{ columns: [] }] };
  return { clip: left, cursor: placeOf(left, Math.min(from, Math.max(0, columnCount(left) - 1))) };
}

/** The columns in `range` as a clip of their own, with the clip's time and tuning; bar lines between them are kept. */
export function sliceClip(clip: Clip, [from, to]: [number, number]): Clip {
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
  return normalize({ ...emptyClip(), time: clip.time, tuning: clip.tuning, bars: bars.length > 0 ? bars : [{ columns: [] }] });
}

/** The columns in `range` as alphaTex, for the clipboard. */
export function copyText(clip: Clip, range: [number, number]): string {
  return writeAlphaTex(sliceClip(clip, range));
}

export function isEmpty(clip: Clip): boolean {
  return clip.bars.every(b => b.columns.length === 0);
}

/**
 * `pasted` put in at the cursor, before the cursor's column, as text is pasted at a caret: its
 * first bar's columns join the cursor's bar, each later bar is a new bar, and the rest of the
 * cursor's bar follows its last one. Into an empty clip, the pasted clip comes whole, with its
 * name, time and tuning. The cursor ends on the last pasted column.
 */
export function pasteAt(clip: Clip, cursor: Cursor, pasted: Clip): { clip: Clip; cursor: Cursor } {
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
