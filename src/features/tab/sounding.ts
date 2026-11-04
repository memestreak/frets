/**
 * Sounding notes: a Voice's Columns read as the notes they sound (string, fret, start, length, a Tie
 * chain as one note), and written back as Columns by the meter. Pure; no React.
 * `docs/specs/2026-11-03-tab-sounding-notes-design.md`; why the Clip stores Columns at all:
 * `docs/adr/2026-11-03-edit-sounding-notes-store-columns.md`.
 *
 * Times are ticks from the Part's start. Each bar starts where the one before it ends by its own
 * Columns, so a short or overfull bar (kept as written) doesn't move the bars after it.
 */
import {
  barLength, barSpan, beatGroupsAt, defaultGroupCounts, barTicks, meterOffset, NOTE_VALUES, SHORTEST_DOTTED, STRING_COUNT, ticks, timeAt, tupletGroups, tupletProblems,
  WHOLE, type Column, type Duration, type Note, type NoteValue, type Part, type TimeSignature,
} from './clip';

/** One written note of a Sounding note: the first, or one tied on after it. */
export interface Piece {
  at: number;
  length: number;
  /** The note as written, with its own marks. */
  note: Note;
}

/** A note as it sounds: a Tie chain counts as one. */
export interface SoundingNote {
  voice: number;
  string: number;
  start: number;
  length: number;
  /** Its written notes in order; the first holds its attack marks. */
  pieces: Piece[];
}

/** What a Column carries that isn't a note's, at the Column's time (a rest's too). */
export interface ColumnMarks {
  bar: number;
  at: number;
  length: number;
  /** Lasts the whole Column, so a split Column copies it to every piece: tremolo picking, octave line, hairpin. */
  held: Partial<Column>;
  /** Belongs to the Column's start: a chord name, text, stroke, wah, fermata, whammy bar, kept alphaTex. */
  point: Partial<Column>;
}

/** A grace note (or several), kept as written, played before the note at `at`. */
export interface Grace {
  bar: number;
  at: number;
  column: Column;
}

/** A tuplet group, kept as written: a block of time the writer never splits into. */
export interface TupletBlock {
  bar: number;
  start: number;
  end: number;
  columns: Column[];
}

export interface BarSpan {
  start: number;
  length: number;
  time: TimeSignature;
  /** Exactly as long as its time signature, not in free time and with no broken tuplet: written by the meter. */
  byMeter: boolean;
}

/** A Voice as Sounding notes, with everything else its Columns held, ready to write back. */
export interface ReadVoice {
  voice: number;
  bars: BarSpan[];
  notes: SoundingNote[];
  marks: ColumnMarks[];
  graces: Grace[];
  tuplets: TupletBlock[];
}

/** Note marks that last the whole note: a split copies them to every piece. Every other mark is an attack mark. */
const HELD_NOTE_MARKS = ['palmMute', 'letRing', 'vibrato'] as const;
const HELD_COLUMN_MARKS = ['tremolo', 'ottava', 'hairpin'] as const;
const POINT_COLUMN_MARKS = ['stroke', 'chord', 'text', 'wah', 'fermata', 'whammy', 'beam', 'extra'] as const;

function picked<T extends object>(from: T, keys: readonly string[]): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const v = (from as Record<string, unknown>)[k];
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}

/** Plain data compared regardless of key order or keys set to undefined. */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (!same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
  }
  return true;
}

/** A note as it is tied on from `first`: the same fret, tied, with only the marks that last the whole note. */
export function continuation(first: Note): Note {
  return { fret: first.fret, tie: true, ...picked(first, HELD_NOTE_MARKS) };
}

/**
 * Marks drawn or played over the note's own length (a bend's curve, a slide out at its end, the
 * whammy bar's dive): a note or Column carrying one keeps its written pieces, neither split nor
 * merged, or the shape would move in time.
 */
function isShaped(n: SoundingNote): boolean {
  return n.pieces.some(p => p.note.bend !== undefined || p.note.slideOut !== undefined);
}

/** A later piece with nothing of its own: the writer may merge it into the note before. */
function isPlain(piece: Piece, first: Piece): boolean {
  return same(piece.note, continuation(first.note));
}

/** Reads the part's Voice (`part.voice`, Voice 1 when none) as Sounding notes. */
export function readVoice(part: Part): ReadVoice {
  const voice = part.voice ?? 0;
  const read: ReadVoice = { voice, bars: [], notes: [], marks: [], graces: [], tuplets: [] };
  const open: (SoundingNote | null)[] = Array(STRING_COUNT).fill(null);
  let start = 0;
  part.bars.forEach((bar, b) => {
    const time = timeAt(part, b);
    const length = barLength(bar);
    const byMeter = !bar.freeTime && length === barSpan(part, b) && tupletProblems(bar, b).length === 0;
    read.bars.push({ start, length, time, byMeter });

    const timed = bar.columns.filter(c => !c.grace);
    const startOf: number[] = [];
    let t = start;
    for (const column of bar.columns) {
      if (column.grace) {
        read.graces.push({ bar: b, at: t, column });
        continue;
      }
      startOf.push(t);
      const span = ticks(column.duration);
      read.marks.push({ bar: b, at: t, length: span, held: picked(column, HELD_COLUMN_MARKS), point: picked(column, POINT_COLUMN_MARKS) });
      column.notes.forEach((note, s) => {
        const before = open[s];
        if (!note) {
          open[s] = null;
          return;
        }
        if (note.tie && before && before.start + before.length === t) {
          before.pieces.push({ at: t, length: span, note });
          before.length += span;
          return;
        }
        const sounding: SoundingNote = { voice, string: s, start: t, length: span, pieces: [{ at: t, length: span, note }] };
        read.notes.push(sounding);
        open[s] = sounding;
      });
      t += span;
    }
    // A tuplet keeps the grace notes inside it, in place.
    const placeOf = bar.columns.flatMap((c, k) => (c.grace ? [] : [k]));
    for (const group of tupletGroups(timed)) {
      const end = group.to + 1 < startOf.length ? startOf[group.to + 1] : t;
      const columns = bar.columns.slice(placeOf[group.from], placeOf[group.to] + 1);
      read.tuplets.push({ bar: b, start: startOf[group.from], end, columns });
    }
    start += length;
  });
  return read;
}

/* — the meter — */

/**
 * The Beat groups a bar of `time` is counted in, in ticks: 4/4 as two halves, 6/8 as two dotted
 * quarters, 5/8 as 3+2, 7/8 as 2+2+3 (the spec's table): each time signature's default. The writer
 * counts a bar in its own time signature's groups (`beatGroupsAt`), which may differ.
 */
export function beatGroups(time: TimeSignature): number[] {
  const unit = WHOLE / time.value;
  return defaultGroupCounts(time).map(n => n * unit);
}

/** The finest step positions are told apart at: a 256th, the shortest rest step. */
const FINEST = WHOLE / 256;

/** A bar's places, each with its strength (0 strongest), and the spans a rest may fill whole. */
export interface Meter {
  length: number;
  /** Ticks into the bar → strength: 0 the bar's ends, then halves of a 12/8 bar, Beat groups, beats, and halves of those. */
  levels: Map<number, number>;
  /** Spans (from, to) a rest or a syncopation may fill: the bar, each half, group, beat and each half of those. */
  spans: Set<string>;
  /** Groups counted in eighths or shorter (6/8, 5/8, 7/8): `e q` stays inside one, and so does `e rq`. */
  compound: { from: number; to: number; unit: number }[];
  simple: boolean;
}

export function meterOf(time: TimeSignature, groups = beatGroups(time)): Meter {
  const length = barTicks(time);
  const unit = WHOLE / time.value;
  const levels = new Map<number, number>();
  const spans = new Set<string>();
  const mark = (t: number, level: number) => {
    if (!levels.has(t) || levels.get(t)! > level) levels.set(t, level);
  };
  const span = (from: number, to: number) => spans.add(`${from}:${to}`);
  mark(0, 0);
  mark(length, 0);
  span(0, length);
  // Four equal groups (12/8) are two halves first.
  if (groups.length === 4 && groups.every(g => g === groups[0])) {
    mark(2 * groups[0], 1);
    span(0, 2 * groups[0]);
    span(2 * groups[0], length);
  }
  const compound: Meter['compound'] = [];
  let at = 0;
  for (const g of groups) {
    mark(at, 2);
    span(at, at + g);
    const beat = time.value >= 8 && g > unit ? unit : Math.min(unit, g);
    if (time.value >= 8 && g > unit) compound.push({ from: at, to: at + g, unit });
    for (let b = at; b < at + g; b += beat) {
      mark(b, 3);
      // Halves of the beat, down to the finest step.
      let size = beat;
      let level = 4;
      while (size / 2 >= FINEST && Number.isInteger(size / 2)) {
        for (let s = b; s < b + beat; s += size) span(s, s + size);
        size /= 2;
        for (let s = b + size; s < b + beat; s += 2 * size) mark(s, level);
        level++;
      }
      for (let s = b; s < b + beat; s += size) span(s, s + size);
    }
    at += g;
  }
  return { length, levels, spans, compound, simple: time.value <= 4 };
}

/** The one note value, plain or dotted, that is `length` ticks long; none when it takes more than one. */
export function durationOf(length: number): Duration | null {
  for (const value of NOTE_VALUES) {
    for (const dots of [0, 1, 2] as const) {
      if (dots > 0 && value > SHORTEST_DOTTED) continue;
      const d: Duration = { value, dots };
      if (ticks(d) === length) return d;
    }
  }
  return null;
}

/** The strongest place strictly between `from` and `to`, the earliest of equal strength; null when none is marked. */
function strongestInside(meter: Meter, from: number, to: number): { at: number; level: number } | null {
  let best: { at: number; level: number } | null = null;
  for (const [at, level] of meter.levels) {
    if (at <= from || at >= to) continue;
    if (!best || level < best.level || (level === best.level && at < best.at)) best = { at, level };
  }
  return best;
}

function levelAt(meter: Meter, at: number): number {
  return meter.levels.get(at) ?? Infinity;
}

function inCompoundGroup(meter: Meter, from: number, to: number) {
  return meter.compound.find(g => from >= g.from && to <= g.to) ?? null;
}

/** Whether a note may be written as one value from `from` to `to` in the bar. */
function noteFits(meter: Meter, from: number, to: number): boolean {
  const inside = strongestInside(meter, from, to);
  // It starts on a place stronger than any it crosses: q. on a beat, h. from beat 1, h on beat 3 of 4/4.
  if (!inside || levelAt(meter, from) < inside.level) return true;
  // A syncopation: a note centred in a span twice its length (e q e, s e s, q h q).
  const half = (to - from) / 2;
  if (meter.spans.has(`${from - half}:${to + half}`)) return true;
  // Inside a group counted in eighths, a note on an eighth stays whole (e q in 6/8).
  const group = inCompoundGroup(meter, from, to);
  return group !== null && (from - group.from) % group.unit === 0;
}

/** Whether a Gap may be written as one rest from `from` to `to` in the bar. */
function restFits(meter: Meter, from: number, to: number, duration: Duration): boolean {
  if (meter.simple && duration.dots > 0) return false;
  if (from === 0 && to === meter.length) return false; // a whole-bar rest only for an empty bar (`emptyBarRests`)
  if (meter.spans.has(`${from}:${to}`)) return true;
  // Inside a group counted in eighths, a plain rest on an eighth (e rq, rq e in 6/8).
  const group = inCompoundGroup(meter, from, to);
  return group !== null && duration.dots === 0 && (from - group.from) % group.unit === 0;
}

/**
 * The values a note or a Gap from `from` for `length` ticks into a bar is written as, by the
 * meter: whole when the rules let it be, else split at the strongest place inside it and each side
 * written the same way.
 */
export function spell(meter: Meter, from: number, length: number, kind: 'note' | 'rest'): Duration[] {
  const to = from + length;
  const one = durationOf(length);
  if (one && (kind === 'note' ? noteFits(meter, from, to) : restFits(meter, from, to, one))) return [one];
  const inside = strongestInside(meter, from, to);
  if (!inside) return one ? [one] : fewest(length);
  return [...spell(meter, from, inside.at - from, kind), ...spell(meter, inside.at, to - inside.at, kind)];
}

/** Longest values first, for time no place in the meter divides (it shouldn't happen outside a tuplet). */
function fewest(length: number): Duration[] {
  const out: Duration[] = [];
  let left = length;
  const plain = NOTE_VALUES.map(value => ({ value, dots: 0 as const }));
  for (const d of plain) {
    while (ticks(d) <= left) {
      out.push(d);
      left -= ticks(d);
    }
  }
  return out;
}

/** An empty bar: one rest of the bar's length where one exists, else one per Beat group. */
export function emptyBarRests(time: TimeSignature, groups = beatGroups(time)): Duration[] {
  const whole = durationOf(barTicks(time));
  if (whole) return [whole];
  const meter = meterOf(time, groups);
  let at = 0;
  return groups.flatMap(g => spell(meter, (at += g) - g, g, 'rest'));
}

/* — tuplet rests and grace values (`docs/specs/2026-11-04-tab-tuplets-grace-rest-design.md`) — */

/** Only the tuplet fields of a duration. */
export function tupletKind(duration: Duration): Pick<Duration, 'tuplet' | 'tupletSpan'> {
  return duration.tupletSpan ? { tuplet: duration.tuplet, tupletSpan: duration.tupletSpan } : { tuplet: duration.tuplet };
}

/**
 * Rests `length` ticks long in a tuplet of `kind`: the fewest of its own values, longest first, as
 * printed music writes a tuplet's rests (spec Q3). Null when no set of its values fills it.
 */
export function tupletRests(length: number, kind: Pick<Duration, 'tuplet' | 'tupletSpan'>): Duration[] | null {
  const out: Duration[] = [];
  let left = length;
  for (const value of NOTE_VALUES) {
    const d: Duration = { value, dots: 0, ...kind };
    while (ticks(d) <= left) {
      out.push(d);
      left -= ticks(d);
    }
  }
  return left === 0 ? out : null;
}

/** Whether a Column is a rest with nothing of its own on it. */
export function isBareRest(column: Column): boolean {
  return !column.grace && !column.notes.some(Boolean) && Object.keys(column).every(k => k === 'duration' || k === 'notes');
}

/**
 * A tuplet group's Columns as the meter writes them: every run of bare rests in it written again as
 * the fewest rests in the tuplet's values (spec Q3). The Columns as they are when a run can't be.
 */
export function spellTupletRests(columns: Column[]): Column[] {
  const out: Column[] = [];
  let run: Column[] = [];
  const flush = () => {
    if (run.length === 0) return;
    const length = run.reduce((sum, c) => sum + ticks(c.duration), 0);
    const rests = tupletRests(length, tupletKind(run[0].duration));
    out.push(...(rests ? rests.map(d => ({ duration: d, notes: Array<Note | null>(STRING_COUNT).fill(null) })) : run));
    run = [];
  };
  for (const column of columns) {
    if (isBareRest(column) && column.duration.tuplet) {
      run.push(column);
      continue;
    }
    flush();
    out.push(column);
  }
  flush();
  return out;
}

/** Whether a tuplet group's Columns hold no note: the tuplet goes, its time a Gap (spec Q5). */
export function isEmptyTuplet(columns: Column[]): boolean {
  return columns.every(c => !c.notes.some(Boolean));
}

/** A grace note's value by how many are before the note, as books and alphaTab have them: an eighth, two sixteenths, thirty-seconds (spec Q9). */
export function graceValue(count: number): NoteValue {
  return count <= 1 ? 8 : count === 2 ? 16 : 32;
}

/** A bar's Columns with every run of grace notes written by its count (spec Q9). */
export function graceValues(columns: Column[]): Column[] {
  const out = [...columns];
  let i = 0;
  while (i < out.length) {
    if (!out[i].grace) {
      i++;
      continue;
    }
    let end = i;
    while (end + 1 < out.length && out[end + 1].grace) end++;
    const value = graceValue(end - i + 1);
    for (let k = i; k <= end; k++) {
      const d = out[k].duration;
      if (d.value !== value || d.dots !== 0) out[k] = { ...out[k], duration: { ...d, value, dots: 0 } };
    }
    i = end + 1;
  }
  return out;
}

/* — writing — */

export interface WriteOptions {
  /** The bars to write by the meter; every other bar keeps its Columns. All of them when left out. */
  bars?: number[];
  /** A bar's Beat groups, in ticks, in place of its time signature's (`beatGroupsAt`). */
  groupsOf?: (bar: number) => number[] | undefined;
}

/**
 * Writes `read` back into `part` as Columns: each bar asked for that is written by the meter is
 * cut at every note's start and end, every piece with marks of its own, every Column mark and
 * every tuplet's edges, and each piece spelled by the meter, notes that sound on tied over.
 */
export function writeVoice(part: Part, read: ReadVoice, options: WriteOptions = {}): Part {
  const asked = options.bars ? new Set(options.bars) : null;
  const bars = part.bars.map((bar, b) => {
    const span = read.bars[b];
    if ((asked && !asked.has(b)) || !span?.byMeter) return bar;
    const groups = options.groupsOf?.(b) ?? beatGroupsAt(part, b);
    return { ...bar, columns: writeBar(read, b, meterOf(span.time, groups), groups, meterOffset(part, b)) };
  });
  return { ...part, bars };
}

function writeBar(read: ReadVoice, b: number, meter: Meter, groups: number[], offset = 0): Column[] {
  const { start, length, time } = read.bars[b];
  const end = start + length;
  const notes = read.notes.filter(n => n.start < end && n.start + n.length > start);
  const marks = read.marks.filter(m => m.bar === b);
  // A tuplet with no note left goes, its time a Gap (spec Q5); the rests in one are its fewest (Q3).
  const tuplets = read.tuplets
    .filter(t => t.bar === b && !isEmptyTuplet(t.columns))
    .map(t => ({ ...t, columns: spellTupletRests(t.columns) }));
  const graces = read.graces.filter(g => g.bar === b && !tuplets.some(t => g.at > t.start && g.at < t.end));

  const cuts = new Set<number>([start, end]);
  // Spans that keep their written length: a shaped note's pieces, a Column with the whammy bar.
  const kept = new Map<number, number>();
  const keep = (at: number, length: number) => {
    cuts.add(at);
    cuts.add(at + length);
    kept.set(at, length);
  };
  for (const n of notes) {
    cuts.add(Math.max(n.start, start));
    cuts.add(Math.min(n.start + n.length, end));
    const shaped = isShaped(n);
    n.pieces.forEach((p, k) => {
      if (p.at < start || p.at >= end) return;
      if (shaped) keep(p.at, p.length);
      else if (k > 0 && !isPlain(p, n.pieces[0])) cuts.add(p.at);
    });
  }
  let held: Partial<Column> | null = null;
  for (const m of marks) {
    if (Object.keys(m.point).length > 0 || (held !== null && !same(m.held, held))) cuts.add(m.at);
    if (m.point.whammy) keep(m.at, m.length);
    held = m.held;
  }
  for (const t of tuplets) {
    cuts.add(t.start);
    cuts.add(t.end);
  }
  for (const g of graces) cuts.add(g.at);
  const times = [...cuts].sort((x, y) => x - y);

  const columns: Column[] = [];
  for (let i = 0; i < times.length - 1; i++) {
    const from = times[i];
    const to = times[i + 1];
    columns.push(...graces.filter(g => g.at === from).map(g => g.column));
    const tuplet = tuplets.find(t => from >= t.start && from < t.end);
    if (tuplet) {
      if (from === tuplet.start) columns.push(...tuplet.columns);
      continue;
    }
    const sounding = notes.filter(n => n.start <= from && n.start + n.length >= to);
    const mark = [...marks].reverse().find(m => m.at <= from);
    const own = kept.get(from) === to - from ? durationOf(to - from) : null;
    const durations = own ? [own]
      : sounding.length === 0
        ? (from === start && to === end && offset === 0 ? emptyBarRests(time, groups) : spell(meter, offset + from - start, to - from, 'rest'))
        : spell(meter, offset + from - start, to - from, 'note');
    durations.forEach((duration, k) => {
      const notesHere: (Note | null)[] = Array(STRING_COUNT).fill(null);
      for (const n of sounding) notesHere[n.string] = k === 0 ? noteAt(n, from) : continuation(n.pieces[0].note);
      columns.push({
        ...(mark?.held ?? {}),
        ...(k === 0 && mark?.at === from ? mark.point : {}),
        duration,
        notes: notesHere,
      });
    });
  }
  columns.push(...graces.filter(g => g.at === end).map(g => g.column));
  // Grace notes are valued by how many come before a note (spec Q9).
  return graceValues(columns);
}

/** The written note a Sounding note has at `at`: its first, a piece of its own that starts there, or a plain tie on. */
function noteAt(n: SoundingNote, at: number): Note {
  if (n.start === at) return n.pieces[0].note;
  const shaped = isShaped(n);
  const own = n.pieces.find((p, k) => k > 0 && p.at === at && (shaped || !isPlain(p, n.pieces[0])));
  return own ? own.note : continuation(n.pieces[0].note);
}
