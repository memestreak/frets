import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import type { Clip } from '@/features/tab/clip';
import { choosePlace, movedPitch, moveNotes, moveToString, notesToMove, pitchAtStep, stepOf, stepPitch, toggleStaffNote } from '@/features/tab/staffEntry';

function clipOf(body: string): Clip {
  const result = readAlphaTexWith(alphaTab, `\\ts (4 4)\n${body}\n`);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.clip;
}

const E4 = 64;
const at = (column: number) => ({ bar: 0, column });
const frets = (clip: Clip, column: number) => clip.bars[0].columns[column].notes.map(n => (n ? n.fret : null));

describe('the staff cursor\'s pitch', () => {
  it('takes the key\'s note on a line or space, and steps through the key', () => {
    const g = clipOf('\\ks G r.1 |');
    // The top line is F, sharp in G major: F♯5 written, F♯4 sounding.
    expect(pitchAtStep(g, 0, 8)).toBe(66);
    expect(stepOf(g, 0, 66)).toBe(8);
    expect(stepPitch(g, 0, 66, -1)).toBe(64);
    expect(stepPitch(g, 0, 64, 1)).toBe(66);
    const c = clipOf('r.1 |');
    expect(pitchAtStep(c, 0, 8)).toBe(65);
    // The bottom line is E4 written, E3 sounding.
    expect(pitchAtStep(c, 0, 0)).toBe(52);
  });
});

describe('choosing the string and fret', () => {
  it('takes the lowest fret with nothing around', () => {
    expect(choosePlace(clipOf('r.1 |'), at(0), E4)).toEqual({ string: 0, fret: 0 });
  });

  it('stays near the notes before, and takes the lower fret between two as near', () => {
    // After a G-string 7th fret, E4 is 5th fret B rather than the open e.
    expect(choosePlace(clipOf('7.3.4 r.4 r.2 |'), at(1), E4)).toEqual({ string: 1, fret: 5 });
  });

  it('skips strings the column already uses, and finds none for a note below the low E', () => {
    expect(choosePlace(clipOf('0.1.1 |'), at(0), E4)).toEqual({ string: 1, fret: 5 });
    expect(choosePlace(clipOf('r.1 |'), at(0), 30)).toBeNull();
  });
});

describe('Enter on the staff', () => {
  it('puts a note on a rest, and takes it away again', () => {
    const clip = clipOf('r.1 |');
    const added = toggleStaffNote(clip, at(0), E4);
    expect(added.string).toBe(0);
    expect(frets(added.clip, 0)[0]).toBe(0);
    const removed = toggleStaffNote(added.clip, at(0), E4);
    expect(removed.string).toBeNull();
    expect(frets(removed.clip, 0).every(f => f === null)).toBe(true);
  });

  it('builds a chord, and says when no string is free', () => {
    let clip = clipOf('r.1 |');
    for (const pitch of [40, 47, 52]) clip = toggleStaffNote(clip, at(0), pitch).clip;
    expect(frets(clip, 0)).toEqual([null, null, null, 2, 2, 0]);
    expect(toggleStaffNote(clip, at(0), 30).problem).toBeTruthy();
  });
});

describe('Alt+arrows on the tab', () => {
  it('move the note to the next string that can play it, keeping its marks and pitch', () => {
    const clip = clipOf('0.1{ac}.1 |');
    const down = moveToString(clip, at(0), E4, 1);
    expect(down.string).toBe(1);
    expect(frets(down.clip, 0)).toEqual([null, 5, null, null, null, null]);
    expect(down.clip.bars[0].columns[0].notes[1]!.accent).toBeTruthy();
    expect(moveToString(down.clip, at(0), E4, -1).string).toBe(0);
    // Nowhere higher than the high e: it stays.
    expect(moveToString(clip, at(0), E4, -1)).toEqual({ clip, string: 0 });
  });
});

describe('moving notes on the staff (issue #174)', () => {
  it('steps a line or space in the key, or a semitone', () => {
    const g = clipOf('\\ks G r.1 |');
    expect(movedPitch(g, 0, E4, { steps: 1, semitones: false })).toBe(66);
    expect(movedPitch(g, 0, E4, { steps: 2, semitones: false })).toBe(67);
    expect(movedPitch(g, 0, E4, { steps: -1, semitones: true })).toBe(63);
  });

  it('moves one note of a chord, keeping its marks and its string', () => {
    // An A minor shape at the fifth fret: A on the low E, E on the A string, A on the D string.
    const clip = clipOf('(5.6 7.5 7.4{ac}).1 |');
    const places = notesToMove(clip, at(0), 57, null, false);
    expect(places).toEqual([{ bar: 0, column: 0, string: 3 }]);
    const up = moveNotes(clip, places, { steps: 1, semitones: false });
    expect(frets(up.clip, 0)).toEqual([null, null, null, 9, 7, 5]);
    expect(up.clip.bars[0].columns[0].notes[3]!.accent).toBeTruthy();
    expect(up.moved).toEqual([{ bar: 0, column: 0, string: 3 }]);
  });

  it('moves the whole chord, or every note of the selection', () => {
    const clip = clipOf('(5.6 7.5).4 (3.6 5.5).4 r.2 |');
    const chord = notesToMove(clip, at(0), 45, null, true);
    expect(chord).toHaveLength(2);
    expect(frets(moveNotes(clip, chord, { steps: 2, semitones: true }).clip, 0)).toEqual([null, null, null, null, 9, 7]);
    const selected = notesToMove(clip, at(0), 45, { anchor: 0, focus: 1 }, false);
    const moved = moveNotes(clip, selected, { steps: -1, semitones: true }).clip;
    expect(frets(moved, 0)).toEqual([null, null, null, null, 6, 4]);
    expect(frets(moved, 1)).toEqual([null, null, null, null, 4, 2]);
  });

  it('moves a note off the end of its string to another one', () => {
    const clip = clipOf('2.5.1 |');
    expect(frets(moveNotes(clip, [{ bar: 0, column: 0, string: 4 }], { steps: -3, semitones: true }).clip, 0)).toEqual([null, null, null, null, null, 4]);
  });

  it('moves nothing when a note would fall off the neck', () => {
    const clip = clipOf('0.6.1 |');
    const edit = moveNotes(clip, notesToMove(clip, at(0), 40, null, false), { steps: -1, semitones: true });
    expect(edit.clip).toBe(clip);
    expect(edit.problem).toBeTruthy();
  });

  it('carries nothing off a note, unless the chord is asked for', () => {
    const clip = clipOf('0.1.1 |');
    expect(notesToMove(clip, at(0), 60, null, false)).toEqual([]);
    expect(notesToMove(clip, at(0), 60, null, true)).toHaveLength(1);
  });
});
