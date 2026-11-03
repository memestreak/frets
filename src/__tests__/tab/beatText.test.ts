/**
 * Free text over a column wraps onto more lines over its column (issue #323;
 * docs/specs/2026-11-03-tab-text-wrap-design.md).
 */
import * as alphaTab from '@coderline/alphatab';
import { BEAT_TEXT_GAP, BEAT_TEXT_INSET, BEAT_TEXT_LINE, BEAT_TEXT_MAX_ROOM, BEAT_TEXT_MIN_ROOM, beatTextWidth, placeBeatTexts, wrapBeatText } from '@/features/tab/beatText';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { partOf, type Part } from '@/features/tab/clip';
import { layoutClip, type Layout } from '@/features/tab/layout';
import { textAt, textBox } from '@/features/tab/layoutText';

const clipOf = (tex: string): Part => {
  const result = readAlphaTexWith(alphaTab, tex);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return partOf(result.clip);
};
const placedOf = (layout: Layout) => layout.systems.flatMap(s => s.bars.flatMap(b => b.columns));

const LONG = 'Press the first note, then press Delete twice';

describe('wrapBeatText', () => {
  it('keeps a text that fits on one line', () => {
    expect(wrapBeatText('let ring', 100)).toEqual(['let ring']);
  });

  it('breaks at spaces into lines no wider than the room, each as long as fits', () => {
    const lines = wrapBeatText(LONG, 100);
    expect(lines.join(' ')).toBe(LONG);
    for (const line of lines) expect(beatTextWidth(line)).toBeLessThanOrEqual(100);
    // Each line but the last would overflow with the next word.
    lines.slice(0, -1).forEach((line, k) => {
      expect(beatTextWidth(`${line} ${lines[k + 1].split(' ')[0]}`)).toBeGreaterThan(100);
    });
  });

  it('puts each word on a line of its own when the room is narrower than any two', () => {
    expect(wrapBeatText('then press Delete', 40)).toEqual(['then', 'press', 'Delete']);
  });

  it('never splits a word wider than the room: it takes a line of its own', () => {
    expect(wrapBeatText('a Supercalifragilistic b', 30)).toEqual(['a', 'Supercalifragilistic', 'b']);
  });

  it('keeps the words as typed, punctuation and quotes too', () => {
    expect(wrapBeatText('let "it" ring, softly.', 40).join(' ')).toBe('let "it" ring, softly.');
  });
});

describe('placeBeatTexts', () => {
  it('wraps each text to the room before the next, all on one level when none touch', () => {
    const { placed, rows } = placeBeatTexts([{ x0: 0, text: LONG }, { x0: 200, text: 'then this' }], 600);
    expect(placed[0].lines.length).toBeGreaterThan(1);
    for (const line of placed[0].lines) expect(beatTextWidth(line)).toBeLessThanOrEqual(200 - BEAT_TEXT_GAP);
    // Both on level 0, which is as tall as its tallest text; each starts on its top row.
    expect(placed.map(p => p.top)).toEqual([0, 0]);
    expect(rows).toBe(placed[0].lines.length);
  });

  it('never wraps to less than the least room, even when the next text is close', () => {
    const { placed } = placeBeatTexts([{ x0: 0, text: LONG }, { x0: 30, text: 'b' }], 600);
    expect(placed[0].lines).toEqual(wrapBeatText(LONG, BEAT_TEXT_MIN_ROOM));
    expect(placed[0].lines.some(line => line.includes(' '))).toBe(true);
  });

  it('never runs a text past the most room, about 60 characters, however much is free', () => {
    const sixty = 'Text very near the line end runs to the edge and wraps there';
    expect(BEAT_TEXT_MAX_ROOM).toBe(beatTextWidth(sixty));
    expect(placeBeatTexts([{ x0: 0, text: sixty }], 2000).placed[0].lines).toEqual([sixty]);
    const longer = `${sixty} and on`;
    const { placed } = placeBeatTexts([{ x0: 0, text: longer }], 2000);
    expect(placed[0].lines).toEqual([sixty, 'and on']);
  });

  it('moves a text that still touches the one before it up a level, over all of its rows', () => {
    const { placed, rows } = placeBeatTexts([{ x0: 0, text: LONG }, { x0: 30, text: 'Expect two rests' }], 600);
    const under = placed[0].lines.length;
    expect(placed[1].top).toBe(0);
    expect(placed[0].top).toBe(placed[1].lines.length);
    expect(rows).toBe(under + placed[1].lines.length);
  });

  it('puts a text back on the lowest level it clears', () => {
    // b touches a and moves up; c clears a, so it goes back down to level 0.
    const { placed, rows } = placeBeatTexts([{ x0: 0, text: 'aaaa aaaa' }, { x0: 20, text: 'bbbb' }, { x0: 300, text: 'cccc' }], 600);
    expect(rows).toBe(2);
    expect(placed.map(p => p.top)).toEqual([1, 0, 1]);
  });

  it('takes one row for a line without texts', () => {
    expect(placeBeatTexts([], 600)).toEqual({ placed: [], rows: 1 });
  });
});

describe('layoutClip wraps free text', () => {
  /** Two texts two quarters apart, the first far longer than the room before the second. */
  const TWO = clipOf(`5.1.4{txt "${LONG}"} 5.1.4 5.1.4{txt "then this"} 5.1.4 |`);

  it('wraps a text before the next text on the line, so the two never overlap', () => {
    const layout = layoutClip(TWO, 800);
    const [first, , second] = placedOf(layout);
    expect(first.textLines.length).toBeGreaterThan(1);
    expect(first.textLines.join(' ')).toBe(LONG);
    const room = second.x - BEAT_TEXT_INSET - BEAT_TEXT_GAP - (first.x - BEAT_TEXT_INSET);
    // A line wider than the room is one word, never split.
    for (const line of first.textLines) if (line.includes(' ')) expect(beatTextWidth(line)).toBeLessThanOrEqual(room);
    expect(first.textLines.some(line => line.includes(' '))).toBe(true);
  });

  it('lets the last text on a line run to the drawing\'s right edge, and wrap there', () => {
    const layout = layoutClip(clipOf(`5.1.8 5.1.8 5.1.8 5.1.8 5.1.2{txt "${LONG}"} |`), 400);
    const last = placedOf(layout).at(-1)!;
    expect(last.textLines.length).toBeGreaterThan(1);
    for (const line of last.textLines) expect(last.x - BEAT_TEXT_INSET + beatTextWidth(line)).toBeLessThanOrEqual(400);
    // Past the end of a short last line too: it isn't run to the width.
    const short = layoutClip(clipOf(`5.1.1{txt "${LONG}"} |`), 800);
    expect(short.systems[0].bars[0].x1).toBeLessThan(800);
    expect(placedOf(short)[0].textLines).toEqual([LONG]);
  });

  it('keeps a short text on one line, and gives a column with no text no lines', () => {
    const [, empty, second] = placedOf(layoutClip(TWO, 800));
    expect(second.textLines).toEqual(['then this']);
    expect(empty.textLines).toEqual([]);
  });

  it('pushes everything under the text row down one line per extra text row', () => {
    const short = layoutClip(clipOf('5.1.4{txt "a" wahc} 5.1.4 5.1.4{txt "b"} 5.1.4 |'), 800).systems[0].rows;
    const tall = layoutClip(clipOf(`5.1.4{txt "${LONG}" wahc} 5.1.4 5.1.4{txt "b"} 5.1.4 |`), 800);
    const lines = placedOf(tall)[0].textLines.length;
    expect(tall.systems[0].textRows).toBe(lines);
    const rows = tall.systems[0].rows;
    expect(rows.text).toBe(short.text);
    expect(rows.wah! - short.wah!).toBe((lines - 1) * BEAT_TEXT_LINE);
    expect(rows.staffTop - short.staffTop).toBe((lines - 1) * BEAT_TEXT_LINE);
  });

  it('moves a text on the next eighth up, clear of a long one, and draws the long one under it', () => {
    const layout = layoutClip(clipOf(`5.1.8{txt "${LONG}"} 5.1.8{txt "Expect: two rests"} 5.1.8 5.1.8 5.1.2 |`), 800);
    const [first, second] = placedOf(layout);
    expect(first.textLines).toEqual(wrapBeatText(LONG, BEAT_TEXT_MIN_ROOM));
    expect(second.textTop).toBe(0);
    expect(first.textTop).toBe(second.textLines.length);
    expect(layout.systems[0].textRows).toBe(first.textLines.length + second.textLines.length);
    // A press on each picks its own.
    const { top, rows } = layout.systems[0];
    expect(textAt(layout, second.x, top + rows.text!)).toEqual({ kind: 'text', index: 1 });
    expect(textAt(layout, second.x, top + rows.text! + first.textTop * BEAT_TEXT_LINE)).toEqual({ kind: 'text', index: 0 });
    const box = textBox(layout, { kind: 'text', index: 0 }, null)!;
    expect(box.y).toBeGreaterThan(top + rows.text!);
  });

  it('pushes the notation staff down too', () => {
    const short = layoutClip(clipOf('5.1.8{txt "a"} 5.1.8{txt "b"} 5.1.8 5.1.8 5.1.2 |'), 800, 'both').systems[0].rows;
    const tall = layoutClip(TWO, 800, 'both');
    const lines = placedOf(tall)[0].textLines.length;
    expect(tall.systems[0].rows.score!.top - short.score!.top).toBe((lines - 1) * BEAT_TEXT_LINE);
  });

  it('grows only the line that has the long text', () => {
    // Two bars too wide for one line: the long text on the first, a short one on the second.
    const clip = clipOf(`5.1.8{txt "${LONG}"} 5.1.8{txt "x"} 5.1.8 5.1.8 5.1.2 | 5.1.8{txt "y"} 5.1.8 5.1.8 5.1.8 5.1.2 |`);
    const layout = layoutClip(clip, 300);
    expect(layout.systems).toHaveLength(2);
    const [one, two] = layout.systems;
    expect(one.rows.staffTop).toBeGreaterThan(two.rows.staffTop);
  });

  it('picks a wrapped text from a press on any of its lines, and boxes all of them', () => {
    const layout = layoutClip(TWO, 800);
    const system = layout.systems[0];
    const [first] = placedOf(layout);
    const lastLine = system.rows.text! + (first.textLines.length - 1) * BEAT_TEXT_LINE;
    expect(textAt(layout, first.x, system.top + lastLine)).toEqual({ kind: 'text', index: 0 });
    // Under its last line is no longer the text.
    expect(textAt(layout, first.x, system.top + lastLine + BEAT_TEXT_LINE)).not.toEqual({ kind: 'text', index: 0 });
    const box = textBox(layout, { kind: 'text', index: 0 }, null)!;
    expect(box.y).toBeLessThanOrEqual(system.top + system.rows.text! - 8);
    expect(box.y + box.height).toBeGreaterThanOrEqual(system.top + lastLine + 8);
    expect(box.x + box.width).toBeLessThan(placedOf(layout)[2].x - BEAT_TEXT_INSET);
  });
});
