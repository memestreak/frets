/**
 * Moving music in time by the grid (issue #473, `docs/specs/2026-11-13-tab-move-in-time-design.md`):
 * what moves keeps its length and writes over what it lands on; the time it leaves becomes a Gap.
 */
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { writeBars } from '@/features/tab/alphatex';
import { isUneven, partOf, WHOLE, type Clip, type Part } from '@/features/tab/clip';
import type { Cursor, Selection } from '@/features/tab/editing';
import { moveInTime } from '@/features/tab/timeMoves';

const S = WHOLE / 16;
const E = WHOLE / 8;
const Q = WHOLE / 4;

function read(text: string): Clip {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.clip;
}
const clipOf = (text: string): Part => partOf(read(text));
const bars = (part: Part) => writeBars(part).join(' ');
const at = (bar: number, column: number, string = 0): Cursor => ({ bar, column, string });
const even = (part: Part) => part.bars.every((_bar, b) => !isUneven(part, b));
const lone = (cursor: Cursor) => ({ cursor, selection: null });
const run = (anchor: number, focus: number): { cursor: Cursor; selection: Selection } => ({ cursor: at(0, anchor), selection: { anchor, focus } });

describe('a chord moves by the grid', () => {
  // His case (2026-11-13): a sixteenth chord on beat 3, moved a sixteenth earlier.
  const chord = '\\ts (4 4)\nr.4 r.4 (5.1 3.2 4.3 5.4).16 r.16 r.8 r.4 |';

  it('a sixteenth earlier: it starts a sixteenth before beat 3, and the bar stays full', () => {
    const moved = moveInTime(clipOf(chord), lone(at(0, 2)), -S)!;
    expect(even(moved.clip)).toBe(true);
    expect(bars(moved.clip)).toBe('r.4 r.8 r.16 (5.1 3.2 4.3 5.4).16 r.2 |');
    expect(moved.cursor).toEqual({ bar: 0, column: 3, string: 0 });
  });

  it('a sixteenth later, then back: on beat 3 again, the rests spelled by the meter', () => {
    const later = moveInTime(clipOf(chord), lone(at(0, 2)), S)!;
    expect(bars(later.clip)).toBe('r.2 r.16 (5.1 3.2 4.3 5.4).16 r.8 r.4 |');
    const back = moveInTime(later.clip, lone(later.cursor), -S)!;
    expect(bars(back.clip)).toBe('r.2 (5.1 3.2 4.3 5.4).16 r.16 r.8 r.4 |');
  });

  it('writes over the note it lands on, and leaves a Gap where it was', () => {
    const moved = moveInTime(clipOf('\\ts (4 4)\n1.1.4 2.1.4 3.1.4 4.1.4 |'), lone(at(0, 2)), -Q)!;
    expect(bars(moved.clip)).toBe('1.1.4 3.1.4 r.4 4.1.4 |');
  });

  it('across the bar line it is split and tied', () => {
    const moved = moveInTime(clipOf('\\ts (4 4)\nr.2 r.4 5.1.4 | r.1 |'), lone(at(0, 2)), E)!;
    expect(bars(moved.clip)).toBe('r.2 r.4 r.8 5.1.8 | -.1.8 r.8 r.4 r.2 |');
    expect(even(moved.clip)).toBe(true);
  });

  it('keeps its Tie chain whole', () => {
    const moved = moveInTime(clipOf('\\ts (4 4)\n5.1.4 -.1.4 r.2 |'), lone(at(0, 0)), Q)!;
    expect(bars(moved.clip)).toBe('r.4 5.1.2 r.4 |');
  });

  it('does nothing on a rest, before the clip starts, or on a grace note', () => {
    expect(moveInTime(clipOf('\\ts (4 4)\nr.4 5.1.4 r.2 |'), lone(at(0, 0)), S)).toBeNull();
    expect(moveInTime(clipOf('\\ts (4 4)\n5.1.4 r.4 r.2 |'), lone(at(0, 0)), -S)).toBeNull();
    expect(moveInTime(clipOf('\\ts (4 4)\n3.1.16{gr} 5.1.4 r.4 r.2 |'), lone(at(0, 0)), S)).toBeNull();
  });

  it('takes its Text and chord name with it, leaving a bare Gap', () => {
    const moved = moveInTime(clipOf('\\ts (4 4)\nr.4 5.1.4{txt "go" ch "A"} r.2 |'), lone(at(0, 1)), -S)!;
    expect(bars(moved.clip)).toBe('r.8 r.16 5.1.16{ch "A" txt "go"} -.1.8{d} r.16 r.2 |');
  });

  it('past the last bar line, a bar is added for it', () => {
    const moved = moveInTime(clipOf('\\ts (4 4)\nr.2 r.4 5.1.4 |'), lone(at(0, 2)), Q);
    expect(moved && bars(moved.clip)).toBe('r.1 | 5.1.4 r.4 r.2 |');
  });
});

describe('a note picked in a chord moves its whole chord, as Dorico’s does', () => {
  it('the chord moves together', () => {
    const moved = moveInTime(clipOf('\\ts (4 4)\n(5.1 7.2).4 r.4 r.2 |'), lone(at(0, 0, 1)), Q)!;
    expect(bars(moved.clip)).toBe('r.4 (5.1 7.2).4 r.2 |');
    expect(moved.cursor).toEqual({ bar: 0, column: 1, string: 1 });
  });
});

describe('a selection moves as one block', () => {
  it('two notes an eighth later, the selection still on them', () => {
    const moved = moveInTime(clipOf('\\ts (4 4)\n1.1.8 2.1.8 r.4 r.2 |'), run(0, 1), E)!;
    expect(bars(moved.clip)).toBe('r.8 1.1.8 2.1.8 r.8 r.2 |');
    expect(moved.selection).toEqual({ anchor: 1, focus: 2 });
  });

  it('takes its Texts with it', () => {
    const moved = moveInTime(clipOf('\\ts (4 4)\n1.1.8{txt "a"} 2.1.8 r.4 r.2 |'), run(0, 1), E)!;
    expect(bars(moved.clip)).toBe('r.8 1.1.8{txt "a"} 2.1.8 r.8 r.2 |');
  });

  it('only rests: nothing moves', () => {
    expect(moveInTime(clipOf('\\ts (4 4)\nr.4 r.4 5.1.2 |'), run(0, 1), Q)).toBeNull();
  });
});
