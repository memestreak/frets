/**
 * Tuplets and grace notes that keep bars full (`docs/specs/2026-11-04-tab-tuplets-grace-rest-design.md`):
 * a tuplet over one note's time, a selection squeezed into one, a tuplet taken away, a note's length
 * changed or typed inside one, and a grace note added before a note. A tuplet is still a mark on each
 * of its Columns (alphaTex `{tu n}`), a grace note a Column that takes no time (`{gr}`). Pure; no React.
 */
import {
  STRING_COUNT, ticks, tupletGroups, TUPLET_SPANS,
  type Bar, type Column, type Duration, type NoteValue, type Part,
} from './clip';
import { columnAt, emptyColumn, normalize, placeOf, replaceBar, selectedRange, without, type Cursor, type Target } from './editing';
import { chainDuration, chainTicks, lengthAnchor, type Place } from './ties';
import { graceValues, isBareRest, tupletKind as kindOf, tupletRests } from './sounding';
import { SPLITS_TUPLET, timeOf, writeOver } from './timeline';
import { unbeamed } from './beams';

/* — what the page says when a tuplet can't be made — */

export const TUPLET_NEEDS_PLAIN = 'A tuplet goes on a note without a dot.';
export const TUPLET_TOO_SHORT = "That tuplet's notes would be shorter than a sixty-fourth.";
export const TUPLET_ALREADY = 'Take the tuplet away first: these notes are in one already.';
export const TUPLET_CANT_WRITE = "Those notes can't be written in that tuplet.";

/** An edit that may be refused: the Part, or the sentence the line under the clip says. */
export type Edited = Part | { problem: string };

export function isProblem(edited: Edited): edited is { problem: string } {
  return 'problem' in edited;
}

/* — tuplet groups — */

/** One tuplet group of a bar: its Columns' places in the bar (grace notes inside it included) and its time. */
export interface TupletGroup {
  bar: number;
  /** The bar's Column index of its first and last Column. */
  from: number;
  to: number;
  /** Where it starts in the Part, and how long it is, in ticks. */
  start: number;
  length: number;
  /** Its kind, as each of its Columns has it. */
  duration: Duration;
}

/** The tuplet group the Column at `place` is in, or null when it is in none. */
export function groupAt(part: Part, place: Place): TupletGroup | null {
  return groupsOf(part, place.bar).find(g => place.column >= g.from && place.column <= g.to) ?? null;
}

/** Every tuplet group of a bar. */
export function groupsOf(part: Part, b: number): TupletGroup[] {
  const bar = part.bars[b];
  if (!bar) return [];
  const timed = bar.columns.flatMap((c, k) => (c.grace ? [] : [k]));
  return tupletGroups(timed.map(k => bar.columns[k])).map(g => {
    const from = timed[g.from];
    const to = timed[g.to];
    const length = bar.columns.slice(from, to + 1).reduce((sum, c) => sum + (c.grace ? 0 : ticks(c.duration)), 0);
    return { bar: b, from, to, start: timeOf(part, b, from), length, duration: g.duration };
  });
}

/** The length of one tuplet note's place in a group: its time over its count (a triplet over a quarter, a triplet eighth). */
export function tupletUnit(group: Pick<TupletGroup, 'length' | 'duration'>): number {
  return group.length / (group.duration.tuplet ?? 1);
}

/* — grace notes — */

/** The Part with bar `b`'s grace notes written by their count. */
function withGraceValues(part: Part, b: number): Part {
  const bar = part.bars[b];
  return replaceBar(part, b, { ...bar, columns: graceValues(bar.columns) });
}

/**
 * `/` in normal mode (spec Q8): a grace note before the picked note, at the same fret, moving nothing.
 * Only the cursor's string gets one, or with `wholeColumn` every note of the Column (a grace chord). On a
 * grace note, another before it. Returns the Part and the cursor on the new grace note; null on a rest.
 */
export function addGrace(part: Part, cursor: Cursor, wholeColumn: boolean): { clip: Part; cursor: Cursor } | null {
  const column = columnAt(part, cursor);
  if (!column || !column.notes.some(Boolean)) return null;
  const strings = wholeColumn ? column.notes.map((_n, s) => s) : [cursor.string];
  if (!strings.some(s => column.notes[s])) return null;
  const notes = column.notes.map((note, s) => (note && strings.includes(s) ? { fret: note.fret } : null));
  const grace: Column = { duration: { value: 8, dots: 0 }, notes, grace: 'before' };
  const bar = part.bars[cursor.bar];
  const columns = [...bar.columns];
  columns.splice(cursor.column, 0, grace);
  const clip = withGraceValues(normalize(replaceBar(part, cursor.bar, { ...bar, columns })), cursor.bar);
  return { clip, cursor };
}

/**
 * Grace entry's typed fret (spec Q11): a grace note on the cursor's string before the Column at the
 * cursor, after any grace notes already there. The cursor stays on that Column, now one place on.
 */
export function enterGrace(part: Part, cursor: Cursor, fret: number): { clip: Part; cursor: Cursor } {
  const bar = part.bars[cursor.bar];
  const notes = Array(STRING_COUNT).fill(null).map((_n, s) => (s === cursor.string ? { fret } : null));
  const columns = [...bar.columns];
  columns.splice(cursor.column, 0, { duration: { value: 8, dots: 0 }, notes, grace: 'before' });
  const clip = withGraceValues(normalize(replaceBar(part, cursor.bar, { ...bar, columns })), cursor.bar);
  return { clip, cursor: { ...cursor, column: cursor.column + 1 } };
}

/** Delete (or `,`) on a picked grace note: it goes, leaving no Gap (spec Q10). */
export function removeGrace(part: Part, place: Place): Part {
  const bar = part.bars[place.bar];
  if (!bar.columns[place.column]?.grace) return part;
  const columns = bar.columns.filter((_c, k) => k !== place.column);
  return withGraceValues(normalize(replaceBar(part, place.bar, { ...bar, columns })), place.bar);
}

/* — tuplets in normal mode — */

/** The tuplet of `n` with its usual span. */
function kindFor(n: number): Pick<Duration, 'tuplet'> {
  return { tuplet: n };
}

/**
 * A tuplet of `n` over one picked note's time (spec Q1): the note becomes its first note and the rest is
 * a Gap in it. A triplet splits the value in halves, 5–7 in quarters, 9–12 in eighths.
 */
export function tupletOver(part: Part, cursor: Cursor, n: number): Edited {
  const anchor = lengthAnchor(part, cursor);
  if (!anchor) return part;
  const column = columnAt(part, anchor)!;
  const span = chainDuration(part, anchor);
  if (!span || span.dots > 0) return { problem: TUPLET_NEEDS_PLAIN };
  const value = span.value * (TUPLET_SPANS[n] ?? 1);
  if (value > 64) return { problem: TUPLET_TOO_SHORT };
  const unit: Duration = { value: value as NoteValue, dots: 0, ...kindFor(n) };
  const rests = tupletRests(ticks(unit) * (n - 1), kindFor(n));
  if (!rests) return { problem: TUPLET_CANT_WRITE };
  const start = timeOf(part, anchor.bar, anchor.column);
  const columns = [{ ...unbeamed(column), duration: unit }, ...rests.map(emptyColumn)];
  const written = writeOver(part, start, columns, start + chainTicks(part, anchor));
  return written ? normalize(written) : { problem: SPLITS_TUPLET };
}

/**
 * The selected Columns squeezed into a tuplet of `n` (spec Q2), as Dorico's "turn notes into a tuplet":
 * each keeps its written value, n in the time of the tuplet's span, counted in the shortest of them; a
 * last tuplet they don't fill ends in a Gap inside it. Longer than the selection it writes over what
 * follows; shorter, it leaves a Gap.
 */
export function squeezeTuplet(part: Part, from: number, to: number, n: number): Edited {
  const columns: Column[] = [];
  for (let i = from; i <= to; i++) columns.push(columnAt(part, { ...placeOf(part, i), string: 0 })!);
  const timed = columns.filter(c => !c.grace);
  if (timed.length === 0) return part;
  if (timed.some(c => c.duration.tuplet)) return { problem: TUPLET_ALREADY };
  const kind = kindFor(n);
  const plain = (c: Column) => ticks({ value: c.duration.value, dots: c.duration.dots });
  const shortest = Math.min(...timed.map(plain));
  const squeezed = columns.map(c => (c.grace ? c : { ...unbeamed(c), duration: { ...c.duration, ...kind } }));
  const length = squeezed.reduce((sum, c) => sum + (c.grace ? 0 : ticks(c.duration)), 0);
  const group = (shortest * (TUPLET_SPANS[n] ?? 1));
  const filled = Math.ceil(length / group - 1e-9) * group;
  const pad = filled - length;
  const rests = pad > 0 ? tupletRests(pad, kind) : [];
  if (!rests || squeezed.some(c => !Number.isInteger(ticks(c.duration)))) return { problem: TUPLET_CANT_WRITE };
  const first = placeOf(part, from);
  const last = placeOf(part, to);
  const start = timeOf(part, first.bar, first.column);
  const lastColumn = part.bars[last.bar].columns[last.column];
  const end = timeOf(part, last.bar, last.column) + (lastColumn.grace ? 0 : ticks(lastColumn.duration));
  const written = writeOver(part, start, [...squeezed, ...rests.map(emptyColumn)], end);
  return written ? normalize(written) : { problem: SPLITS_TUPLET };
}

/**
 * The tuplet at `place` taken away (spec Q4): its notes keep their written values, plain, laid out
 * again from its start; a Gap at its end is dropped, so shorter leaves a Gap and longer writes over.
 */
export function untuplet(part: Part, place: Place): Edited {
  const group = groupAt(part, place);
  if (!group) return part;
  const bar = part.bars[group.bar];
  const columns = bar.columns.slice(group.from, group.to + 1).map(c => (c.grace ? c : { ...unbeamed(c), duration: without(without(c.duration, 'tuplet'), 'tupletSpan') }));
  while (columns.length > 0 && isBareRest(columns[columns.length - 1])) columns.pop();
  const written = writeOver(part, group.start, columns, group.start + group.length);
  return written ? normalize(written) : { problem: SPLITS_TUPLET };
}

/**
 * A tuplet picked from the Tuplet panel (`;`) in normal mode, or None (null): on a note in a tuplet,
 * the same kind or None takes it away and another kind is refused; on a selection of several Columns
 * the notes are squeezed into it; on one note, the tuplet takes its time.
 */
export function applyTuplet(part: Part, target: Target, n: number | null): Edited {
  const { cursor, selection } = target;
  const lone = !selection || selection.anchor === selection.focus;
  const pressed = lone && selection ? { ...cursor, ...placeOf(part, selection.anchor) } : cursor;
  const inGroup = lone ? groupAt(part, pressed) : null;
  if (inGroup) {
    if (n === null || (inGroup.duration.tuplet === n && !inGroup.duration.tupletSpan)) return untuplet(part, pressed);
    return { problem: TUPLET_ALREADY };
  }
  if (n === null) {
    if (lone) return part;
    // None on a selection takes away every tuplet that starts in it.
    const [from, to] = selectedRange(selection!);
    let next = part;
    for (let i = to; i >= from; i--) {
      const place = placeOf(part, i);
      const group = groupAt(part, place);
      if (group && group.from === place.column) {
        const edited = untuplet(next, place);
        if (isProblem(edited)) return edited;
        next = edited;
      }
    }
    return next;
  }
  if (!lone) {
    const [from, to] = selectedRange(selection!);
    return squeezeTuplet(part, from, to, n);
  }
  const column = columnAt(part, pressed);
  if (!column || column.grace || !column.notes.some(Boolean)) return part;
  return tupletOver(part, pressed, n);
}

/* — inside a tuplet — */

/**
 * The tuplet group's Columns with `column` written from `at` ticks into it (spec Q5, Q6, Q7): what it
 * covers goes, a Column it covers part of leaves its uncovered time as tuplet rests, and a Column it
 * shortens leaves its time as tuplet rests. Null when it runs past the tuplet's end or can't be written.
 */
function writeInGroup(columns: Column[], at: number, column: Column, groupLength: number): Column[] | null {
  const length = ticks(column.duration);
  const end = at + length;
  if (end > groupLength || !Number.isInteger(length)) return null;
  const kind = kindOf(column.duration);
  const out: Column[] = [];
  let t = 0;
  let placed = false;
  const restsFor = (span: number) => tupletRests(span, kind);
  for (const c of columns) {
    if (c.grace) {
      // Grace notes before the written note stay before it; those inside what it covers go.
      if (t < at || (t === at && !placed) || t >= end) out.push(c);
      continue;
    }
    const span = ticks(c.duration);
    const cEnd = t + span;
    if (cEnd <= at || t >= end) {
      if (t >= end && !placed) return null;
      out.push(c);
    } else {
      if (t < at) {
        const head = restsFor(at - t);
        if (!head) return null;
        // A note cut short keeps its start: its head is a note, written in the tuplet's values.
        if (c.notes.some(Boolean)) {
          if (head.length !== 1) return null;
          out.push({ ...c, duration: head[0] });
        } else out.push(...head.map(emptyColumn));
      }
      if (!placed) {
        out.push(column);
        placed = true;
      }
      if (cEnd > end) {
        const tail = restsFor(cEnd - end);
        if (!tail) return null;
        out.push(...tail.map(emptyColumn));
      }
    }
    t = cEnd;
  }
  return placed ? out : null;
}

/** The Part with tuplet group `group`'s Columns replaced. */
function withGroup(part: Part, group: TupletGroup, columns: Column[]): Part {
  const bar: Bar = part.bars[group.bar];
  const next = [...bar.columns];
  next.splice(group.from, group.to - group.from + 1, ...columns);
  return normalize(replaceBar(part, group.bar, { ...bar, columns: next }));
}

/**
 * A length key on a note in a tuplet (spec Q5): within the tuplet only. Longer writes over its later
 * notes, and changes nothing when there isn't room before its end; shorter leaves a Gap in it.
 */
export function lengthInTuplet(part: Part, place: Place, duration: Duration): Part {
  const group = groupAt(part, place);
  if (!group) return part;
  const bar = part.bars[group.bar];
  const columns = bar.columns.slice(group.from, group.to + 1);
  const k = place.column - group.from;
  const column = columns[k];
  const at = columns.slice(0, k).reduce((sum, c) => sum + (c.grace ? 0 : ticks(c.duration)), 0);
  const written: Column = { ...unbeamed(column), duration: { ...duration, ...kindOf(group.duration) } };
  const oldEnd = at + ticks(column.duration);
  // Shorter: the note's own time is cut, its end becomes tuplet rests.
  const replaced = ticks(written.duration) < ticks(column.duration)
    ? shortened(columns, k, written, oldEnd - at)
    : writeInGroup(columns, at, written, group.length);
  return replaced ? withGroup(part, group, replaced) : part;
}

/** The group's Columns with Column `k` made shorter, the time it leaves as tuplet rests. */
function shortened(columns: Column[], k: number, written: Column, old: number): Column[] | null {
  const rests = tupletRests(old - ticks(written.duration), kindOf(written.duration));
  if (!rests) return null;
  return [...columns.slice(0, k), written, ...rests.map(emptyColumn), ...columns.slice(k + 1)];
}

/**
 * A fret typed in a tuplet's Gap in note input (spec Q7): a tuplet note of `length` in the tuplet's ratio,
 * `at` ticks into the Column at `cursor`. With no fret (`,`, spec Q12) a Gap that long. Null when it
 * doesn't fit before the tuplet's end.
 */
export function typeInTuplet(part: Part, cursor: Cursor, at: number, fret: number | null, length: Duration): { clip: Part; cursor: Cursor } | null {
  const group = groupAt(part, cursor);
  if (!group) return null;
  const bar = part.bars[group.bar];
  const columns = bar.columns.slice(group.from, group.to + 1);
  const k = cursor.column - group.from;
  const from = columns.slice(0, k).reduce((sum, c) => sum + (c.grace ? 0 : ticks(c.duration)), 0) + at;
  const notes = Array(STRING_COUNT).fill(null).map((_n, s) => (s === cursor.string && fret !== null ? { fret } : null));
  const column: Column = { duration: { value: length.value, dots: length.dots, ...kindOf(group.duration) }, notes };
  const replaced = writeInGroup(columns, from, column, group.length);
  if (!replaced) return null;
  const clip = withGroup(part, group, replaced);
  // The cursor on the new note: count the group's Columns up to its time.
  let t = 0;
  let index = group.from;
  for (const c of replaced) {
    if (!c.grace && t === from && c === column) break;
    if (!c.grace) t += ticks(c.duration);
    index++;
  }
  return { clip, cursor: { ...cursor, column: index } };
}

/**
 * Tuplet entry's first note (spec Q6): a tuplet of `n` whose notes are `length`, started at time `start`
 * (where Tuplet entry's rest began, or the cursor), its note `offset` tuplet notes in. Written over what
 * is there. Returns the Part and the time of the note.
 */
export function startTuplet(part: Part, start: number, offset: number, n: number, length: Duration, string: number, fret: number): Edited {
  const kind = kindFor(n);
  const unit: Duration = { value: length.value, dots: length.dots, ...kind };
  const notes = Array(STRING_COUNT).fill(null).map((_n, s) => (s === string ? { fret } : null));
  const unitTicks = ticks(unit);
  if (!Number.isInteger(unitTicks) || offset >= n) return { problem: TUPLET_CANT_WRITE };
  const before = offset > 0 ? tupletRests(unitTicks * offset, kind) : [];
  const after = tupletRests(unitTicks * (n - 1 - offset), kind);
  if (!before || !after) return { problem: TUPLET_CANT_WRITE };
  const columns = [...before.map(emptyColumn), { duration: unit, notes }, ...after.map(emptyColumn)];
  const written = writeOver(part, start, columns, start + unitTicks * n);
  return written ? normalize(written) : { problem: SPLITS_TUPLET };
}

/** The tuplet's span in ticks for `n` notes of `length`: what Tuplet entry starts. */
export function tupletSpanTicks(n: number, length: Duration): number {
  return ticks({ value: length.value, dots: length.dots, tuplet: n }) * n;
}

/** Whether a Column is a rest inside a tuplet: note input's grid stops at each tuplet note in it (spec Q7). */
export function isTupletRest(column: Column | undefined): boolean {
  return !!column && !column.grace && !!column.duration.tuplet && !column.notes.some(Boolean);
}

