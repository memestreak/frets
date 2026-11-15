/**
 * Insert mode's pure rules (`docs/specs/2026-11-14-tab-insert-mode-design.md`, issue #482 phase 2): what Delete
 * takes, the length changes that push and pull, and the bars of rests a push never adds at the end. The keys
 * themselves are tested on the page (`page/insertMode.test.tsx`).
 */
import * as alphaTab from '@coderline/alphatab';
import { writeBars } from '@/features/tab/alphatex';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { partOf, WHOLE, type Part } from '@/features/tab/clip';
import type { Cursor } from '@/features/tab/editing';
import { deleteTakesTime } from '@/features/tab/insertMode';
import { cycleDots, setValue, stepDuration } from '@/features/tab/noteEdits';
import { shiftInTime } from '@/features/tab/timeMoves';
import { pushTime, withoutAddedRests } from '@/features/tab/timeline';

function clipOf(text: string): Part {
  const result = readAlphaTexWith(alphaTab, `\\ts (4 4)\n${text}`);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return partOf(result.clip);
}
const bars = (clip: Part) => writeBars(clip).join('\n');
const at = (bar: number, column: number, string: number): Cursor => ({ bar, column, string });
const only = (cursor: Cursor) => ({ cursor, selection: null });

describe('Insert mode: what Delete takes', () => {
  const clip = clipOf('5.1.4 (7.1 8.2).4 r.4 5.1.8{gr} 7.1.4 |');
  it('takes the time of a lone note, a rest, a Column picked whole and a selection', () => {
    expect(deleteTakesTime(clip, at(0, 0, 0), null, false)).toBe(true);
    expect(deleteTakesTime(clip, at(0, 2, 0), null, false)).toBe(true);
    expect(deleteTakesTime(clip, at(0, 1, 0), null, true)).toBe(true);
    expect(deleteTakesTime(clip, at(0, 1, 0), { anchor: 1, focus: 1 }, false)).toBe(true);
  });
  it('takes no time for one note of a chord, or a grace note', () => {
    expect(deleteTakesTime(clip, at(0, 1, 0), null, false)).toBe(false);
    expect(deleteTakesTime(clip, at(0, 3, 0), null, false)).toBe(false);
  });
  it('takes no time for a note of a Tie chain whose later Column holds another note', () => {
    const tied = clipOf('5.1.2 -.1.4 (7.1 9.2).4 |\n(-.1 3.3).2 r.2 |');
    expect(deleteTakesTime(tied, at(0, 2, 0), null, false)).toBe(false);
    expect(deleteTakesTime(tied, at(0, 0, 0), null, false)).toBe(true);
  });
});

describe('Insert mode: length changes push and pull', () => {
  it('a longer note pushes what follows on, by the time it adds, in every Voice', () => {
    const clip = clipOf('\\voice 5.1.4 7.1.4 r.2 \\voice 0.6.4 3.6.4 r.2 |');
    expect(bars(stepDuration(clip, only(at(0, 0, 0)), 1, true))).toBe(bars(clipOf('\\voice 5.1.2 7.1.4 r.4 \\voice 0.6.4 r.4 3.6.4 r.4 |')));
  });
  it('a shorter note pulls what follows back, leaving no Gap after it', () => {
    const clip = clipOf('5.1.2 7.1.4 9.1.4 |');
    expect(bars(stepDuration(clip, only(at(0, 0, 0)), -1, true))).toBe('5.1.4 7.1.4 9.1.4 r.4 |');
    // Out of Insert mode, as before: a Gap after it.
    expect(bars(stepDuration(clip, only(at(0, 0, 0)), -1))).toBe('5.1.4 r.4 7.1.4 9.1.4 |');
  });
  it('a length set and a dot push too', () => {
    const clip = clipOf('5.1.4 7.1.4 r.2 |');
    expect(bars(setValue(clip, only(at(0, 0, 0)), 2, true))).toBe('5.1.2 7.1.4 r.4 |');
    expect(bars(cycleDots(clip, only(at(0, 0, 0)), true))).toBe('5.1.4{d} 7.1.8 -.1.8 r.8 r.4 |');
  });
  it('a selection pushes by what all its notes add', () => {
    const clip = clipOf('5.1.8 7.1.8 9.1.4 r.2 |');
    const longer = stepDuration(clip, { cursor: at(0, 1, 0), selection: { anchor: 0, focus: 1 } }, 1, true);
    expect(bars(longer)).toBe('5.1.4 7.1.4 9.1.4 r.4 |');
  });
  it('a push that would put a tuplet across a bar line changes nothing', () => {
    const clip = clipOf('5.1.8 r.8 7.1.4 r.4 7.1.8{tu 3} 7.1.8{tu 3} 7.1.8{tu 3} |');
    expect(bars(stepDuration(clip, only(at(0, 0, 0)), 1, true))).toBe(bars(clip));
  });
});

describe('Insert mode: moving in time pushes and pulls (Alt+← →, a drag)', () => {
  const Q = WHOLE / 4;
  it('later: a Gap goes in before the note, which moves on with all the music after it, nothing written over', () => {
    const clip = clipOf('5.1.4 7.1.4 5.1.4 7.1.4 |\n5.1.4 7.1.4 5.1.4 7.1.4 |');
    const moved = shiftInTime(clip, only(at(0, 0, 0)), Q)!;
    expect(bars(moved.clip)).toBe('r.4 5.1.4 7.1.4 5.1.4 |\n7.1.4 5.1.4 7.1.4 5.1.4 |\n7.1.4 r.4 r.2 |');
    expect(moved.cursor).toEqual(at(0, 1, 0));
  });
  it('earlier: the rests before it are taken out, pulling it and the music after it back', () => {
    const moved = shiftInTime(clipOf('r.4 5.1.4 7.1.4 r.4 |'), only(at(0, 1, 0)), -Q)!;
    expect(bars(moved.clip)).toBe('5.1.4 7.1.4 r.2 |');
    expect(moved.cursor).toEqual(at(0, 0, 0));
    // By an 8th, split and tied by the meter.
    expect(bars(shiftInTime(clipOf('r.2 5.1.4 7.1.4 |'), only(at(0, 1, 0)), -Q / 2)!.clip)).toBe('r.4 r.8 5.1.8 -.1.8 7.1.4 r.8 |');
  });
  it('earlier is refused over a note, over another Voice\'s note, and before the clip\'s start', () => {
    expect(shiftInTime(clipOf('5.1.4 7.1.4 r.2 |'), only(at(0, 1, 0)), -Q)).toBeNull();
    expect(shiftInTime(clipOf('\\voice r.4 5.1.4 7.1.4 r.4 \\voice 0.6.2 r.2 |'), only(at(0, 1, 0)), -Q)).toBeNull();
    expect(shiftInTime(clipOf('5.1.4 7.1.4 r.2 |'), only(at(0, 0, 0)), -Q)).toBeNull();
  });
  it('a selection moves with the music after it and stays on the same notes; a rest alone doesn\'t move', () => {
    const moved = shiftInTime(clipOf('5.1.8 7.1.8 9.1.4 r.2 |'), { cursor: at(0, 1, 0), selection: { anchor: 0, focus: 1 } }, Q)!;
    expect(bars(moved.clip)).toBe('r.4 5.1.8 7.1.8 9.1.4 r.4 |');
    expect(moved.selection).toEqual({ anchor: 1, focus: 2 });
    expect(shiftInTime(clipOf('r.4 5.1.4 7.1.4 r.4 |'), only(at(0, 0, 0)), Q)).toBeNull();
  });
});

describe('Insert mode: no bars of rests added at the end', () => {
  it('drops the bars a push added that hold only rests, and never a bar that was there', () => {
    const clip = clipOf('5.1.4 r.4 r.2 |\nr.1 |');
    const pushed = pushTime(clip, 0, WHOLE / 4)!;
    expect(pushed.bars.length).toBe(3);
    const trimmed = withoutAddedRests(clip, pushed);
    expect(trimmed.bars.length).toBe(2);
    expect(bars(trimmed)).toBe('r.4 5.1.4 r.2 |\nr.1 |');
  });
  it('keeps an added bar that holds a note, or a mark', () => {
    const clip = clipOf('5.1.4 7.1.4 9.1.4 3.1.4 |');
    const pushed = pushTime(clip, 0, WHOLE / 4)!;
    expect(withoutAddedRests(clip, pushed).bars.length).toBe(2);
    const marked = { ...pushed, bars: pushed.bars.map((bar, b) => (b === 1 ? { ...bar, section: { text: 'Coda' } } : bar)) } as Part;
    const restsOnly = { ...marked, bars: marked.bars.map((bar, b) => (b === 1 ? { ...bar, columns: bar.columns.map(c => ({ ...c, notes: c.notes.map(() => null) })) } : bar)) } as Part;
    expect(withoutAddedRests(clip, restsOnly).bars.length).toBe(2);
  });
});
