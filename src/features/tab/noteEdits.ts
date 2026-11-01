/**
 * What the palette's tools and their keys change on the target (the selection, else the cursor's note
 * or column): rhythm, tuplets, grace notes, technique marks, joins and bends. Pure: each returns a new
 * clip. See `docs/specs/2026-10-25-tab-editing-design.md`.
 */

import type { MarkHit } from './marks';
import { BEND_QUARTERS, NOTE_VALUES, SHORTEST_DOTTED, STRING_COUNT, TREMOLO_VALUES, type BendQuarters, type Part, type Duration, type Note, type Ottava, type Slide, type TremoloValue } from './clip';
import { type Cursor, type Target, changeColumns, columnAt, emptyColumn, normalize, noteAt, noteBefore, placeOf, selectedRange, withColumn, without } from './editing';

/** Makes the target columns rests. */
export function makeRest(clip: Part, target: Target): Part {
  return changeColumns(clip, target, column => ({ ...emptyColumn(column.duration), ...(column.extra ? { extra: column.extra } : {}) }));
}

/**
 * A longer (+1) or shorter (−1) note value for the target columns, from a whole to a sixty-fourth.
 * A sixty-fourth takes no dots, so its dots go.
 */
export function stepDuration(clip: Part, target: Target, step: 1 | -1): Part {
  return changeColumns(clip, target, column => {
    const i = NOTE_VALUES.indexOf(column.duration.value);
    const value = NOTE_VALUES[Math.min(NOTE_VALUES.length - 1, Math.max(0, i - step))];
    return { ...column, duration: { ...column.duration, value, dots: value > SHORTEST_DOTTED ? 0 : column.duration.dots } };
  });
}

/** Sets the note value of the target columns. */
export function setValue(clip: Part, target: Target, value: Duration['value']): Part {
  return changeColumns(clip, target, column => ({
    ...column,
    duration: { ...column.duration, value, dots: value > SHORTEST_DOTTED ? 0 : column.duration.dots },
  }));
}

/** Cycles none, one dot, two dots on the target columns (a sixty-fourth takes none). */
export function cycleDots(clip: Part, target: Target): Part {
  return changeColumns(clip, target, column => {
    const { duration } = column;
    const dots = duration.value > SHORTEST_DOTTED ? 0 : ((duration.dots + 1) % 3) as Duration['dots'];
    return { ...column, duration: { ...duration, dots } };
  });
}

/** Puts the target columns in one kind of tuplet (3 to 12, in its usual span), or none with null. */
/** Puts the target columns under an octave line, or takes it away with null: the Octave line button's panel. */
export function setOttava(clip: Part, target: Target, ottava: Ottava | null): Part {
  return changeColumns(clip, target, c => (ottava ? { ...c, ottava } : without(c, 'ottava')));
}

export function setTuplet(clip: Part, target: Target, tuplet: number | null): Part {
  return changeColumns(clip, target, column => {
    const plain = without(without(column.duration, 'tuplet'), 'tupletSpan');
    return { ...column, duration: tuplet ? { ...plain, tuplet } : plain };
  });
}

/** Makes the target columns one kind of tuplet (a triplet, quintuplet …); the same kind again makes them plain. */
export function toggleTuplet(clip: Part, target: Target, tuplet: number): Part {
  const now = columnAt(clip, target.cursor)?.duration;
  const on = now?.tuplet !== tuplet || now.tupletSpan !== undefined;
  return setTuplet(clip, target, on ? tuplet : null);
}

/** Makes the target columns grace notes, played just before the beat; pressed again on a grace note, plain notes. */
export function toggleGrace(clip: Part, target: Target): Part {
  const on = !columnAt(clip, target.cursor)?.grace;
  return changeColumns(clip, target, column => (on ? { ...column, grace: 'before' } : without(column, 'grace')));
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
 * Changes the notes a note mark applies to: with a selection every note in its columns, else the
 * cursor's note. Returns the clip unchanged when there is no note to mark.
 */
function changeNotes(clip: Part, { cursor, selection }: Target, change: (note: Note, before: Note | null) => Note): Part {
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
function targetNotes(clip: Part, { cursor, selection }: Target): Note[] {
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
  const off = targetNotes(clip, target).every(n => n[mark] === value);
  return changeNotes(clip, target, note => withMark(note, mark, off ? undefined : value));
}

/**
 * Steps a mark through its kinds, then off, for the keys that do (V: vibrato, then wide). The next
 * kind is the one after the cursor note's, and every target note gets it.
 */
export function cycleMark<K extends MarkName>(clip: Part, target: Target, mark: K, kinds: NoteMarks[K][]): Part {
  const note = noteAt(clip, target.cursor) ?? targetNotes(clip, target)[0];
  if (!note) return clip;
  const next = kinds[kinds.indexOf(note[mark] as NoteMarks[K]) + 1];
  return changeNotes(clip, target, n => withMark(n, mark, next));
}

/**
 * The clip without one drawn mark (a picked mark's Delete, issue #128): from its note, or from every
 * note of its column for a mark drawn over the column; a tuplet's whole group goes plain. The notes stay.
 */
export function removeMark(clip: Part, hit: MarkHit): Part {
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
    case 'artificial': return changeNotes(clip, wholeColumn, n => (n.harmonic === 'artificial' ? without(without(n, 'harmonic'), 'harmonicFret') : n));
    case 'accent': return changeNotes(clip, wholeColumn, n => without(n, 'accent'));
    case 'staccato': return changeNotes(clip, wholeColumn, n => without(n, 'staccato'));
    case 'mordent': return changeNotes(clip, wholeColumn, n => without(n, 'mordent'));
    case 'stroke': return changeColumns(clip, wholeColumn, c => without(c, 'stroke'));
    case 'wah': return changeColumns(clip, wholeColumn, c => without(c, 'wah'));
    case 'whammy': return changeColumns(clip, wholeColumn, c => without(c, 'whammy'));
    case 'fermata': return changeColumns(clip, wholeColumn, c => without(c, 'fermata'));
    case 'tremolo': return changeColumns(clip, wholeColumn, c => without(c, 'tremolo'));
    case 'tuplet': return setTuplet(clip, wholeColumn, null);
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

/** A tie to the note before on the string: the same fret, held. */
export function toggleTie(clip: Part, target: Target): Part {
  const on = !targetNotes(clip, target).every(n => n.tie);
  return changeNotes(clip, target, (note, before) => {
    const rest = without(note, 'tie');
    return on && before && before.fret !== null ? { ...rest, tie: true, fret: before.fret } : rest;
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
