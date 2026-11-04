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
  // The same bar even, as edits keep it: Ctrl/⌘ pulls the music back (step 4).
  const even = clipOf(':4 5.3 :2 r :8 7.3 r | :1 3.2 |');

  it('leaves a rest just before the line as it is: bars stay full (issue #238)', () => {
    expect(deleteAtLine(clip, 4, null)).toBeNull();
  });

  it('with Ctrl/⌘ takes the rest just before the line and pulls the music after it back', () => {
    const cut = deleteAtLine(even, 4, null, true)!;
    expect(bars(cut.clip)).toBe(bars(clipOf(':4 5.3 r r :8 7.3 3.2 | -.2.2{dd} r.8 |')));
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

  it('makes rests of a selection, and with Ctrl/⌘ takes it away, the line where it began', () => {
    const rests = deleteAtLine(clip, null, { anchor: 3, focus: 1 })!;
    expect(bars(rests.clip)).toBe(bars(clipOf(':4 5.3 :2 r{d} :8 r r | :1 3.2 |')));
    expect(rests.line).toBe(1);
    const cut = deleteAtLine(even, null, { anchor: 3, focus: 1 }, true)!;
    expect(bars(cut.clip)).toBe(bars(clipOf(':4 5.3 3.2 :2 -.2 | :4 -.2 r :2 r |')));
    expect(cut.line).toBe(1);
  });

  it('with Ctrl/⌘ takes away a bar whose only rest goes', () => {
    const one = clipOf(':4 5.3 5.3 5.3 5.3 | :1 r | :1 3.2 |');
    const cut = deleteAtLine(one, 5, null, true)!;
    expect(bars(cut.clip)).toBe(bars(clipOf(':4 5.3 5.3 5.3 5.3 | :1 3.2 |')));
    expect(cut.line).toBe(4);
  });
});
