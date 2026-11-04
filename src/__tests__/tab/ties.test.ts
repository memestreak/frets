/**
 * Ties forward, a Tie chain as one note (step 5, `docs/specs/2026-11-04-tab-ties-forward-design.md`):
 * the pure edits. The page's presses and keys are in `page/ties.test.tsx`.
 */
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { writeBars, writeAlphaTex } from '@/features/tab/alphatex';
import { partOf, withPart, type Clip, type Part } from '@/features/tab/clip';
import { rewrite } from '@/features/tab/rewrite';
import { clearNote, deleteColumns, insertTime, noteAt, setFret, sliceClip, type Cursor, type Target } from '@/features/tab/editing';
import { clearToRests, cycleDots, setMark, setValue, cycleMark } from '@/features/tab/noteEdits';
import { applyTool, isOn } from '@/features/tab/tools';
import { chainStart, litTiedNotes, tieForward, tieOnInput } from '@/features/tab/ties';
import { writeMusicXml } from '@/features/tab/musicxml';
import { writeGuitarProWith } from '@/features/tab/guitarPro';
import { writeAscii } from '@/features/tab/ascii';
import { timeOf } from '@/features/tab/timeline';

function read(text: string): Clip {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.clip;
}
const clipOf = (text: string): Part => partOf(read(text));
/** An edit as the page records it: the bars whose rhythm changed written again by the meter. */
const edited = (clip: Part, next: Part) => rewrite(clip, next);
const bars = (part: Part) => writeBars(part).join(' ');
const at = (bar: number, column: number, string = 0): Cursor => ({ bar, column, string });
const note = (cursor: Cursor): Target => ({ cursor, selection: null });
const quarter = { value: 4, dots: 0 } as const;

describe('a Tie chain is one note', () => {
  it('starts at its first written note, from any of its notes, across the bar line', () => {
    const clip = clipOf('\\ts (4 4)\nr.2 r.4 5.1.4 | -.1.4 r.4 r.2 |');
    expect(chainStart(clip, at(1, 0))).toEqual(at(0, 2));
    expect(chainStart(clip, at(0, 2))).toEqual(at(0, 2));
  });

  it('Delete on its second Tied note leaves one Gap for the whole chain, written by the meter', () => {
    const clip = clipOf('\\ts (4 4)\n5.1.4 -.1.4 7.1.2 |');
    expect(bars(edited(clip, clearNote(clip, at(0, 1))))).toBe('r.2 7.1.2 |');
  });

  it('Insert on a picked q~e adds a dotted-quarter Gap; Ctrl/⌘+Delete takes a dotted quarter', () => {
    const clip = clipOf('\\ts (4 4)\n5.1.4 -.1.8 7.1.8 7.1.2 |');
    // The page asks for the chain's start and whole length (`editorKeys.ts`).
    const start = timeOf(clip, 0, 0);
    const inserted = insertTime(clip, start, 3 * 3548160 / 8, at(0, 0))!;
    expect(bars(edited(clip, inserted.clip))).toBe('r.4 r.8 5.1.8 -.1.4 7.1.8 7.1.8 | -.1.4{d} r.8 r.2 |');
    expect(bars(edited(clip, deleteColumns(clip, [0, 1]).clip))).toBe('7.1.8 7.1.8 -.1.4 -.1.8 r.8 r.4 |');
  });

  it('the length key for a half on the second Tied note of q~e makes a half from the chain’s start', () => {
    const clip = clipOf('\\ts (4 4)\n5.1.4 -.1.8 r.8 r.2 |');
    // The chain is a dotted quarter, so the half keeps the dot; on a plain q~q it is a half.
    expect(bars(edited(clip, setValue(clip, note(at(0, 1)), 2)))).toBe('5.1.2{d} r.4 |');
    const plain = clipOf('\\ts (4 4)\n5.1.8 -.1.8 r.4 r.2 |');
    expect(bars(edited(plain, setValue(plain, note(at(0, 1)), 2)))).toBe('5.1.2 r.2 |');
  });

  it('Duration on q~e lights quarter and the dot, on h~e nothing; . on q~q makes h., on h~e changes nothing', () => {
    const qe = clipOf('\\ts (4 4)\n5.1.4 -.1.8 r.8 r.2 |');
    expect(isOn(qe, at(0, 1), 'quarter')).toBe(true);
    expect(isOn(qe, at(0, 1), 'dot')).toBe(true);
    expect(isOn(qe, at(0, 1), 'eighth')).toBe(false);
    const he = clipOf('\\ts (4 4)\n5.1.2 -.1.8 r.8 r.4 |');
    for (const id of ['half', 'eighth', 'dot'] as const) expect(isOn(he, at(0, 0), id)).toBe(false);
    expect(cycleDots(he, note(at(0, 0)))).toBe(he);
    const qq = clipOf('\\ts (4 4)\n5.1.4 -.1.4 r.2 |');
    expect(bars(edited(qq, cycleDots(qq, note(at(0, 1)))))).toBe('5.1.2{d} r.4 |');
  });

  it('a fret typed on the second Tied note changes both and keeps the tie', () => {
    const clip = setFret(clipOf('\\ts (4 4)\n5.1.4 -.1.4 r.2 |'), at(0, 1), 7);
    expect(bars(clip)).toBe('7.1.4 -.1.4 r.2 |');
  });

  it('a selection takes the notes that start in it, whole: a held bass stays, a chain past its end goes, and copy runs to its end', () => {
    // The bass (string 6) is held from beat 1; a chain on string 1 starts on beat 3 and runs into bar 2.
    const clip = clipOf('\\ts (4 4)\n3.6.4 (-.6 5.1).4 (-.6 7.1).4 (-.6 8.1).4 | -.1.4 9.1.4 r.2 |');
    const selection = { anchor: 1, focus: 3 };
    const cleared = clearToRests(clip, selection).clip;
    expect(bars(cleared)).toBe('3.6.4 -.6.4 -.6.4 -.6.4 | r.4 9.1.4 r.2 |');
    // Copy takes the melody from beat 2 on, and the chain on into bar 2; not the held bass.
    expect(bars(sliceClip(clip, [1, 3]))).toBe('5.1.4 7.1.4 8.1.4 | -.1.4 |');
    expect(litTiedNotes(clip, at(0, 1), selection, false, false)).toEqual([{ index: 4, string: 0 }]);
  });

  it('a mark on a picked chain: P.M., let ring, vibrato and tremolo on every note; attacks and the bend on the first; slide out on the last', () => {
    const clip = clipOf('\\ts (4 4)\n5.1.4 -.1.4 -.1.4 r.4 |');
    const target = note(at(0, 1));
    const marks = (part: Part) => [0, 1, 2].map(c => noteAt(part, at(0, c)));
    for (const tool of ['palmMute', 'letRing'] as const) {
      const marked = applyTool(clip, target, tool);
      expect(marks(marked).every(n => n?.[tool])).toBe(true);
      expect(isOn(marked, at(0, 0), tool)).toBe(true);
    }
    const vibrato = cycleMark(clip, target, 'vibrato', ['slight', 'wide']);
    expect(marks(vibrato).every(n => n?.vibrato === 'slight')).toBe(true);
    const tremolo = applyTool(clip, target, 'tremolo16');
    expect([0, 1, 2].every(c => tremolo.bars[0].columns[c].tremolo === 16)).toBe(true);
    for (const tool of ['tap', 'ghost', 'harmonic', 'staccato', 'accent', 'preBend'] as const) {
      const marked = applyTool(clip, { cursor: at(0, 0), selection: null }, tool);
      const [first, ...rest] = marks(marked);
      expect(first).not.toEqual({ fret: 5 });
      expect(rest).toEqual([{ fret: 5, tie: true }, { fret: 5, tie: true }]);
      expect(isOn(marked, at(0, 0), tool)).toBe(true);
    }
    const out = applyTool(clip, target, 'slideOutDown');
    expect(marks(out).map(n => n?.slideOut)).toEqual([undefined, undefined, 'down']);
    expect(isOn(out, at(0, 0), 'slideOutDown')).toBe(true);
    // A legato or a mordent goes on the first note too.
    expect(noteAt(setMark(clip, target, ['mordent', 'upper']), at(0, 0))?.mordent).toBe('upper');
  });

  it('one Tied note picked alone takes a bend on that note only; a length key still changes the whole chain', () => {
    const clip = clipOf('\\ts (4 4)\n5.1.4 -.1.4 r.2 |');
    const alone: Target = { cursor: at(0, 1), selection: null, alone: true };
    const bent = applyTool(clip, alone, 'preBend');
    expect(noteAt(bent, at(0, 0))?.bend).toBeUndefined();
    expect(noteAt(bent, at(0, 1))?.bend).toBeDefined();
    expect(bars(edited(bent, setValue(bent, alone, 2)))).toBe(bars(edited(bent, setValue(bent, note(at(0, 0)), 2))));
    expect(noteAt(setValue(bent, alone, 2), at(0, 0))?.bend).toBeUndefined();
  });
});

describe('= ties forward', () => {
  it('onto a note at another fret: it takes the fret and is tied, losing its attack marks and keeping its palm mute', () => {
    const clip = clipOf('\\ts (4 4)\n5.1.4 7.1{h ac pm}.4 r.2 |');
    const tied = tieForward(clip, note(at(0, 0)));
    expect(noteAt(tied, at(0, 1))).toEqual({ fret: 5, tie: true, palmMute: true });
  });

  it('onto notes on other strings only adds a tied note on this string; onto a quarter rest, a tied quarter', () => {
    const other = clipOf('\\ts (4 4)\n5.1.4 3.6.4 r.2 |');
    expect(bars(tieForward(other, note(at(0, 0))))).toBe('5.1.4 (-.1 3.6).4 r.2 |');
    const rest = clipOf('\\ts (4 4)\n5.1.4 r.4 r.2 |');
    expect(bars(tieForward(rest, note(at(0, 0))))).toBe('5.1.4 -.1.4 r.2 |');
    // Written by the meter after the edit, the tied quarters are one half.
    expect(bars(edited(rest, tieForward(rest, note(at(0, 0)))))).toBe('5.1.2 r.2 |');
  });

  it('at the clip’s last note changes nothing; a grace note on another string is passed over, one on the same string stops it', () => {
    const last = clipOf('\\ts (4 4)\nr.2 r.4 5.1.4 |');
    expect(bars(tieForward(last, note(at(0, 2))))).toBe(bars(last));
    const other = clipOf('\\ts (4 4)\n5.1.4 7.2.16{gr} 7.1.4 r.2 |');
    expect(noteAt(tieForward(other, note(at(0, 0))), at(0, 2))).toEqual({ fret: 5, tie: true });
    // A tie after a grace note ties from the grace note (alphaTex's `-`), so none reaches over it.
    const same = clipOf('\\ts (4 4)\n5.1.4 7.1.16{gr} 7.1.4 r.2 |');
    expect(tieForward(same, note(at(0, 0)))).toEqual(same);
  });

  it('from a chain, ties on from its end', () => {
    const clip = clipOf('\\ts (4 4)\n5.1.4 -.1.4 7.1.4 r.4 |');
    expect(noteAt(tieForward(clip, note(at(0, 0))), at(0, 2))).toEqual({ fret: 5, tie: true });
  });

  it('with three Columns selected ties only where the next note has the same fret, and no fret changes', () => {
    const clip = clipOf('\\ts (4 4)\n5.1.4 5.1.4 7.1.4 7.1.4 |');
    const tied = tieForward(clip, { cursor: at(0, 0), selection: { anchor: 0, focus: 2 } });
    expect(bars(tied)).toBe('5.1.4 -.1.4 7.1.4 -.1.4 |');
  });

  it('in note input, input length a quarter, on a half on beat 1 of h q q: h. q, the cursor still on beat 1; again, a whole note', () => {
    const clip = clipOf('\\ts (4 4)\n5.1.2 3.1.4 4.1.4 |');
    const once = edited(clip, tieOnInput(clip, at(0, 0), quarter)!);
    expect(bars(once)).toBe('5.1.2{d} 4.1.4 |');
    expect(chainStart(once, at(0, 0))).toEqual(at(0, 0));
    const twice = edited(once, tieOnInput(once, at(0, 0), quarter)!);
    expect(bars(twice)).toBe('5.1.1 |');
    // On a rest it does nothing.
    expect(tieOnInput(clipOf('\\ts (4 4)\nr.1 |'), at(0, 0), quarter)).toBeNull();
  });

  it('a chain made with = writes the same alphaTex, MusicXML, Guitar Pro and ASCII tab as one typed with -', () => {
    const typed = read('\\ts (4 4)\n5.1.4 -.1.4 r.2 |');
    const made = withPart(typed, tieForward(clipOf('\\ts (4 4)\n5.1.4 r.4 r.2 |'), note(at(0, 0))));
    expect(writeAlphaTex(made)).toBe(writeAlphaTex(typed));
    expect(writeMusicXml(made)).toBe(writeMusicXml(typed));
    expect(writeGuitarProWith(alphaTab, made)).toEqual(writeGuitarProWith(alphaTab, typed));
    expect(writeAscii(partOf(made))).toBe(writeAscii(partOf(typed)));
  });
});
