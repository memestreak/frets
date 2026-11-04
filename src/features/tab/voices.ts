/**
 * Editing every Voice of a track (`docs/specs/2026-11-04-tab-voices-drawn-edited-design.md`, step 9).
 * The page edits one Voice at a time, the Active voice, as a Part (`partOf(clip, track, voice)`); these
 * work out what the other Voices hold at a selection's time, run an edit Voice by Voice, move notes into
 * another Voice, and catch an edit that would sound one string in two Voices at once. Pure; no React.
 */
import { clipAction } from './clipState';
import { STRING_COUNT, fewestRests, hasNotes, partOf, ticks, voiceColumns, type Bar, type Clip, type Column, type Note, type OtherVoice, type Part } from './clip';
import { clearNote, columnAt, cursorTime, indexOf, insertPaste, normalize, noteAt, placeOf, selectedRange, sliceClip, type Cursor, type Selection } from './editing';
import { clearToRests } from './noteEdits';
import { chainPlaces } from './ties';
import { placeAtTime, pushTime, timeOf, writeOver } from './timeline';

/** The most Voices a track has (`MAX_VOICES` in the reader). */
export const VOICE_COUNT = 4;

/** The part as Voice `voice`'s own Part: that Voice's Columns as each bar's, numbered as `partOf` numbers them. */
export function asVoice(part: Part, voice: number): Part {
  if ((part.voice ?? 0) === voice) return part;
  const bars = part.bars.map((bar, b) => {
    const own = { ...bar, columns: voiceColumns(part, b, voice) };
    delete own.otherVoices;
    return own;
  });
  const made: Part = { ...part, bars };
  if (voice > 0) made.voice = voice;
  else delete made.voice;
  return made;
}

/** Whether Voice `voice` is present in bar `b` of the part: the part's own Voice 1 always is. */
function presentIn(part: Part, b: number, voice: number): boolean {
  if ((part.voice ?? 0) === voice) return voice === 0 || part.bars[b].columns.some(c => c.notes.some(Boolean) || c.grace);
  return voice === 0 || (part.bars[b].otherVoices?.some(o => o.voice === voice) ?? false);
}

/** The stretch of time a selection of the part's own Voice covers, in ticks from the start: [from, to). */
export function selectionTime(part: Part, selection: Selection): [number, number] {
  const [low, high] = selectedRange(selection);
  const first = placeOf(part, low);
  const last = placeOf(part, high);
  const column = part.bars[last.bar].columns[last.column];
  return [timeOf(part, first.bar, first.column), timeOf(part, last.bar, last.column) + (column.grace ? 0 : ticks(column.duration))];
}

/** Each Column of Voice `voice` with where it starts and its place in that Voice's numbering. */
function columnsWithTimes(part: Part, voice: number): { index: number; bar: number; column: number; start: number; item: Column }[] {
  const own = asVoice(part, voice);
  const out: { index: number; bar: number; column: number; start: number; item: Column }[] = [];
  let index = 0;
  own.bars.forEach((bar, b) => {
    let t = timeOf(own, b, 0);
    bar.columns.forEach((item, column) => {
      out.push({ index: index++, bar: b, column, start: t, item });
      if (!item.grace) t += ticks(item.duration);
    });
  });
  return out;
}

/** Voice `voice`'s Columns that start in `[from, to)`, as a run of its own numbering; null when none do or the Voice is absent there. */
export function voiceRange(part: Part, voice: number, [from, to]: [number, number]): [number, number] | null {
  const inside = columnsWithTimes(part, voice).filter(c => c.start >= from && c.start < to && presentIn(part, c.bar, voice));
  return inside.length > 0 ? [inside[0].index, inside[inside.length - 1].index] : null;
}

/**
 * The other Voices' runs at a selection's time (Dorico's selection covers every Voice in its time, Q12):
 * each present Voice's Columns starting in it, by Voice, in that Voice's numbering.
 */
export function voiceSelections(part: Part, selection: Selection): Map<number, [number, number]> {
  const time = selectionTime(part, selection);
  const out = new Map<number, [number, number]>();
  for (const voice of otherVoicesOf(part)) {
    const range = voiceRange(part, voice, time);
    if (range) out.set(voice, range);
  }
  return out;
}

/** The Voices other than the part's own that any bar of it carries, in order. */
export function otherVoicesOf(part: Part): number[] {
  const voices = new Set<number>();
  for (const bar of part.bars) for (const o of bar.otherVoices ?? []) voices.add(o.voice);
  return [...voices].sort((a, b) => a - b);
}

/** Whether the selection's time holds notes of a Voice other than the part's own. */
export function spansVoices(part: Part, selection: Selection | null): boolean {
  return selection !== null && voiceSelections(part, selection).size > 0;
}

/**
 * An edit on a selection run on every Voice it covers (Q19), the Active voice first, as one clip:
 * `edit` gets each Voice's Part and that Voice's run at the selection's time.
 */
export function perVoice(whole: Clip, track: number, part: Part, selection: Selection, edit: (part: Part, selection: Selection) => Part): Clip {
  const voice = part.voice ?? 0;
  const runs: [number, Selection][] = [[voice, selection], ...[...voiceSelections(part, selection)].map(([v, [a, b]]): [number, Selection] => [v, { anchor: a, focus: b }])];
  let clip = whole;
  for (const [v, run] of runs) {
    const before = partOf(clip, track, v);
    const after = edit(before, run);
    if (after !== before) clip = editedClip(clip, track, after);
  }
  return clip;
}

/** The clip with an edit of one of its track's Voices in it, its bars written again by the meter. */
function editedClip(clip: Clip, track: number, part: Part): Clip {
  const action = clipAction(clip, { type: 'replacePart', part }, track);
  return action.type === 'replace' ? action.clip : clip;
}

/* — two Voices on one string (Q10) — */

/** How many times each string sounds in two Voices at once in the part, by string and pair of Voices. */
function clashCounts(part: Part): Map<string, number> {
  const counts = new Map<string, number>();
  part.bars.forEach(bar => {
    if (!bar.otherVoices?.length) return;
    const voices = [{ voice: part.voice ?? 0, columns: bar.columns }, ...bar.otherVoices];
    const spans = voices.map(({ columns }) => {
      const on: [number, number][][] = Array.from({ length: STRING_COUNT }, () => []);
      let t = 0;
      for (const column of columns) {
        if (column.grace) continue;
        const end = t + ticks(column.duration);
        column.notes.forEach((note, s) => { if (note) on[s].push([t, end]); });
        t = end;
      }
      return on;
    });
    for (let s = 0; s < STRING_COUNT; s++) {
      for (let i = 0; i < voices.length; i++) {
        for (let k = i + 1; k < voices.length; k++) {
          const n = spans[i][s].filter(([from, to]) => spans[k][s].some(([f, e]) => from < e && f < to)).length;
          if (n === 0) continue;
          const pair = [voices[i].voice, voices[k].voice].sort((a, b) => a - b);
          const key = `${s}:${pair[0]}:${pair[1]}`;
          counts.set(key, (counts.get(key) ?? 0) + n);
        }
      }
    }
  });
  return counts;
}

/**
 * The sentence an edit gets that would sound a string while another Voice is still sounding it there
 * (Q10): "String 2 is sounding in voice 1 there." Null when it makes no new clash. A clash that was there
 * before (an import's) doesn't stop an edit.
 */
export function clashMessage(before: Part, after: Part): string | null {
  const was = clashCounts(before);
  const voice = after.voice ?? 0;
  for (const [key, n] of clashCounts(after)) {
    if (n <= (was.get(key) ?? 0)) continue;
    const [s, a, b] = key.split(':').map(Number);
    const other = a === voice ? b : a;
    return `String ${s + 1} is sounding in voice ${other + 1} there.`;
  }
  return null;
}

/* — moving notes into another Voice (Q11) — */

/** A note's joins from the note before it on its string: a hammer-on or pull-off, a slide from it, a tie. */
function withoutJoin(column: Column, s: number): Column {
  const note = column.notes[s];
  if (!note || !(note.legato || note.tie || note.slide === 'legato' || note.slide === 'shift')) return column;
  const plain = { ...note };
  delete plain.legato;
  delete plain.tie;
  if (plain.slide === 'legato' || plain.slide === 'shift') delete plain.slide;
  return { ...column, notes: column.notes.map((n, i) => (i === s ? plain : n)) };
}

/** The moved notes with no join to a note before them, which stays behind. */
function unjoinedStart(slice: Part): Part {
  const seen = new Set<number>();
  const bars = slice.bars.map(bar => ({
    ...bar,
    columns: bar.columns.map(column => {
      let next = column;
      column.notes.forEach((note, s) => {
        if (!note || seen.has(s)) return;
        seen.add(s);
        next = withoutJoin(next, s);
      });
      return next;
    }),
  }));
  return { ...slice, bars };
}

/** The part with the first note on each string at or after `index` joined from no note it lost: its join goes when a rest comes before it. */
function unjoinedAfter(part: Part, index: number): Part {
  let i = 0;
  const done = new Set<number>();
  const last: (boolean | undefined)[] = Array<boolean | undefined>(STRING_COUNT).fill(undefined);
  const bars = part.bars.map(bar => ({
    ...bar,
    columns: bar.columns.map(column => {
      const here = i++;
      if (column.grace) return column;
      let next = column;
      column.notes.forEach((note, s) => {
        if (here >= index && note && !done.has(s)) {
          done.add(s);
          if (last[s] === false) next = withoutJoin(next, s);
        }
      });
      column.notes.forEach((note, s) => { last[s] = Boolean(note); });
      return next;
    }),
  }));
  return { ...part, bars };
}

/**
 * The picked note (`cursor`, its Tie chain whole) or the selected Columns of the part's Voice moved into
 * Voice `to` (Q11): they leave a Gap behind and are written over the same time there, as a paste writes;
 * a join to a note left behind is dropped. Returns the clip and the moved notes' run in Voice `to`, or
 * null when there is nothing to move.
 */
export function moveToVoice(whole: Clip, track: number, part: Part, at: { cursor: Cursor; selection: Selection | null; columnOnly: boolean }, to: number): { clip: Clip; part: Part; selection: Selection; cursor: Cursor } | null {
  const from = part.voice ?? 0;
  if (from === to) return null;
  const { cursor, selection } = at;
  let range: [number, number];
  let only: number | null = null;
  if (selection) range = selectedRange(selection);
  else {
    if (!columnAt(part, cursor)) return null;
    const one = !at.columnOnly && noteAt(part, cursor) !== null;
    const places = one ? chainPlaces(part, cursor) : [cursor];
    range = [indexOf(part, places[0].bar, places[0].column), indexOf(part, places[places.length - 1].bar, places[places.length - 1].column)];
    if (one) only = cursor.string;
  }
  let slice = sliceClip(part, range);
  if (only !== null) {
    const s = only;
    slice = { ...slice, bars: slice.bars.map(bar => ({ ...bar, columns: bar.columns.map(c => ({ ...c, notes: c.notes.map((n, i) => (i === s ? n : null)) })) })) };
  }
  if (!slice.bars.some(bar => bar.columns.some(c => c.notes.some(Boolean)))) return null;
  slice = unjoinedStart(slice);
  const first = placeOf(part, range[0]);
  const start = timeOf(part, first.bar, first.column);
  const cleared = only !== null ? clearNote(part, cursor) : clearToRests(part, { anchor: range[0], focus: range[1] }).clip;
  const left = editedClip(whole, track, unjoinedAfter(cleared, range[1] + 1));
  const target = partOf(left, track, to);
  const place = placeAtTime(target, start);
  const clip = editedClip(left, track, pasteAt(target, start, slice));
  const moved = partOf(clip, track, to);
  const end = start + slice.bars.reduce((sum, bar) => sum + bar.columns.reduce((t, c) => t + (c.grace ? 0 : ticks(c.duration)), 0), 0);
  const run = voiceRange(moved, to, [start, end]) ?? [indexOf(moved, place.bar, place.column), indexOf(moved, place.bar, place.column)];
  const startPlace = placeOf(moved, run[0]);
  return {
    clip, part: moved,
    selection: { anchor: run[0], focus: run[1] },
    cursor: { ...cursor, ...startPlace },
  };
}

/**
 * Paste at a time (`pasteOver`'s way, bars staying full), not at a Column's start: another Voice's Columns
 * needn't start where the Active voice's do. With `insert`, the music after it in every Voice is pushed on
 * first. The Part as it was when the paste doesn't fit.
 */
function pasteAt(part: Part, at: number, pasted: Part, insert = false): Part {
  const columns = pasted.bars.flatMap(bar => bar.columns.map(c => ({ ...c })));
  const pushed = insert ? pushTime(part, at, lengthOf(columns)) : part;
  const written = pushed && writeOver(pushed, at, columns);
  return written ? normalize(written) : part;
}

/** The cursor at the same time in another Voice's Part: on the Column starting there or the one it falls in. */
export function cursorInVoice(from: Part, to: Part, cursor: Cursor): Cursor {
  const t = timeOf(from, cursor.bar, cursor.column);
  return { ...cursor, ...placeAtTime(to, t) };
}

/** The run of Voice `voice`'s Columns at a selection's time, as a selection of that Voice's Part; null when it has none there. */
export function selectionInVoice(part: Part, selection: Selection, voice: number): Selection | null {
  if ((part.voice ?? 0) === voice) return selection;
  const range = voiceRange(part, voice, selectionTime(part, selection));
  return range ? { anchor: range[0], focus: range[1] } : null;
}

/**
 * Alt+← →'s next note or rest by time across every present Voice (Q13): the nearest after the cursor (or
 * before it, `step` −1), Voice 1 first at the same time. Null when the Active voice's own next one comes first.
 */
export function stepAcrossVoices(part: Part, cursor: Cursor, step: 1 | -1): { voice: number; bar: number; column: number } | null {
  const voice = part.voice ?? 0;
  const others = otherVoicesOf(part);
  if (others.length === 0) return null;
  const now = timeOf(part, cursor.bar, cursor.column);
  const key = (t: number, v: number) => t * VOICE_COUNT + v;
  const here = key(now, voice);
  const candidates = [voice, ...others].flatMap(v => columnsWithTimes(part, v)
    .filter(c => presentIn(part, c.bar, v) && !c.item.grace)
    .map(c => ({ voice: v, bar: c.bar, column: c.column, at: key(c.start, v) })));
  const ahead = candidates.filter(c => (step === 1 ? c.at > here : c.at < here)).sort((a, b) => (a.at - b.at) * step);
  const next = ahead[0];
  return next && next.voice !== voice ? { voice: next.voice, bar: next.bar, column: next.column } : null;
}

/* — copy and paste (Q20) — */

/** How long Columns last, grace notes taking no time. */
function lengthOf(columns: readonly Column[]): number {
  return columns.reduce((t, c) => t + (c.grace ? 0 : ticks(c.duration)), 0);
}

/** Rests filling `room` ticks. */
function restsFor(room: number): Column[] {
  return fewestRests(room).map(duration => ({ duration, notes: Array<Note | null>(STRING_COUNT).fill(null) }));
}

/**
 * The selected Columns as a clip to copy, every Voice with notes in their time (Q20): one Voice by itself
 * is copied as a plain Voice 1, so it pastes into whichever Voice is active; two or more keep their
 * Voices, each starting at the selection's time, rests filling up to its first Column.
 */
export function sliceVoices(part: Part, range: [number, number]): Part {
  const selection = { anchor: range[0], focus: range[1] };
  const own = sliceClip(part, range);
  const others = [...voiceSelections(part, selection)].filter(([voice, [a, b]]) =>
    columnsWithTimes(part, voice).some(c => c.index >= a && c.index <= b && hasNotes([c.item])));
  const ownNotes = own.bars.some(bar => hasNotes(bar.columns));
  if (others.length === 0) return own;
  if (!ownNotes && others.length === 1) return sliceClip(asVoice(part, others[0][0]), others[0][1]);
  const [from] = selectionTime(part, selection);
  const lengths = own.bars.map(bar => lengthOf(bar.columns));
  const bars: Bar[] = own.bars.map(bar => ({ ...bar, otherVoices: [] as OtherVoice[] }));
  for (const [voice, [a, b]] of others) {
    const items = columnsWithTimes(part, voice).filter(c => c.index >= a && c.index <= b);
    const out: Column[][] = lengths.map(() => []);
    let bar = 0;
    let barStart = 0;
    let at = 0;
    // Rests from where the Voice is up to `to`, split at the slice's bar lines.
    const restTo = (to: number) => {
      while (at < to && bar < lengths.length) {
        const end = Math.min(to, barStart + lengths[bar]);
        out[bar].push(...restsFor(end - at));
        at = end;
        if (at >= barStart + lengths[bar] && bar < lengths.length - 1) {
          barStart += lengths[bar];
          bar++;
        } else if (at >= barStart + lengths[bar]) break;
      }
    };
    for (const item of items) {
      restTo(item.start - from);
      out[bar].push({ ...item.item });
      if (!item.item.grace) at += ticks(item.item.duration);
      if (at >= barStart + lengths[bar] && bar < lengths.length - 1) {
        barStart += lengths[bar];
        bar++;
      }
    }
    restTo(lengths.reduce((t, n) => t + n, 0));
    out.forEach((columns, k) => bars[k].otherVoices!.push({ voice, columns }));
  }
  const made: Part = { ...own, bars };
  if (part.voice) made.voice = part.voice;
  return made;
}

/** The Voices a pasted clip's first track has notes in, Voice 1 always. */
function pastedVoices(put: Clip): number[] {
  const bars = put.tracks[0].bars;
  return Array.from({ length: VOICE_COUNT }, (_, v) => v).filter(v => v === 0 || bars.some(bar => hasNotes(bar.voices[v] ?? [])));
}

/** Whether a pasted clip holds more than one Voice: then each goes into its own (Q20). */
export function pastesVoices(put: Clip): boolean {
  return pastedVoices(put).length > 1;
}

/**
 * A pasted clip of several Voices put in at the cursor's time (Q20): each Voice written over its own
 * Voice there, bars staying full, or with `insert` the music after it in every Voice pushed on first.
 * Returns the clip, the Active voice's Part of it, and the time the paste covers.
 */
export function pasteVoices(whole: Clip, track: number, part: Part, at: Cursor, put: Clip, insert: boolean): { clip: Clip; part: Part; from: number; to: number } {
  const shell = partOf(put);
  const bars = put.tracks[0].bars;
  const run = (voice: number): Part => ({
    ...shell,
    bars: bars.map((bar, b) => {
      const room = lengthOf(bar.voices[0] ?? []);
      const columns = bar.voices[voice] ?? [];
      const own = hasNotes(columns) || voice === 0 ? [...columns, ...restsFor(room - lengthOf(columns))] : restsFor(room);
      const made: Bar = { ...shell.bars[b], columns: own };
      delete made.otherVoices;
      return made;
    }),
  });
  const from = part.bars[at.bar].columns.length === 0 ? timeOf(part, at.bar, 0) : cursorTime(part, at);
  let clip = whole;
  pastedVoices(put).forEach((voice, i) => {
    const target = partOf(clip, track, voice);
    // Into an empty clip the first Voice comes whole, as Insert paste brings it.
    const empty = target.bars.every(bar => bar.columns.length === 0);
    const next = empty ? insertPaste(target, at, run(voice)).clip : pasteAt(target, from, run(voice), i === 0 && insert);
    clip = editedClip(clip, track, next);
  });
  const length = lengthOf(run(0).bars.flatMap(bar => bar.columns));
  return { clip, part: partOf(clip, track, part.voice ?? 0), from, to: from + length };
}
