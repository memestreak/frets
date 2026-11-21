/**
 * Export and copy selected bars (`docs/specs/2026-11-21-tab-export-bars-design.md`, issue #532): the bars cut
 * from the whole clip as a clip of their own, their name, and an image's bar numbers.
 */
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { writeAlphaTex } from '@/features/tab/alphatex';
import { barsName, clipOfBars, imagePart } from '@/features/tab/barExport';
import { barNumber, type Clip } from '@/features/tab/clip';
import { DEFAULT_TAB_EXPORT } from '@/features/tab/exportTab';

function read(text: string): Clip {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.clip;
}

describe('clipOfBars', () => {
  it('cuts out the bars asked for, and nothing else', () => {
    const clip = read('\\ts (4 4)\n0.6.1 |\n2.6.1 |\n3.6.1 |\n5.6.1 |');
    expect(writeAlphaTex(clipOfBars(clip, [1, 2]))).toBe(writeAlphaTex(read('\\ts (4 4)\n2.6.1 |\n3.6.1 |')));
    expect(writeAlphaTex(clipOfBars(clip, [3, 3]))).toBe(writeAlphaTex(read('\\ts (4 4)\n5.6.1 |')));
    expect(writeAlphaTex(clipOfBars(clip, [0, 3]))).toBe(writeAlphaTex(clip));
  });

  it('starts on the time signature, key and tempo in force there, set on an earlier bar', () => {
    const clip = read('\\ts (4 4)\n\\ks G \\tempo 90 0.6.1 |\n\\ts (3 4) 0.6.2{d} |\n2.6.2{d} |\n\\tempo 120 3.6.2{d} |');
    const cut = clipOfBars(clip, [2, 3]);
    expect(cut.time).toEqual({ beats: 3, value: 4 });
    expect(cut.masterBars[0].time).toBeUndefined();
    expect(cut.masterBars[0].key).toEqual(clip.masterBars[0].key);
    expect(cut.masterBars[0].tempo).toEqual({ bpm: 90 });
    expect(cut.masterBars[1].tempo).toEqual({ bpm: 120 });
    // The marks set inside the range stay where they are.
    expect(writeAlphaTex(cut)).toBe(writeAlphaTex(read('\\ts (3 4)\n\\ks G \\tempo 90 2.6.2{d} |\n\\tempo 120 3.6.2{d} |')));
  });

  it('with Start with turned off, says only what the first bar sets itself', () => {
    const clip = read('\\ts (4 4)\n\\ks G \\tempo 90 0.6.1 |\n\\ts (3 4) 0.6.2{d} |\n2.6.2{d} |');
    const off = { startKey: false, startTime: false, startTempo: false };
    const cut = clipOfBars(clip, [2, 2], off);
    // No time signature of its own: the clip's first.
    expect(cut.time).toEqual({ beats: 4, value: 4 });
    expect(cut.masterBars[0].key).toBeUndefined();
    expect(cut.masterBars[0].tempo).toBeUndefined();
    // A bar that sets its own time signature keeps it.
    expect(clipOfBars(clip, [1, 2], off).time).toEqual({ beats: 3, value: 4 });
    // Each one on its own.
    const keyOnly = clipOfBars(clip, [2, 2], { ...off, startKey: true });
    expect(keyOnly.masterBars[0].key).toEqual(clip.masterBars[0].key);
    expect(keyOnly.masterBars[0].tempo).toBeUndefined();
    expect(clipOfBars(clip, [2, 2], { ...off, startTempo: true }).masterBars[0].tempo).toEqual({ bpm: 90 });
    expect(clipOfBars(clip, [2, 2], { ...off, startTime: true }).time).toEqual({ beats: 3, value: 4 });
  });

  it('says no key or tempo when the whole clip sets none', () => {
    const cut = clipOfBars(read('\\ts (4 4)\n0.6.1 |\n2.6.1 |'), [1, 1]);
    expect(cut.masterBars[0].key).toBeUndefined();
    expect(cut.masterBars[0].tempo).toBeUndefined();
  });

  it('keeps the Beat groups in force, and drops ones that are only the default', () => {
    const clip = read('\\ts (7 8)\n\\beaming (8 3 2 2) :8 0.6 0.6 0.6 0.6 0.6 0.6 0.6 |\n:8 2.6 2.6 2.6 2.6 2.6 2.6 2.6 |');
    expect(clipOfBars(clip, [1, 1]).masterBars[0].beatGroups).toEqual([3, 2, 2]);
    const plain = read('\\ts (7 8)\n:8 0.6 0.6 0.6 0.6 0.6 0.6 0.6 |\n:8 2.6 2.6 2.6 2.6 2.6 2.6 2.6 |');
    expect(clipOfBars(plain, [1, 1]).masterBars[0].beatGroups).toBeUndefined();
  });

  it('keeps a Pickup bar only when bar 1 is in the range', () => {
    const clip = read('\\ts (4 4)\n\\ac 0.6.4 |\n2.6.1 |\n3.6.1 |');
    expect(clipOfBars(clip, [0, 1]).masterBars[0].pickup).toBe(clip.masterBars[0].pickup);
    expect(clipOfBars(clip, [1, 2]).masterBars[0].pickup).toBeUndefined();
  });

  it('plays a note tied over from before the range as a plain note, and keeps ties inside it', () => {
    const clip = read('\\ts (4 4)\n5.1.2 -.1.2 |\n-.1.2 -.1.2 |\n7.1.1 |');
    const cut = clipOfBars(clip, [1, 2]);
    const [first, second] = cut.tracks[0].bars[0].voices[0];
    expect(first.notes[0]?.tie).toBeUndefined();
    expect(first.notes[0]?.fret).toBe(5);
    expect(second.notes[0]?.tie).toBe(true);
  });

  it('takes every track and every Voice, each keeping its own sound and tuning', () => {
    const clip = read([
      '\\track "Gtr I"', '\\ts (4 4)', '5.3.1 | 7.3.1 | 8.3.1 |',
      '\\track "Gtr II"', '\\tuning (E4 B3 G3 D3 A2 D2)', '\\capo 2', '0.6.1 | 3.6.1 | 5.6.1 |', '',
    ].join('\n'));
    const cut = clipOfBars(clip, [1, 2]);
    expect(cut.tracks.map(t => t.bars.length)).toEqual([2, 2]);
    expect(cut.masterBars).toHaveLength(2);
    expect(cut.tracks[1].tuning).toEqual(clip.tracks[1].tuning);
    expect(cut.tracks[1].capo).toBe(2);
    expect(cut.tracks[1].bars[0].voices[0][0].notes[5]?.fret).toBe(3);
  });

  it('leaves the clip\'s own line layout out: it was for the whole clip', () => {
    const clip = read('\\systemsLayout (2 1)\n\\defaultSystemsLayout 4\n\\ts (4 4)\n0.6.1 |\n2.6.1 |\n3.6.1 |');
    const cut = clipOfBars(clip, [1, 2]);
    expect(cut.systemsLayout).toBeUndefined();
    expect(cut.defaultSystemsLayout).toBeUndefined();
  });

  it('leaves the whole clip as it was', () => {
    const text = '\\ts (4 4)\n\\tempo 90 5.1.2 -.1.2 |\n-.1.2 -.1.2 |';
    const clip = read(text);
    const before = writeAlphaTex(clip);
    clipOfBars(clip, [1, 1]);
    expect(writeAlphaTex(clip)).toBe(before);
  });
});

describe('barsName and the image\'s bar numbers', () => {
  const clip = read('\\ts (4 4)\n0.6.1 |\n2.6.1 |\n3.6.1 |\n5.6.1 |');

  it('names one bar or a span, as the clip numbers them', () => {
    expect(barsName(clip, [1, 1])).toBe('bar 2');
    expect(barsName(clip, [1, 3])).toBe('bars 2–4');
    // A Pickup bar isn't counted: the bar after it is bar 1.
    const pickup = read('\\ts (4 4)\n\\ac 0.6.4 |\n2.6.1 |\n3.6.1 |');
    expect(barsName(pickup, [1, 2])).toBe('bars 1–2');
    expect(barsName(pickup, [0, 0])).toBe('pickup bar');
    expect(barsName(pickup, [0, 2])).toBe('pickup bar to bar 2');
  });

  it('an image of bars 3–4 numbers them 3 and 4; the whole clip from 1', () => {
    const part = imagePart(clip, 0, [2, 3], DEFAULT_TAB_EXPORT);
    expect(part.bars).toHaveLength(2);
    expect([barNumber(part, 0), barNumber(part, 1)]).toEqual([3, 4]);
    expect(barNumber(imagePart(clip, 0, null, DEFAULT_TAB_EXPORT), 0)).toBe(1);
  });

  it('with bar numbers From 1 (or hidden), the bars count from 1', () => {
    const one = imagePart(clip, 0, [2, 3], { ...DEFAULT_TAB_EXPORT, barNumbers: 'one' });
    expect([barNumber(one, 0), barNumber(one, 1)]).toEqual([1, 2]);
  });

  it('draws the track the page shows', () => {
    const two = read(['\\track "A"', '\\ts (4 4)', '5.3.1 | 7.3.1 |', '\\track "B"', '0.6.1 | 3.6.1 |', ''].join('\n'));
    expect(imagePart(two, 1, [1, 1], DEFAULT_TAB_EXPORT).bars[0].columns[0].notes[5]?.fret).toBe(3);
  });
});
