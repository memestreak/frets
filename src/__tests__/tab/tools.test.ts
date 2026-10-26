import * as alphaTab from '@coderline/alphatab';
import { writeAlphaTex } from '@/features/tab/alphatex';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import type { Clip } from '@/features/tab/clip';
import { applyCyclingKey, applyTool, isOn } from '@/features/tab/tools';

function clipOf(text: string): Clip {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.clip;
}
const bars = (clip: Clip) => writeAlphaTex(clip).split('\n').filter(l => l.endsWith('|')).join('\n');

describe('marks drawn over a column', () => {
  // The cursor on the low E, which the chord leaves empty.
  const target = { cursor: { bar: 0, column: 0, string: 5 }, selection: null };

  it.each([
    ['palmMute', 'pm'], ['letRing', 'lr'], ['accent', 'ac'], ['staccato', 'st'],
  ] as const)('%s marks every note of the column, wherever the cursor is in it, and clears them again', (id, tex) => {
    let clip = clipOf('(0.1 1.2 0.3).2 r.2 |');
    clip = applyTool(clip, target, id);
    expect(bars(clip)).toBe(`(0.1{${tex}} 1.2{${tex}} 0.3{${tex}}).2 r.2 |`);
    expect(isOn(clip, target.cursor, id)).toBe(true);
    clip = applyTool(clip, target, id);
    expect(bars(clip)).toBe('(0.1 1.2 0.3).2 r.2 |');
    expect(isOn(clip, target.cursor, id)).toBe(false);
  });

  it('steps the whole column through accents with A', () => {
    let clip = applyCyclingKey(clipOf('(0.1 1.2).2 r.2 |'), target, 'a')!;
    expect(bars(clip)).toBe('(0.1{ac} 1.2{ac}).2 r.2 |');
    clip = applyCyclingKey(clip, target, 'a')!;
    expect(bars(clip)).toBe('(0.1{hac} 1.2{hac}).2 r.2 |');
  });

  it('leaves marks drawn on the note itself to the cursor\'s note', () => {
    const clip = applyTool(clipOf('(0.1 1.2).2 r.2 |'), { ...target, cursor: { ...target.cursor, string: 1 } }, 'ghost');
    expect(bars(clip)).toBe('(0.1 1.2{g}).2 r.2 |');
  });
});
