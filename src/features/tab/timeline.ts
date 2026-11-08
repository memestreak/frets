/**
 * The timeline: the edits that change time, done on a Voice as one stream of timed Columns with the
 * bar lines taken out, then laid back into bars by their time signatures, so no edit makes an Uneven
 * bar (`docs/specs/2026-11-04-tab-bars-always-full-design.md`). Pure; no React.
 *
 * Three edits: write over from a time (the new Columns take the whole Voice for their time), push
 * from a time by a length, and pull back a stretch of time. Laying back splits each Column at bar
 * lines and spells every piece by the meter, a note tied on; the commit's rewrite (`rewrite.ts`)
 * then writes every bar whose rhythm changed by the meter, as for every edit.
 */
import { barLength, barSpan, barTicks, beatGroupsAt, isRest, meterOffset, partOf, STRING_COUNT, ticks, timeAt, withTrackParts, type Bar, type Clip, type Column, type OtherVoice, type Part, type TimeSignature } from './clip';
import { continuation, meterOf, readVoice, spell, writeVoice } from './sounding';

/** A stretch of a Voice's stream: one Column, a whole tuplet group, or a grace note (no time). */
interface Item {
  columns: Column[];
  length: number;
  kind: 'column' | 'tuplet' | 'grace';
}

/** Why an edit can't be made; the page says it. */
export const SPLITS_TUPLET = 'That would put a tuplet across a bar line.';

/** Column marks that last the whole Column: a piece cut from it keeps them. */
const HELD = ['tremolo', 'ottava', 'hairpin'] as const;

/** A piece of `column` after a cut: its notes tied on, keeping the marks that last the whole note and Column. */
function laterPiece(column: Column): Column {
  const piece: Column = { duration: column.duration, notes: column.notes.map(n => (n ? continuation(n) : null)) };
  for (const key of HELD) if (column[key] !== undefined) (piece as unknown as Record<string, unknown>)[key] = column[key];
  return piece;
}

function rest(length: number): Item {
  return { columns: [{ duration: { value: 4, dots: 0 }, notes: Array(STRING_COUNT).fill(null) }], length, kind: 'column' };
}

/* — streams — */

/** A bar's Columns as stream items: each Column, each tuplet group whole, an empty bar as one Gap `span` long. */
function itemsOf(columns: Column[], span: number): Item[] {
  if (columns.length === 0) return span > 0 ? [rest(span)] : [];
  const items: Item[] = [];
  let tuplet: Item | null = null;
  for (const column of columns) {
    if (column.duration.tuplet && !column.grace) {
      if (!tuplet) {
        tuplet = { columns: [], length: 0, kind: 'tuplet' };
        items.push(tuplet);
      }
      tuplet.columns.push(column);
      tuplet.length += ticks(column.duration);
      continue;
    }
    // A grace note inside a tuplet stays in it.
    if (column.grace && tuplet) {
      tuplet.columns.push(column);
      continue;
    }
    tuplet = null;
    items.push(column.grace ? { columns: [column], length: 0, kind: 'grace' } : { columns: [column], length: ticks(column.duration), kind: 'column' });
  }
  return items;
}

/** Where each item starts. */
function startsOf(items: Item[]): number[] {
  const out: number[] = [];
  let t = 0;
  for (const item of items) {
    out.push(t);
    t += item.length;
  }
  return out;
}

function lengthOf(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.length, 0);
}

/**
 * The stream with an item boundary at `t`: a Column across it is cut in two, its later piece's notes
 * tied on. Null when `t` falls inside a tuplet.
 */
function cutAt(items: Item[], t: number): Item[] | null {
  const starts = startsOf(items);
  const k = items.findIndex((item, i) => starts[i] < t && starts[i] + item.length > t);
  if (k < 0) return items;
  const item = items[k];
  if (item.kind !== 'column') return null;
  const first = t - starts[k];
  const column = item.columns[0];
  return [
    ...items.slice(0, k),
    { columns: [column], length: first, kind: 'column' },
    { columns: [laterPiece(column)], length: item.length - first, kind: 'column' },
    ...items.slice(k + 1),
  ];
}

/** The index of the first item starting at or after `t` (graces at `t` included unless `afterGraces`). */
function indexAt(items: Item[], t: number, afterGraces = false): number {
  const starts = startsOf(items);
  for (let i = 0; i < items.length; i++) {
    if (starts[i] > t) return i;
    if (starts[i] === t && !(afterGraces && items[i].kind === 'grace')) return i;
  }
  return items.length;
}

/**
 * Notes cut off at `from` by an edit: from item `from` on, each string still tied on to a note that
 * is gone loses its tied pieces, so what was left of the note is a Gap (spec Q18).
 */
function dropTiedOn(items: Item[], from: number, strings: Set<number>): Item[] {
  if (strings.size === 0) return items;
  const open = new Set(strings);
  return items.map((item, i) => {
    if (i < from || open.size === 0 || item.kind !== 'column') return item;
    const column = item.columns[0];
    let changed = false;
    const notes = column.notes.map((note, s) => {
      if (!open.has(s)) return note;
      if (note?.tie) {
        changed = true;
        return null;
      }
      open.delete(s);
      return note;
    });
    return changed ? { ...item, columns: [{ ...column, notes }] } : item;
  });
}

/** From item `from` on, the first tied-on piece on each of `strings` is played again instead: a note an inserted Gap cuts in two. */
function untieFrom(items: Item[], from: number, strings: Set<number>): Item[] {
  if (strings.size === 0) return items;
  const open = new Set(strings);
  return items.map((item, i) => {
    if (i < from || open.size === 0 || item.kind !== 'column') return item;
    const column = item.columns[0];
    let changed = false;
    const notes = column.notes.map((note, s) => {
      if (!open.has(s) || !note) return note;
      open.delete(s);
      if (!note.tie) return note;
      changed = true;
      const played = { ...note };
      delete played.tie;
      return played;
    });
    return changed ? { ...item, columns: [{ ...column, notes }] } : item;
  });
}

/** The strings with a note sounding into the item at `index` (its notes tied on from before). */
function tiedInto(items: Item[], index: number): Set<number> {
  const item = items[index];
  const out = new Set<number>();
  if (!item || item.kind !== 'column') return out;
  item.columns[0].notes.forEach((note, s) => {
    if (note?.tie) out.add(s);
  });
  return out;
}

/* — the three edits, on a stream — */

/**
 * Marks of a Column's time that follow it when something is written over it (issue #393): the
 * Column now sounding at that time takes them. Marks that last the whole Column, and kept alphaTex,
 * stay with the Column they were written for.
 */
const MOVED = ['chord', 'text', 'fermata', 'wah'] as const;

/** Joins a moved text to the one already there, unless it is the same text. */
const TEXT_JOIN = ' / ';

/**
 * `placed` (the items written from `at`) with the time marks of `covered` (the items they replace,
 * the first starting at `coveredAt`) moved onto the placed Column sounding at each one's start: a
 * text joins the one there, a chord name, fermata or wah already there stays.
 */
function keepCoveredMarks(covered: Item[], coveredAt: number, placed: Item[], at: number): Item[] {
  const moving: { t: number; column: Column }[] = [];
  let t = coveredAt;
  for (const item of covered) {
    for (const column of item.columns) if (MOVED.some(key => column[key] !== undefined)) moving.push({ t, column });
    t += item.length;
  }
  if (moving.length === 0) return placed;
  const out = placed.map(item => ({ ...item, columns: [...item.columns] }));
  const starts = startsOf(out).map(start => start + at);
  for (const { t: when, column } of moving) {
    const k = out.findIndex((item, i) => item.length > 0 && starts[i] <= when && starts[i] + item.length > when);
    if (k < 0) continue;
    const c = out[k].kind === 'tuplet' ? out[k].columns.findIndex(x => !x.grace) : 0;
    out[k].columns[c] = withMarksOf(out[k].columns[c], column);
  }
  return out;
}

/** `target` with `from`'s time marks added: a text joined, the rest only where `target` has none. */
function withMarksOf(target: Column, from: Column): Column {
  const next: Column = { ...target };
  for (const key of MOVED) {
    const value = from[key];
    if (value === undefined) continue;
    if (key === 'text' && next.text !== undefined) {
      if (next.text !== value) next.text = `${next.text}${TEXT_JOIN}${value}`;
    } else if (next[key] === undefined) Object.assign(next, { [key]: value });
  }
  return next;
}

/**
 * `incoming` over the stream from `at`, clearing up to `clearTo` (at least the incoming's end): the
 * time it covers loses everything in it, chords and tuplets whole; the uncovered part of a covered note
 * is a Gap. Graces at `at` stay before the new notes.
 */
function overStream(items: Item[], at: number, incoming: Item[], clearTo: number): Item[] | null {
  const end = Math.max(clearTo, at + lengthOf(incoming));
  let out = cutAt(items, at);
  // A tuplet the new notes reach into goes whole: clear to its end.
  if (out) {
    const starts = startsOf(out);
    const hit = out.findIndex((item, i) => item.kind === 'tuplet' && starts[i] < end && starts[i] + item.length > end);
    if (hit >= 0) return overStream(items, at, incoming, Math.max(end, starts[hit] + out[hit].length));
  }
  out = out && cutAt(out, end);
  if (!out) return null;
  const from = indexAt(out, at, true);
  const to = indexAt(out, end, false);
  const gap = end - at - lengthOf(incoming);
  const placed = keepCoveredMarks(out.slice(from, to), startsOf(out)[from] ?? at, [...incoming, ...(gap > 0 ? [rest(gap)] : [])], at);
  const next = [...out.slice(0, from), ...placed, ...out.slice(to)];
  return dropTiedOn(next, from + placed.length, tiedInto(out, to));
}

/** The stream with a Gap `length` long put in at `at`, everything after it later. */
function pushStream(items: Item[], at: number, length: number): Item[] | null {
  const out = cutAt(items, at);
  if (!out) return null;
  const from = indexAt(out, at, false);
  return untieFrom([...out.slice(0, from), rest(length), ...out.slice(from)], from + 1, tiedInto(out, from));
}

/** The stream without the time from `from` to `to`, everything after it earlier. */
function pullStream(items: Item[], from: number, to: number): Item[] | null {
  let out = cutAt(items, from);
  out = out && cutAt(out, to);
  if (!out) return null;
  const a = indexAt(out, from, false);
  const b = indexAt(out, to, false);
  // A note sounding on through the whole stretch taken out stays tied; one that started inside it loses what is left.
  const before = tiedInto(out, a);
  const cutOff = new Set([...tiedInto(out, b)].filter(s => !(a < b && before.has(s) && heldThrough(out, a, b, s))));
  return dropTiedOn([...out.slice(0, a), ...out.slice(b)], a, cutOff);
}

/** Whether string `s` is tied on through every item from `a` to before `b`. */
function heldThrough(items: Item[], a: number, b: number, s: number): boolean {
  for (let i = a; i < b; i++) {
    const item = items[i];
    if (item.kind === 'grace') continue;
    if (item.kind !== 'column' || !item.columns[0].notes[s]?.tie) return false;
  }
  return true;
}

/* — laying a stream into bars — */

/** One bar's room as the stream is laid: its length, time signature and where the meter counts it from. */
interface Span {
  length: number;
  time: TimeSignature;
  offset: number;
  /** Its Beat groups in ticks; the time signature's default when left out. */
  groups?: number[];
}

/** A piece `length` long, `at` ticks into a bar, spelled by the meter: the Column, then its tied-on pieces. */
function spelled(column: Column, at: number, length: number, span: Span): Column[] {
  const kind = isRest(column) ? 'rest' : 'note';
  const durations = spell(meterOf(span.time, span.groups), span.offset + at, length, kind);
  return durations.map((duration, k) => ({ ...(k === 0 ? column : laterPiece(column)), duration }));
}

/**
 * The stream laid into bars, `spanOf(i)` giving the i-th bar's room, until it is used up; the last bar
 * ends in a Gap. A Column across a bar line goes on tied into the next bar. Null when a tuplet would
 * cross a bar line. `stopAt(i, t)` may end the laying at the start of bar i (stream time t).
 */
function layStream(items: Item[], spanOf: (i: number) => Span, stopAt?: (i: number, t: number) => boolean, minBars = 1): Column[][] | null {
  const bars: Column[][] = [];
  let queue = [...items];
  let t = 0;
  while (queue.length > 0 || bars.length < minBars) {
    if (stopAt?.(bars.length, t)) return bars;
    const span = spanOf(bars.length);
    const columns: Column[] = [];
    let used = 0;
    while (queue.length > 0 && (used < span.length || queue[0].length === 0)) {
      // A grace at the bar line goes with the note after it, in the next bar.
      if (used === span.length && queue[0].kind === 'grace' && queue.length > 1) break;
      const item = queue.shift()!;
      if (item.kind === 'grace' || item.kind === 'tuplet') {
        if (used + item.length > span.length) return null;
        columns.push(...item.columns);
        used += item.length;
        continue;
      }
      const room = span.length - used;
      const column = item.columns[0];
      if (item.length <= room) {
        columns.push(...spelled(column, used, item.length, span));
        used += item.length;
        continue;
      }
      columns.push(...spelled(column, used, room, span));
      used = span.length;
      queue = [{ columns: [laterPiece(column)], length: item.length - room, kind: 'column' }, ...queue];
    }
    if (used < span.length) columns.push(...spelled(rest(0).columns[0], used, span.length - used, span));
    bars.push(columns);
    t += span.length;
  }
  return bars;
}

/* — on a Part — */

/** Where bar `bar`'s Column `column` starts in the Part, in ticks (an empty bar counts its room). */
export function timeOf(part: Part, bar: number, column: number): number {
  let t = 0;
  for (let b = 0; b < bar; b++) t += writtenLength(part, b);
  const columns = part.bars[bar]?.columns ?? [];
  for (let c = 0; c < column && c < columns.length; c++) if (!columns[c].grace) t += ticks(columns[c].duration);
  return t;
}

/** A bar's length as its Columns have it; an empty bar is as long as its room. */
function writtenLength(part: Part, b: number): number {
  const bar = part.bars[b];
  return bar.columns.length === 0 ? barSpan(part, b) : barLength(bar);
}

/** The bar and Column at `t` in the Part: the Column starting there or the one `t` falls in, after any grace notes. */
export function placeAtTime(part: Part, t: number): { bar: number; column: number } {
  let start = 0;
  for (let b = 0; b < part.bars.length; b++) {
    const length = writtenLength(part, b);
    if (t < start + length || b === part.bars.length - 1) {
      const columns = part.bars[b].columns;
      let at = start;
      let found = 0;
      for (let c = 0; c < columns.length; c++) {
        if (columns[c].grace) continue;
        if (at <= t) found = c;
        else break;
        at += ticks(columns[c].duration);
      }
      return { bar: b, column: found };
    }
    start += length;
  }
  return { bar: 0, column: 0 };
}

/** One Voice of the Part, bar by bar: the Part's own, or another it carries. */
type VoiceBars = Column[][];

function ownBars(part: Part): VoiceBars {
  return part.bars.map(bar => bar.columns);
}

/** The other Voices the Part carries, by Voice number. */
function otherBars(part: Part): Map<number, VoiceBars> {
  const out = new Map<number, VoiceBars>();
  part.bars.forEach((bar, b) => {
    for (const other of bar.otherVoices ?? []) {
      if (!out.has(other.voice)) out.set(other.voice, part.bars.map(() => []));
      out.get(other.voice)![b] = other.columns;
    }
  });
  return out;
}

/** The time signature a bar `i` past the Part's last bar is in: the last bar's. */
function spanAt(part: Part, b: number): Span {
  const index = Math.min(b, part.bars.length - 1);
  const time = timeAt(part, index);
  const groups = beatGroupsAt(part, index);
  if (b >= part.bars.length) return { length: barTicks(time), time, offset: 0, groups };
  // A free-time bar keeps its written length.
  const length = part.bars[b].freeTime ? writtenLength(part, b) : barSpan(part, b);
  return { length, time, offset: meterOffset(part, b), groups };
}

/** A Voice's bars from `from` on as one stream. */
function streamOf(part: Part, voice: VoiceBars, from: number): Item[] {
  const items: Item[] = [];
  for (let b = from; b < part.bars.length; b++) items.push(...itemsOf(voice[b] ?? [], voice[b]?.length ? 0 : spanAt(part, b).length));
  return items;
}

/** What an edit does to one Voice's stream from its first bar, `shift` the time it moves the music after it by. */
export interface StreamEdit {
  /** The time the edit starts at, in the Part. */
  at: number;
  /** Where the edited stretch ends in the result: the laying may stop at a bar line from here on. */
  end: number;
  /** How much later (or earlier, negative) the music after `end` lands than it was. */
  shift: number;
  /** The edit on the Part's own Voice's stream (times from bar `first`'s start). */
  own: (items: Item[], base: number) => Item[] | null;
  /** The same edit on another Voice, or none to leave the other Voices as they are. */
  other?: (items: Item[], base: number) => Item[] | null;
  /** The fewest bars the Part keeps (no bars come off the end of a pull back). */
  minBars?: number;
  /** Lay every bar to the end, never stopping early (a pull back: no bar comes off the end). */
  toEnd?: boolean;
}

/**
 * `part` with an edit made on its timeline: its Voice (and, for one that moves time, the other Voices
 * it carries) from the edit's bar on laid back into bars by their time signatures. The laying stops at
 * the first bar line from the edit's end on where the music after it is as it was, so bars past the
 * edit's reach keep their Columns (an Uneven bar its ⚠); past the Part's end, bars are added. Null when
 * a tuplet would cross a bar line.
 */
export function editTimeline(part: Part, edit: StreamEdit): Part | null {
  const first = placeAtTime(part, edit.at).bar;
  const base = timeOf(part, first, 0);
  // The bar lines after the edit, as stream times, and which bar each starts.
  const lines = new Map<number, number>();
  let t = 0;
  for (let b = first; b < part.bars.length; b++) {
    lines.set(t, b);
    t += writtenLength(part, b);
  }
  const own = edit.own(streamOf(part, ownBars(part), first), base);
  if (!own) return null;
  let stopBar = part.bars.length;
  const spanOf = (i: number) => spanAt(part, first + i);
  const stopAt = (i: number, at: number) => {
    if (edit.toEnd || base + at < edit.end || i === 0) return false;
    const b = lines.get(at - edit.shift);
    if (b === undefined) return false;
    stopBar = b;
    return true;
  };
  let minBars = Math.max(1, (edit.minBars ?? 0) - first);
  // Laid to the end, another Voice longer than this one keeps all its music: every Voice gets the bars the longest needs.
  const otherStreams = new Map<number, Item[]>();
  if (edit.other) {
    for (const [voice, bars] of otherBars(part)) {
      const edited = edit.other(streamOf(part, bars, first), base);
      if (!edited) return null;
      otherStreams.set(voice, edited);
      if (edit.toEnd) {
        const alone = layStream(edited, spanOf);
        if (!alone) return null;
        minBars = Math.max(minBars, alone.length);
      }
    }
  }
  const laid = layStream(own, spanOf, stopAt, minBars);
  if (!laid) return null;
  const count = laid.length;
  const until = base + laid.reduce((sum, _bar, i) => sum + spanOf(i).length, 0);

  // The other Voices: the same edit, laid over the same bars.
  const others = new Map<number, Column[][]>();
  for (const [voice, bars] of otherBars(part)) {
    const edited = otherStreams.get(voice);
    if (!edited) {
      others.set(voice, bars.slice(first, first + count));
      continue;
    }
    const kept = lengthUpTo(edited, until - base);
    if (!kept) return null;
    const laidOther = layStream(kept, spanOf, undefined, count);
    if (!laidOther) return null;
    others.set(voice, laidOther.slice(0, count));
  }

  const made: Bar[] = laid.map((columns, i) => {
    const b = first + i;
    const old = b < stopBar ? part.bars[b] : undefined;
    return carrying(old ? { ...old, columns } : { columns }, others, i, spanOf(i));
  });
  const bars = [...part.bars.slice(0, first), ...made, ...part.bars.slice(stopBar)];
  // The bars laid are written by the meter at once, as the commit's rewrite would write them.
  const result = { ...part, bars };
  return writeVoice(result, readVoice(result), { bars: made.map((_bar, i) => first + i) });
}

/**
 * `bar` carrying the other Voices' bar `i`, each that has more than rests in it, and Voice 1 always: it is
 * never absent from a bar, so an edit of another Voice keeps its rests, and gives a bar it adds rests in
 * Voice 1 (`span`) too (issue #422's fuzzing: Voice 1 went missing under a note typed in Voice 2).
 */
function carrying(bar: Bar, others: Map<number, Column[][]>, i: number, span: Span): Bar {
  const out = { ...bar };
  delete out.otherVoices;
  const voices: OtherVoice[] = [];
  for (const [voice, bars] of others) {
    const columns = bars[i] ?? [];
    if (voice === 0) voices.push({ voice, columns: columns.length > 0 ? columns : restsFor(span) });
    else if (columns.some(c => !isRest(c) || Object.keys(c).some(k => k !== 'duration' && k !== 'notes'))) voices.push({ voice, columns });
  }
  if (voices.length > 0) out.otherVoices = voices.sort((x, y) => x.voice - y.voice);
  return out;
}

/** A bar's span as rests, written by the meter. */
function restsFor(span: Span): Column[] {
  return spell(meterOf(span.time, span.groups), span.offset, span.length, 'rest').map(duration => ({ duration, notes: Array<null>(STRING_COUNT).fill(null) }));
}

/** The stream cut off at `length` (padded with a Gap when shorter). Null when a tuplet is across that point. */
function lengthUpTo(items: Item[], length: number): Item[] | null {
  const total = lengthOf(items);
  if (total <= length) return total < length ? [...items, rest(length - total)] : items;
  const cut = cutAt(items, length);
  if (!cut) return null;
  return cut.slice(0, indexAt(cut, length, false));
}

/* — the edits — */

/** Columns as stream items (their own lengths), for writing over. */
export function itemsFrom(columns: Column[]): Item[] {
  return itemsOf(columns, 0);
}

/**
 * `columns` written over the Part's Voice from time `at`, clearing up to `clearTo` when that is later
 * than their end. Other Voices are left as they are.
 */
export function writeOver(part: Part, at: number, columns: Column[], clearTo = 0): Part | null {
  const incoming = itemsFrom(columns);
  const end = Math.max(at + lengthOf(incoming), clearTo);
  return editTimeline(part, {
    at,
    end,
    shift: 0,
    own: (items, base) => overStream(items, at - base, incoming, end - base),
  });
}

/** One Column `length` long (any length: the meter spells it, tied) written over the Part's Voice from `at`. */
export function writeSpan(part: Part, at: number, column: Column, length: number): Part | null {
  const incoming: Item[] = [{ columns: [column], length, kind: 'column' }];
  return editTimeline(part, { at, end: at + length, shift: 0, own: (items, base) => overStream(items, at - base, incoming, at + length - base) });
}

/** A Gap `length` long put in at `at` in every Voice of the Part, the music after it later. */
export function pushTime(part: Part, at: number, length: number): Part | null {
  const edit = (items: Item[], base: number) => pushStream(items, at - base, length);
  return editTimeline(part, { at, end: at + length, shift: length, own: edit, other: edit });
}

/** The time from `from` to `to` taken out of every Voice of the Part, the music after it earlier; the Part keeps `minBars` bars. */
export function pullTime(part: Part, from: number, to: number, minBars = part.bars.length): Part | null {
  const edit = (items: Item[], base: number) => pullStream(items, from - base, to - base);
  return editTimeline(part, { at: from, end: from, shift: from - to, own: edit, other: edit, minBars, toEnd: true });
}

/** The Part's whole length, in ticks. */
export function partLength(part: Part): number {
  return part.bars.reduce((sum, _, b) => sum + writtenLength(part, b), 0);
}

/* — re-barring, when a time signature or the Pickup bar changes — */

/**
 * The bars `from` up to `to` (the next time signature change in `before`, or the end) laid again by
 * the time signatures `after` has: every Voice of the Part as one stream, split and tied over the new
 * bar lines, at least `minBars` bars; a last bar left part-filled ends in a Gap. `before` and `after`
 * have the same bars and Columns, only their time signatures (or Pickup bar) differ. The bars after
 * `to` are as they were. A bar the re-bar adds has no marks; one it takes away goes, its closing
 * marks (a repeat's end, a double bar line) moving onto the new last bar. Null when a tuplet would
 * cross a bar line; `after` itself when a free-time bar is in the stretch, which keeps its bars.
 */
export function reBar(before: Part, after: Part, from: number, to: number, minBars = 1): Part | null {
  if (before.bars.slice(from, to).some(bar => bar.freeTime)) return after;
  const own = before.bars.slice(from, to).map(bar => bar.columns);
  const others = [...otherBars(before)].map(([voice, bars]) => [voice, bars.slice(from, to)] as const);
  const rooms = own.map((_columns, i) => barSpan(before, from + i));
  const time = timeAt(after, from);
  const groups = beatGroupsAt(after, from);
  const spanOf = (i: number): Span => (i === 0
    ? { length: barSpan(after, from), time, offset: meterOffset(after, from), groups }
    : { length: barTicks(time), time, offset: 0, groups });
  // At the clip's end the Gap after the last note is no music to keep: no bar of rests is added for it.
  const laid = layVoices([own, ...others.map(([, bars]) => bars)], rooms, spanOf, minBars, to === before.bars.length);
  if (!laid) return null;
  const [ownLaid, ...othersLaid] = laid;
  const otherMap = new Map(others.map(([voice], k) => [voice, othersLaid[k]]));
  const made = ownLaid.map((columns, i) => {
    const old = from + i < to ? after.bars[from + i] : undefined;
    const bar: Bar = old ? { ...old, columns } : { columns };
    return carrying(bar, otherMap, i, spanOf(i));
  });
  const last = after.bars[to - 1];
  if (made.length < to - from && last) {
    const end = made[made.length - 1];
    if (last.repeatEnd !== undefined && end.repeatEnd === undefined) end.repeatEnd = last.repeatEnd;
    if (last.doubleBar && !end.doubleBar) end.doubleBar = true;
  }
  const result: Part = { ...after, bars: [...after.bars.slice(0, from), ...made, ...after.bars.slice(to)] };
  const changed = made.map((_bar, i) => from + i);
  return writeOtherVoices(writeVoice(result, readVoice(result), { bars: changed }), changed);
}

/**
 * Several Voices' bars (`voices[v][i]` the Columns of the stretch's bar i, [] where the Voice is
 * absent, counted as a Gap `rooms[i]` long) laid into bars by `spanOf`, every Voice into as many bars
 * as the longest needs, and at least `minBars`; with `trimEnd`, without the Gap each Voice ends in.
 */
function layVoices(voices: Column[][][], rooms: number[], spanOf: (i: number) => Span, minBars: number, trimEnd: boolean): Column[][][] | null {
  const streams = voices.map(bars => {
    const items = bars.flatMap((columns, i) => itemsOf(columns, columns.length > 0 ? 0 : rooms[i]));
    if (trimEnd) while (items.length > 0 && isPlainRestItem(items[items.length - 1])) items.pop();
    return items;
  });
  let count = minBars;
  for (const stream of streams) {
    const laid = layStream(stream, spanOf);
    if (!laid) return null;
    count = Math.max(count, laid.length);
  }
  const laid = streams.map(stream => layStream(stream, spanOf, undefined, count));
  return laid.every(bars => bars !== null) ? (laid as Column[][][]) : null;
}

/** Whether an item is a rest with nothing written over it. */
function isPlainRestItem(item: Item): boolean {
  const column = item.columns[0];
  return item.kind === 'column' && isRest(column) && Object.keys(column).every(k => k === 'duration' || k === 'notes');
}

/** The Part with its other Voices' bars `bars` written by the meter, as its own Voice's are. */
function writeOtherVoices(part: Part, bars: number[]): Part {
  let result = part;
  for (const voice of otherBars(part).keys()) {
    const asOwn: Part = { ...result, voice, bars: result.bars.map(bar => ({ columns: bar.otherVoices?.find(o => o.voice === voice)?.columns ?? [], ...masterOf(bar) })) };
    const written = writeVoice(asOwn, readVoice(asOwn), { bars: bars.filter(b => asOwn.bars[b].columns.length > 0) });
    result = {
      ...result,
      bars: result.bars.map((bar, b) => {
        if (!bars.includes(b) || !bar.otherVoices) return bar;
        return { ...bar, otherVoices: bar.otherVoices.map(o => (o.voice === voice ? { voice, columns: written.bars[b].columns } : o)) };
      }),
    };
  }
  return result;
}

/** A bar's time signature fields, which the meter reads. */
function masterOf(bar: Bar): Pick<Bar, 'time' | 'freeTime' | 'pickup'> {
  const out: Pick<Bar, 'time' | 'freeTime' | 'pickup'> = {};
  if (bar.time) out.time = bar.time;
  if (bar.freeTime) out.freeTime = bar.freeTime;
  if (bar.pickup !== undefined) out.pickup = bar.pickup;
  return out;
}

/**
 * Every Track of the clip re-barred (`reBar`) from bar `from` up to `to`: `before` the clip as it was,
 * `after` the same with the new time signature (or Pickup bar). Every Track gets the same bars, as
 * many as the longest needs. Null when a tuplet would cross a bar line.
 */
export function reBarClip(before: Clip, after: Clip, from: number, to: number): Clip | null {
  const tracks = before.tracks.map((_track, t) => t);
  const first = tracks.map(t => reBar(partOf(before, t), partOf(after, t), from, to));
  if (first.some(part => part === null)) return null;
  const count = Math.max(...first.map(part => part!.bars.length));
  const parts = tracks.map(t => reBar(partOf(before, t), partOf(after, t), from, to, count - (before.masterBars.length - to) - from));
  if (parts.some(part => part === null)) return null;
  return withTrackParts(after, parts as Part[]);
}

/** Where a time signature change at bar `at` stops re-barring: the next bar of `clip` that changes the time, or the end. */
export function reBarEnd(clip: Pick<Part, 'time' | 'bars'>, at: number): number {
  for (let b = at + 1; b < clip.bars.length; b++) if (clip.bars[b].time) return b;
  return clip.bars.length;
}

/**
 * Every Voice of the Part from bar `from` on laid again into bars by their time signatures, to the end:
 * an overfull bar's extra goes into the next bar and pushes the music after it along (Move extra into
 * next bar, from an Uneven bar's ⚠). Null when a tuplet would cross a bar line.
 */
export function layFrom(part: Part, from: number): Part | null {
  const at = timeOf(part, from, 0);
  const same = (items: Item[]) => items;
  return editTimeline(part, { at, end: at, shift: 0, own: same, other: same, toEnd: true, minBars: part.bars.length });
}
