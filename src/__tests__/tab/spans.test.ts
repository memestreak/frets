import * as alphaTab from '@coderline/alphatab';
import { writePart } from '@/features/tab/alphatex';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { type Part, partOf } from '@/features/tab/clip';
import { clampSpan, isSpan, moveSpan, spanAround, spanColumns, spanKind, type SpanMark } from '@/features/tab/spans';

function clipOf(body: string): Part {
  const result = readAlphaTexWith(alphaTab, `\\ts (4 4)\n${body}\n`);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  expect(result.warnings).toEqual([]);
  return partOf(result.clip);
}

/** The clip's notes, in alphaTex, without its header lines. */
const notesOf = (clip: Part) => writePart(clip).split('\n').filter(l => l && !l.startsWith('\\')).join(' ').replace(/\s+/g, ' ');

/** The Span round `index` moved to cover `want`, as a Handle drag or Alt+Shift+← → moves it. */
function drag(clip: Part, mark: SpanMark, index: number, want: [number, number]) {
  const columns = spanColumns(clip);
  const old = spanAround(columns, mark, index);
  const kind = spanKind(columns[index], mark)!;
  const next = clampSpan(clip, mark, kind, old, want);
  return { next, clip: moveSpan(clip, mark, old, next) };
}

describe('Spans (step 8)', () => {
  it('are let ring, P.M., vibrato, octave lines and hairpins, and not the whammy bar, tuplets, ties or arcs', () => {
    for (const mark of ['letRing', 'palmMute', 'vibrato', 'ottava', 'hairpin']) expect(isSpan(mark)).toBe(true);
    for (const mark of ['whammy', 'tuplet', 'tie', 'legato', 'bend', 'accent']) expect(isSpan(mark)).toBe(false);
  });

  it('a let ring Span is the run of neighbouring columns that have it', () => {
    const clip = clipOf('0.3.4 2.3{lr}.4 3.3{lr}.4 5.3.4 |');
    expect(spanAround(spanColumns(clip), 'letRing', 2)).toEqual([1, 2]);
  });

  it('dragging the end two columns on marks every note of both columns; dragging it back unmarks them', () => {
    const clip = clipOf('(2.2{lr} 0.3{lr}).4 (3.2 2.3).4 (0.2 3.3).4 5.3.4 |');
    const on = drag(clip, 'letRing', 0, [0, 2]);
    expect(on.next).toEqual([0, 2]);
    expect(notesOf(on.clip)).toContain('(2.2{lr} 0.3{lr}).4 (3.2{lr} 2.3{lr}).4 (0.2{lr} 3.3{lr}).4 5.3.4');
    const back = drag(on.clip, 'letRing', 0, [0, 0]);
    expect(notesOf(back.clip)).toBe(notesOf(clip));
  });

  it('a let ring Handle stops before a rest; a hairpin’s passes over one', () => {
    const ring = drag(clipOf('0.3{lr}.4 2.3.4 r.4 5.3.4 |'), 'letRing', 0, [0, 3]);
    expect(ring.next).toEqual([0, 1]);
    const pin = drag(clipOf('0.3.4{cre} 2.3.4 r.4 5.3.4 |'), 'hairpin', 0, [0, 3]);
    expect(pin.next).toEqual([0, 3]);
    expect(spanColumns(pin.clip).map(c => c.hairpin ?? null)).toEqual(['crescendo', 'crescendo', 'crescendo', 'crescendo']);
  });

  it('dragging into the next let ring Span joins them into one', () => {
    const { clip } = drag(clipOf('0.3{lr}.4 2.3.4 3.3{lr}.4 5.3{lr}.4 |'), 'letRing', 0, [0, 1]);
    expect(spanAround(spanColumns(clip), 'letRing', 0)).toEqual([0, 3]);
  });

  it('can’t shrink below one column, and its start can’t pass its end', () => {
    const clip = clipOf('0.3{lr}.4 2.3{lr}.4 3.3.4 5.3.4 |');
    expect(drag(clip, 'letRing', 0, [0, -1]).next).toEqual([0, 0]);
    expect(drag(clip, 'letRing', 0, [3, 1]).next).toEqual([1, 1]);
  });

  it('a start dragged one column earlier marks that column, so the label starts there', () => {
    const { clip } = drag(clipOf('0.3.4 2.3{lr}.4 3.3{lr}.4 5.3.4 |'), 'letRing', 1, [0, 2]);
    expect(spanAround(spanColumns(clip), 'letRing', 0)).toEqual([0, 2]);
  });

  it('a Handle dragged over a Tied note marks its whole Tie chain', () => {
    const { next, clip } = drag(clipOf('0.3{lr}.4 2.3.4 -.3.4 5.3.4 |'), 'letRing', 0, [0, 1]);
    expect(next).toEqual([0, 2]);
    expect(spanAround(spanColumns(clip), 'letRing', 0)).toEqual([0, 2]);
  });

  it('a wide vibrato’s new column is wide; an 8vb line’s new column 8vb', () => {
    const wide = drag(clipOf('0.3{vw}.4 2.3.4 3.3.4 5.3.4 |'), 'vibrato', 0, [0, 1]);
    expect(spanColumns(wide.clip)[1].notes[2]?.vibrato).toBe('wide');
    const octave = drag(clipOf('0.3.4{ot 8vb} 2.3.4 3.3.4 5.3.4 |'), 'ottava', 0, [0, 1]);
    expect(spanColumns(octave.clip)[1].ottava).toBe('8vb');
  });

  it('a let ring Handle stops at another kind of the same Mark, and a vibrato’s at a vibrato of another kind', () => {
    expect(drag(clipOf('0.3{v}.4 2.3.4 3.3{vw}.4 5.3.4 |'), 'vibrato', 0, [0, 3]).next).toEqual([0, 1]);
  });
});
