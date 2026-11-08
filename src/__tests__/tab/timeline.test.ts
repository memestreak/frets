/**
 * Lengths and bars always full (step 4, `docs/specs/2026-11-04-tab-bars-always-full-design.md`): edits
 * that change time work on a Voice as one stream and lay it back into bars by their time signatures,
 * so no edit makes an Uneven bar.
 */
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { writeBars } from '@/features/tab/alphatex';
import { isUneven, partOf, WHOLE, type Clip, type Part } from '@/features/tab/clip';
import { clipAction } from '@/features/tab/clipState';
import { deleteColumns, insertTime, moveColumn, setFret, type Cursor } from '@/features/tab/editing';
import { setValue } from '@/features/tab/noteEdits';
import { barFixes, fillWithRests, makePickup, moveExtra, setBarTime } from '@/features/tab/barEdits';
import { reBarEnd, timeOf } from '@/features/tab/timeline';
import { parseEditing } from '@/features/tab/editingPrefs';

const Q = WHOLE / 4;
const E = WHOLE / 8;

function read(text: string): Clip {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.clip;
}
const clipOf = (text: string): Part => partOf(read(text));
const bars = (part: Part) => writeBars(part).join(' ');
const at = (bar: number, column: number, string = 0): Cursor => ({ bar, column, string });
const even = (part: Part) => part.bars.every((_bar, b) => !isUneven(part, b));
const half = { value: 2, dots: 0 } as const;

describe('note input mode writes over what follows', () => {
  it('a half on beat 4 of a bar of rests is a quarter tied over the bar line; no bar is Uneven', () => {
    const clip = clipOf('\\ts (4 4)\nr.4 r.4 r.4 r.4 | r.1 |');
    const typed = setFret(clip, at(0, 3), 5, half);
    expect(bars(typed)).toBe('r.2 r.4 5.1.4 | -.1.4 r.4 r.2 |');
    expect(even(typed)).toBe(true);
  });

  it('a half on beat 1 of four quarters takes beats 1–2; on beat 2 it takes beats 2–3', () => {
    const clip = clipOf('\\ts (4 4)\n1.1.4 2.1.4 3.1.4 4.1.4 |');
    expect(bars(setFret(clip, at(0, 0), 9, half))).toBe('9.1.2 3.1.4 4.1.4 |');
    expect(bars(setFret(clip, at(0, 1), 9, half))).toBe('1.1.4 9.1.2 4.1.4 |');
  });

  it('a half over the first half of a whole note leaves the rest of it a Gap, not tied on', () => {
    expect(bars(setFret(clipOf('\\ts (4 4)\n1.1.1 |'), at(0, 0), 9, half))).toBe('9.1.2 r.2 |');
  });

  it('a note over beat 2 of a triplet takes the whole tuplet away, its time left a Gap', () => {
    const clip = clipOf('\\ts (4 4)\nr.4 1.1.4{tu 3} 2.1.4{tu 3} 3.1.4{tu 3} 4.1.4 |');
    expect(bars(setFret(clip, at(0, 0), 9, half))).toBe('9.1.2 r.4 4.1.4 |');
  });

  it('a single note over a chord takes every string of it for its time', () => {
    expect(bars(setFret(clipOf('\\ts (4 4)\n1.1.4 (1.1 2.2 3.3).4 r.2 |'), at(0, 0), 5, half))).toBe('5.1.2 r.2 |');
  });

  it('a fret on another string of a note joins its chord, at the chord’s length', () => {
    expect(bars(setFret(clipOf('\\ts (4 4)\n1.1.4 2.1.4 r.2 |'), at(0, 0, 1), 5, half))).toBe('(1.1 5.2).4 2.1.4 r.2 |');
  });
});

describe('the length keys', () => {
  it('on a run: its notes close up and its Gaps keep their length, then a Gap; made halves it writes over and ties on', () => {
    const clip = clipOf('\\ts (4 4)\n1.1.4 r.8 2.1.4 3.1.8 4.1.4 | 5.1.1 |');
    const run = { cursor: at(0, 0), selection: { anchor: 0, focus: 2 } };
    expect(bars(setValue(clip, run, 8))).toBe('1.1.8 r.8 2.1.8 r.8 r.8 3.1.8 4.1.4 | 5.1.1 |');
    // The half from the eighth after beat 2 writes over the whole note's first eighth: the rest of it is a Gap.
    expect(bars(setValue(clip, run, 2))).toBe('1.1.2 r.8 2.1.8 -.1.4 | -.1.8 r.8 r.4 r.2 |');
  });

  it('on a Tie chain set its whole length from its start, from any of its notes (step 5); on a tuplet note they work within it (step 6)', () => {
    // The chain is a dotted quarter as one note, so a half keeps the dot.
    const clip = clipOf('\\ts (4 4)\n1.1.4 -.1.8 r.8 r.2 |');
    expect(bars(setValue(clip, { cursor: at(0, 0), selection: null }, 2))).toBe('1.1.2{d} r.4 |');
    expect(bars(setValue(clip, { cursor: at(0, 1), selection: null }, 2))).toBe('1.1.2{d} r.4 |');
    const tuplet = clipOf('\\ts (4 4)\n1.1.4{tu 3} 2.1.4{tu 3} 3.1.4{tu 3} r.2 |');
    // A triplet half from the second note fills the triplet to its end; from the third there is no room.
    expect(bars(setValue(tuplet, { cursor: at(0, 1), selection: null }, 2))).toBe('1.1.4{tu 3} 2.1.2{tu 3} r.2 |');
    expect(setValue(tuplet, { cursor: at(0, 2), selection: null }, 2)).toEqual(tuplet);
  });
});

describe('normal mode, a fret on a rest', () => {
  it('takes a quarter rest’s length; on a Whole-bar rest it fills the bar, by the meter', () => {
    expect(bars(setFret(clipOf('\\ts (4 4)\n1.1.4 r.4 r.2 |'), at(0, 1), 5))).toBe('1.1.4 5.1.4 r.2 |');
    expect(bars(setFret(clipOf('\\ts (4 4)\nr.1 |'), at(0, 0), 5))).toBe('5.1.1 |');
    expect(bars(setFret(clipOf('\\ts (3 4)\nr.2{d} |'), at(0, 0), 5))).toBe('5.1.2{d} |');
    expect(bars(setFret(clipOf('\\ts (5 8)\nr.4{d} r.4 |'), at(0, 0), 5))).toBe('5.1.4{d} -.1.4 |');
  });
});

describe('Insert and Ctrl/⌘+Delete', () => {
  const quarters = '\\ts (4 4)\n1.1.4 2.1.4 3.1.4 4.1.4 | 5.1.4 6.1.4 7.1.4 8.1.4 |';

  it('Insert puts in a Gap and pushes the rest of the Voice on, over the bar line', () => {
    const clip = clipOf(quarters);
    const eighth = insertTime(clip, Q, E, at(0, 1))!;
    expect(bars(eighth.clip)).toBe('1.1.4 r.8 2.1.8 -.1.8 3.1.4 4.1.8 | -.1.8 5.1.4 6.1.8 -.1.8 7.1.4 8.1.8 | -.1.8 r.8 r.4 r.2 |');
    expect(eighth.cursor).toEqual(at(0, 1));
    expect(bars(insertTime(clip, Q, Q, at(0, 1))!.clip)).toBe('1.1.4 r.4 2.1.4 3.1.4 | 4.1.4 5.1.4 6.1.4 7.1.4 | 8.1.4 r.4 r.2 |');
    expect(bars(insertTime(clip, Q, 2 * Q, at(0, 1))!.clip)).toBe('1.1.4 r.4 r.4 2.1.4 | 3.1.4 4.1.4 5.1.4 6.1.4 | 7.1.4 8.1.4 r.2 |');
  });

  it('Ctrl/⌘+Delete on beat 2 pulls the next bar’s first quarter into beat 4; the last bar ends in a Gap', () => {
    const cut = deleteColumns(clipOf(quarters), [1, 1]).clip;
    expect(bars(cut)).toBe('1.1.4 3.1.4 4.1.4 5.1.4 | 6.1.4 7.1.4 8.1.4 r.4 |');
    const whole = deleteColumns(clipOf(`${quarters} 9.1.1 |`), [0, 7]).clip;
    expect(bars(whole)).toBe('9.1.1 |');
  });

  it('move Voice 2 with Voice 1, and leave other Tracks as they are', () => {
    const clip = read('\\track "A"\n\\voiceMode barWise \\ts (4 4) \\voice 1.1.2 2.1.2 \\voice 0.6.4 0.6.4 0.6.2 |\n\\track "B"\n\\ts (4 4) 3.3.1 |');
    const pushed = insertTime(partOf(clip), 0, Q, at(0, 0))!.clip;
    expect(pushed.bars[0].otherVoices?.[0].columns.map(c => c.duration.value)).toEqual([4, 4, 4, 4]);
    const whole = clipAction(clip, { type: 'replacePart', part: pushed }) as { clip: Clip };
    expect(whole.clip.tracks[1].bars[0].voices[0].map(c => c.notes[2]?.fret)).toEqual([3]);
    // Running past the clip's end adds a bar in the last bar's time to every Track: the other Track's is a Whole-bar rest.
    expect(whole.clip.tracks[1].bars).toHaveLength(2);
    expect(whole.clip.tracks[1].bars[1].voices[0].map(c => [c.duration.value, c.notes.every(n => n === null)])).toEqual([[1, true]]);
  });

  it('write an imported overfull bar they reach by its time signature; a bar past their reach keeps its ⚠', () => {
    const clip = clipOf('\\ts (4 4)\n1.1.4 2.1.4 3.1.4 4.1.4 5.1.4 | 6.1.1 | 7.1.4 |');
    // Three beats in before a bar a beat over: the music after it lands back on its bar lines a bar later.
    const pushed = insertTime(clip, 0, 3 * Q, at(0, 0))!.clip;
    expect(bars(pushed)).toBe('r.2 r.4 1.1.4 | 2.1.4 3.1.4 4.1.4 5.1.4 | 6.1.1 | 7.1.4 |');
    expect([0, 1, 2].map(b => isUneven(pushed, b))).toEqual([false, false, false]);
    expect(isUneven(pushed, 3)).toBe(true);
  });
});

describe('the "Fill short bars with rests" setting', () => {
  it('is gone: a saved fillBars is dropped', () => {
    expect(parseEditing({ fillBars: true, grid: 8 })).not.toHaveProperty('fillBars');
  });
});

describe('a time signature change re-bars the music', () => {
  it('3/4 on bar 3 of four bars of quarters: the same notes in 3/4, one bar more, in every Track', () => {
    const clip = read('\\track "A"\n\\ts (4 4) 1.1.4 2.1.4 3.1.4 4.1.4 | 5.1.4 6.1.4 7.1.4 8.1.4 | 9.1.4 10.1.4 11.1.4 12.1.4 | 13.1.4 14.1.4 15.1.4 16.1.4 |\n\\track "B"\n\\ts (4 4) r.1 | r.1 | 0.6.1 | 0.6.1 |');
    const part = partOf(clip);
    const changed = setBarTime(part, 2, { beats: 3, value: 4 });
    const action = clipAction(clip, { type: 'reBarPart', part: changed, from: 2, to: reBarEnd(part, 2) }) as { clip: Clip };
    const a = partOf(action.clip);
    expect(bars(a)).toBe('1.1.4 2.1.4 3.1.4 4.1.4 | 5.1.4 6.1.4 7.1.4 8.1.4 | \\ts (3 4) 9.1.4 10.1.4 11.1.4 | 12.1.4 13.1.4 14.1.4 | 15.1.4 16.1.4 r.4 |');
    expect(even(a)).toBe(true);
    const b = partOf(action.clip, 1);
    expect(bars(b)).toBe('r.1 | r.1 | \\ts (3 4) 0.6.2{d} | -.6.4 0.6.4 -.6.4 | -.6.2 r.4 |');
  });
});

describe('→', () => {
  it('moves on from the end of a short imported bar, adding no Column; from the clip’s last Column it adds a Whole-bar rest', () => {
    const clip = clipOf('\\ts (4 4)\n1.1.4 | 2.1.1 |');
    const moved = moveColumn(clip, at(0, 0), 1);
    expect(moved.clip).toBe(clip);
    expect(moved.cursor).toEqual(at(1, 0));
    const grown = moveColumn(clip, at(1, 0), 1);
    expect(bars(grown.clip)).toBe('1.1.4 | 2.1.1 | r.1 |');
  });

  it('starts timeOf from the bar it is in', () => {
    expect(timeOf(clipOf('\\ts (4 4)\n1.1.4 2.1.4 r.2 | 3.1.1 |'), 1, 0)).toBe(WHOLE);
  });
});

describe('fixing an Uneven bar from its ⚠', () => {
  it('Move extra into next bar pushes an overfull bar’s extra on, losing no note, Voice 2 too', () => {
    const clip = clipOf('\\ts (4 4)\n1.1.4 2.1.4 3.1.4 4.1.4 5.1.4 | 6.1.1 |');
    expect(barFixes(clip, 0)).toEqual({ over: true, short: false, pickup: false });
    const moved = moveExtra(clip, 0)!;
    expect(bars(moved)).toBe('1.1.4 2.1.4 3.1.4 4.1.4 | 5.1.4 6.1.4 -.1.2 | -.1.4 r.4 r.2 |');
    expect(even(moved)).toBe(true);
    const two = partOf(read('\\voiceMode barWise \\ts (4 4) \\voice 1.1.1 \\voice 0.6.2 0.6.2 0.6.4 |'));
    expect(barFixes(two, 0).over).toBe(true);
    expect(moveExtra(two, 0)!.bars[1].otherVoices?.[0].columns.map(c => c.notes[5]?.fret ?? null)).toEqual([0, null, null]);
  });

  it('Fill with rests ends a short bar in a Gap, in every Voice; a short bar 1 can be a Pickup bar instead', () => {
    const clip = partOf(read('\\voiceMode barWise \\ts (4 4) \\voice 1.1.4 2.1.4 \\voice 0.6.4 | 3.1.1 |'));
    expect(barFixes(clip, 0)).toEqual({ over: false, short: true, pickup: true });
    const filled = fillWithRests(clip, 0);
    expect(bars(filled).split(' | ')[0]).toBe('1.1.4 2.1.4 r.2');
    expect(filled.bars[0].otherVoices?.[0].columns.map(c => c.duration.value)).toEqual([4, 4, 2]);
    expect(even(filled)).toBe(true);
    const pickup = makePickup(clip);
    expect(pickup.bars[0].pickup).toBe(2 * Q);
    expect(isUneven(pickup, 0)).toBe(false);
    // A short bar after the first has no Make pickup bar.
    expect(barFixes(clipOf('\\ts (4 4)\n1.1.1 | 2.1.4 |'), 1)).toEqual({ over: false, short: true, pickup: false });
  });
});
