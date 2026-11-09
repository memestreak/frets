/**
 * Spans (`docs/specs/2026-11-04-tab-pick-every-mark-design.md`): the Marks drawn as one line or wave
 * over neighbouring columns that have them (let ring, P.M., vibrato, octave lines, hairpins). Which
 * columns a Span covers, and moving its ends, as its Handles and Alt+Shift+← → do. Pure.
 */
import { STRING_COUNT, type Column, type Note, type Part } from './clip';
import { normalize, placeOf } from './editing';
import type { MarkHit } from './marks';

export type SpanMark = 'letRing' | 'palmMute' | 'vibrato' | 'ottava' | 'hairpin';
export const SPAN_MARKS: readonly SpanMark[] = ['letRing', 'palmMute', 'vibrato', 'ottava', 'hairpin'];

export function isSpan(mark: string): mark is SpanMark {
  return (SPAN_MARKS as readonly string[]).includes(mark);
}

/** Spans stored on notes stop at a rest; those stored on columns (octave lines, hairpins) can cover rests. */
export function onNotes(mark: SpanMark): boolean {
  return mark === 'letRing' || mark === 'palmMute' || mark === 'vibrato';
}

/**
 * The kind of a Span's Mark a column has, or null: neighbouring columns of one kind are one Span. A
 * vibrato is wide where any note's is (as `vibratoRuns` draws it).
 */
export function spanKind(column: Column | undefined, mark: SpanMark): string | null {
  if (!column) return null;
  const notes = column.notes.filter((n): n is Note => n !== null);
  switch (mark) {
    case 'letRing': return notes.some(n => n.letRing) ? 'on' : null;
    case 'palmMute': return notes.some(n => n.palmMute) ? 'on' : null;
    case 'vibrato': return notes.some(n => n.vibrato === 'wide') ? 'wide' : notes.some(n => n.vibrato) ? 'slight' : null;
    case 'ottava': return column.ottava ?? null;
    case 'hairpin': return column.hairpin ?? null;
  }
}

/** The places in the clip of the Span round `index`: across bars and lines of tab, as far as its kind goes. */
export function spanAround(columns: readonly (Column | undefined)[], mark: SpanMark, index: number): [number, number] {
  const kind = spanKind(columns[index], mark);
  if (kind === null) return [index, index];
  let from = index;
  let to = index;
  while (from > 0 && spanKind(columns[from - 1], mark) === kind) from--;
  while (to < columns.length - 1 && spanKind(columns[to + 1], mark) === kind) to++;
  return [from, to];
}

function columnsOf(clip: Part): Column[] {
  return clip.bars.flatMap(b => b.columns);
}

/** Whether column `i` continues a Tie chain from column `i - 1`: a Tied note on a string the one before has a note on. */
function tiedFromBefore(columns: readonly Column[], i: number): boolean {
  const here = columns[i];
  const before = columns[i - 1];
  if (!here || !before) return false;
  return here.notes.some((n, s) => n?.tie && before.notes[s]);
}

/**
 * Where a Span's ends may go: `from` and `to` kept in the clip and in order, at least one column; a Span
 * on notes stops before a rest; neither end goes into another Span of the same Mark but another kind
 * (one of the same kind joins); and a Tie chain is never split, so an end inside one goes to its edge.
 */
export function clampSpan(clip: Part, mark: SpanMark, kind: string, [oldFrom, oldTo]: [number, number], [from, to]: [number, number]): [number, number] {
  const columns = columnsOf(clip);
  const open = (i: number) => {
    const column = columns[i];
    if (!column) return false;
    if (onNotes(mark) && !column.notes.some(n => n !== null)) return false;
    const other = spanKind(column, mark);
    return other === null || other === kind;
  };
  // Grow from the old ends one column at a time, stopping where a column can't take it; shrink no further than the other end.
  let f = Math.min(from, oldTo);
  if (from < oldFrom) {
    f = oldFrom;
    while (f > Math.max(from, 0) && open(f - 1)) f--;
  }
  let t = Math.max(to, oldFrom);
  if (to > oldTo) {
    t = oldTo;
    while (t < Math.min(to, columns.length - 1) && open(t + 1)) t++;
  }
  // A Tie chain stays whole: the start goes back to its first note, the end on to its last.
  while (f > 0 && tiedFromBefore(columns, f) && open(f - 1)) f--;
  while (t < columns.length - 1 && tiedFromBefore(columns, t + 1) && open(t + 1)) t++;
  return [f, Math.max(f, t)];
}

/** A column with a Span's Mark of `kind`, or without it (`kind` null). */
function withKind(column: Column, mark: SpanMark, kind: string | null): Column {
  if (mark === 'ottava' || mark === 'hairpin') {
    const rest = { ...column };
    delete rest[mark];
    return kind === null ? rest : { ...rest, [mark]: kind };
  }
  return {
    ...column,
    notes: column.notes.map(note => {
      if (!note) return null;
      const rest = { ...note };
      delete rest[mark];
      if (kind === null) return rest;
      return mark === 'vibrato' ? { ...rest, vibrato: kind as Note['vibrato'] } : { ...rest, [mark]: true };
    }),
  };
}

/**
 * The clip with a Span moved from covering `old` to covering `next` (already clamped): columns it now
 * takes in get its kind on every note (or the column), columns it leaves lose it. The notes stay.
 */
export function moveSpan(clip: Part, mark: SpanMark, old: [number, number], next: [number, number]): Part {
  const columns = columnsOf(clip);
  const kind = spanKind(columns[old[0]], mark);
  if (kind === null || (old[0] === next[0] && old[1] === next[1])) return clip;
  let index = 0;
  const bars = clip.bars.map(bar => ({
    ...bar,
    columns: bar.columns.map(column => {
      const i = index++;
      const inOld = i >= old[0] && i <= old[1];
      const inNext = i >= next[0] && i <= next[1];
      if (inNext && !inOld) return withKind(column, mark, kind);
      if (inOld && !inNext) return withKind(column, mark, null);
      return column;
    }),
  }));
  return normalize({ ...clip, bars });
}

/** The column a place in the clip is, for callers holding a flat index. */
export function spanColumns(clip: Part): Column[] {
  return columnsOf(clip);
}

/** The first string with a note in a column at `index`, for the cursor, or 0. */
export function firstString(clip: Part, index: number): number {
  const { bar, column } = placeOf(clip, index);
  const notes = clip.bars[bar]?.columns[column]?.notes ?? [];
  const s = notes.findIndex(n => n !== null);
  return s === -1 ? 0 : Math.min(s, STRING_COUNT - 1);
}

/**
 * The Span a palette press just put on (let ring, P.M.), to pick it so it can be dragged to the length
 * wanted (Jeremy, 2026-11-09): the Span round `at`, the first column the press acted on. Null when the
 * press took the Mark away or changed nothing.
 */
export function addedSpan(before: Part, after: Part, mark: SpanMark, at: number): MarkHit | null {
  if (before === after) return null;
  const columns = columnsOf(after);
  if (spanKind(columns[at], mark) === null) return null;
  const [from, to] = spanAround(columns, mark, at);
  return { kind: 'mark', mark, index: from, to, string: null };
}
