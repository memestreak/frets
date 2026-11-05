/** A Shift+press's selection only ever grows to what was pressed; inside it, it is trimmed from the nearer end (issue #366). */
import { growSelection } from '@/features/tab/editing';

describe('growSelection (issue #366)', () => {
  // Columns 2–6 selected; made rightwards (anchor 2) or leftwards (anchor 6).
  const right = { anchor: 2, focus: 6 };
  const left = { anchor: 6, focus: 2 };

  it.each([right, left])('after the selection, moves its end there and keeps its start (%o)', selection => {
    expect(growSelection(selection, 0, 9)).toEqual({ anchor: 2, focus: 9 });
  });

  it.each([right, left])('before the selection, moves its start there and keeps its end (%o)', selection => {
    expect(growSelection(selection, 0, 0)).toEqual({ anchor: 6, focus: 0 });
  });

  it('a pressed span reaching past both ends takes in all of it, focus on its end', () => {
    expect(growSelection(right, 0, 1, 8)).toEqual({ anchor: 1, focus: 8 });
  });

  it('a pressed span (a Whole-bar rest) after the selection grows to its last column', () => {
    expect(growSelection(left, 0, 8, 11)).toEqual({ anchor: 2, focus: 11 });
  });

  it('with nothing selected, runs from the cursor\'s column to the press, either way', () => {
    expect(growSelection(null, 4, 7)).toEqual({ anchor: 4, focus: 7 });
    expect(growSelection(null, 4, 1)).toEqual({ anchor: 4, focus: 1 });
    expect(growSelection(null, 4, 4)).toEqual({ anchor: 4, focus: 4 });
  });

  it.each([right, left])('inside, trims from the end nearer the press (%o)', selection => {
    expect(growSelection(selection, 0, 5)).toEqual({ anchor: 2, focus: 5 });
    expect(growSelection(selection, 0, 3)).toEqual({ anchor: 6, focus: 3 });
    // On an end: that end stays where it is, the selection unchanged.
    expect(growSelection(selection, 0, 6)).toEqual({ anchor: 2, focus: 6 });
    expect(growSelection(selection, 0, 2)).toEqual({ anchor: 6, focus: 2 });
  });

  it('inside, halfway, trims the end last grown (the focus)', () => {
    expect(growSelection(right, 0, 4)).toEqual({ anchor: 2, focus: 4 });
    expect(growSelection(left, 0, 4)).toEqual({ anchor: 6, focus: 4 });
  });
});
