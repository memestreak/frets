import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { writePart, writeBars } from '@/features/tab/alphatex';
import { fewestRests, WHOLE, type Part, partOf, emptyPart } from '@/features/tab/clip';
import { parseEditing } from '@/features/tab/editingPrefs';
import { clampCursor, copyText, deleteColumns, fillBar, removeEmptyBar, indexOf, insertBar, moveColumn, noteAt, insertPaste, placeOf, setDead, setFret, runAround, type Cursor } from '@/features/tab/editing';
import { cycleRepeatEnd, setEnding, setCapo, setChordName, setSection, setTempo } from '@/features/tab/barEdits';
import { cycleBend, cycleBendShape, cycleDots, cycleSlide, makeRest, stepDuration, setMark, cycleMark, toggleLegato, toggleStroke, toggleTie } from '@/features/tab/noteEdits';

function clipOf(text: string): Part {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return partOf(result.clip);
}

/** The clip's bars as alphaTex, without the header. */
function bars(clip: Part): string {
  return writeBars(clip).join('\n');
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
    const clip = setFret(emptyPart(), at(0, 0, 2), 5);
    expect(bars(clip)).toBe('5.3.4 |');
  });

  it('keeps a note\'s marks when its fret changes, but not a tie', () => {
    let clip = clipOf('5.3.4 5.3{v}.4 r.2 |');
    clip = toggleTie(clip, only(at(0, 1, 2)));
    expect(noteAt(clip, at(0, 1, 2))).toEqual({ fret: 5, tie: true, vibrato: 'slight' });
    clip = setFret(clip, at(0, 1, 2), 7);
    expect(noteAt(clip, at(0, 1, 2))).toEqual({ fret: 7, vibrato: 'slight' });
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
    let clip = setMark(clipOf('(0.6 2.5).8 0.6.8 r.4 r.2 |'), { cursor: at(0, 0, 5), selection }, ['palmMute', true]);
    expect(bars(clip)).toBe('(2.5{pm} 0.6{pm}).8 0.6{pm}.8 r.4 r.2 |');
    clip = setMark(clip, { cursor: at(0, 0, 5), selection }, ['palmMute', true]);
    expect(bars(clip)).toBe('(2.5 0.6).8 0.6.8 r.4 r.2 |');
  });

  it('sets one kind of a mark, swaps it for another, and clears it when pressed again', () => {
    let clip = clipOf('5.3.4 r.4 r.2 |');
    clip = setMark(clip, only(at(0, 0, 2)), ['vibrato', 'slight']);
    expect(bars(clip)).toBe('5.3{v}.4 r.4 r.2 |');
    clip = setMark(clip, only(at(0, 0, 2)), ['vibrato', 'wide']);
    expect(bars(clip)).toBe('5.3{vw}.4 r.4 r.2 |');
    clip = setMark(clip, only(at(0, 0, 2)), ['vibrato', 'wide']);
    expect(bars(clip)).toBe('5.3.4 r.4 r.2 |');
  });

  it('steps a mark through its kinds and then off', () => {
    let clip = clipOf('5.3.4 r.4 r.2 |');
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      clip = cycleMark(clip, only(at(0, 0, 2)), 'accent', ['normal', 'heavy']);
      seen.push(bars(clip));
    }
    expect(seen).toEqual(['5.3{ac}.4 r.4 r.2 |', '5.3{hac}.4 r.4 r.2 |', '5.3.4 r.4 r.2 |']);
    expect(cycleMark(clip, only(at(0, 1, 2)), 'accent', ['normal', 'heavy'])).toBe(clip);
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
    for (let i = 0; i < 3; i++) clip = cycleBend(clip, only(at(0, 0, 2)));
    expect(noteAt(clip, at(0, 0, 2))?.bend).toEqual({ quarters: 4, pre: false, release: false });
    clip = cycleBendShape(clip, at(0, 0, 2));
    expect(bars(clip)).toBe('7.3{b (0 4 0)}.2 r.2 |');
    clip = cycleBendShape(clip, at(0, 0, 2));
    expect(bars(clip)).toBe('7.3{b (4 4)}.2 r.2 |');
  });
});

/** Settings' "Fill short bars with rests", turned on. */
const FILL = { fillBars: true };

describe('moving', () => {
  it('adds a column at the end while the bar has room, then a new bar of rests', () => {
    let clip = clipOf('5.3.2 |');
    let cursor = at(0, 0, 2);
    ({ clip, cursor } = moveColumn(clip, cursor, 1, FILL));
    expect(cursor).toEqual(at(0, 1, 2));
    clip = setFret(clip, cursor, 7);
    ({ clip, cursor } = moveColumn(clip, cursor, 1, FILL));
    expect(cursor).toEqual(at(1, 0, 2));
    expect(bars(clip)).toBe('5.3.2 7.3.2 |\nr.2 r.2 |');
  });

  it('crosses bar lines both ways and stops at the start', () => {
    const clip = clipOf('5.3.2 5.3.2 | 7.3.1 |');
    expect(moveColumn(clip, at(1, 0, 0), -1, FILL).cursor).toEqual(at(0, 1, 0));
    expect(moveColumn(clip, at(0, 0, 0), -1, FILL).cursor).toEqual(at(0, 0, 0));
    expect(moveColumn(clip, at(0, 1, 0), 1, FILL).cursor).toEqual(at(1, 0, 0));
  });

  it('fills a short bar anywhere in the clip at once, with the fewest rests, then moves on', () => {
    const clip = clipOf('5.3.4 | 7.3.1 |');
    const moved = moveColumn(clip, at(0, 0, 2), 1, FILL);
    expect(bars(moved.clip)).toBe('5.3.4 r.2{d} |\n7.3.1 |');
    expect(moved.cursor).toEqual(at(0, 1, 2));
    expect(moveColumn(moved.clip, moved.cursor, 1, FILL).cursor).toEqual(at(1, 0, 2));
    // Only an eighth is left: the rest is an eighth.
    const short = clipOf('5.3.2 5.3.4 5.3.8 | 7.3.1 |');
    expect(bars(moveColumn(short, at(0, 2, 0), 1, FILL).clip).split('\n')[0]).toBe('5.3.2 5.3.4 5.3.8 r.8 |');
  });

  it('fills the bar it leaves going left, after its last column', () => {
    const clip = clipOf('5.3.2 5.3.2 | 7.3.4 | 9.3.1 |');
    const moved = moveColumn(clip, at(1, 0, 2), -1, FILL);
    expect(bars(moved.clip)).toBe('5.3.2 5.3.2 |\n7.3.4 r.2{d} |\n9.3.1 |');
    expect(moved.cursor).toEqual(at(0, 1, 2));
    // Within a bar, and when selecting, nothing is added.
    expect(moveColumn(clip, at(2, 0, 2), -1, FILL).clip).toBe(clip);
    expect(moveColumn(clip, at(1, 0, 2), -1, { grow: false, fillBars: true }).clip).toBe(clip);
  });

  it('fills a bar with the fewest rests, and leaves a full one alone', () => {
    const clip = clipOf('5.3.2 | 7.3.1 |');
    expect(bars(fillBar(clip, 0))).toBe('5.3.2 r.2 |\n7.3.1 |');
    expect(fillBar(clip, 1)).toBe(clip);
  });

  it('fills an emptied bar with one rest where one will do', () => {
    const full = clipOf('5.3.1 | \\ts (3 4) 7.3.2 7.3.4 | 9.3.2 9.3.4 |');
    const clip: Part = { ...full, bars: full.bars.map((b, i) => (i === 1 ? { ...b, columns: [] } : b)) };
    const moved = moveColumn(clip, at(1, 0, 2), 1, FILL);
    expect(bars(moved.clip).split('\n')[1]).toBe('\\ts (3 4) r.2{d} |');
    expect(moved.cursor).toEqual(at(1, 0, 2));
    expect(moveColumn(moved.clip, moved.cursor, 1, FILL).cursor).toEqual(at(2, 0, 2));
  });

  it('splits a long rest when a note goes on it: the note takes the last note\'s length', () => {
    let { clip, cursor } = moveColumn(clipOf('12.3.4 |'), at(0, 0, 2), 1, FILL);
    clip = setFret(clip, cursor, 14);
    expect(bars(clip)).toBe('12.3.4 14.3.4 r.2 |');
    ({ clip, cursor } = moveColumn(clip, cursor, 1, FILL));
    clip = setFret(clip, cursor, 15);
    expect(bars(clip)).toBe('12.3.4 14.3.4 15.3.4 r.4 |');
    // A rest no longer than the last note keeps its length.
    expect(bars(setFret(clipOf('5.3.2 r.4 r.4 |'), at(0, 1, 0), 3))).toBe('5.3.2 3.1.4 r.4 |');
  });

  it('with filling off (the default), adds one rest to type on and leaves short bars short', () => {
    // → past a short bar's last column: one rest as long as the column before it.
    let clip = clipOf('5.3.4 | 7.3.1 |');
    let cursor = at(0, 0, 2);
    ({ clip, cursor } = moveColumn(clip, cursor, 1));
    expect(bars(clip)).toBe('5.3.4 r.4 |\n7.3.1 |');
    expect(cursor).toEqual(at(0, 1, 2));
    clip = setFret(clip, cursor, 7);
    ({ clip, cursor } = moveColumn(clip, cursor, 1));
    expect(bars(clip)).toBe('5.3.4 7.3.4 r.4 |\n7.3.1 |');
    // A full bar moves on to the next one, adding nothing.
    const full = clipOf('5.3.2 5.3.2 | 7.3.1 |');
    expect(moveColumn(full, at(0, 1, 2), 1)).toEqual({ clip: full, cursor: at(1, 0, 2) });
    // Where the column before is too long for what is left, the longest rest that fits.
    expect(bars(moveColumn(clipOf('5.3.2 5.3.4{d} |'), at(0, 1, 2), 1).clip)).toBe('5.3.2 5.3.4{d} r.8 |');
    // An emptied bar gets one rest, as long as the last column before it.
    const emptied = clipOf('5.3.4 | 9.3.1 |');
    const blank: Part = { ...emptied, bars: [emptied.bars[0], { ...emptied.bars[1], columns: [] }] };
    expect(bars(moveColumn(blank, at(1, 0, 2), 1).clip)).toBe('5.3.4 |\nr.4 |');
  });

  it('with filling off, ← leaves the bar it leaves as it was', () => {
    const clip = clipOf('5.3.2 5.3.2 | 7.3.4 | 9.3.1 |');
    const moved = moveColumn(clip, at(1, 0, 2), -1);
    expect(moved.clip).toBe(clip);
    expect(moved.cursor).toEqual(at(0, 1, 2));
  });

  it('starts a new full bar from the clip\'s last column either way', () => {
    for (const options of [{}, FILL]) {
      const moved = moveColumn(clipOf('5.3.2 5.3.2 |'), at(0, 1, 2), 1, options);
      expect(bars(moved.clip)).toBe('5.3.2 5.3.2 |\nr.2 r.2 |');
      expect(moved.cursor).toEqual(at(1, 0, 2));
    }
  });

  it('reads the Editing setting, off unless saved as true', () => {
    expect([parseEditing(null), parseEditing({ fillBars: true }), parseEditing({ fillBars: 'yes' })])
      .toEqual([{ fillBars: false }, { fillBars: true }, { fillBars: false }]);
  });

  it('makes up any length with the fewest rests, longest first', () => {
    const names = (room: number) => fewestRests(room).map(d => `${d.value}${'.'.repeat(d.dots)}`);
    expect(names(WHOLE)).toEqual(['1']);
    expect(names(WHOLE * 3 / 4)).toEqual(['2.']);
    expect(names(WHOLE * 7 / 8)).toEqual(['2..']);
    expect(names(WHOLE * 5 / 4)).toEqual(['1', '4']);
    expect(names(WHOLE * 3 / 8)).toEqual(['4.']);
    expect(names(0)).toEqual([]);
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

  it('inserts a bar of the fewest rests after the cursor\'s bar, in the time in force there', () => {
    const clip = clipOf('\\ts (4 4) 0.6.1 | \\ts (3 4) 0.5.4 0.5.4 0.5.4 | \\ts (6 8) 0.4.4 0.4.8 0.4.4 0.4.8 | 0.4.4 0.4.8 0.4.4 0.4.8 |');
    const { clip: next, cursor } = insertBar(clip, at(1, 0, 2), 'after');
    expect(bars(next).split('\n')).toEqual([
      '0.6.1 |',
      '\\ts (3 4) 0.5.4 0.5.4 0.5.4 |',
      'r.2{d} |',
      '\\ts (6 8) 0.4.4 0.4.8 0.4.4 0.4.8 |',
      '0.4.4 0.4.8 0.4.4 0.4.8 |',
    ]);
    expect(cursor).toEqual(at(2, 0, 2));
    // After the last bar, and in 6/8: one dotted half rest.
    expect(bars(insertBar(clip, at(3, 0, 0), 'after').clip).split('\n').at(-1)).toBe('r.2{d} |');
  });

  it('inserts a bar before the cursor\'s bar in the time before it; the bar keeps its own change', () => {
    const clip = clipOf('\\ts (4 4) 0.6.1 | \\ts (3 4) 0.5.4 0.5.4 0.5.4 |');
    const { clip: next, cursor } = insertBar(clip, at(1, 1, 0), 'before');
    expect(bars(next).split('\n')).toEqual(['0.6.1 |', 'r.1 |', '\\ts (3 4) 0.5.4 0.5.4 0.5.4 |']);
    expect(cursor).toEqual(at(1, 0, 0));
    // Before the first bar: the clip's own time.
    expect(bars(insertBar(clip, at(0, 0, 0), 'before').clip).split('\n')[0]).toBe('r.1 |');
  });
});

describe('cut, copy and paste', () => {
  const clip = clipOf('\\ts (2 4)\n5.3.4 7.3{h}.8 9.3.8 | 0.6.2 |');

  it('copies the selected columns as alphaTex that reads back', () => {
    const text = copyText(clip, [1, 3]);
    expect(text).toBe('\\ts (2 4)\n7.3{h}.8 9.3.8 | 0.6.2 |\n');
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

  it('keeps the cursor in the bar: the column after a deleted one in that bar, else the one before', () => {
    const two = clipOf('1.1.4 2.1.4 3.1.2 | 4.1.1 |');
    // A bar's last column: back to the one before it, not on to the next bar.
    expect(deleteColumns(two, [2, 2]).cursor).toEqual({ bar: 0, column: 1 });
    // A middle column: the one that moved into its place.
    expect(deleteColumns(two, [1, 1]).cursor).toEqual({ bar: 0, column: 1 });
    // The clip's very first column: the one after it.
    expect(deleteColumns(two, [0, 0]).cursor).toEqual({ bar: 0, column: 0 });
  });

  it('keeps a bar emptied on its own, with the cursor in it, and Delete there takes the bar away', () => {
    const three = clipOf('1.1.1 | 2.1.2 3.1.2 | 4.1.1 |');
    const cut = deleteColumns(three, [1, 2]);
    expect(cut.clip.bars.map(b => b.columns.length)).toEqual([1, 0, 1]);
    expect(cut.cursor).toEqual({ bar: 1, column: 0 });
    const gone = removeEmptyBar(cut.clip, 1);
    expect(bars(gone.clip)).toBe('1.1.1 |\n4.1.1 |');
    expect(gone.cursor).toEqual({ bar: 0, column: 0 });
    // The only bar stays.
    const only = deleteColumns(clipOf('1.1.1 |'), [0, 0]).clip;
    expect(removeEmptyBar(only, 0).clip.bars).toHaveLength(1);
  });

  it('pastes before the cursor column, as at a caret', () => {
    const pasted = clipOf('1.1.8 2.1.8 | 3.1.4 |');
    const result = insertPaste(clip, at(0, 1, 0), pasted);
    expect(bars(result.clip)).toBe('5.3.4 1.1.8 2.1.8 |\n3.1.4 7.3{h}.8 9.3.8 |\n0.6.2 |');
    expect(result.cursor).toEqual(at(1, 0, 0));
  });

  it('pastes a whole clip into an empty one, with its name and time', () => {
    const pasted = clipOf('\\title "Lick"\n\\ts (3 4)\n5.3.2{d} |');
    const result = insertPaste(emptyPart(), at(0, 0, 0), pasted);
    expect(result.clip.name).toBe('Lick');
    expect(result.clip.time).toEqual({ beats: 3, value: 4 });
  });
});

describe('runAround', () => {
  it('reaches as far as the mark goes, across bars', () => {
    const clip = clipOf('0.6.4 0.6{pm}.4 0.6{pm}.2 | 0.6{pm}.2 0.6.2 |');
    const muted = (c: { notes: ({ palmMute?: boolean } | null)[] }) => c.notes.some(n => n?.palmMute);
    expect(runAround(clip, 2, muted)).toEqual([1, 3]);
  });
});

describe('words over the tab', () => {
  it('sets and clears a chord name, a section, a tempo and the capo', () => {
    let clip = clipOf('5.3.2 7.3.2 |');
    clip = setChordName(clip, at(0, 1, 2), ' Am7 ');
    clip = setSection(clip, 0, 'Intro');
    clip = setTempo(clip, 0, { bpm: 80 });
    clip = setCapo(clip, 2);
    expect(writePart(clip)).toBe('\\ts (4 4)\n\\capo 2\n\\section "Intro" \\tempo 80 5.3.2 7.3.2{ch "Am7"} |\n');
    clip = setChordName(clip, at(0, 1, 2), '');
    clip = setSection(clip, 0, ' ');
    clip = setTempo(clip, 0, null);
    clip = setCapo(clip, null);
    expect(writePart(clip)).toBe('\\ts (4 4)\n5.3.2 7.3.2 |\n');
  });

  it('keeps a rehearsal mark when only the section name changes', () => {
    let clip = clipOf('\\section ("A" "Verse") \\tempo (60 "Slowly") 5.3.1 |');
    clip = setSection(clip, 0, 'Bridge');
    expect(bars(clip)).toBe('\\section ("A" "Bridge") \\tempo (60 "Slowly") 5.3.1 |');
  });
});

describe('setEnding', () => {
  it('renumbers or takes away the whole run of bars under one bracket', () => {
    const clip = clipOf('0.6.1 | \\ae 2 3.6.1 | \\ae 2 5.6.1 | 7.6.1 |');
    expect(setEnding(clip, 2, 3).bars.map(b => b.ending)).toEqual([undefined, 3, 3, undefined]);
    expect(setEnding(clip, 1, null).bars.map(b => b.ending)).toEqual([undefined, undefined, undefined, undefined]);
    expect(setEnding(clip, 0, 2)).toBe(clip);
  });
});

