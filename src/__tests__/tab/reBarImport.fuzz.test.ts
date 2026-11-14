/**
 * Fuzzing Re-bar by time signature (`docs/specs/2026-11-14-tab-rebar-import-design.md`): random
 * alphaTex, uneven bars and all, re-barred and checked against what must hold whatever the input.
 * Seeded, so a failure names the seed and the text that broke it.
 */
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { writeAlphaTex } from '@/features/tab/alphatex';
import { barLength, barSpan, isUneven, partOf, type Clip } from '@/features/tab/clip';
import { missReport, reBarImport } from '@/features/tab/reBarImport';
import { seededRng } from '../helpers/rng';

type Rng = () => number;

function read(text: string): Clip {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(`${result.errors.join('\n')}\n${text}`);
  return result.clip;
}

const pick = <T,>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];

/** Lengths in 64ths, with their alphaTex durations. */
const LENGTHS: [number, string][] = [
  [64, '1'], [48, '2{d}'], [32, '2'], [24, '4{d}'], [16, '4'], [12, '8{d}'], [8, '8'], [6, '16{d}'], [4, '16'], [2, '32'],
];
const TIMES: [number, number][] = [[4, 4], [3, 4], [2, 4], [6, 8], [5, 8], [7, 8]];
const SECTIONS = ['Intro', 'Verse', 'Chorus', 'Bridge', 'Solo', 'Outro'];

interface GenOptions {
  tuplets: boolean;
  freeTime: boolean;
  tracks: number;
  voices: number;
  /** The chance a bar is uneven. */
  uneven: number;
}

interface Generated {
  text: string;
  hasTuplets: boolean;
}

/** One Voice's bar of random notes, `room` 64ths long. */
function barText(rng: Rng, room: number, opts: GenOptions, state: { lastString: number | null }, used: { tuplet: boolean }): string {
  const out: string[] = [];
  let r = room;
  while (r > 0) {
    if (opts.tuplets && r >= 16 && rng() < 0.06) {
      for (let i = 0; i < 3; i++) out.push(`${Math.floor(rng() * 13)}.${1 + Math.floor(rng() * 6)}.8{tu 3}`);
      used.tuplet = true;
      state.lastString = null;
      r -= 16;
      continue;
    }
    const [len, dur] = pick(rng, LENGTHS.filter(([l]) => l <= r));
    const roll = rng();
    if (roll < 0.15) {
      out.push(`r.${dur}`);
      state.lastString = null;
    } else if (roll < 0.25 && state.lastString !== null) {
      out.push(`-.${state.lastString}.${dur}`);
    } else if (roll < 0.4) {
      const a = 1 + Math.floor(rng() * 3);
      const b = 4 + Math.floor(rng() * 3);
      out.push(`(${Math.floor(rng() * 13)}.${a} ${Math.floor(rng() * 13)}.${b}).${dur}`);
      state.lastString = null;
    } else {
      const s = 1 + Math.floor(rng() * 6);
      out.push(`${Math.floor(rng() * 13)}.${s}.${dur}`);
      state.lastString = s;
    }
    r -= len;
  }
  return out.join(' ');
}

function generate(rng: Rng, opts: GenOptions): Generated {
  const count = 2 + Math.floor(rng() * 14);
  let time = OPENING;
  const used = { tuplet: false };
  // The bar Marks, shared, written in the first Track's Voice 1.
  const marks: string[] = [];
  const spans: number[] = [];
  let free = false;
  for (let k = 0; k < count; k++) {
    const own: string[] = [];
    const wasFree = free;
    free = opts.freeTime && k > 0 && rng() < 0.12;
    if (!free && k > 0 && rng() < 0.15) {
      time = pick(rng, TIMES);
      own.push(`\\ts (${time[0]} ${time[1]})`);
    } else if (!free && wasFree) {
      own.push(`\\ts (${time[0]} ${time[1]})`);
    }
    if (free) own.push('\\ft');
    if (rng() < 0.15) own.push(`\\section "${pick(rng, SECTIONS)}"`);
    if (rng() < 0.1) own.push(`\\tempo ${60 + Math.floor(rng() * 120)}`);
    if (rng() < 0.08) own.push('\\ro');
    if (rng() < 0.08) own.push('\\rc 2');
    marks.push(own.join(' '));
    spans.push((time[0] * 64) / time[1]);
  }
  const lengthOf = (k: number) => {
    const full = spans[k];
    if (rng() >= opts.uneven) return full;
    const delta = pick(rng, [2, 4, 8, 16, Math.floor(rng() * full / 2) * 2]) * (rng() < 0.5 ? -1 : 1);
    return Math.max(2, full + delta);
  };
  const lines: string[] = [];
  for (let t = 0; t < opts.tracks; t++) {
    if (opts.tracks > 1) lines.push(`\\track "T${t + 1}"`);
    if (t === 0) lines.push(`\\ts (${OPENING[0]} ${OPENING[1]})`);
    const voices = opts.voices > 1 ? opts.voices : 1;
    const trackBars = t > 0 ? Math.max(1, count - Math.floor(rng() * 3)) : count;
    for (let v = 0; v < voices; v++) {
      const state = { lastString: null as number | null };
      const bars: string[] = [];
      for (let k = 0; k < trackBars; k++) {
        const head = t === 0 && v === 0 ? marks[k] : '';
        bars.push(`${head} ${barText(rng, lengthOf(k), opts, state, used)} |`.trim());
      }
      lines.push(`${voices > 1 ? '\\voice ' : ''}${bars.join(' ')}`);
    }
  }
  return { text: lines.join('\n'), hasTuplets: used.tuplet };
}

/** The time signature bar 1 is in, picked per seed. */
let OPENING: [number, number] = [4, 4];

/** A Sounding note: a Tie chain counted once, from where it starts to where it stops. */
interface Sounding {
  at: number;
  string: number;
  fret: number | null;
  end: number;
}

/** Each Voice of each Track as its Sounding notes, timed from the start of the stream less `lead`. */
function soundings(clip: Clip, track: number, voice: number, lead = 0, firstRoom?: number): Sounding[] {
  const part = partOf(clip, track, 0);
  const out: Sounding[] = [];
  const ringing = new Map<number, Sounding>();
  let t = 0 - lead;
  // The Track's own bars: `partOf` fills an absent Voice with rests.
  clip.tracks[track].bars.forEach((own, b) => {
    const bar = { columns: own.voices[voice] ?? [] };
    if (bar.columns.length === 0) {
      // A Gap, as long as its bar: a pasted copy's first bar is as long as its Voice 1.
      t += b === 0 && firstRoom !== undefined ? firstRoom : barSpan(part, b);
      return;
    }
    for (const column of bar.columns) {
      const len = column.grace ? 0 : barLength({ columns: [column] });
      column.notes.forEach((note, s) => {
        if (!note) return;
        const held = ringing.get(s);
        if (note.tie && held && held.end === t) {
          held.end = t + len;
          return;
        }
        const sounding = { at: t, string: s, fret: note.fret, end: t + len };
        out.push(sounding);
        ringing.set(s, sounding);
      });
      t += len;
    }
  });
  return out;
}

/** The notes played, not held by a Tie: what free time, which breaks the flow, must keep. */
function attacks(clip: Clip, track: number, voice: number): number {
  return partOf(clip, track, voice).bars.reduce((n, bar) => n + bar.columns.reduce((m, c) => m + c.notes.filter(x => x && !x.tie).length, 0), 0);
}

/** Where each source bar starts in its stream (an empty bar is a Gap as long as its bar). */
function sourceStarts(clip: Clip, track: number, voice: number): number[] {
  const part = partOf(clip, track, voice);
  const out: number[] = [];
  let t = 0;
  part.bars.forEach((bar, b) => {
    out.push(t);
    t += bar.columns.length > 0 ? barLength(bar) : barSpan(part, b);
  });
  return out;
}

function voiceCount(clip: Clip, t: number): number {
  return Math.max(1, ...clip.tracks[t].bars.map(bar => bar.voices.length));
}

const SEEDS = Number(process.env.FUZZ_SEEDS ?? 300);
/** Each seed takes a few milliseconds; FUZZ_SEEDS=3000 runs a deeper pass. */
const TIMEOUT = Math.max(20_000, SEEDS * 40);

function check(seed: number, opts: GenOptions, pasted: boolean) {
  const rng = seededRng(seed);
  OPENING = pick(rng, TIMES);
  const { text, hasTuplets } = generate(rng, opts);
  const where = `seed ${seed}${pasted ? ' (pasted)' : ''}:\n${text}`;
  const source = read(text);
  const result = reBarImport(source, { pasted });
  if (!result.ok) {
    expect(hasTuplets, `refused without a tuplet, ${where}\n${result.error}`).toBe(true);
    expect(result.error).toMatch(/^Can't re-bar: the tuplet in source bar \d+ would cross a bar line\./);
    return 'refused';
  }
  const { clip } = result;

  // Every Track has as many bars, and every bar with a meter is full, in every Voice.
  const counts = clip.tracks.map(tr => tr.bars.length);
  expect(new Set(counts).size, `bar counts ${counts}, ${where}`).toBe(1);
  expect(clip.masterBars.length, where).toBe(counts[0]);
  clip.tracks.forEach((_tr, t) => {
    for (let v = 0; v < voiceCount(clip, t); v++) {
      const part = partOf(clip, t, v);
      part.bars.forEach((bar, b) => {
        if (bar.freeTime || bar.columns.length === 0) return;
        expect(isUneven(part, b), `track ${t} voice ${v} bar ${b + 1} uneven, ${where}\n${writeAlphaTex(clip)}`).toBe(false);
      });
    }
  });

  // The music is the same: every Sounding note at the same time, as long. (Free time resets the stream.)
  const hasFree = source.masterBars.some(m => m.freeTime);
  const first = partOf(source, 0, 0);
  const firstLen = first.bars[0].columns.length > 0 ? barLength(first.bars[0]) : barSpan(first, 0);
  const lead = pasted && !first.bars[0].freeTime && firstLen < barSpan(first, 0) ? barSpan(first, 0) - firstLen : 0;
  source.tracks.forEach((_tr, t) => {
    for (let v = 0; v < voiceCount(source, t); v++) {
      const before = soundings(source, t, v, 0, lead > 0 ? firstLen : undefined);
      const after = soundings(clip, t, v, lead);
      if (hasFree) expect(attacks(clip, t, v), `notes lost, track ${t} voice ${v}, ${where}`).toBe(attacks(source, t, v));
      else expect(after, `track ${t} voice ${v} changed, ${where}\n${writeAlphaTex(clip)}`).toEqual(before);
    }
  });

  // The misses are exactly the Source bar lines off a bar line, each by the nearest one (Voice 1 of Track 1).
  if (!hasFree) {
    const lines = [0];
    const outPart = partOf(clip, 0, 0);
    outPart.bars.forEach((_bar, b) => lines.push(lines[lines.length - 1] + barSpan(outPart, b)));
    const starts = sourceStarts(source, 0, 0).map(s => s + lead);
    const expected = starts.slice(1).flatMap((s, i) => {
      if (lines.includes(s)) return [];
      return [i + 2];
    });
    const got = result.misses.filter(m => m.track === 0 && m.voice === 0).map(m => m.bar);
    expect(got, `misses, ${where}`).toEqual(expected);
    for (const miss of result.misses) {
      const near = Math.min(...lines.map(l => Math.abs(l - (starts[miss.bar - 1] ?? l))));
      if (miss.track === 0 && miss.voice === 0) expect(Math.abs(miss.offset), `offset bar ${miss.bar}, ${where}`).toBe(near);
    }
  }

  // Bar Marks: sections and time signatures kept in order, never more than the source had.
  const texts = (c: Clip) => c.masterBars.flatMap(m => (m.section ? [m.section.text] : []));
  const isSubsequence = (a: string[], b: string[]) => {
    let i = 0;
    for (const x of b) if (x === a[i]) i++;
    return i === a.length;
  };
  expect(isSubsequence(texts(clip), texts(source)), `sections ${texts(clip)} from ${texts(source)}, ${where}`).toBe(true);
  const lastSection = [...source.masterBars].reverse().find(m => m.section)?.section?.text;
  if (lastSection) expect(texts(clip).at(-1), `last section lost, ${where}`).toBe(lastSection);

  // The report reads; it counts past four runs.
  const report = missReport(source, result.misses, result.pickupHint);
  if (result.misses.length === 0) expect(report).toBeNull();
  else expect(report).toMatch(/Source bar lines miss a downbeat at bars? \d/);

  // Re-barred again, it is already full: the very same clip.
  const again = reBarImport(clip);
  expect(again.ok && again.clip === clip, `not settled, ${where}\n${writeAlphaTex(clip)}`).toBe(true);

  // Written out and read back, it reads as full bars with the same music.
  const back = read(writeAlphaTex(clip));
  back.tracks.forEach((_tr, t) => {
    const part = partOf(back, t, 0);
    part.bars.forEach((bar, b) => {
      if (bar.freeTime || bar.columns.length === 0) return;
      expect(isUneven(part, b), `read back uneven, bar ${b + 1}, ${where}\n${writeAlphaTex(clip)}`).toBe(false);
    });
    expect(soundings(back, t, 0), `read back changed, ${where}`).toEqual(soundings(clip, t, 0));
  });
  return 'ok';
}

const MODES: [string, GenOptions][] = [
  ['one Voice', { tuplets: false, freeTime: false, tracks: 1, voices: 1, uneven: 0.35 }],
  ['every bar uneven', { tuplets: false, freeTime: false, tracks: 1, voices: 1, uneven: 1 }],
  ['two Tracks', { tuplets: false, freeTime: false, tracks: 2, voices: 1, uneven: 0.35 }],
  ['two Voices', { tuplets: false, freeTime: false, tracks: 1, voices: 2, uneven: 0.35 }],
  ['tuplets', { tuplets: true, freeTime: false, tracks: 1, voices: 1, uneven: 0.35 }],
  ['free time', { tuplets: false, freeTime: true, tracks: 1, voices: 1, uneven: 0.35 }],
  ['everything', { tuplets: true, freeTime: true, tracks: 2, voices: 2, uneven: 0.5 }],
];

describe('Re-bar by time signature, fuzzed', () => {
  for (const [name, opts] of MODES) {
    for (const pasted of [false, true]) {
      it(`${name}${pasted ? ', pasted' : ''}`, () => {
        const tally = { ok: 0, refused: 0 };
        for (let seed = 1; seed <= SEEDS; seed++) tally[check(seed * 7919 + name.length, opts, pasted)]++;
        expect(tally.ok).toBeGreaterThan(0);
      }, TIMEOUT);
    }
  }

  it('a clip whose bars all add up comes back the very same clip', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const rng = seededRng(seed);
      OPENING = pick(rng, TIMES);
      const { text } = generate(rng, { tuplets: true, freeTime: true, tracks: 2, voices: 2, uneven: 0 });
      const source = read(text);
      const result = reBarImport(source);
      expect(result.ok && result.clip === source, `seed ${seed}:\n${text}`).toBe(true);
    }
  }, TIMEOUT);
});
