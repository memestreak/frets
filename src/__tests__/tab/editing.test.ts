import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { writeAlphaTex } from '@/features/tab/alphatex';
import { emptyClip, type Clip } from '@/features/tab/clip';
import {
  clampCursor, copyText, cycleBend, cycleBendShape, cycleDots, cycleRepeatEnd, cycleSlide,
  deleteColumns, indexOf, makeRest, moveColumn, noteAt, pasteAt, placeOf, setDead, setFret,
  stepDuration, toggleFlag, toggleLegato, toggleStroke, toggleTie, type Cursor,
} from '@/features/tab/editing';

function clipOf(text: string): Clip {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.clip;
}

/** The clip's bars as alphaTex, without the header. */
function bars(clip: Clip): string {
  return writeAlphaTex(clip).split('\n').filter(l => l.endsWith('|')).join('\n');
}

const at = (bar: number, column: number, string: number): Cursor => ({ bar, column, string });
const only = (cursor: Cursor) => ({ cursor, selection: null });

describe('places', () => {
  const clip = clipOf('5.1.2 7.1.2 | 0.6.1 |');
  it('counts columns across bars', () => {
    expect(indexOf(clip, 1, 0)).toBe(2);
    expect(placeOf(clip, 2)).toEqual({ bar: 1, column: 0 });
    expect(placeOf(clip, 9)).toEqual({ bar: 1, column: 0 });
  });
  it('keeps the cursor inside the clip', () => {
    expect(clampCursor(clip, at(4, 3, 9))).toEqual(at(1, 0, 5));
  });
});

describe('typing', () => {
  it('puts the first fret in an empty clip as a quarter', () => {
    const clip = setFret(emptyClip(), at(0, 0, 2), 5);
    expect(bars(clip)).toBe('5.3.4 |');
  });

  it('keeps a note\'s marks when its fret changes, but not a tie', () => {
    let clip = clipOf('5.3.4 5.3{v}.4 r.2 |');
    clip = toggleTie(clip, only(at(0, 1, 2)));
    expect(noteAt(clip, at(0, 1, 2))).toEqual({ fret: 5, tie: true, vibrato: true });
    clip = setFret(clip, at(0, 1, 2), 7);
    expect(noteAt(clip, at(0, 1, 2))).toEqual({ fret: 7, vibrato: true });
  });

  it('names a hammer-on or pull-off by the frets, and follows a fret change', () => {
    let clip = clipOf('7.3.8 5.3.8 r.4 r.2 |');
    clip = toggleLegato(clip, only(at(0, 1, 2)));
    expect(noteAt(clip, at(0, 1, 2))?.legato).toBe('p');
    clip = setFret(clip, at(0, 1, 2), 9);
    expect(noteAt(clip, at(0, 1, 2))?.legato).toBe('h');
    // With nothing before it on the string, there is nothing to hammer from.
    expect(toggleLegato(clip, only(at(0, 0, 2)))).toEqual(clip);
  });

  it('makes a dead note and a rest', () => {
    let clip = clipOf('(5.3 5.4).4 r.4 r.2 |');
    clip = setDead(clip, at(0, 0, 3));
    expect(bars(clip)).toBe('(5.3 x.4).4 r.4 r.2 |');
    clip = makeRest(clip, only(at(0, 0, 0)));
    expect(bars(clip)).toBe('r.4 r.4 r.2 |');
  });
});

describe('durations and column marks', () => {
  it('steps the note value and the dots', () => {
    let clip = clipOf('5.3.4 r.4 r.2 |');
    clip = stepDuration(clip, only(at(0, 0, 2)), -1);
    expect(bars(clip)).toMatch(/^5\.3\.8 /);
    clip = cycleDots(clip, only(at(0, 0, 2)));
    clip = cycleDots(clip, only(at(0, 0, 2)));
    expect(bars(clip)).toMatch(/^5\.3\.8\{dd\} /);
  });

  it('steps down to a sixty-fourth, which drops its dots and takes none', () => {
    let clip = clipOf('5.3.16{d} r.16 r.8 r.4 r.2 |');
    clip = stepDuration(clip, only(at(0, 0, 2)), -1);
    expect(bars(clip)).toMatch(/^5\.3\.32\{d\} /);
    clip = stepDuration(clip, only(at(0, 0, 2)), -1);
    expect(bars(clip)).toMatch(/^5\.3\.64 /);
    clip = stepDuration(clip, only(at(0, 0, 2)), -1);
    expect(bars(clip)).toMatch(/^5\.3\.64 /);
    clip = cycleDots(clip, only(at(0, 0, 2)));
    expect(bars(clip)).toMatch(/^5\.3\.64 /);
  });

  it('applies to every selected column', () => {
    const clip = toggleStroke(clipOf('5.3.4 5.3.4 5.3.4 5.3.4 |'), { cursor: at(0, 1, 2), selection: { anchor: 2, focus: 1 } }, 'down');
    expect(clip.bars[0].columns.map(c => c.stroke)).toEqual([undefined, 'down', 'down', undefined]);
  });
});

describe('note marks', () => {
  it('palm mutes every note of a selection, and unmutes when all are muted', () => {
    const selection = { anchor: 0, focus: 1 };
    let clip = toggleFlag(clipOf('(0.6 2.5).8 0.6.8 r.4 r.2 |'), { cursor: at(0, 0, 5), selection }, 'palmMute');
    expect(bars(clip)).toBe('(2.5{pm} 0.6{pm}).8 0.6{pm}.8 r.4 r.2 |');
    clip = toggleFlag(clip, { cursor: at(0, 0, 5), selection }, 'palmMute');
    expect(bars(clip)).toBe('(2.5 0.6).8 0.6.8 r.4 r.2 |');
  });

  it('cycles slides, offering slides from the note before only when there is one', () => {
    let clip = clipOf('5.3.4 7.3.4 r.2 |');
    const kinds: unknown[] = [];
    for (let i = 0; i < 5; i++) {
      clip = cycleSlide(clip, at(0, 1, 2));
      kinds.push(noteAt(clip, at(0, 1, 2))?.slide);
    }
    expect(kinds).toEqual(['legato', 'shift', 'below', 'above', undefined]);
    expect(noteAt(cycleSlide(clip, at(0, 0, 2)), at(0, 0, 2))?.slide).toBe('below');
  });

  it('cycles bend amounts, then bend shapes', () => {
    let clip = clipOf('7.3.2 r.2 |');
    for (let i = 0; i < 3; i++) clip = cycleBend(clip, at(0, 0, 2));
    expect(noteAt(clip, at(0, 0, 2))?.bend).toEqual({ quarters: 4, pre: false, release: false });
    clip = cycleBendShape(clip, at(0, 0, 2));
    expect(bars(clip)).toBe('7.3{b (0 4 0)}.2 r.2 |');
    clip = cycleBendShape(clip, at(0, 0, 2));
    expect(bars(clip)).toBe('7.3{b (4 4)}.2 r.2 |');
  });
});

describe('moving', () => {
  it('adds a column at the end while the bar has room, then a new bar', () => {
    let clip = clipOf('5.3.2 |');
    let cursor = at(0, 0, 2);
    ({ clip, cursor } = moveColumn(clip, cursor, 1));
    expect(cursor).toEqual(at(0, 1, 2));
    clip = setFret(clip, cursor, 7);
    ({ clip, cursor } = moveColumn(clip, cursor, 1));
    expect(cursor).toEqual(at(1, 0, 2));
    expect(bars(clip)).toBe('5.3.2 7.3.2 |\nr.2 |');
  });

  it('crosses bar lines both ways and stops at the start', () => {
    const clip = clipOf('5.3.2 5.3.2 | 7.3.1 |');
    expect(moveColumn(clip, at(1, 0, 0), -1).cursor).toEqual(at(0, 1, 0));
    expect(moveColumn(clip, at(0, 0, 0), -1).cursor).toEqual(at(0, 0, 0));
    expect(moveColumn(clip, at(0, 1, 0), 1).cursor).toEqual(at(1, 0, 0));
  });
});

describe('bars', () => {
  it('steps a repeat\'s count and then clears it', () => {
    let clip = clipOf('5.3.1 |');
    const counts: unknown[] = [];
    for (let i = 0; i < 4; i++) {
      clip = cycleRepeatEnd(clip, at(0, 0, 0));
      counts.push(clip.bars[0].repeatEnd);
    }
    expect(counts).toEqual([2, 3, 4, undefined]);
  });
});

describe('cut, copy and paste', () => {
  const clip = clipOf('\\ts (2 4)\n5.3.4 7.3{h}.8 9.3.8 | 0.6.2 |');

  it('copies the selected columns as alphaTex that reads back', () => {
    const text = copyText(clip, [1, 3]);
    expect(text).toBe('\\ts (2 4)\n7.3{h}.8 9.3.8 |\n0.6.2 |\n');
    expect(bars(clipOf(text))).toBe('7.3{h}.8 9.3.8 |\n0.6.2 |');
  });

  it('drops a join to a note that was not copied', () => {
    expect(copyText(clip, [2, 2])).toBe('\\ts (2 4)\n9.3.8 |\n');
  });

  it('deletes columns and the bars they empty', () => {
    const cut = deleteColumns(clip, [1, 3]);
    expect(bars(cut.clip)).toBe('5.3.4 |');
    expect(cut.cursor).toEqual({ bar: 0, column: 0 });
  });

  it('pastes before the cursor column, as at a caret', () => {
    const pasted = clipOf('1.1.8 2.1.8 | 3.1.4 |');
    const result = pasteAt(clip, at(0, 1, 0), pasted);
    expect(bars(result.clip)).toBe('5.3.4 1.1.8 2.1.8 |\n3.1.4 7.3{h}.8 9.3.8 |\n0.6.2 |');
    expect(result.cursor).toEqual(at(1, 0, 0));
  });

  it('pastes a whole clip into an empty one, with its name and time', () => {
    const pasted = clipOf('\\title "Lick"\n\\ts (3 4)\n5.3.2{d} |');
    const result = pasteAt(emptyClip(), at(0, 0, 0), pasted);
    expect(result.clip.name).toBe('Lick');
    expect(result.clip.time).toEqual({ beats: 3, value: 4 });
  });
});
