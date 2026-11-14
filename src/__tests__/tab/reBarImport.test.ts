/**
 * Re-bar by time signature, Import's option (`docs/specs/2026-11-14-tab-rebar-import-design.md`):
 * the notes laid into bars by the time signatures, bar Marks at the nearest bar line, misses in runs.
 */
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { writeBars } from '@/features/tab/alphatex';
import { isUneven, partOf, type Clip } from '@/features/tab/clip';
import { missReport, reBarImport } from '@/features/tab/reBarImport';

function read(text: string): Clip {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.clip;
}

function reBarred(text: string, pasted = false) {
  const source = read(text);
  const result = reBarImport(source, { pasted });
  if (!result.ok) throw new Error(result.error);
  return { clip: result.clip, report: missReport(source, result.misses, result.pickupHint) };
}

const bars = (clip: Clip, track = 0, voice = 0) => writeBars(partOf(clip, track, voice)).join(' ');
const even = (clip: Clip) => clip.tracks.every((_t, t) => {
  const part = partOf(clip, t);
  return part.bars.every((_bar, b) => !isUneven(part, b));
});

/** `count` bars of 4/4 quarters, bar `k` (from 1) a 16th short when listed in `short`. */
function long(count: number, short: number[]): string {
  return Array.from({ length: count }, (_, i) =>
    short.includes(i + 1) ? '5.1.4 5.1.4 5.1.4 5.1.8{d} |' : '5.1.4 5.1.4 5.1.4 5.1.4 |').join(' ');
}

describe('Re-bar by time signature', () => {
  it('a clip whose bars all add up is the very same clip, with no report', () => {
    const source = read('\\ts (4 4)\n\\section "A"\n1.1.4 2.1.4 3.1.4 4.1.4 | 5.1.1 |');
    const result = reBarImport(source);
    expect(result.ok && result.clip).toBe(source);
    expect(result.ok && result.misses).toEqual([]);
  });

  it('a short first bar: the notes flow on, one miss, and the Pickup hint', () => {
    const { clip, report } = reBarred('\\ts (4 4)\n5.1.4 5.1.4 5.1.4 | 7.1.4 7.1.4 7.1.4 7.1.4 |');
    expect(bars(clip)).toBe('5.1.4 5.1.4 5.1.4 7.1.4 | 7.1.4 7.1.4 7.1.4 r.4 |');
    expect(report).toBe("Source bar lines miss a downbeat at bar 2 (1 beat early). If bar 1 is a pickup, set its length in bar 1's Pickup field.");
  });

  it('a note over a bar line is split and tied by the meter', () => {
    const { clip, report } = reBarred('\\ts (4 4)\n5.1.2 5.1.2 7.1.8 | 9.1.1 |');
    expect(bars(clip)).toBe('5.1.2 5.1.2 | 7.1.8 9.1.8 -.1.4 -.1.2 | -.1.8 r.8 r.4 r.2 |');
    expect(even(clip)).toBe(true);
    expect(report).toBe('Source bar lines miss a downbeat at bar 2 (an 8th late).');
  });

  it('misses are grouped in runs, each with its amount', () => {
    const { clip, report } = reBarred(`\\ts (4 4)\n${long(60, [8, 22])}`);
    expect(even(clip)).toBe(true);
    expect(report).toBe('Source bar lines miss a downbeat at bars 9–22 (a 16th early) and 23–60 (an 8th early).');
  });

  it('past four runs, the rest are counted', () => {
    // Short and long by turns: each source bar line is a run of its own.
    const text = Array.from({ length: 12 }, (_, i) => (i % 2 === 0 ? '5.1.4 5.1.4 5.1.4 5.1.8{d} |' : '5.1.4 5.1.4 5.1.4 5.1.4 5.1.16 |')).join(' ');
    const { report } = reBarred(`\\ts (4 4)\n${text}`);
    expect(report).toBe('Source bar lines miss a downbeat at bars 2 (a 16th early), 4 (a 16th early), 6 (a 16th early), 8 (a 16th early) and 2 more.');
  });

  it('a section goes to the nearest bar line; exactly halfway, to the later one', () => {
    const near = reBarred('\\ts (4 4)\n5.1.1 | 5.1.4 5.1.4 5.1.4 5.1.8{d} | \\section "Chorus" 7.1.1 |').clip;
    expect(near.masterBars[2].section?.text).toBe('Chorus');
    const half = reBarred('\\ts (4 4)\n5.1.2 | \\section "Chorus" 7.1.1 |').clip;
    expect(half.masterBars[1].section?.text).toBe('Chorus');
    expect(half.masterBars[0].section).toBeUndefined();
  });

  it('a time signature takes effect from its nearest bar line', () => {
    const { clip } = reBarred('\\ts (4 4)\n5.1.4 5.1.4 5.1.4 5.1.8{d} | \\ts (3 4) 7.1.4 7.1.4 7.1.4 | 7.1.2 |');
    expect(clip.masterBars[1].time).toEqual({ beats: 3, value: 4 });
    expect(bars(clip)).toBe('5.1.4 5.1.4 5.1.4 5.1.8{d} 7.1.16 | \\ts (3 4) -.1.8{d} 7.1.16 -.1.8{d} 7.1.16 -.1.8{d} 7.1.16 | -.1.4{dd} r.16 r.4 |');
    expect(even(clip)).toBe(true);
  });

  it('a time signature that goes to bar 1 is the clip’s own, and bar 1 is full in it', () => {
    // Source bar 1 is a 16th long in 6/8, so source bar 2's 7/8 goes to bar 1's line (found by fuzzing).
    const { clip } = reBarred('\\ts (6 8)\n5.1.16 | \\ts (7 8) 7.1.4 7.1.4 7.1.4 7.1.8 | 9.1.4{d} 9.1.4{d} |');
    expect(clip.time).toEqual({ beats: 7, value: 8 });
    expect(clip.masterBars[0].time).toBeUndefined();
    expect(even(clip)).toBe(true);
  });

  it("a repeat's end closes the bar before the one the next source bar goes to", () => {
    const { clip } = reBarred('\\ts (4 4)\n\\ro 5.1.1 | \\rc 2 5.1.4 5.1.4 5.1.4 5.1.8{d} | 7.1.1 |');
    expect(clip.masterBars[1].repeatEnd).toBe(2);
    expect(clip.masterBars[0].repeatStart).toBe(true);
  });

  it('two source bars on one bar line: the later one’s tempo is kept', () => {
    const { clip } = reBarred('\\ts (4 4)\n\\tempo 90 5.1.16 | \\tempo 120 7.1.1 |');
    expect(clip.masterBars[0].tempo?.bpm).toBe(120);
  });

  it('a tuplet that would cross a bar line refuses the re-bar, naming its source bar', () => {
    const result = reBarImport(read('\\ts (4 4)\n5.1.2 5.1.4 | 5.1.4{tu 3} 5.1.4{tu 3} 5.1.4{tu 3} 7.1.2 |'));
    expect(result).toEqual({ ok: false, error: "Can't re-bar: the tuplet in source bar 2 would cross a bar line. Turn off Re-bar by time signature to import it as written." });
  });

  it('a free-time bar stays as written; the short bar before it ends in a Gap; after it, a fresh downbeat', () => {
    const { clip, report } = reBarred('\\ts (4 4)\n5.1.4 5.1.4 5.1.4 | \\ft 7.1.8 7.1.8 7.1.8 | \\ts (4 4) 9.1.1 |');
    expect(bars(clip)).toBe('5.1.4 5.1.4 5.1.4 r.4 | \\ft 7.1.8 7.1.8 7.1.8 | 9.1.1 |');
    expect(report).toBeNull();
  });

  it('two Tracks end with the same bars, and each Track names its misses', () => {
    const { clip, report } = reBarred([
      '\\track "Lead"', '\\ts (4 4)', '5.1.4 5.1.4 5.1.4 | 7.1.1 |',
      '\\track "Rhythm"', '5.6.1 | 7.6.1 |',
    ].join('\n'));
    expect(clip.tracks.map(t => t.bars.length)).toEqual([2, 2]);
    expect(report).toBe("Lead: Source bar lines miss a downbeat at bar 2 (1 beat early). If bar 1 is a pickup, set its length in bar 1's Pickup field.");
  });

  it('a second Voice names itself', () => {
    const { report } = reBarred('\\ts (4 4)\n\\voice 5.1.1 | 7.1.1 |\n\\voice 5.6.2 5.6.4 | 7.6.1 |');
    expect(report).toBe('Voice 2: Source bar lines miss a downbeat at bar 2 (1 beat early).');
  });

  it('pasted, a copy from beat 2 lands on beat 2 again, with no misses', () => {
    const { clip, report } = reBarred('\\ts (4 4)\n5.1.4 5.1.4 5.1.4 | 7.1.4 7.1.4 |', true);
    expect(bars(clip)).toBe('r.4 5.1.4 5.1.4 5.1.4 | 7.1.4 7.1.4 r.2 |');
    expect(report).toBeNull();
  });

  it('Line breaks follow the bar their System starts with', () => {
    const { clip } = reBarred('\\ts (4 4)\n\\systemsLayout (2 1)\n5.1.2 | 5.1.2 | 7.1.1 | 9.1.1 |');
    expect(clip.systemsLayout).toEqual([1, 1]);
  });
});
