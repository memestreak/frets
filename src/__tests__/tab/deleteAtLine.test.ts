import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { writeBars } from '@/features/tab/alphatex';
import { deleteAtLine } from '@/features/tab/editorKeys';
import { type Part, partOf } from '@/features/tab/clip';

function clipOf(text: string): Part {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return partOf(result.clip);
}

const bars = (clip: Part) => writeBars(clip).join('\n');

/** Delete or Backspace off the tab, with the playback line at a gap (Jeremy, 2026-10-29). */
describe('deleteAtLine', () => {
  // A bar ending in an eighth rest, as in his picture, then a second bar.
  const clip = clipOf(':4 5.3 :2 r{d} :8 7.3 r | :1 3.2 |');

  it('takes the rest just before the line, and the line steps back over it', () => {
    const cut = deleteAtLine(clip, 4, null)!;
    expect(bars(cut.clip)).toBe(bars(clipOf(':4 5.3 :2 r{d} :8 7.3 | :1 3.2 |')));
    expect(cut.line).toBe(3);
  });

  it('turns notes just before the line into a rest first, the line staying', () => {
    const cut = deleteAtLine(clip, 3, null)!;
    expect(bars(cut.clip)).toBe(bars(clipOf(':4 5.3 :2 r{d} :8 r r | :1 3.2 |')));
    expect(cut.line).toBe(3);
  });

  it('takes the last column with the line past the end of the clip', () => {
    const cut = deleteAtLine(clip, 5, null)!;
    expect(bars(cut.clip)).toBe(bars(clipOf(':4 5.3 :2 r{d} :8 7.3 r | :1 r |')));
    expect(cut.line).toBe(5);
  });

  it('does nothing with the line at the start, or with no line', () => {
    expect(deleteAtLine(clip, 0, null)).toBeNull();
    expect(deleteAtLine(clip, null, null)).toBeNull();
    expect(deleteAtLine(clipOf('|'), 0, null)).toBeNull();
  });

  it('takes a selection made from the line, the line where it began', () => {
    const cut = deleteAtLine(clip, null, { anchor: 3, focus: 1 })!;
    expect(bars(cut.clip)).toBe(bars(clipOf(':4 5.3 | :1 3.2 |')));
    expect(cut.line).toBe(1);
  });

  it('leaves a bar empty when its only rest goes', () => {
    const one = clipOf(':4 5.3 5.3 5.3 5.3 | :1 r | :1 3.2 |');
    const cut = deleteAtLine(one, 5, null)!;
    expect(cut.clip.bars.map(b => b.columns.length)).toEqual([4, 0, 1]);
    expect(cut.line).toBe(4);
  });
});
