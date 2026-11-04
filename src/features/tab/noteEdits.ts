/**
 * What the palette's tools and their keys change on the target (the selection, else the cursor's note
 * or column): rhythm, tuplets, grace notes, technique marks, joins and bends. Pure: each returns a new
 * clip. See `docs/specs/2026-10-25-tab-editing-design.md`.
 */

import type { MarkHit } from './marks';
import { BEND_QUARTERS, NOTE_VALUES, SHORTEST_DOTTED, STRING_COUNT, TREMOLO_VALUES, barTicks, fewestRests, isRest, ticks, timeAt, type BendQuarters, type Column, type Part, type Duration, type Note, type Ottava, type Slide, type TremoloValue } from './clip';
import { readVoice } from './sounding';
import { chainDuration, chainPlaces, isTaken, lengthAnchor, takenNotes } from './ties';
import { timeOf, writeOver } from './timeline';
import { isProblem, lengthInTuplet, untuplet } from './tuplets';
import { type Cursor, type Selection, type Target, changeColumns, columnAt, emptyColumn, indexOf, normalize, noteAt, noteBefore, placeOf, selectedRange, withColumn, without } from './editing';


/**
 * Delete (and cut) on a selection, as MuseScore's: the notes it takes (`takenNotes`) go, each Tie chain
 * starting inside it whole, past its end too, while a note held on from before it stays
 * (`docs/specs/2026-11-04-tab-ties-forward-design.md`). A selected Column left with no note becomes a
 * rest, and each bar it covers whole with no note left starts again as the fewest rests that fill it, a
 * whole rest in 4/4, whatever lengths its rests had or however short it was (issue #290). Returns the
 * selection over the same bars and columns.
 */
export function clearToRests(clip: Part, selection: Selection): { clip: Part; selection: Selection } {
  const [from, to] = selectedRange(selection);
  const taken = takenNotes(clip, selection);
  let index = 0;
  const rested: Part = {
    ...clip,
    bars: clip.bars.map(bar => ({
      ...bar,
      columns: bar.columns.map(column => {
        const i = index++;
        if (i < from || i > taken.last) return column;
        const notes = column.notes.map((note, s) => (note && isTaken(taken.notes, i, s) ? null : note));
        if (i > to) return { ...column, notes };
        return notes.some(Boolean) ? { ...column, notes } : { ...emptyColumn(column.duration), ...(column.extra ? { extra: column.extra } : {}) };
      }),
    })),
  };
  const first = placeOf(clip, from);
  const last = placeOf(clip, to);
  const whole = (b: number) =>
    (b > first.bar || first.column === 0) && (b < last.bar || last.column === clip.bars[b].columns.length - 1)
    && rested.bars[b].columns.every(c => !c.notes.some(Boolean));
  const bars = rested.bars.map((bar, b) =>
    b >= first.bar && b <= last.bar && whole(b) ? { ...bar, columns: fewestRests(barTicks(timeAt(rested, b))).map(emptyColumn) } : bar,
  );
  // A grace note left with no note goes, leaving no Gap (step 6, Q10).
  const next = normalize({ ...rested, bars: bars.map(bar => (bar.columns.some(c => c.grace && !c.notes.some(Boolean)) ? { ...bar, columns: bar.columns.filter(c => !(c.grace && !c.notes.some(Boolean))) } : bar)) });
  // The same places, a bar started again counted from its first rest to its last.
  const start = indexOf(next, first.bar, whole(first.bar) ? 0 : Math.min(first.column, Math.max(0, next.bars[first.bar].columns.length - 1)));
  const end = indexOf(next, last.bar, whole(last.bar) ? next.bars[last.bar].columns.length - 1 : Math.min(last.column, next.bars[last.bar].columns.length - 1));
  return { clip: next, selection: selection.anchor <= selection.focus ? { anchor: start, focus: end } : { anchor: end, focus: start } };
}

/**
 * A longer (+1) or shorter (−1) note value for the target columns, from a whole to a sixty-fourth.
 * A sixty-fourth takes no dots, so its dots go.
 */
export function stepDuration(clip: Part, target: Target, step: 1 | -1): Part {
  // A Tie chain that is no one written value (`h~e`) has no next value: nothing changes.
  return changeLength(clip, target, duration => {
    if (!duration) return null;
    const i = NOTE_VALUES.indexOf(duration.value);
    const value = NOTE_VALUES[Math.min(NOTE_VALUES.length - 1, Math.max(0, i - step))];
    return { ...duration, value, dots: value > SHORTEST_DOTTED ? 0 : duration.dots };
  });
}

/** Sets the note value of the target columns. */
export function setValue(clip: Part, target: Target, value: Duration['value']): Part {
  return changeLength(clip, target, duration => ({ value, dots: value > SHORTEST_DOTTED ? 0 : duration?.dots ?? 0 }));
}

/** Cycles none, one dot, two dots on the target columns (a sixty-fourth takes none). */
export function cycleDots(clip: Part, target: Target): Part {
  // A Tie chain that is no one written value (`h~e`) takes no dot: nothing changes.
  return changeLength(clip, target, duration => {
    if (!duration) return null;
    const dots = duration.value > SHORTEST_DOTTED ? 0 : ((duration.dots + 1) % 3) as Duration['dots'];
    return { ...duration, dots };
  });
}

/**
 * A new length for the target columns, keeping bars full (`docs/specs/2026-11-04-tab-bars-always-full-design.md`).
 * One Column picked by itself starts where it did: longer, it writes over what follows, tied over bar
 * lines by the meter; shorter, it leaves a Gap. A note it starts takes the new length whole, its Tie
 * chain too; a Column that only carries tied notes on doesn't change (until Tie chains are picked as one).
 * A run is laid out again from its start, each note with its new length and each Gap in it keeping its
 * own. A grace note doesn't change; a note in a tuplet changes within it (`tuplets.ts`). An edit that
 * would put a tuplet across a bar line changes nothing.
 */
function changeLength(clip: Part, target: Target, change: (duration: Duration | null) => Duration | null): Part {
  // A rest is a Gap, whose length can't be set (rests are Gaps, step 3): only rests, nothing changes.
  if (onlyRests(clip, target)) return clip;
  const { cursor, selection } = target;
  const lone = !selection || selection.anchor === selection.focus;
  if (lone) {
    const pressed = selection ? { ...cursor, ...placeOf(clip, selection.anchor) } : cursor;
    const pressedColumn = columnAt(clip, pressed);
    if (!pressedColumn) return clip;
    // A grace note is valued by how many come before its note: the keys don't change it (step 6, Q9).
    if (pressedColumn.grace) return clip;
    // A Tie chain is one note: the keys work from its first written note, whichever was picked (step 5).
    const at = lengthAnchor(clip, pressed);
    if (!at) return clip;
    const column = columnAt(clip, at)!;
    // In a tuplet the length changes within it only (step 6, Q5).
    if (column.duration.tuplet) {
      const duration = change(column.duration);
      return duration ? lengthInTuplet(clip, at, duration) : clip;
    }
    const duration = change(chainDuration(clip, at));
    if (!duration) return clip;
    const start = timeOf(clip, at.bar, at.column);
    // The Sounding notes it starts end here at the latest: a shorter one leaves a Gap to there.
    const ends = readVoice(clip).notes.filter(n => n.start === start).map(n => n.start + n.length);
    const oldEnd = Math.max(start + ticks(column.duration), ...ends);
    const written = writeOver(clip, start, [{ ...column, duration }], oldEnd);
    return written ? normalize(written) : clip;
  }
  const [from, to] = selectedRange(selection);
  const first = placeOf(clip, from);
  const last = placeOf(clip, to);
  const columns: Column[] = [];
  for (let i = from; i <= to; i++) {
    const column = columnAt(clip, { ...placeOf(clip, i), string: 0 })!;
    if (column.duration.tuplet) return clip;
    columns.push(column.grace || isRest(column) ? column : { ...column, duration: change(column.duration) ?? column.duration });
  }
  const start = timeOf(clip, first.bar, first.column);
  const lastColumn = clip.bars[last.bar].columns[last.column];
  const oldEnd = timeOf(clip, last.bar, last.column) + (lastColumn.grace ? 0 : ticks(lastColumn.duration));
  const written = writeOver(clip, start, columns, oldEnd);
  return written ? normalize(written) : clip;
}

/** Whether every target column is a rest (not a grace note). */
function onlyRests(clip: Part, { cursor, selection }: Target): boolean {
  if (!selection) {
    const column = columnAt(clip, cursor);
    return !!column && !column.grace && isRest(column);
  }
  const [from, to] = selectedRange(selection);
  for (let i = from; i <= to; i++) {
    const column = columnAt(clip, { ...placeOf(clip, i), string: 0 });
    if (!column || column.grace || !isRest(column)) return false;
  }
  return true;
}

/** Puts the target columns under an octave line, or takes it away with null: the Octave line button's panel. */
export function setOttava(clip: Part, target: Target, ottava: Ottava | null): Part {
  return changeColumns(clip, target, c => (ottava ? { ...c, ottava } : without(c, 'ottava')));
}

/** Tremolo picks the target columns as fast as `value`; the same speed again stops it. */
export function setTremolo(clip: Part, target: Target, value: TremoloValue): Part {
  const on = columnAt(clip, target.cursor)?.tremolo !== value;
  return changeColumns(clip, target, column => (on ? { ...column, tremolo: value } : without(column, 'tremolo')));
}

/** Steps the target columns' tremolo picking through eighths, sixteenths, thirty-seconds and none. */
export function cycleTremolo(clip: Part, target: Target): Part {
  const now = columnAt(clip, target.cursor)?.tremolo;
  const next = now === undefined ? TREMOLO_VALUES[0] : TREMOLO_VALUES[TREMOLO_VALUES.indexOf(now) + 1];
  return changeColumns(clip, target, column => (next ? { ...column, tremolo: next } : without(column, 'tremolo')));
}

/** Puts a whammy bar (its points) on the target columns, or takes it away with null: the Whammy bar button's panel. */
export function setWhammy(clip: Part, target: Target, points: readonly number[] | null): Part {
  return changeColumns(clip, target, c => (points ? { ...c, whammy: [...points] } : without(c, 'whammy')));
}

/** The wah on the target columns, stepping from the cursor column's: closed, open, then off. */
export function cycleWah(clip: Part, target: Target): Part {
  const now = columnAt(clip, target.cursor)?.wah;
  const next = now === undefined ? 'closed' : now === 'closed' ? 'open' : undefined;
  return changeColumns(clip, target, column => {
    const rest = without(column, 'wah');
    return next ? { ...rest, wah: next } : rest;
  });
}

/** A pick or strum stroke on the target columns; the same stroke again clears it. */
export function toggleStroke(clip: Part, target: Target, stroke: 'down' | 'up'): Part {
  const on = columnAt(clip, target.cursor)?.stroke !== stroke;
  return changeColumns(clip, target, column => {
    const rest = without(column, 'stroke');
    return on ? { ...rest, stroke } : rest;
  });
}

/* — note marks — */

/**
 * Which written notes of a Tie chain a mark put on the chain goes on (spec Q5): palm mute, let ring and
 * vibrato on every one, slide out on the last, every other mark (the attack marks, a bend) on the first.
 */
type Reach = 'first' | 'last' | 'every';

/** The places of the cursor's note a mark reaches: one Tied note picked alone (Alt+press) is its own. */
function reachOf(clip: Part, { cursor, alone }: Target, reach: Reach): Cursor[] {
  if (alone) return [cursor];
  const places = chainPlaces(clip, cursor).map(p => ({ ...p, string: cursor.string }));
  if (places.length === 0) return [];
  return reach === 'every' ? places : reach === 'last' ? [places[places.length - 1]] : [places[0]];
}

/** How far along a Tie chain each note mark goes. */
const MARK_REACH: Partial<Record<MarkName, Reach>> = { vibrato: 'every', palmMute: 'every', letRing: 'every', slideOut: 'last' };

/**
 * Changes the notes a note mark applies to: with a selection every note in its columns, else the
 * cursor's note, along its Tie chain as far as `reach` says. Returns the clip unchanged when there is no
 * note to mark.
 */
function changeNotes(clip: Part, target: Target, change: (note: Note, before: Note | null) => Note, reach: Reach = 'first'): Part {
  const { cursor, selection } = target;
  if (!selection) {
    if (!noteAt(clip, cursor)) return clip;
    const changed = reachOf(clip, target, reach).reduce((next, at) => {
      const before = noteBefore(next, at);
      return withColumn(next, at, column => ({
        ...column,
        notes: column.notes.map((n, s) => (s === at.string && n ? change(n, before) : n)),
      }));
    }, clip);
    return normalize(changed);
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
function targetNotes(clip: Part, target: Target, reach: Reach = 'first'): Note[] {
  const { selection } = target;
  if (!selection) return reachOf(clip, target, reach).map(at => noteAt(clip, at)).filter(n => n !== null);
  const [from, to] = selectedRange(selection);
  const notes: Note[] = [];
  for (let i = from; i <= to; i++) {
    const { bar, column } = placeOf(clip, i);
    for (const n of clip.bars[bar].columns[column]?.notes ?? []) if (n) notes.push(n);
  }
  return notes;
}

/** Marks a note carries that are on or off (true), or one of a few kinds. */
type NoteMarks = Required<Pick<Note, 'vibrato' | 'harmonic' | 'tap' | 'palmMute' | 'letRing' | 'ghost' | 'accent' | 'staccato' | 'mordent' | 'slideOut'>>;
export type MarkName = keyof NoteMarks;
/** A mark and one of its kinds: ['vibrato', 'wide'], ['palmMute', true]. */
export type MarkKind = { [K in MarkName]: [K, NoteMarks[K]] }[MarkName];

function withMark(note: Note, mark: MarkName, value: NoteMarks[MarkName] | undefined): Note {
  const n: Note = { ...note };
  delete n[mark];
  return value === undefined ? n : { ...n, [mark]: value };
}

/** Sets a mark on the target notes, or clears it when they all have that kind already. */
export function setMark(clip: Part, target: Target, [mark, value]: MarkKind): Part {
  const reach = MARK_REACH[mark];
  const off = targetNotes(clip, target, reach).every(n => n[mark] === value);
  return changeNotes(clip, target, note => withMark(note, mark, off ? undefined : value), reach);
}

/**
 * Steps a mark through its kinds, then off, for the keys that do (V: vibrato, then wide). The next
 * kind is the one after the cursor note's, and every target note gets it.
 */
export function cycleMark<K extends MarkName>(clip: Part, target: Target, mark: K, kinds: NoteMarks[K][]): Part {
  const reach = MARK_REACH[mark];
  const note = targetNotes(clip, target, reach)[0];
  if (!note) return clip;
  const next = kinds[kinds.indexOf(note[mark] as NoteMarks[K]) + 1];
  return changeNotes(clip, target, n => withMark(n, mark, next), reach);
}

/**
 * The clip without one drawn mark (a picked mark's Delete, issue #128): from its note, or from every
 * note of its column for a mark drawn over the column; a tuplet is taken away (`untuplet`). The notes stay.
 */
export function removeMark(clip: Part, hit: MarkHit): Part {
  const { bar, column } = placeOf(clip, hit.index);
  const cursor = { bar, column, string: hit.string ?? 0 };
  // A mark drawn on one written note is that note's own, a Tied note's too.
  const note: Target = { cursor, selection: null, alone: true };
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
    case 'artificial': return changeNotes(clip, wholeColumn, n => (n.harmonic === 'artificial' ? without(without(n, 'harmonic'), 'harmonicFret') : n));
    case 'accent': return changeNotes(clip, wholeColumn, n => without(n, 'accent'));
    case 'staccato': return changeNotes(clip, wholeColumn, n => without(n, 'staccato'));
    case 'mordent': return changeNotes(clip, wholeColumn, n => without(n, 'mordent'));
    case 'stroke': return changeColumns(clip, wholeColumn, c => without(c, 'stroke'));
    case 'wah': return changeColumns(clip, wholeColumn, c => without(c, 'wah'));
    case 'whammy': return changeColumns(clip, wholeColumn, c => without(c, 'whammy'));
    case 'fermata': return changeColumns(clip, wholeColumn, c => without(c, 'fermata'));
    case 'tremolo': return changeColumns(clip, wholeColumn, c => without(c, 'tremolo'));
    case 'tuplet': {
      // The tuplet goes and its notes are laid out again, plain (step 6, Q4).
      const plain = untuplet(clip, cursor);
      return isProblem(plain) ? clip : plain;
    }
    case 'ottava': return changeColumns(clip, wholeColumn, c => without(c, 'ottava'));
    case 'hairpin': return changeColumns(clip, wholeColumn, c => without(c, 'hairpin'));
  }
}

/** A hammer-on or pull-off from the note before (named by the frets), or off again. */
export function toggleLegato(clip: Part, target: Target): Part {
  const on = !targetNotes(clip, target).every(n => n.legato);
  return changeNotes(clip, target, (note, before) => {
    const rest = without(note, 'legato');
    return on && before ? { ...rest, legato: 'h' } : rest;
  });
}

/** Sets a slide on the target notes, or clears it when they all have that one. */
export function setSlide(clip: Part, target: Target, slide: Slide): Part {
  const off = targetNotes(clip, target).every(n => n.slide === slide);
  return changeNotes(clip, target, note => {
    const rest = without(note, 'slide');
    return off ? rest : { ...rest, slide };
  });
}

/** The order "/" steps through; slides from the note before are skipped when there is none. */
const SLIDE_CYCLE: (Slide | undefined)[] = ['legato', 'shift', 'below', 'above', undefined];

/** The cursor note's next slide kind, for the "/" key. */
export function cycleSlide(clip: Part, cursor: Cursor): Part {
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
export function setBend(clip: Part, target: Target, quarters: BendQuarters | null): Part {
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
export function cycleBend(clip: Part, target: Target): Part {
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
export function toggleBendPart(clip: Part, target: Target, part: 'pre' | 'release'): Part {
  const on = !targetNotes(clip, target).every(n => n.bend?.[part]);
  return changeNotes(clip, target, note => {
    const bend = note.bend ?? { quarters: 4 as BendQuarters, pre: false, release: false };
    const quarters = part === 'pre' && on && bend.quarters === 1 ? 2 : bend.quarters;
    return { ...note, bend: { ...bend, quarters, [part]: on } };
  });
}

/** The cursor note's next bend shape, for Shift+B: release, pre-bend, pre-bend and release, plain. */
export function cycleBendShape(clip: Part, cursor: Cursor): Part {
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
