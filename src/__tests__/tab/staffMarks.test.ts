import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import type { Clip } from '@/features/tab/clip';
import { layoutClip, stepY, type Parts } from '@/features/tab/layout';
import { markAt, markBox, markBoxes } from '@/features/tab/marks';
import { staffMarks } from '@/features/tab/staffMarks';

function clipOf(body: string): Clip {
  const result = readAlphaTexWith(alphaTab, `\\ts (4 4)\n${body}\n`);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  expect(result.warnings).toEqual([]);
  return result.clip;
}

const WIDTH = 900;
const kinds = (clip: Clip, parts: Parts) => staffMarks(layoutClip(clip, WIDTH, parts))[0].map(m => `${m.kind}:${m.hit.mark}`);

describe('staffMarks', () => {
  it('puts a column\'s accent and staccato dot at its heads, away from the stem', () => {
    // A low note: its stem goes up, so the marks go under it.
    const layout = layoutClip(clipOf('3.6{ac st}.4 r.4 r.2 |'), WIDTH, 'both');
    const [staccato, accent] = staffMarks(layout)[0];
    const head = stepY(layout.rows.score!, layout.systems[0].bars[0].columns[0].heads[0].step);
    expect(staccato.kind).toBe('staccato');
    expect(accent.kind).toBe('accent');
    expect(staccato.box.y).toBeGreaterThan(head);
    expect(accent.box.y).toBeGreaterThan(staccato.box.y);
  });

  it('draws slurs, slides, ties, vibrato and tremolo on the staff', () => {
    const clip = clipOf('5.3{h}.8 7.3.8 5.3{sl}.8 7.3.8 7.3{v}.4 -.3.4 | 5.2.4{tp 16} r.4 r.2 |');
    expect(kinds(clip, 'both')).toEqual([
      'arc:legato', 'arc:slide', 'line:slide', 'arc:tie', 'tremolo:tremolo', 'vibrato:vibrato',
    ]);
  });

  it('brackets every tuplet, beamed or not, as Guitar Pro prints them (issue #179)', () => {
    // Quarter-note triplets (the book's bar 115), then eighth-note triplets under one beam (bar 117).
    const clip = clipOf('11.1.4{tu 3} 12.1.4{tu 3} 14.1.4{tu 3} r.4 11.3.8{tu 3} 12.3.8{tu 3} 14.3.8{tu 3} |');
    const layout = layoutClip(clip, WIDTH, 'both');
    const tuplets = staffMarks(layout)[0].filter(m => m.kind === 'tuplet');
    expect(tuplets).toHaveLength(2);
    const columns = layout.systems[0].bars[0].columns;
    const [quarters, eighths] = tuplets;
    if (quarters.kind !== 'tuplet' || eighths.kind !== 'tuplet') throw new Error('not tuplets');
    expect(quarters.bracket.x0).toBeLessThan(columns[0].x);
    expect(quarters.bracket.x1).toBeGreaterThan(columns[2].x);
    expect(eighths.bracket.x0).toBeLessThan(columns[4].x);
    expect(eighths.bracket.x1).toBeGreaterThan(columns[6].x);
  });

  it('puts bends and taps on the staff only when it is alone', () => {
    const clip = clipOf('7.3{b (0 4)}.4 12.1.4{tt} r.2 |');
    expect(kinds(clip, 'both')).toEqual([]);
    expect(kinds(clip, 'staff')).toEqual(['bend:bend', 'tap:tap']);
  });
});

describe('the tab\'s rows with the staff shown', () => {
  const clip = clipOf('3.3{v ac}.4 3.3{pm}.4 3.3{ph}.4 r.4 |');

  it('draw vibrato on both, leave accents to the staff, and keep P.M. and P.H. between the two', () => {
    const { rows } = layoutClip(clip, WIDTH, 'both');
    expect(rows.vibrato).toBeLessThan(rows.staffTop);
    expect(rows.accents).toBeNull();
    expect(rows.palmMute).toBeGreaterThan(rows.score!.bottom);
    expect(rows.harmonics).toBeLessThan(rows.staffTop);
  });

  it('keep P.M. and P.H. under the staff alone', () => {
    const { rows } = layoutClip(clip, WIDTH, 'staff');
    expect(rows.palmMute).toBeGreaterThan(rows.score!.bottom);
    expect(rows.harmonics).not.toBeNull();
  });
});

describe('picking a mark on the staff', () => {
  it('finds it, outlines it there, and leaves a press on a head to the note', () => {
    const clip = clipOf('5.3{h}.4 7.3.4 r.2 |');
    const layout = layoutClip(clip, WIDTH, 'both');
    const slur = markBoxes(layout).find(m => m.hit.on === 'staff' && m.hit.mark === 'legato')!;
    const x = slur.box.x + slur.box.width / 2;
    const hit = markAt(layout, x, slur.box.y + 2);
    expect(hit).toMatchObject({ mark: 'legato', index: 1, string: 2, on: 'staff' });
    expect(markBox(layout, hit!)).toEqual(slur.box);
    const placed = layout.systems[0].bars[0].columns[1];
    expect(markAt(layout, placed.x, stepY(layout.rows.score!, placed.heads[0].step))).toBeNull();
  });
});
