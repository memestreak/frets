/**
 * Re-bar by time signature, Import's option (`docs/specs/2026-11-14-tab-rebar-import-design.md`,
 * issue #482 phase 1): every Voice of every Track read as one stream with its Source bar lines taken
 * out, laid into bars by the source's time signatures, split and tied over the bar lines. Each source
 * bar's Marks go to the bar line nearest to where its music now starts; a Source bar line that no
 * longer falls on a bar line misses a downbeat, and the misses are reported in runs. Pure; no React.
 */
import { startsForm } from './directions';
import {
  DIRECTION_NAMES, barLength, barNumber, barSpan, barTicks, beatGroupsAt, hasNotes, listed, meterOffset, partOf, timeAt, timeInWords, trackName,
  withTrackParts, type Bar, type Clip, type Column, type MasterBar, type TimeSignature, type TrackBar,
} from './clip';
import { layVoices, writtenByMeter, type Span } from './timeline';

/** A Source bar line that misses a downbeat, in one Voice of one Track. */
export interface Miss {
  track: number;
  /** From 0, Voice 1. */
  voice: number;
  /** The source bar the line opens, numbered as the source numbers it. */
  bar: number;
  /** How far the line is from the nearest bar line, in ticks: negative is early, positive late. */
  offset: number;
  /** The time signature the amount is counted in. */
  time: TimeSignature;
}

export type ReBarResult =
  | { ok: true; clip: Clip; misses: Miss[]; pickupHint: boolean }
  | { ok: false; error: string };

export interface ReBarOptions {
  /**
   * The text is being pasted into an empty clip: a short first bar is a copy that started inside a bar,
   * so it is placed to end on a bar line, with a Gap before it, instead of starting on beat 1.
   */
  pasted?: boolean;
}

/** Bar Marks that a source bar starts with, moved to the bar line its music goes to. */
const START_MARKS = ['time', 'beatGroups', 'key', 'repeatStart', 'ending', 'tempo', 'section'] as const;

/** The most runs a report lists before "and N more". */
const MOST_RUNS = 4;

/** The source's bars as the meter helpers read them (they look only at the bar Marks). */
type Source = { time: TimeSignature; bars: Bar[] };

/** One Voice of one Track. */
interface Stream {
  track: number;
  voice: number;
}

/**
 * The clip re-barred by its time signatures, with the misses; the clip itself (and no misses) when every
 * bar already adds up. Refused, with why, when a tuplet would cross a bar line.
 */
export function reBarImport(clip: Clip, { pasted = false }: ReBarOptions = {}): ReBarResult {
  const n = clip.masterBars.length;
  const src: Source = { time: clip.time, bars: clip.masterBars.map(m => ({ ...m, columns: [] })) };
  const streams: Stream[] = clip.tracks.flatMap((track, t) => {
    const count = Math.max(1, ...track.bars.map(bar => bar.voices.length));
    return Array.from({ length: count }, (_, voice) => ({ track: t, voice }))
      .filter(({ voice }) => voice === 0 || track.bars.some(bar => (bar.voices[voice]?.length ?? 0) > 0));
  });
  const columnsOf = (s: Stream, k: number): Column[] => clip.tracks[s.track].bars[k]?.voices[s.voice] ?? [];
  const free = (k: number) => !!clip.masterBars[k]?.freeTime;

  // A pasted copy's short first bar ends on a bar line: the time before it is a Gap.
  const firstLength = written(columnsOf(streams[0], 0), barSpan(src, 0));
  const lead = pasted && n > 0 && !free(0) && !(clip.masterBars[0].pickup! > 0) && firstLength < barSpan(src, 0) ? barSpan(src, 0) - firstLength : 0;
  const room = (k: number) => (k === 0 && lead > 0 ? firstLength : barSpan(src, k));
  const lengthOf = (s: Stream, k: number) => written(columnsOf(s, k), room(k));

  const uneven = streams.some(s => clip.masterBars.some((_m, k) => !free(k) && columnsOf(s, k).length > 0 && lengthOf(s, k) !== barSpan(src, k)));
  if (lead === 0 && !uneven) return { ok: true, clip, misses: [], pickupHint: false };

  const masterBars: MasterBar[] = [];
  const trackBars: TrackBar[][] = clip.tracks.map(() => []);
  /** The bar each source bar's Marks went to. */
  const where: number[] = [];
  const misses: Miss[] = [];
  /** The bars laid by the meter (not free time), to be written by it. */
  const laidBars: number[] = [];

  for (let a = 0; a < n;) {
    if (free(a)) {
      where[a] = masterBars.length;
      masterBars.push({ ...clip.masterBars[a] });
      clip.tracks.forEach((track, t) => trackBars[t].push(track.bars[a]));
      a++;
      continue;
    }
    let b = a;
    while (b < n && !free(b)) b++;
    const base = masterBars.length;
    const segLead = a === 0 ? lead : 0;
    const startsOf = (s: Stream) => {
      const out: number[] = [];
      let t = segLead;
      for (let k = a; k < b; k++) {
        out.push(t);
        t += lengthOf(s, k);
      }
      return out;
    };

    // The bar lines, planned a source bar at a time: each goes to its nearest, and its time signature counts from there.
    const time = timeAt(src, a);
    const lines: Span[] = [{ length: barSpan(src, a), time, offset: meterOffset(src, a), groups: beatGroupsAt(src, a) }];
    const lineAt = [0];
    const next = () => {
      const last = lines[lines.length - 1];
      lineAt.push(lineAt[lineAt.length - 1] + last.length);
      lines.push({ length: barTicks(last.time), time: last.time, offset: 0, groups: last.groups });
    };
    const ref = startsOf(streams[0]);
    const assigned = [0];
    for (let k = a + 1; k < b; k++) {
      const s = ref[k - a];
      while (lineAt[lineAt.length - 1] + lines[lines.length - 1].length <= s) next();
      let p = lineAt.length - 1;
      while (lineAt[p] > s) p--;
      const after = lineAt[p] + lines[p].length;
      const j = s - lineAt[p] < after - s ? p : p + 1;
      if (j === lines.length) next();
      lines.length = j + 1;
      lineAt.length = j + 1;
      const own = clip.masterBars[k].time;
      if (own) lines[j] = { length: barTicks(own), time: own, offset: 0, groups: beatGroupsAt(src, k) };
      assigned.push(j);
    }
    const spanOf = (i: number): Span => {
      while (lines.length <= i) next();
      return lines[i];
    };

    const voices = streams.map(s => Array.from({ length: b - a }, (_, i) => columnsOf(s, a + i)));
    const rooms = Array.from({ length: b - a }, (_, i) => room(a + i));
    const laid = layVoices(voices, rooms, spanOf, assigned[assigned.length - 1] + 1, true, segLead);
    if (!laid) {
      const bar = tupletAcross(streams.map(startsOf), voices, spanOf, a, src);
      return { ok: false, error: `Can't re-bar: the tuplet in source bar ${bar} would cross a bar line. Turn off Re-bar by time signature to import it as written.` };
    }
    const count = laid[0].length;
    spanOf(count);

    // The misses: each Voice's Source bar lines against the bar lines laid.
    streams.forEach(s => {
      const starts = startsOf(s);
      for (let k = a + 1; k < b; k++) {
        const t = starts[k - a];
        let p = 0;
        while (p + 1 <= count && lineAt[p + 1] <= t) p++;
        const after = lineAt[p] + lines[p].length;
        const j = t - lineAt[p] < after - t ? p : p + 1;
        const offset = t - (j === p ? lineAt[p] : after);
        if (offset !== 0) misses.push({ track: s.track, voice: s.voice, bar: barNumber(src, k), offset, time: lines[p].time });
      }
    });

    // The bar Marks, each source bar's at the bar line its music goes to.
    const marks: MasterBar[] = Array.from({ length: count }, () => ({}));
    const extras: string[][][] = clip.tracks.map(() => Array.from({ length: count }, () => []));
    for (let k = a; k < b; k++) {
      const j = assigned[k - a];
      const m = clip.masterBars[k];
      if (m.time) delete marks[j].beatGroups;
      for (const key of START_MARKS) if (m[key] !== undefined) Object.assign(marks[j], { [key]: m[key] });
      if (k === 0 && m.pickup !== undefined) marks[j].pickup = m.pickup;
      const closes = k + 1 < b ? Math.max(j, assigned[k + 1 - a] - 1) : count - 1;
      if (m.repeatEnd !== undefined) marks[closes].repeatEnd = m.repeatEnd;
      if (m.doubleBar) marks[closes].doubleBar = true;
      // Segno and Coda where the bar's music starts, the jumps and Fine where it ends (issue #496).
      for (const name of m.directions ?? []) {
        const into = marks[startsForm(name) ? j : closes];
        into.directions = DIRECTION_NAMES.filter(n => n === name || into.directions?.includes(n));
      }
      clip.tracks.forEach((track, t) => extras[t][j].push(...(track.bars[k].extra ?? [])));
      where[k] = base + j;
    }
    masterBars.push(...marks);
    clip.tracks.forEach((_track, t) => {
      for (let i = 0; i < count; i++) {
        const own: Column[][] = [];
        streams.forEach((s, v) => {
          if (s.track !== t) return;
          const columns = laid[v][i];
          own[s.voice] = s.voice > 0 && !hasNotes(columns) ? [] : columns;
        });
        const all = Array.from(own, columns => columns ?? []);
        while (all.length > 1 && all[all.length - 1].length === 0) all.pop();
        const bar: TrackBar = { voices: all };
        if (extras[t][i].length > 0) bar.extra = extras[t][i];
        trackBars[t].push(bar);
      }
    });
    for (let i = 0; i < count; i++) laidBars.push(base + i);
    a = b;
  }

  // A time signature that went to bar 1 is the clip's own: bar 1 keeps none (`timeAt`).
  const opening = masterBars[0]?.time;
  if (opening) delete masterBars[0].time;
  const out: Clip = { ...clip, time: opening ?? clip.time, masterBars, tracks: clip.tracks.map((track, t) => ({ ...track, bars: trackBars[t] })) };
  if (clip.systemsLayout?.length) out.systemsLayout = linesMapped(clip.systemsLayout, where, n, masterBars.length);
  const parts = clip.tracks.map((_track, t) => writtenByMeter(partOf(out, t), laidBars));
  const made = withTrackParts(out, parts);

  const first = misses.filter(m => m.track === 0 && m.voice === 0);
  const pickupHint = !pasted && n > 1 && !free(0) && !(clip.masterBars[0].pickup! > 0) && firstLength < barSpan(src, 0)
    && first.length === n - 1 && first.every(m => m.offset === first[0].offset);
  return { ok: true, clip: made, misses, pickupHint };
}

/** A Voice's bar as long as its Columns, or `room` when it is empty (an absent Voice is a Gap). */
function written(columns: Column[], room: number): number {
  return columns.length > 0 ? barLength({ columns }) : room;
}

/** The source bar number of the first tuplet a bar line would cross, from the bar lines `spanOf` lays. */
function tupletAcross(starts: number[][], voices: Column[][][], spanOf: (i: number) => Span, a: number, src: Source): number {
  const lines: number[] = [];
  const crosses = (from: number, to: number) => {
    while (lines.length === 0 || lines[lines.length - 1] < to) lines.push((lines[lines.length - 1] ?? 0) + spanOf(lines.length).length);
    return lines.some(line => line > from && line < to);
  };
  for (let v = 0; v < voices.length; v++) {
    for (let i = 0; i < voices[v].length; i++) {
      let t = starts[v][i];
      let from = -1;
      for (const column of voices[v][i]) {
        if (column.grace) continue;
        const length = barLength({ columns: [column] });
        if (column.duration.tuplet && from < 0) from = t;
        if (!column.duration.tuplet && from >= 0) {
          if (crosses(from, t)) return barNumber(src, a + i);
          from = -1;
        }
        t += length;
      }
      if (from >= 0 && crosses(from, t)) return barNumber(src, a + i);
    }
  }
  return barNumber(src, a);
}

/** The clip's Line breaks (bars per System), each System's first source bar moved to the bar its Marks went to. */
function linesMapped(layout: number[], where: number[], n: number, total: number): number[] {
  const starts = [0];
  for (const count of layout) starts.push(starts[starts.length - 1] + count);
  const mapped = starts.map(b => (b >= n ? total : where[b]));
  const counts: number[] = [];
  for (let i = 1; i < mapped.length; i++) if (mapped[i] > mapped[i - 1]) counts.push(mapped[i] - mapped[i - 1]);
  return counts;
}

/**
 * The line under the clip for the misses: runs of Source bar lines that miss by the same amount, a
 * sentence for each Track and Voice ("Lead, Voice 2: Source bar lines miss a downbeat at bars 9–22 (a
 * 16th early)."), and the Pickup hint; null when nothing misses.
 */
export function missReport(clip: Clip, misses: Miss[], pickupHint: boolean): string | null {
  if (misses.length === 0) return null;
  const sentences: string[] = [];
  const keys = [...new Set(misses.map(m => `${m.track}:${m.voice}`))];
  for (const key of keys) {
    const own = misses.filter(m => `${m.track}:${m.voice}` === key);
    const runs: { from: Miss; to: number }[] = [];
    for (const miss of own) {
      const last = runs[runs.length - 1];
      if (last && miss.bar === last.to + 1 && miss.offset === last.from.offset) last.to = miss.bar;
      else runs.push({ from: miss, to: miss.bar });
    }
    const texts = runs.map(({ from, to }) =>
      `${from.bar}${to > from.bar ? `–${to}` : ''} (${timeInWords(Math.abs(from.offset), from.time)} ${from.offset < 0 ? 'early' : 'late'})`);
    const shown = texts.length > MOST_RUNS ? `${texts.slice(0, MOST_RUNS).join(', ')} and ${texts.length - MOST_RUNS} more` : listed(texts);
    const one = runs.length === 1 && runs[0].to === runs[0].from.bar;
    const { track, voice } = own[0];
    const who = [clip.tracks.length > 1 ? trackName(clip, track) : '', voice > 0 ? `Voice ${voice + 1}` : ''].filter(Boolean).join(', ');
    sentences.push(`${who ? `${who}: ` : ''}Source bar lines miss a downbeat at ${one ? 'bar' : 'bars'} ${shown}.`);
  }
  if (pickupHint) sentences.push("If bar 1 is a pickup, set its length in bar 1's Pickup field.");
  return sentences.join(' ');
}
