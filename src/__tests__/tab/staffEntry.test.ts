import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import type { Clip } from '@/features/tab/clip';
import { choosePlace, moveToString, pitchAtStep, stepOf, stepPitch, toggleStaffNote } from '@/features/tab/staffEntry';

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

describe('Alt+arrows on the staff', () => {
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
