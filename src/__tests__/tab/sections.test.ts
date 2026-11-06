/**
 * A section whose name runs into the next section's moves up clear of it (issue #389;
 * docs/specs/2026-11-06-tab-section-overlap-design.md).
 */
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { partOf, type Part } from '@/features/tab/clip';
import { wordSpot } from '@/features/tab/fieldSpots';
import { layoutClip, type Layout, type PlacedBar } from '@/features/tab/layout';
import { sectionBox, textAt, textBox } from '@/features/tab/layoutText';
import { placeSections, SECTION_GAP, SECTION_LINE, sectionReach, sectionTextWidth, setSectionFit } from '@/features/tab/sectionText';

const clipOf = (tex: string): Part => {
  const result = readAlphaTexWith(alphaTab, tex);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return partOf(result.clip);
};
const sectionedOf = (layout: Layout): PlacedBar[] => layout.systems[0].bars.filter(b => b.bar.section);

const BAR = '0.6.2 0.6.2 |';
const W = 1400;
/** Five short bars, each with a long section name: the clip of issue #389. */
const LONG_NAMES = [
  '1. Downstroke / Upstroke: light strum (3%)',
  '2. No mark: all strings at once',
  '3. Strum down, Strum up (5%), Rolled chord (20%)',
  '4. Written length',
  '5. Try Settings',
].map(name => `\\section "${name}" ${BAR}`).join(' ');
const SHORT_NAMES = ['Intro', 'Verse', 'Chorus'].map(name => `\\section "${name}" ${BAR}`).join(' ');

afterEach(() => setSectionFit('stack'));

describe('placeSections', () => {
  const section = (text: string) => ({ text });

  it('leaves sections that clear each other on one row', () => {
    const { placed, rows } = placeSections([{ x0: 0, section: section('Verse') }, { x0: 200, section: section('Chorus') }], 400);
    expect(rows).toBe(1);
    expect(placed.map(p => p.top)).toEqual([0, 0]);
  });

  it('moves a section that a name before it runs into up a row, and the long one stays by the music', () => {
    const long = 'A name far longer than its bar';
    const second = sectionTextWidth(long) - 20;
    const { placed, rows } = placeSections([{ x0: 0, section: section(long) }, { x0: second, section: section('Next') }], 800);
    expect(rows).toBe(2);
    // Rows count from the top: the moved one is on row 0, the long one under it.
    expect(placed[1].top).toBe(0);
    expect(placed[0].top).toBe(1);
  });

  it('counts the room kept after a name: a section closer than that moves up', () => {
    const end = sectionTextWidth('Verse');
    expect(placeSections([{ x0: 0, section: section('Verse') }, { x0: end + SECTION_GAP, section: section('B') }], 400).rows).toBe(1);
    expect(placeSections([{ x0: 0, section: section('Verse') }, { x0: end + SECTION_GAP - 1, section: section('B') }], 400).rows).toBe(2);
  });

  it('counts a rehearsal mark\'s box in front of the name', () => {
    const end = sectionTextWidth('Verse');
    const marked = { marker: 'A', text: 'Verse' };
    // Without its box "B" clears it; with the box in front, the name reaches past "B".
    expect(placeSections([{ x0: 0, section: section('Verse') }, { x0: end + SECTION_GAP + 2, section: section('B') }], 400).rows).toBe(1);
    expect(placeSections([{ x0: 0, section: marked }, { x0: end + SECTION_GAP + 2, section: section('B') }], 400).rows).toBe(2);
  });

  it('puts a later section that clears the row by the music back on it', () => {
    const long = 'A name far longer than its bar';
    const w = sectionTextWidth(long);
    const { placed } = placeSections([
      { x0: 0, section: section(long) }, { x0: w - 20, section: section('Two') }, { x0: w + 2 * SECTION_GAP + 60, section: section('Three') },
    ], 800);
    expect(placed.map(p => p.top)).toEqual([1, 0, 1]);
  });

  it('never wraps a name unless the wrap mock is on', () => {
    const long = 'A name far longer than its bar';
    expect(placeSections([{ x0: 0, section: section(long) }, { x0: 40, section: section('Next') }], 800).placed[0].lines).toEqual([long]);
    setSectionFit('wrap');
    const lines = placeSections([{ x0: 0, section: section(long) }, { x0: 150, section: section('Next') }], 800).placed[0].lines;
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(' ')).toBe(long);
    // Wrapped, never to less than 100px, however close the next section is.
    for (const line of lines.slice(0, -1)) expect(sectionTextWidth(`${line} x`)).toBeGreaterThan(100);
  });
});

describe('a clip of long section names on short bars', () => {
  it('draws no two sections on one row over each other', () => {
    const layout = layoutClip(clipOf(LONG_NAMES), W);
    const { rows } = layout.systems[0];
    const boxes = sectionedOf(layout).map(b => sectionBox(b, rows.section!));
    expect(layout.systems[0].bars.length).toBe(5);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        if (boxes[i].y0 === boxes[j].y0) expect(boxes[i].x1 + SECTION_GAP).toBeLessThanOrEqual(boxes[j].x0);
      }
    }
    expect(layout.systems[0].sectionRows).toBeGreaterThan(1);
  });

  it('keeps sections that fit on one row, as before', () => {
    const layout = layoutClip(clipOf(SHORT_NAMES), W);
    expect(layout.systems[0].sectionRows).toBe(1);
    expect(sectionedOf(layout).map(b => b.sectionTop)).toEqual([0, 0, 0]);
  });

  it('pushes the rows under the section row down one row per extra section row, and not the rows over it', () => {
    const short = layoutClip(clipOf(`\\tempo 90 . ${BAR} \\tempo 100 ${SHORT_NAMES}`), W).systems[0].rows;
    const tall = layoutClip(clipOf(`\\tempo 90 . ${BAR} \\tempo 100 ${LONG_NAMES}`), W).systems[0];
    // Every bar on one line, in both.
    expect(tall.bars.length).toBe(6);
    const extra = (tall.sectionRows - 1) * SECTION_LINE;
    expect(extra).toBeGreaterThan(0);
    expect(tall.rows.tempo).toBe(short.tempo);
    expect(tall.rows.section).toBe(short.section);
    expect(tall.rows.staffTop - short.staffTop).toBe(extra);
  });

  it('picks a moved-up section where it is drawn, and opens its field over it', () => {
    const layout = layoutClip(clipOf(LONG_NAMES), W);
    const { rows, top } = layout.systems[0];
    const raised = sectionedOf(layout).find(b => b.sectionTop === 0)!;
    const low = sectionedOf(layout).find(b => b.sectionTop > 0)!;
    const box = sectionBox(raised, rows.section!);
    expect(textAt(layout, box.x0 + 10, top + box.y0)).toEqual({ kind: 'section', bar: raised.index });
    // The row under it, at the same x, is the section it moved clear of (or nothing), never this one.
    expect(textAt(layout, box.x0 + 10, top + sectionBox(low, rows.section!).y0)).not.toEqual({ kind: 'section', bar: raised.index });
    const picked = textBox(layout, { kind: 'section', bar: raised.index }, null)!;
    expect(picked.y + picked.height / 2).toBeCloseTo(top + box.y0);
  });

  it('opens a moved-up section\'s field over where it is drawn', () => {
    // On a later line, so the fields aren't held at the drawing's top.
    const layout = layoutClip(clipOf(`${SHORT_NAMES} ${LONG_NAMES}`), 700);
    const system = layout.systems.find(s => s.sectionRows > 1)!;
    expect(system.top).toBeGreaterThan(100);
    const sectioned = system.bars.filter(b => b.bar.section);
    const raised = sectioned.find(b => b.sectionTop === 0)!;
    const low = sectioned.find(b => b.sectionTop > 0)!;
    const lowSpot = wordSpot(layout, W, { kind: 'section', bar: low.index, column: 0 });
    const raisedSpot = wordSpot(layout, W, { kind: 'section', bar: raised.index, column: 0 });
    expect(lowSpot.y - raisedSpot.y).toBe((low.sectionTop - raised.sectionTop) * SECTION_LINE);
  });
});

describe('the widen mock', () => {
  it('makes each bar at least as wide as its section\'s name, so the names share one row', () => {
    setSectionFit('widen');
    const layout = layoutClip(clipOf(LONG_NAMES), 4000);
    for (const bar of sectionedOf(layout)) expect(bar.x1 - bar.x0).toBeGreaterThanOrEqual(sectionReach(bar.bar.section!) - 0.001);
    expect(layout.systems[0].sectionRows).toBe(1);
  });
});
