import * as alphaTab from '@coderline/alphatab';
import { writeAlphaTex } from '@/features/tab/alphatex';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import type { Clip } from '@/features/tab/clip';
import { removeMark } from '@/features/tab/noteEdits';
import { layoutClip, stringY } from '@/features/tab/layout';
import { markAt, markBox, markBoxes, markTool, type MarkHit } from '@/features/tab/marks';

function clipOf(body: string): Clip {
  const result = readAlphaTexWith(alphaTab, `\\ts (4 4)\n${body}\n`);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  expect(result.warnings).toEqual([]);
  return result.clip;
}

/** The clip's notes, in alphaTex, without its header lines. */
const notesOf = (clip: Clip) => writeAlphaTex(clip).split('\n').filter(l => l && !l.startsWith('\\')).join(' ');

const WIDTH = 900;

/** The middle of the first box drawn for `mark`. */
function middleOf(clip: Clip, mark: MarkHit['mark']) {
  const found = markBoxes(layoutClip(clip, WIDTH)).find(m => m.hit.mark === mark);
  if (!found) throw new Error(`no ${mark} drawn`);
  return { hit: found.hit, x: found.box.x + found.box.width / 2, y: found.box.y + found.box.height / 2 };
}

/** Picks the first drawn `mark` with a press on its middle, and checks the press finds it. */
function pick(clip: Clip, mark: MarkHit['mark']): MarkHit {
  const { hit, x, y } = middleOf(clip, mark);
  expect(markAt(layoutClip(clip, WIDTH), x, y)).toEqual(hit);
  return hit;
}

describe('markAt', () => {
  it('finds a bend, on its note', () => {
    const clip = clipOf('5.4.4 7.3{b (0 4)}.4 r.2 |');
    expect(pick(clip, 'bend')).toEqual({ kind: 'mark', mark: 'bend', index: 1, string: 2 });
  });

  it('leaves a press on a note number to the note', () => {
    const clip = clipOf('7.3{b (0 4)}.4 r.4 r.2 |');
    const layout = layoutClip(clip, WIDTH);
    const x = layout.systems[0].bars[0].columns[0].x;
    expect(markAt(layout, x, stringY(layout.rows, 2))).toBeNull();
  });

  it('finds a join on the note it arrives at', () => {
    const clip = clipOf('5.3{h}.4 7.3.4 7.3.4 -.3.4 |');
    // Frets keeps a hammer-on on the note before it in alphaTex, and on the note after it in the clip.
    expect(pick(clip, 'legato')).toMatchObject({ index: 1, string: 2 });
    expect(pick(clip, 'tie')).toMatchObject({ index: 3, string: 2 });
  });

  it('gives a mark over the whole column no string', () => {
    const clip = clipOf('(0.1 1.2).4{sd} 3.3{v}.4 3.3{ac}.4 3.3{ph}.4 |');
    for (const mark of ['stroke', 'vibrato', 'accent', 'pinch'] as const) expect(pick(clip, mark).string).toBeNull();
  });

  it('tells an accent from the staccato dot under it', () => {
    const clip = clipOf('3.3{ac st}.4 r.4 r.2 |');
    expect(pick(clip, 'accent').mark).toBe('accent');
    expect(pick(clip, 'staccato').mark).toBe('staccato');
  });

  it('gives a tuplet its whole group', () => {
    const clip = clipOf('5.3.8{tu 3} 7.3.8{tu 3} 8.3.8{tu 3} r.4 r.2 |');
    expect(pick(clip, 'tuplet')).toEqual({ kind: 'mark', mark: 'tuplet', index: 0, string: null, to: 2 });
  });

  it('finds nothing on blank space', () => {
    const clip = clipOf('3.3.4 r.4 r.2 |');
    expect(markAt(layoutClip(clip, WIDTH), 300, 5)).toBeNull();
  });
});

describe('markTool and removeMark', () => {
  it.each([
    ['7.3{b (0 4)}.4 r.4 r.2 |', 'bend', 'bend', '7.3.4 r.4 r.2 |'],
    ['7.3{b (4 4)}.4 r.4 r.2 |', 'bend', 'preBend', '7.3.4 r.4 r.2 |'],
    ['5.2{sod}.4 r.4 r.2 |', 'slideOut', 'slideOutDown', '5.2.4 r.4 r.2 |'],
    ['12.1.4{tt} r.4 r.2 |', 'tap', 'tap', '12.1.4 r.4 r.2 |'],
    ['5.3{h}.4 7.3.4 r.2 |', 'legato', 'legato', '5.3.4 7.3.4 r.2 |'],
    ['5.3{sl}.4 7.3.4 r.2 |', 'slide', 'slide', '5.3.4 7.3.4 r.2 |'],
    ['3.3{vw}.4 r.4 r.2 |', 'vibrato', 'vibrato', '3.3.4 r.4 r.2 |'],
    ['3.3{ph}.4 r.4 r.2 |', 'pinch', 'pinchHarmonic', '3.3.4 r.4 r.2 |'],
    ['3.3{hac}.4 r.4 r.2 |', 'accent', 'heavyAccent', '3.3.4 r.4 r.2 |'],
    ['3.3{st}.4 r.4 r.2 |', 'staccato', 'staccato', '3.3.4 r.4 r.2 |'],
    ['(0.1 1.2).4{su} r.4 r.2 |', 'stroke', 'strokeUp', '(0.1 1.2).4 r.4 r.2 |'],
    ['3.3.4{tp 16} r.4 r.2 |', 'tremolo', 'tremolo16', '3.3.4 r.4 r.2 |'],
  ] as const)('%s: the %s lights %s, and Delete leaves %s', (body, mark, tool, after) => {
    const clip = clipOf(body);
    const hit = pick(clip, mark);
    expect(markTool(clip, hit)).toBe(tool);
    const next = removeMark(clip, hit);
    expect(notesOf(next)).toBe(after);
    expect(markTool(next, hit)).toBeNull();
    expect(markBox(layoutClip(next, WIDTH), hit)).toBeNull();
  });

  it('takes a tie away and keeps its note, now played', () => {
    const clip = clipOf('5.3.2 -.3.2 |');
    expect(notesOf(removeMark(clip, pick(clip, 'tie')))).toBe('5.3.2 5.3.2 |');
  });

  it('takes a vibrato off every note in its column', () => {
    const clip = clipOf('(3.3{v} 5.2{v}).4 r.4 r.2 |');
    expect(notesOf(removeMark(clip, pick(clip, 'vibrato')))).toBe('(5.2 3.3).4 r.4 r.2 |');
  });

  it('takes a whole tuplet away', () => {
    const clip = clipOf('5.3.8{tu 3} 7.3.8{tu 3} 8.3.8{tu 3} r.4 r.2 |');
    const hit = pick(clip, 'tuplet');
    expect(markTool(clip, hit)).toBe('tuplet');
    expect(notesOf(removeMark(clip, hit))).toBe('5.3.8 7.3.8 8.3.8 r.4 r.2 |');
  });
});
