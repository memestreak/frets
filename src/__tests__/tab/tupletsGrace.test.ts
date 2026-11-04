/**
 * Tuplets, grace notes and rests that keep bars full (step 6, `docs/specs/2026-11-04-tab-tuplets-grace-rest-design.md`):
 * the pure edits, run through the meter as the page records them. The page's keys, panel and lights are in
 * `page/tupletsGrace.test.tsx`.
 */
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { writeAlphaTex, writeBars } from '@/features/tab/alphatex';
import { partOf, withPart, type Clip, type Part } from '@/features/tab/clip';
import { rewrite } from '@/features/tab/rewrite';
import { clearNote, type Cursor, type Target } from '@/features/tab/editing';
import { setValue } from '@/features/tab/noteEdits';
import { isOn } from '@/features/tab/tools';
import { advance, stepInRest } from '@/features/tab/grid';
import { writeMusicXml } from '@/features/tab/musicxml';
import { writeGuitarProWith } from '@/features/tab/guitarPro';
import { writeAscii } from '@/features/tab/ascii';
import {
  addGrace, applyTuplet, enterGrace, isProblem, removeGrace, startTuplet, typeInTuplet,
  TUPLET_NEEDS_PLAIN, TUPLET_TOO_SHORT, type Edited,
} from '@/features/tab/tuplets';

function read(text: string): Clip {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.clip;
}
const clipOf = (text: string): Part => partOf(read(`\\ts (4 4)\n${text}`));
const bars = (part: Part) => writeBars(part).join(' ');
/** An edit as the page records it: the bars whose rhythm changed written again by the meter. */
const edited = (clip: Part, next: Edited): Part => {
  if (isProblem(next)) throw new Error(next.problem);
  return rewrite(clip, next);
};
const at = (bar: number, column: number, string = 0): Cursor => ({ bar, column, string });
const note = (cursor: Cursor): Target => ({ cursor, selection: null });
const range = (from: number, to: number): Target => ({ cursor: at(0, from), selection: { anchor: from, focus: to } });
const eighth = { value: 8, dots: 0 } as const;
const quarter = { value: 4, dots: 0 } as const;

describe('a tuplet on one picked note takes its time (Q1)', () => {
  const QUARTER = '5.1.4 7.1.4 r.2 |';

  it('a triplet on a quarter on beat 1: a triplet eighth at its fret, then a triplet quarter rest, the bar still full', () => {
    const clip = clipOf(QUARTER);
    expect(bars(edited(clip, applyTuplet(clip, note(at(0, 0)), 3)))).toBe('5.1.8{tu 3} r.4{tu 3} 7.1.4 r.2 |');
  });

  it('5, 6 and 7 split a quarter in sixteenths, 9 in thirty-seconds', () => {
    const clip = clipOf(QUARTER);
    const first = (n: number) => edited(clip, applyTuplet(clip, note(at(0, 0)), n)).bars[0].columns[0].duration;
    expect(first(5)).toEqual({ value: 16, dots: 0, tuplet: 5 });
    expect(first(6)).toEqual({ value: 16, dots: 0, tuplet: 6 });
    expect(first(7)).toEqual({ value: 16, dots: 0, tuplet: 7 });
    expect(first(9)).toEqual({ value: 32, dots: 0, tuplet: 9 });
    // Each fills just the quarter: the note after it stays on beat 2.
    for (const n of [5, 6, 7, 9]) expect(bars(edited(clip, applyTuplet(clip, note(at(0, 0)), n)))).toMatch(/ 7\.1\.4 r\.2 \|$/);
  });

  it('a triplet on q~q in a bar makes triplet quarters', () => {
    const clip = clipOf('5.1.4 -.1.4 r.2 |');
    expect(bars(edited(clip, applyTuplet(clip, note(at(0, 0)), 3)))).toBe('5.1.4{tu 3} r.2{tu 3} r.2 |');
  });

  it('a dotted quarter, q~e and a 9 on a sixteenth are refused, the Clip unchanged, with the sentence why', () => {
    for (const tex of ['5.1.4{d} r.8 r.2 |', '5.1.4 -.1.8 r.8 r.2 |']) {
      expect(applyTuplet(clipOf(tex), note(at(0, 0)), 3)).toEqual({ problem: TUPLET_NEEDS_PLAIN });
    }
    expect(TUPLET_NEEDS_PLAIN).toBe('A tuplet goes on a note without a dot.');
    expect(applyTuplet(clipOf('5.1.16 r.16 r.8 r.4 r.2 |'), note(at(0, 0)), 9)).toEqual({ problem: TUPLET_TOO_SHORT });
    expect(TUPLET_TOO_SHORT).toBe('That tuplet’s notes would be shorter than a sixty-fourth.'.replace('’', "'"));
  });
});

describe('a selection is squeezed into a tuplet (Q2)', () => {
  const EIGHTHS = '5.1.8 7.1.8 8.1.8 9.1.8 r.2 |';

  it('three eighths on beat 1: an eighth triplet over beat 1 and an eighth Gap after it', () => {
    const clip = clipOf(EIGHTHS);
    expect(bars(edited(clip, applyTuplet(clip, range(0, 2), 3)))).toBe('5.1.8{tu 3} 7.1.8{tu 3} 8.1.8{tu 3} r.8 9.1.8 r.2 |');
  });

  it('two eighths: a triplet whose third note is a Gap, nothing after it moved', () => {
    const clip = clipOf(EIGHTHS);
    expect(bars(edited(clip, applyTuplet(clip, range(0, 1), 3)))).toBe('5.1.8{tu 3} 7.1.8{tu 3} r.8{tu 3} 8.1.8 9.1.8 r.2 |');
  });
});

describe('taking a tuplet away (Q4)', () => {
  it('None, the triplet again, or Delete on its number, on a triplet made from a quarter: an eighth then an eighth Gap', () => {
    const quarter = clipOf('5.1.4 7.1.4 r.2 |');
    const clip = edited(quarter, applyTuplet(quarter, note(at(0, 0)), 3));
    expect(bars(edited(clip, applyTuplet(clip, note(at(0, 0)), null)))).toBe('5.1.8 r.8 7.1.4 r.2 |');
    expect(bars(edited(clip, applyTuplet(clip, note(at(0, 0)), 3)))).toBe('5.1.8 r.8 7.1.4 r.2 |');
  });

  it('three triplet eighths go back to three plain eighths, writing over the next eighth', () => {
    const clip = clipOf('5.1.8{tu 3} 7.1.8{tu 3} 8.1.8{tu 3} 9.1.8 3.1.8 r.2 |');
    expect(bars(edited(clip, applyTuplet(clip, note(at(0, 1)), null)))).toBe('5.1.8 7.1.8 8.1.8 3.1.8 r.2 |');
  });
});

describe('inside a tuplet (Q5)', () => {
  const TRIPLET = '5.1.8{tu 3} 7.1.8{tu 3} 8.1.8{tu 3} r.4 r.2 |';

  it('the quarter key on its first note makes a triplet quarter over the second', () => {
    const clip = clipOf(TRIPLET);
    expect(bars(edited(clip, setValue(clip, note(at(0, 0)), 4)))).toBe('5.1.4{tu 3} 8.1.8{tu 3} r.4 r.2 |');
  });

  it('on its third note nothing changes: there is no room before its end', () => {
    const clip = clipOf(TRIPLET);
    expect(setValue(clip, note(at(0, 2)), 4)).toEqual(clip);
  });

  it('shorter leaves a Gap inside it', () => {
    const clip = clipOf(TRIPLET);
    expect(bars(edited(clip, setValue(clip, note(at(0, 1)), 16)))).toBe('5.1.8{tu 3} 7.1.16{tu 3} r.16{tu 3} 8.1.8{tu 3} r.4 r.2 |');
  });

  it('Delete on its only note leaves no tuplet: a plain Gap, written by the meter', () => {
    const quarter = clipOf('5.1.4 7.1.4 r.2 |');
    const clip = edited(quarter, applyTuplet(quarter, note(at(0, 0)), 3));
    expect(bars(edited(clip, clearNote(clip, at(0, 0))))).toBe('r.4 7.1.4 r.2 |');
  });
});

describe('Tuplet entry and the Grid in a tuplet (Q6, Q7)', () => {
  it('a fret typed in a Gap starts a tuplet whose notes are the Input length; the next goes in its Gap', () => {
    const empty = clipOf('r.1 |');
    const started = edited(empty, startTuplet(empty, 0, 0, 3, eighth, 0, 5));
    expect(bars(started)).toBe('5.1.8{tu 3} r.4{tu 3} r.4 r.2 |');
    const second = typeInTuplet(started, at(0, 1), 0, 7, eighth)!;
    expect(bars(rewrite(started, second.clip))).toBe('5.1.8{tu 3} 7.1.8{tu 3} r.8{tu 3} r.4 r.2 |');
    expect(second.cursor).toEqual(at(0, 1));
  });

  it('a sixteenth Input length inside an eighth triplet types a triplet sixteenth', () => {
    const started = clipOf('5.1.8{tu 3} r.4{tu 3} r.4 r.2 |');
    const typed = typeInTuplet(started, at(0, 1), 0, 7, { value: 16, dots: 0 })!;
    expect(typed.clip.bars[0].columns[1].duration).toEqual({ value: 16, dots: 0, tuplet: 3 });
  });

  it('nothing is typed past the tuplet’s end', () => {
    const started = clipOf('5.1.8{tu 3} 7.1.8{tu 3} r.8{tu 3} r.4 r.2 |');
    expect(typeInTuplet(started, at(0, 2), 0, 9, quarter)).toBeNull();
  });

  it('a rest typed first (`,`) then a fret makes a triplet starting with a rest', () => {
    const empty = clipOf('r.1 |');
    const started = edited(empty, startTuplet(empty, 0, 1, 3, eighth, 0, 5));
    expect(bars(started)).toBe('r.8{tu 3} 5.1.8{tu 3} r.8{tu 3} r.4 r.2 |');
  });

  it('in a triplet’s Gap, → stops at each triplet eighth, whatever the Grid', () => {
    const clip = clipOf('5.1.8{tu 3} r.4{tu 3} r.4 r.2 |');
    const step = 3548160 / 16;
    const unit = 3548160 / 12;
    expect(stepInRest(clip, at(0, 1), 0, 1, step)).toBe(unit);
    expect(stepInRest(clip, at(0, 1), unit, 1, step)).toBeNull();
    // Shift+Space on by a triplet eighth lands there too.
    expect(advance(clip, at(0, 1), 0, unit).at).toBe(unit);
  });
});

describe('grace notes (Q8–Q11)', () => {
  const QUARTERS = '5.1.4 7.1.4 r.2 |';

  it('`/` on a picked note adds one at its fret before it, the bar’s time unchanged, the cursor on it; one alone is a slashed eighth', () => {
    const clip = clipOf(QUARTERS);
    const added = addGrace(clip, at(0, 1), false)!;
    expect(bars(rewrite(clip, added.clip))).toBe('5.1.4 7.1.8{gr} 7.1.4 r.2 |');
    expect(added.cursor).toEqual(at(0, 1));
  });

  it('`/` on that grace note adds a second, both sixteenths; a third makes them thirty-seconds', () => {
    const clip = clipOf(QUARTERS);
    const one = addGrace(clip, at(0, 1), false)!;
    const two = addGrace(one.clip, one.cursor, false)!;
    expect(bars(rewrite(clip, two.clip))).toBe('5.1.4 7.1.16{gr} 7.1.16{gr} 7.1.4 r.2 |');
    const three = addGrace(two.clip, two.cursor, false)!;
    expect(bars(rewrite(clip, three.clip))).toBe('5.1.4 7.1.32{gr} 7.1.32{gr} 7.1.32{gr} 7.1.4 r.2 |');
  });

  it('a whole Column picked gets a grace chord; only the picked string otherwise', () => {
    const clip = clipOf('(5.1 7.2).4 r.4 r.2 |');
    expect(bars(addGrace(clip, at(0, 0, 1), true)!.clip)).toMatch(/^\(5\.1 7\.2\)\.8\{gr\} /);
    expect(bars(addGrace(clip, at(0, 0, 1), false)!.clip)).toMatch(/^7\.2\.8\{gr\} /);
  });

  it('the length keys leave a grace note as it is, and Duration lights nothing for one', () => {
    const clip = clipOf('7.1.8{gr} 7.1.4 r.4 r.2 |');
    expect(setValue(clip, note(at(0, 0)), 4)).toEqual(clip);
    for (const id of ['eighth', 'quarter', 'dot'] as const) expect(isOn(clip, at(0, 0), id)).toBe(false);
  });

  it('Delete on a picked grace note removes it and leaves no Gap', () => {
    const clip = clipOf('5.1.4 7.1.16{gr} 7.1.16{gr} 7.1.4 r.2 |');
    expect(bars(rewrite(clip, removeGrace(clip, at(0, 1))))).toBe('5.1.4 7.1.8{gr} 7.1.4 r.2 |');
  });

  it('Grace entry: frets typed at a quarter’s time go in as grace notes before it, the cursor staying at that time', () => {
    const clip = clipOf(QUARTERS);
    const five = enterGrace(clip, at(0, 1), 5);
    const seven = enterGrace(five.clip, five.cursor, 7);
    expect(bars(rewrite(clip, seven.clip))).toBe('5.1.4 5.1.16{gr} 7.1.16{gr} 7.1.4 r.2 |');
    expect(seven.cursor).toEqual(at(0, 3));
  });
});

describe('what doesn’t change (Q15)', () => {
  it('a triplet and a grace note made by these edits export as ones typed in alphaTex', () => {
    const quarter = clipOf('5.1.4 7.1.4 r.2 |');
    const tupleted = edited(quarter, applyTuplet(quarter, note(at(0, 0)), 3));
    const made = addGrace(tupleted, at(0, 2), false)!.clip;
    const typed = clipOf('5.1.8{tu 3} r.4{tu 3} 7.1.8{gr} 7.1.4 r.2 |');
    const whole = (part: Part) => withPart(read('\\ts (4 4)\nr.1 |'), part);
    expect(writeAlphaTex(whole(made))).toBe(writeAlphaTex(whole(typed)));
    expect(writeMusicXml(whole(made))).toBe(writeMusicXml(whole(typed)));
    expect(writeAscii(made)).toBe(writeAscii(typed));
    expect(writeGuitarProWith(alphaTab, whole(made))).toEqual(writeGuitarProWith(alphaTab, whole(typed)));
  });
});
