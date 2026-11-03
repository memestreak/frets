/**
 * Rests are Gaps (`docs/specs/2026-11-03-tab-rests-are-gaps-design.md`): after an edit, the bars whose
 * rhythm changed are written again by the meter; the cursor and selection follow by time; an empty
 * bar is one Whole-bar rest, drawn and exported as one.
 */
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { writeBars } from '@/features/tab/alphatex';
import { partOf, type Part } from '@/features/tab/clip';
import { clearNote, setFret, type Cursor, type Selection } from '@/features/tab/editing';
import { clearToRests, setMark, setValue } from '@/features/tab/noteEdits';
import { cursorAtTime, rewrite, selectionAtTime } from '@/features/tab/rewrite';
import { isWholeBarRest, layoutClip, wholeRestX } from '@/features/tab/layout';
import { writeMusicXml } from '@/features/tab/musicxml';

function clipOf(text: string): Part {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return partOf(result.clip);
}
const bars = (clip: Part) => writeBars(clip).join('\n');
const at = (bar: number, column: number, string = 0): Cursor => ({ bar, column, string });
/** An edit as the page makes it: the edit, then the bars whose rhythm changed written by the meter. */
const edited = (before: Part, edit: (clip: Part) => Part) => rewrite(before, edit(before));
/** Delete on a selection of columns `from` to `to` (places in the clip). */
const deleted = (clip: Part, from: number, to: number) => edited(clip, c => clearToRests(c, { anchor: from, focus: to }).clip);

describe('rests are written by the meter after a rhythm edit', () => {
  it('deleting the last three quarters of 4/4 leaves q rq rh; all but an eighth on beat 1, e re rq rh', () => {
    expect(bars(deleted(clipOf('\\ts (4 4)\n3.6.4 5.6.4 7.6.4 8.6.4 |'), 1, 3))).toBe('3.6.4 r.4 r.2 |');
    expect(bars(deleted(clipOf('\\ts (4 4)\n3.6.8 5.6.8 7.6.4 8.6.2 |'), 1, 3))).toBe('3.6.8 r.8 r.4 r.2 |');
  });

  it('in 3/4 a quarter on beat 1 with the rest deleted is q rq rq, never a half rest', () => {
    expect(bars(deleted(clipOf('\\ts (3 4)\n3.6.4 5.6.2 |'), 1, 1))).toBe('3.6.4 r.4 r.4 |');
  });

  it('deleting every note stores rw in 4/4, rh. in 3/4, rq. rq in 5/8', () => {
    expect(bars(deleted(clipOf('\\ts (4 4)\n3.6.4 5.6.4 7.6.2 |'), 0, 2))).toBe('r.1 |');
    expect(bars(deleted(clipOf('\\ts (3 4)\n3.6.4 5.6.4 7.6.4 |'), 0, 2))).toBe('r.2{d} |');
    expect(bars(deleted(clipOf('\\ts (5 8)\n3.6.8 5.6.8 7.6.8 8.6.4 |'), 0, 3))).toBe('r.4{d} r.4 |');
    // One note cleared from its string, the bar's last, the same.
    expect(bars(edited(clipOf('\\ts (3 4)\n3.6.2{d} |'), c => clearNote(c, at(0, 0, 5))))).toBe('r.2{d} |');
  });

  it('a palm mute, a fret or another string leaves an imported bar\'s rests as written', () => {
    const imported = clipOf('\\ts (4 4)\n3.6.4 r.2{d} |');
    expect(bars(edited(imported, c => setMark(c, { cursor: at(0, 0, 5), selection: null }, ['palmMute', true])))).toBe('3.6{pm}.4 r.2{d} |');
    expect(bars(edited(imported, c => setFret(c, at(0, 0, 5), 7)))).toBe('7.6.4 r.2{d} |');
    // The same note on another string: the bar's rhythm is the same.
    const moved = (c: Part) => ({ ...c, bars: [{ ...c.bars[0], columns: [{ ...c.bars[0].columns[0], notes: [null, null, null, null, { fret: 8 }, null] }, c.bars[0].columns[1]] }] });
    expect(bars(edited(imported, moved))).toBe('8.5.4 r.2{d} |');
  });

  it('a rhythm edit leaves every other bar as it was, but for the bars a changed Tie chain crosses into', () => {
    const clip = clipOf('\\ts (4 4)\n3.6.4 r.2{d} | 3.6.2 5.6.2 | 3.6.4 r.2{d} |');
    const after = deleted(clip, 2, 2);
    expect(bars(after)).toBe('3.6.4 r.2{d} |\nr.2 5.6.2 |\n3.6.4 r.2{d} |');
    expect(after.bars[0]).toEqual(clip.bars[0]);
    expect(after.bars[2]).toEqual(clip.bars[2]);
    // A chain over the bar line, its first note shortened: the bar it ties into is written too.
    const tied = clipOf('\\ts (4 4)\n3.6.2 5.6.4 7.6.4 | -.6.4 r.8 r.8 r.2 |');
    const shorter = edited(tied, c => setValue(c, { cursor: at(0, 0, 5), selection: null }, 4));
    expect(bars(shorter)).toBe('3.6.4 r.4 5.6.4 7.6.4 |\n-.6.4 r.4 r.2 |');
  });

  it('a short bar and an overfull bar come back exactly after an edit in them', () => {
    const short = clipOf('\\ts (4 4)\n3.6.4 5.6.8 r.8 |');
    expect(bars(deleted(short, 1, 1))).toBe('3.6.4 r.8 r.8 |');
    const over = clipOf('\\ts (4 4)\n3.6.2 5.6.2 7.6.4 r.8 r.8 |');
    expect(bars(deleted(over, 2, 2))).toBe('3.6.2 5.6.2 r.4 r.8 r.8 |');
  });

  it('a picked note made shorter still leaves a Gap, written by the meter', () => {
    const clip = clipOf('\\ts (4 4)\n3.6.4 5.6.4 7.6.4 8.6.4 |');
    expect(bars(edited(clip, c => setValue(c, { cursor: at(0, 0, 5), selection: null }, 8)))).toBe('3.6.8 r.8 5.6.4 7.6.4 8.6.4 |');
  });

  it('an edit that changes nothing is the very same part', () => {
    const clip = clipOf('\\ts (4 4)\n3.6.4 r.2{d} |');
    expect(rewrite(clip, clip)).toBe(clip);
  });
});

describe('the cursor and selection follow by time', () => {
  // Beat 1 a quarter, the rest of the bar emptied: the rests the edit left (fewest) and as written by the meter.
  const clip = clipOf('\\ts (4 4)\n3.6.4 5.6.8 7.6.8 8.6.4 10.6.4 |');
  const next = clearToRests(clip, { anchor: 1, focus: 4 }).clip;
  const written = rewrite(clip, next);

  it('the cursor stays at the same time and string; inside a rest, at that rest\'s start', () => {
    expect(bars(next)).toBe('3.6.4 r.8 r.8 r.4 r.4 |');
    expect(bars(written)).toBe('3.6.4 r.4 r.2 |');
    // The third beat (the r.4 at column 3) is the start of the half rest.
    expect(cursorAtTime(next, written, at(0, 3, 2))).toEqual(at(0, 2, 2));
    // The second eighth of beat 2 falls inside the quarter rest: its start.
    expect(cursorAtTime(next, written, at(0, 2, 4))).toEqual(at(0, 1, 4));
    expect(cursorAtTime(next, written, at(0, 0, 5))).toEqual(at(0, 0, 5));
  });

  it('a selection over beats 2 to 3 still covers beats 2 to 3, widened to whole rests', () => {
    const selection: Selection = { anchor: 3, focus: 1 };
    expect(selectionAtTime(next, written, selection)).toEqual({ anchor: 2, focus: 1 });
  });
});

describe('the Whole-bar rest', () => {
  it('a full bar with no note is one, whatever it stores; a short bar or a bar with a note isn\'t', () => {
    const clip = clipOf('\\ts (5 8)\nr.4{d} r.4 | 3.6.4{d} r.4 | r.4 |');
    expect(isWholeBarRest(clip, 0)).toBe(true);
    expect(isWholeBarRest(clip, 1)).toBe(false);
    expect(isWholeBarRest(clip, 2)).toBe(false);
  });

  it('is laid out as one, centred in its Columns\' room', () => {
    const layout = layoutClip(clipOf('\\ts (5 8)\nr.4{d} r.4 | 3.6.8 5.6.8 7.6.8 8.6.4 |'), 800, 'tab');
    const bar = layout.systems[0].bars[0];
    expect(bar.wholeRest).toBe(true);
    expect(layout.systems[0].bars[1].wholeRest).toBe(false);
    const last = bar.columns[1];
    expect(wholeRestX(bar)).toBe((bar.columns[0].start + last.start + last.width) / 2);
  });

  it('MusicXML writes an empty 3/4 bar as one measure rest; alphaTex keeps r.2{d}', () => {
    const text = '\\ts (3 4)\n3.6.2{d} | r.2{d} |';
    const read = readAlphaTexWith(alphaTab, text);
    if (!read.ok) throw new Error(read.errors.join('\n'));
    const clip = clipOf(text);
    const xml = writeMusicXml(read.clip);
    const second = xml.slice(xml.indexOf('<measure number="2"'));
    expect(second.slice(0, second.indexOf('</measure>')).match(/<rest measure="yes"\/>/g)?.length).toBe(2);
    expect(bars(clip)).toBe('3.6.2{d} |\nr.2{d} |');
  });
});
