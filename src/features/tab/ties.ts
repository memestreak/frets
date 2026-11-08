/**
 * Tie chains as one note (`docs/specs/2026-11-04-tab-ties-forward-design.md`): where a chain starts and
 * ends, which notes an edit on a selection takes, and `=`, which ties forward. The Clip still stores each
 * tie on the note it arrives at (alphaTex `-`). Pure; no React.
 */
import { ticks, type Column, type Duration, type Note, type Part } from './clip';
import { columnAt, indexOf, moveColumn, normalize, placeOf, selectedRange, type Cursor, type MoveOptions, type Selection } from './editing';
import { durationOf } from './sounding';
import { writeOver, timeOf } from './timeline';

/** A Column's place: its bar and its index in the bar. */
export interface Place {
  bar: number;
  column: number;
}

/** The next Column that takes time after `place` (grace notes skipped), across bar lines, or null at the clip's end. */
export function nextTimed(clip: Part, place: Place): Place | null {
  let { bar, column } = place;
  for (;;) {
    column++;
    while (bar < clip.bars.length && column >= clip.bars[bar].columns.length) {
      bar++;
      column = 0;
    }
    if (bar >= clip.bars.length) return null;
    if (!clip.bars[bar].columns[column].grace) return { bar, column };
  }
}

/** The last Column that takes time before `place` (grace notes skipped), or null at the clip's start. */
export function previousTimed(clip: Part, place: Place): Place | null {
  let { bar, column } = place;
  for (;;) {
    column--;
    while (column < 0) {
      bar--;
      if (bar < 0) return null;
      column = clip.bars[bar].columns.length - 1;
    }
    if (!clip.bars[bar].columns[column].grace) return { bar, column };
  }
}

const noteOn = (clip: Part, place: Place, string: number): Note | null => clip.bars[place.bar]?.columns[place.column]?.notes[string] ?? null;

/**
 * The Column a tie on `string` from `place` would go to: the next that takes time, unless a grace note on
 * that string comes first. A tie after a grace note ties from the grace note, as alphaTex's `-` does
 * (`17.1.8{gr} -.1{b (0 4)}.2`), so no tie reaches over one.
 */
function nextOnString(clip: Part, place: Place, string: number): Place | null {
  const next = nextTimed(clip, place);
  for (let p: Place | null = place; p; ) {
    const step: Place | null = stepOne(clip, p);
    if (!step || (next && step.bar === next.bar && step.column === next.column)) break;
    if (noteOn(clip, step, string)) return null;
    p = step;
  }
  return next;
}

/** The very next Column after `place`, grace notes included. */
function stepOne(clip: Part, { bar, column }: Place): Place | null {
  if (column + 1 < clip.bars[bar].columns.length) return { bar, column: column + 1 };
  for (let b = bar + 1; b < clip.bars.length; b++) if (clip.bars[b].columns.length > 0) return { bar: b, column: 0 };
  return null;
}

/** The first written note of the Tie chain the note at `at` belongs to (the note itself when it isn't tied on). */
export function chainStart(clip: Part, at: Cursor): Cursor {
  let place: Place = at;
  for (;;) {
    const note = noteOn(clip, place, at.string);
    const before = note?.tie ? previousTimed(clip, place) : null;
    if (!before || !noteOn(clip, before, at.string) || nextOnString(clip, before, at.string) === null) return { ...at, ...place };
    place = before;
  }
}

/** Every written note of the Tie chain at `at`, first to last; empty when there is no note there. */
export function chainPlaces(clip: Part, at: Cursor): Place[] {
  if (!noteOn(clip, at, at.string)) return [];
  const start = chainStart(clip, at);
  const out: Place[] = [{ bar: start.bar, column: start.column }];
  for (;;) {
    const next = nextOnString(clip, out[out.length - 1], at.string);
    if (!next || !noteOn(clip, next, at.string)?.tie) return out;
    out.push(next);
  }
}

/** Whether the note at `at` is one of a chain of more than one written note. */
export function isChained(clip: Part, at: Cursor): boolean {
  return chainPlaces(clip, at).length > 1;
}

/** The chain's whole length in ticks. */
export function chainTicks(clip: Part, at: Cursor): number {
  return chainPlaces(clip, at).reduce((sum, p) => sum + ticks(clip.bars[p.bar].columns[p.column].duration), 0);
}

/**
 * The note the length keys and the Duration group work on for the cursor: its chain's first note, on
 * the cursor's string, or with no note there (a Column of tied-on notes, no string picked) the first
 * tied-on note's. Null on a rest.
 */
export function lengthAnchor(clip: Part, cursor: Cursor): Cursor | null {
  const column = columnAt(clip, cursor);
  if (!column) return null;
  // No note on the cursor's string (a Column picked by itself): the Column's first note that starts there, else its first tied-on one.
  const starts = column.notes.findIndex(n => n && !n.tie);
  const string = column.notes[cursor.string] ? cursor.string : starts >= 0 ? starts : column.notes.findIndex(n => n?.tie);
  return string < 0 ? null : chainStart(clip, { ...cursor, string });
}

/**
 * The written length a chain shows as one value (`q~e` a dotted quarter), or null when it is no one
 * value (`h~e`). A chain of one note is its own duration.
 */
export function chainDuration(clip: Part, at: Cursor): Duration | null {
  const places = chainPlaces(clip, at);
  if (places.length === 0) return null;
  if (places.length === 1) return clip.bars[places[0].bar].columns[places[0].column].duration;
  return durationOf(chainTicks(clip, at));
}

/** A place's key in the sets below. */
const keyOf = (index: number, string: number) => `${index}:${string}`;

/**
 * The notes an edit on the selected Columns takes (spec Q12): the notes that start inside it, each with
 * its whole Tie chain, past the selection's end too; a note held on from before it is left out. Keys are
 * `index:string`, and `last` is the last Column index it reaches.
 */
export function takenNotes(clip: Part, selection: Selection): { notes: Set<string>; last: number } {
  const [from, to] = selectedRange(selection);
  const notes = new Set<string>();
  let last = to;
  for (let i = from; i <= to; i++) {
    const place = placeOf(clip, i);
    const column = clip.bars[place.bar].columns[place.column];
    column.notes.forEach((note, string) => {
      if (!note) return;
      const start = chainStart(clip, { ...place, string });
      if (indexOf(clip, start.bar, start.column) < from) return;
      for (const p of chainPlaces(clip, { ...place, string })) {
        const index = indexOf(clip, p.bar, p.column);
        notes.add(keyOf(index, string));
        last = Math.max(last, index);
      }
    });
  }
  return { notes, last };
}

/** Whether the note at Column `index` on `string` is among `notes` (from `takenNotes`). */
export function isTaken(notes: Set<string>, index: number, string: number): boolean {
  return notes.has(keyOf(index, string));
}

/* — `=` — */

/** The marks that belong to a note's start, which a note tied to loses (spec Q19). */
const ATTACK_MARKS = ['legato', 'slide', 'accent', 'ghost', 'tap', 'harmonic', 'harmonicFret', 'mordent', 'staccato'] as const;

/** `note` tied on to the note before it: its attack marks go, the rest stay. */
function tiedOn(note: Note | null, fret: number): Note {
  const out: Note = { ...(note ?? { fret }), fret, tie: true };
  for (const mark of ATTACK_MARKS) delete out[mark];
  return out;
}

/** The clip with a tied note on `string` in the Column at `place`. */
function tieInto(clip: Part, place: Place, string: number, fret: number): Part {
  return {
    ...clip,
    bars: clip.bars.map((bar, b) => b !== place.bar ? bar : {
      ...bar,
      columns: bar.columns.map((column, c) => c !== place.column ? column : {
        ...column,
        notes: column.notes.map((note, s) => (s === string ? tiedOn(note, fret) : note)),
      }),
    }),
  };
}

/**
 * Normal mode's `=` on one note (spec Q6): the chain at `at` tied on from its end into the next Column
 * that takes time. A note there takes the fret and is tied; a Column with notes on other strings only
 * gets a tied note on this string; a rest becomes a tied note of the rest's length. At the clip's end, on
 * a dead note, or past a grace note on the same string (which a tie would come from), nothing changes; a
 * grace note on another string is passed over.
 */
function tieOnFrom(clip: Part, at: Cursor): Part {
  const places = chainPlaces(clip, at);
  if (places.length === 0) return clip;
  const fret = noteOn(clip, places[0], at.string)?.fret;
  if (fret === null || fret === undefined) return clip;
  const next = nextOnString(clip, places[places.length - 1], at.string);
  return next ? tieInto(clip, next, at.string, fret) : clip;
}

/**
 * `=` in normal mode (A7, spec Q6, Q7). With no selection, the cursor's note; with one Column selected (a
 * chord, or a Column picked with no string), each of its notes that starts there: each is tied forward
 * as `tieOnFrom` does. With several Columns selected, each selected note is tied to the next note on its
 * string only where that note already has the same fret, as MuseScore ties a range; no fret changes.
 */
export function tieForward(clip: Part, { cursor, selection }: { cursor: Cursor; selection: Selection | null }): Part {
  if (!selection) return normalize(tieOnFrom(clip, cursor));
  const [from, to] = selectedRange(selection);
  if (from === to) {
    const place = placeOf(clip, from);
    const column = clip.bars[place.bar].columns[place.column];
    let next = clip;
    column.notes.forEach((note, string) => {
      if (note && !note.tie) next = tieOnFrom(next, { ...place, string });
    });
    return normalize(next);
  }
  let next = clip;
  for (let i = from; i <= to; i++) {
    const place = placeOf(clip, i);
    const column = clip.bars[place.bar].columns[place.column];
    column.notes.forEach((note, string) => {
      if (!note || note.fret === null) return;
      const after = nextOnString(clip, place, string);
      const there = after && noteOn(clip, after, string);
      if (after && there && !there.tie && there.fret === note.fret) next = tieInto(next, after, string, note.fret);
    });
  }
  return normalize(next);
}

/**
 * `=` in note input mode (spec Q9): a note of `length` tied on after the chain at the cursor, for every note of
 * its chord whose chain ends at the same time, written over what follows and split and tied by the
 * meter. Null on a rest, or when it would put a tuplet across a bar line.
 */
export function tieOnInput(clip: Part, cursor: Cursor, length: Duration): Part | null {
  const start = chainStart(clip, cursor);
  const head = columnAt(clip, start);
  if (!head || !head.notes[cursor.string]) return null;
  const end = (string: number) => {
    const places = chainPlaces(clip, { ...start, string });
    const last = places[places.length - 1];
    return timeOf(clip, last.bar, last.column) + ticks(clip.bars[last.bar].columns[last.column].duration);
  };
  const at = end(cursor.string);
  const notes: (Note | null)[] = head.notes.map((note, string) =>
    note && !note.tie && note.fret !== null && end(string) === at ? { fret: note.fret, tie: true } : null);
  const column: Column = { duration: { ...length }, notes };
  const written = writeOver(clip, at, [column]);
  return written ? normalize(written) : null;
}

/**
 * The written notes drawn picked besides the cursor's and the selection's own (spec Q2, Q12): the rest of
 * the picked Tie chain, or each chain that starts in the selection (or the Column picked by itself) and
 * runs on past its end. None while one Tied note is picked alone.
 */
export function litTiedNotes(clip: Part, cursor: Cursor, selection: Selection | null, columnOnly: boolean, alone: boolean): { index: number; string: number }[] {
  if (alone || !columnAt(clip, cursor)) return [];
  const here = indexOf(clip, cursor.bar, cursor.column);
  const range = selection ?? (columnOnly ? { anchor: here, focus: here } : null);
  if (range) {
    const [, to] = selectedRange(range);
    const { notes } = takenNotes(clip, range);
    return [...notes].map(key => key.split(':').map(Number)).filter(([index]) => index > to).map(([index, string]) => ({ index, string }));
  }
  return chainPlaces(clip, cursor)
    .map(p => ({ index: indexOf(clip, p.bar, p.column), string: cursor.string }))
    .filter(p => p.index !== here);
}

/**
 * A move on past Columns that hold only tied-on notes, so a Tie chain is one stop (step 4 in note input mode,
 * step 5 in normal mode). It stops where it can go no further.
 */
export function overTiedOn(moved: { clip: Part; cursor: Cursor }, step: 1 | -1, options: MoveOptions = {}): { clip: Part; cursor: Cursor } {
  let out = moved;
  while (onlyTiedOn(out.clip, out.cursor)) {
    const next = moveColumn(out.clip, out.cursor, step, options);
    if (next.cursor.bar === out.cursor.bar && next.cursor.column === out.cursor.column) break;
    out = next;
  }
  return out;
}

/** Whether the cursor's Column holds only notes tied on from the Column before. */
function onlyTiedOn(clip: Part, cursor: Cursor): boolean {
  const notes = (columnAt(clip, cursor)?.notes ?? []).filter(note => note !== null);
  return notes.length > 0 && notes.every(note => note.tie);
}
