/**
 * Editing a clip: the cursor, the selection and every change the keys and
 * the palette make. Pure; no React. Each change takes a clip and returns a
 * new one (the page keeps the old one for undo), and `normalize` runs after
 * it so marks that join a note to the one before it stay true.
 */
import type { MarkHit } from './marks';
import {
  barLength, barTicks, BEND_QUARTERS, C_MAJOR, keyAt, sameKey, ticks, emptyClip, MAX_BPM, MIN_BPM, NOTE_VALUES, SHORTEST_DOTTED, STRING_COUNT, timeAt, TREMOLO_VALUES, WHOLE,
  type Bar, type BendQuarters, type Clip, type Column, type Duration, type Key, type Note, type Ottava, type Slide, type TimeSignature,
  type Tempo, type TremoloValue,
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

/**
 * The places of the run of columns round `index` that all have a mark (`has`), as the P.M. and let
 * ring lines run: across bars and lines of tab, as far as the mark goes.
 */
export function runAround(clip: Clip, index: number, has: (column: Column) => boolean): [number, number] {
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
  return tidyTimes({ ...clip, bars });
}


const sameTime = (a: TimeSignature, b: TimeSignature) => a.beats === b.beats && a.value === b.value;

/**
 * A time signature set on the first bar becomes the clip's, and one that repeats the time signature
 * already in force is dropped, so a bar's `time` always marks a change.
 */
function tidyTimes(clip: Clip): Clip {
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
function durationNear(clip: Clip, cursor: Cursor): Duration {
  const here = columnAt(clip, cursor);
  if (here) return { ...here.duration };
  for (let b = cursor.bar; b >= 0; b--) {
    const columns = clip.bars[b].columns;
    if (columns.length > 0) return { ...columns[columns.length - 1].duration };
  }
  return { value: 4, dots: 0 };
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

/** The length of the last column with a note before the cursor's, in the clip; a quarter when none. */
function lastNoteLength(clip: Clip, cursor: Cursor): Duration {
  for (let b = cursor.bar; b >= 0; b--) {
    const columns = clip.bars[b].columns;
    for (let c = (b === cursor.bar ? cursor.column : columns.length) - 1; c >= 0; c--) {
      if (!columns[c].grace && columns[c].notes.some(Boolean)) return { value: columns[c].duration.value, dots: columns[c].duration.dots };
    }
  }
  return { value: 4, dots: 0 };
}

/**
 * Before a note goes on a plain rest longer than the note before it (as → fills a bar with), the
 * rest is split: its first part takes that note's length and the rest of its time stays rests, the
 * fewest that fill it. So a run of quarters types on as before (Jeremy, 2026-10-26).
 */
function splitRest(clip: Clip, cursor: Cursor): Clip {
  const column = columnAt(clip, cursor);
  if (!column || column.grace || column.duration.tuplet || column.notes.some(Boolean)) return clip;
  const length = lastNoteLength(clip, cursor);
  const room = ticks(column.duration);
  if (ticks(length) >= room) return clip;
  const bar = clip.bars[cursor.bar];
  const columns = [...bar.columns];
  columns.splice(cursor.column, 1, { ...column, duration: length }, ...fewestRests(room - ticks(length)).map(emptyColumn));
  return replaceBar(clip, cursor.bar, { ...bar, columns });
}

/** Puts a fret on the cursor's string, keeping the note's marks but not a tie or a dead note. */
export function setFret(clip: Clip, cursor: Cursor, fret: number): Clip {
  return normalize(withColumn(splitRest(clip, cursor), cursor, column => ({
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
  return normalize(withColumn(splitRest(clip, cursor), cursor, column => ({
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
 * A longer (+1) or shorter (−1) note value for the target columns, from a whole to a sixty-fourth.
 * A sixty-fourth takes no dots, so its dots go.
 */
export function stepDuration(clip: Clip, target: Target, step: 1 | -1): Clip {
  return changeColumns(clip, target, column => {
    const i = NOTE_VALUES.indexOf(column.duration.value);
    const value = NOTE_VALUES[Math.min(NOTE_VALUES.length - 1, Math.max(0, i - step))];
    return { ...column, duration: { ...column.duration, value, dots: value > SHORTEST_DOTTED ? 0 : column.duration.dots } };
  });
}

/** Sets the note value of the target columns. */
export function setValue(clip: Clip, target: Target, value: Duration['value']): Clip {
  return changeColumns(clip, target, column => ({
    ...column,
    duration: { ...column.duration, value, dots: value > SHORTEST_DOTTED ? 0 : column.duration.dots },
  }));
}

/** Cycles none, one dot, two dots on the target columns (a sixty-fourth takes none). */
export function cycleDots(clip: Clip, target: Target): Clip {
  return changeColumns(clip, target, column => {
    const { duration } = column;
    const dots = duration.value > SHORTEST_DOTTED ? 0 : ((duration.dots + 1) % 3) as Duration['dots'];
    return { ...column, duration: { ...duration, dots } };
  });
}

/** Puts the target columns in one kind of tuplet (3 to 12, in its usual span), or none with null. */
/** Puts the target columns under an octave line, or takes it away with null: the Octave line button's panel. */
export function setOttava(clip: Clip, target: Target, ottava: Ottava | null): Clip {
  return changeColumns(clip, target, c => (ottava ? { ...c, ottava } : without(c, 'ottava')));
}

export function setTuplet(clip: Clip, target: Target, tuplet: number | null): Clip {
  return changeColumns(clip, target, column => {
    const plain = without(without(column.duration, 'tuplet'), 'tupletSpan');
    return { ...column, duration: tuplet ? { ...plain, tuplet } : plain };
  });
}

/** Makes the target columns one kind of tuplet (a triplet, quintuplet …); the same kind again makes them plain. */
export function toggleTuplet(clip: Clip, target: Target, tuplet: number): Clip {
  const now = columnAt(clip, target.cursor)?.duration;
  const on = now?.tuplet !== tuplet || now.tupletSpan !== undefined;
  return setTuplet(clip, target, on ? tuplet : null);
}

/** Makes the target columns grace notes, played just before the beat; pressed again on a grace note, plain notes. */
export function toggleGrace(clip: Clip, target: Target): Clip {
  const on = !columnAt(clip, target.cursor)?.grace;
  return changeColumns(clip, target, column => (on ? { ...column, grace: 'before' } : without(column, 'grace')));
}

/** Tremolo picks the target columns as fast as `value`; the same speed again stops it. */
export function setTremolo(clip: Clip, target: Target, value: TremoloValue): Clip {
  const on = columnAt(clip, target.cursor)?.tremolo !== value;
  return changeColumns(clip, target, column => (on ? { ...column, tremolo: value } : without(column, 'tremolo')));
}

/** Steps the target columns' tremolo picking through eighths, sixteenths, thirty-seconds and none. */
export function cycleTremolo(clip: Clip, target: Target): Clip {
  const now = columnAt(clip, target.cursor)?.tremolo;
  const next = now === undefined ? TREMOLO_VALUES[0] : TREMOLO_VALUES[TREMOLO_VALUES.indexOf(now) + 1];
  return changeColumns(clip, target, column => (next ? { ...column, tremolo: next } : without(column, 'tremolo')));
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

/** Marks a note carries that are on or off (true), or one of a few kinds. */
type NoteMarks = Required<Pick<Note, 'vibrato' | 'harmonic' | 'tap' | 'palmMute' | 'letRing' | 'ghost' | 'accent' | 'staccato' | 'slideOut'>>;
export type MarkName = keyof NoteMarks;
/** A mark and one of its kinds: ['vibrato', 'wide'], ['palmMute', true]. */
export type MarkKind = { [K in MarkName]: [K, NoteMarks[K]] }[MarkName];

function withMark(note: Note, mark: MarkName, value: NoteMarks[MarkName] | undefined): Note {
  const n: Note = { ...note };
  delete n[mark];
  return value === undefined ? n : { ...n, [mark]: value };
}

/** Sets a mark on the target notes, or clears it when they all have that kind already. */
export function setMark(clip: Clip, target: Target, [mark, value]: MarkKind): Clip {
  const off = targetNotes(clip, target).every(n => n[mark] === value);
  return changeNotes(clip, target, note => withMark(note, mark, off ? undefined : value));
}

/**
 * Steps a mark through its kinds, then off, for the keys that do (V: vibrato, then wide). The next
 * kind is the one after the cursor note's, and every target note gets it.
 */
export function cycleMark<K extends MarkName>(clip: Clip, target: Target, mark: K, kinds: NoteMarks[K][]): Clip {
  const note = noteAt(clip, target.cursor) ?? targetNotes(clip, target)[0];
  if (!note) return clip;
  const next = kinds[kinds.indexOf(note[mark] as NoteMarks[K]) + 1];
  return changeNotes(clip, target, n => withMark(n, mark, next));
}

/**
 * The clip without one drawn mark (a picked mark's Delete, issue #128): from its note, or from every
 * note of its column for a mark drawn over the column; a tuplet's whole group goes plain. The notes stay.
 */
export function removeMark(clip: Clip, hit: MarkHit): Clip {
  const { bar, column } = placeOf(clip, hit.index);
  const cursor = { bar, column, string: hit.string ?? 0 };
  const note: Target = { cursor, selection: null };
  const wholeColumn: Target = { cursor, selection: { anchor: hit.index, focus: hit.to ?? hit.index } };
  switch (hit.mark) {
    case 'bend': return changeNotes(clip, note, n => without(n, 'bend'));
    case 'slideOut': return changeNotes(clip, note, n => without(n, 'slideOut'));
    case 'tap': return changeNotes(clip, note, n => without(n, 'tap'));
    case 'legato': return changeNotes(clip, note, n => without(n, 'legato'));
    case 'slide': return changeNotes(clip, note, n => without(n, 'slide'));
    case 'tie': return changeNotes(clip, note, n => without(n, 'tie'));
    case 'vibrato': return changeNotes(clip, wholeColumn, n => without(n, 'vibrato'));
    case 'pinch': return changeNotes(clip, wholeColumn, n => (n.harmonic === 'pinch' ? without(n, 'harmonic') : n));
    case 'accent': return changeNotes(clip, wholeColumn, n => without(n, 'accent'));
    case 'staccato': return changeNotes(clip, wholeColumn, n => without(n, 'staccato'));
    case 'stroke': return changeColumns(clip, wholeColumn, c => without(c, 'stroke'));
    case 'tremolo': return changeColumns(clip, wholeColumn, c => without(c, 'tremolo'));
    case 'tuplet': return setTuplet(clip, wholeColumn, null);
    case 'ottava': return changeColumns(clip, wholeColumn, c => without(c, 'ottava'));
  }
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

/** Sets the bend amount of the target notes, or takes their bends away with null: the Bend button's panel. */
export function setBend(clip: Clip, target: Target, quarters: BendQuarters | null): Clip {
  return changeNotes(clip, target, note => {
    const { bend, ...rest } = note;
    if (quarters === null) return rest;
    // A ¼-tone curl is never pre-bent.
    return { ...rest, bend: { quarters, pre: quarters === 1 ? false : bend?.pre ?? false, release: bend?.release ?? false } };
  });
}

/**
 * The next bend amount after the cursor note's (¼, ½, full, 1½, 2, none), on every target note:
 * the "b" key.
 */
export function cycleBend(clip: Clip, target: Target): Clip {
  const note = noteAt(clip, target.cursor) ?? targetNotes(clip, target)[0];
  if (!note) return clip;
  const i = note.bend ? BEND_QUARTERS.indexOf(note.bend.quarters) : -1;
  const next = BEND_QUARTERS[i + 1];
  return changeNotes(clip, target, n => {
    const { bend, ...rest } = n;
    // A ¼-tone curl is never pre-bent.
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

/* — words over the tab — */

/** The free text over the cursor's column; empty or blank clears it. */
export function setBeatText(clip: Clip, cursor: Cursor, text: string): Clip {
  if (!columnAt(clip, cursor)) return clip;
  const t = text.trim();
  return withColumn(clip, cursor, column => {
    const rest = without(column, 'text');
    return t ? { ...rest, text: t } : rest;
  });
}

/** The chord name over the cursor's column; empty or blank clears it. */
export function setChordName(clip: Clip, cursor: Cursor, name: string): Clip {
  if (!columnAt(clip, cursor)) return clip;
  const chord = name.trim();
  return withColumn(clip, cursor, column => {
    const rest = without(column, 'chord');
    return chord ? { ...rest, chord } : rest;
  });
}

/** The section starting at a bar ("Chorus"); empty or blank clears it, keeping no rehearsal mark. */
export function setSection(clip: Clip, bar: number, text: string): Clip {
  const t = text.trim();
  const { section, ...rest } = clip.bars[bar];
  return replaceBar(clip, bar, t ? { ...rest, section: { ...section, text: t } } : rest);
}

/** The tempo from a bar on, with its label if any ("Slowly"); null clears it. */
export function setTempo(clip: Clip, bar: number, tempo: Tempo | null): Clip {
  const rest = without(clip.bars[bar], 'tempo');
  return replaceBar(clip, bar, tempo === null ? rest : { ...rest, tempo });
}

/**
 * A tempo as typed in its field: bpm, then an optional label ("100 A little faster"; Jeremy,
 * 2026-10-27), the bpm kept within MIN_BPM to MAX_BPM. Nothing typed is null, no tempo; text that
 * doesn't start with a number is undefined, so the tempo stays as it was.
 */
export function readTempo(typed: string): Tempo | null | undefined {
  const t = typed.trim();
  if (t === '') return null;
  const match = /^(\d+)\s*(.*)$/.exec(t);
  if (!match) return undefined;
  const bpm = Math.min(MAX_BPM, Math.max(MIN_BPM, Number(match[1])));
  return match[2] ? { bpm, label: match[2] } : { bpm };
}

/** A tempo as its field shows it: bpm, then the label. */
export function tempoText(tempo: Tempo | undefined): string {
  return tempo ? [tempo.bpm, tempo.label].filter(Boolean).join(' ') : '';
}

/** The capo's fret; null for none. */
export function setCapo(clip: Clip, capo: number | null): Clip {
  const rest = without(clip, 'capo');
  return capo === null ? rest : { ...rest, capo };
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

/**
 * The ending bracket over bar `bar` and the bars round it under the same one: set to `n`, or taken away
 * with null (a press picks a drawn bracket, Jeremy 2026-10-28).
 */
export function setEnding(clip: Clip, bar: number, n: number | null): Clip {
  const was = clip.bars[bar]?.ending;
  if (was === undefined) return clip;
  let first = bar;
  while (first > 0 && clip.bars[first - 1].ending === was) first--;
  let last = bar;
  while (last + 1 < clip.bars.length && clip.bars[last + 1].ending === was) last++;
  let next = clip;
  for (let i = first; i <= last; i++) {
    const rest = { ...next.bars[i] };
    delete rest.ending;
    next = replaceBar(next, i, n ? { ...rest, ending: n } : rest);
  }
  return next;
}

/**
 * The time signature from bar `index` on. On the first bar it is the clip's own; on a later bar it
 * starts a change, and null (or the time signature already in force) takes the change away.
 */
export function setBarTime(clip: Clip, index: number, time: TimeSignature | null): Clip {
  if (index === 0) return time ? normalize({ ...clip, time }) : clip;
  const bar = clip.bars[index];
  return normalize(replaceBar(clip, index, time ? { ...bar, time } : without(bar, 'time')));
}

/**
 * A key signature from a bar on (issue #122), or null to take a bar's own away; on the first bar
 * it is the clip's own, and C major there is the same as none.
 */
export function setBarKey(clip: Clip, index: number, key: Key | null): Clip {
  const bar = clip.bars[index];
  const before = index === 0 ? C_MAJOR : keyAt(clip, index - 1);
  // Setting the key already in force takes the bar's own away.
  const keep = key && !sameKey(key, before);
  return replaceBar(clip, index, keep ? { ...bar, key } : without(bar, 'key'));
}

/* — moving — */

function isFull(clip: Clip, index: number): boolean {
  return barLength(clip.bars[index]) >= barTicks(timeAt(clip, index));
}

/** Every plain rest length, longest first: each note value, then dotted and double-dotted where it may be. */
const REST_DURATIONS: Duration[] = NOTE_VALUES.flatMap(value => {
  const dots: Duration['dots'][] = value > SHORTEST_DOTTED ? [0] : [0, 1, 2];
  return dots.map(d => ({ value, dots: d }));
}).sort((a, b) => ticks(b) - ticks(a));

/** The step every rest length is a whole number of: a 256th, since a double-dotted 32nd is 14 of them. */
const REST_STEP = WHOLE / 256;

/**
 * The fewest rests that add up to `room` ticks, longest first: a whole rest for an empty bar of 4/4,
 * a dotted half for 3/4. Time a plain rest can't fill (left by a broken tuplet) stays unfilled.
 */
export function fewestRests(room: number): Duration[] {
  const steps = Math.floor(Math.max(0, room) / REST_STEP);
  const sizes = REST_DURATIONS.map(d => ticks(d) / REST_STEP);
  // fewest[n]: the fewest rests making n steps; last[n]: the rest that ends such a run.
  const fewest = new Array<number>(steps + 1).fill(Infinity);
  const last = new Array<number>(steps + 1).fill(-1);
  fewest[0] = 0;
  for (let n = 1; n <= steps; n++) {
    sizes.forEach((size, k) => {
      if (size <= n && fewest[n - size] + 1 < fewest[n]) {
        fewest[n] = fewest[n - size] + 1;
        last[n] = k;
      }
    });
  }
  // The longest run of steps that can be made (every count can, a 256th aside).
  let n = steps;
  while (n > 0 && last[n] === -1) n--;
  const rests: Duration[] = [];
  for (; n > 0; n -= sizes[last[n]]) rests.push(REST_DURATIONS[last[n]]);
  return rests.sort((a, b) => ticks(b) - ticks(a));
}

/** The rests that complete a bar: the fewest that fill the time it lacks. */
function restsToFill(clip: Clip, bar: number): Duration[] {
  return fewestRests(barTicks(timeAt(clip, bar)) - barLength(clip.bars[bar]));
}

/**
 * A bar that doesn't add up yet, completed with the fewest rests after its last column; an empty bar
 * gets a whole bar's rest. A full bar, or a bar no plain rest can complete, comes back as it was.
 * The cursor leaving a bar (←, or the tab losing focus) does this (Jeremy, 2026-10-27).
 */
export function fillBar(clip: Clip, bar: number): Clip {
  const here = clip.bars[bar];
  if (!here || isFull(clip, bar)) return clip;
  const rests = restsToFill(clip, bar);
  if (rests.length === 0) return clip;
  return normalize(replaceBar(clip, bar, { ...here, columns: [...here.columns, ...rests.map(emptyColumn)] }));
}

/**
 * The cursor one column left or right. Left off a bar's first column fills the bar it leaves
 * (`fillBar`). Right from the last column of a bar that doesn't add up yet
 * fills it at once with the fewest rests that complete it, anywhere in the clip, an empty bar
 * included (a whole rest in 4/4; Jeremy, 2026-10-26), and the cursor goes to the first of them. Right from the clip's last column, once its bar is full, starts a new bar with a
 * rest as long as the cursor's column, so typing runs on, and the fewest rests after it that fill the bar.
 */
export function moveColumn(clip: Clip, cursor: Cursor, step: 1 | -1, grow = true): { clip: Clip; cursor: Cursor } {
  const { bar, column } = cursor;
  if (step === -1) {
    if (column > 0) return { clip, cursor: { ...cursor, column: column - 1 } };
    if (bar === 0) return { clip, cursor };
    const columns = clip.bars[bar - 1].columns.length;
    // Rests go after the bar left behind, so the columns of the bar before keep their places.
    const left = grow ? fillBar(clip, bar) : clip;
    return { clip: left, cursor: { ...cursor, bar: bar - 1, column: Math.max(0, columns - 1) } };
  }
  const here = clip.bars[bar];
  if (column < here.columns.length - 1) return { clip, cursor: { ...cursor, column: column + 1 } };
  // An emptied bar counts too: its first rest goes where the cursor waits.
  const rests = grow && !isFull(clip, bar) ? restsToFill(clip, bar) : [];
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
export function insertColumn(clip: Clip, cursor: Cursor): Clip {
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
export function insertBar(clip: Clip, cursor: Cursor, where: 'before' | 'after'): { clip: Clip; cursor: Cursor } {
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
export function deleteColumns(clip: Clip, [from, to]: [number, number]): { clip: Clip; cursor: { bar: number; column: number } } {
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
export function removeEmptyBar(clip: Clip, bar: number): { clip: Clip; cursor: { bar: number; column: number } } {
  if (clip.bars.length === 1 || clip.bars[bar].columns.length > 0) return { clip, cursor: { bar, column: 0 } };
  const left = normalize({ ...clip, bars: clip.bars.filter((_, i) => i !== bar) });
  if (bar === 0) return { clip: left, cursor: { bar: 0, column: 0 } };
  return { clip: left, cursor: { bar: bar - 1, column: Math.max(0, left.bars[bar - 1].columns.length - 1) } };
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
  const first = placeOf(clip, from).bar;
  return normalize({ ...emptyClip(), time: timeAt(clip, first), tuning: clip.tuning, bars: bars.length > 0 ? bars : [{ columns: [] }] });
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
