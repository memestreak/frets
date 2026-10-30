import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { partOf, type Part } from '@/features/tab/clip';
import { elementsOf, stepElement, type Element } from '@/features/tab/elements';
import { layoutClip } from '@/features/tab/layout';
import { columnsInRectangle } from '@/features/tab/rectangle';

function clipOf(text: string): Part {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return partOf(result.clip);
}

/** An element as a short name, to compare lists by. */
const name = (e: Element) =>
  e.kind === 'note' ? `note ${e.index}/${e.string}` : e.kind === 'rest' ? `rest ${e.index}` : e.kind === 'mark' ? `${e.mark} ${e.index}` : 'bar' in e ? `${e.kind} bar ${e.bar}` : `${e.kind} ${e.index}`;

describe('elementsOf and stepElement (Alt+← →, issue #238)', () => {
  const clip = clipOf('\\ts (4 4)\n\\section "Intro"\n:4 (5.1 7.2){ch "A"} 7.3{v} r 3.4{ac} |');
  const list = elementsOf(clip, layoutClip(clip, 800, 'tab'));

  it('lists words, notes from the high string down, rests and marks in reading order', () => {
    expect(list.map(name)).toEqual(['section bar 0', 'chord 0', 'note 0/0', 'note 0/1', 'note 1/2', 'vibrato 1', 'rest 2', 'note 3/3', 'accent 3']);
  });

  it('steps forward and back, and stops at either end', () => {
    expect(name(stepElement(list, { kind: 'note', index: 1, string: 2 }, 1)!)).toBe('vibrato 1');
    expect(name(stepElement(list, list[5], 1)!)).toBe('rest 2');
    expect(name(stepElement(list, list[2], -1)!)).toBe('chord 0');
    expect(stepElement(list, list[0], -1)).toBeNull();
    expect(stepElement(list, list[list.length - 1], 1)).toBeNull();
  });

  it('from a column with no string picked, → goes to its first note and ← to what is before it', () => {
    expect(name(stepElement(list, { kind: 'column', index: 0 }, 1)!)).toBe('note 0/0');
    expect(name(stepElement(list, { kind: 'column', index: 0 }, -1)!)).toBe('chord 0');
    expect(name(stepElement(list, { kind: 'column', index: 2 }, 1)!)).toBe('note 3/3');
  });
});

describe('columnsInRectangle (Shift+drag, issue #238)', () => {
  const clip = clipOf('\\ts (4 4)\n:4 5.1 7.1 8.1 9.1 |');
  const layout = layoutClip(clip, 800, 'tab');
  const xs = layout.systems[0].bars[0].columns.map(c => c.x);
  const { top, rows } = layout.systems[0];
  const y = top + rows.staffTop + 10;

  it('takes in the columns across its width, from either corner', () => {
    expect(columnsInRectangle(layout, { x0: xs[1] - 5, y0: y - 30, x1: xs[2] + 5, y1: y })).toEqual([1, 2]);
    expect(columnsInRectangle(layout, { x0: xs[3] + 5, y0: y, x1: xs[0] - 5, y1: y - 30 })).toEqual([0, 3]);
  });

  it('takes in none when it misses the columns or the lines', () => {
    expect(columnsInRectangle(layout, { x0: xs[0] + 5, y0: y, x1: xs[1] - 5, y1: y + 5 })).toBeNull();
    expect(columnsInRectangle(layout, { x0: 0, y0: layout.height + 10, x1: 800, y1: layout.height + 20 })).toBeNull();
  });
});
