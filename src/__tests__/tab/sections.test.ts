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
import { placeSections, SECTION_GAP, SECTION_LINE, sectionTextWidth } from '@/features/tab/sectionText';

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
/** Bars of one beat, each with a one-word name wider than the bar: a name can't wrap, so the next moves up. */
const STACKED = '\\ts (1 4) ' + ['Prechorus', 'Interlude', 'Breakdown'].map(name => `\\section "${name}" 0.6.4 |`).join(' ');
const SHORT_NAMES = ['Intro', 'Verse', 'Chorus'].map(name => `\\section "${name}" ${BAR}`).join(' ');

describe('placeSections', () => {
  const section = (text: string) => ({ text });
  const LONG = 'A name far longer than its bar';

  it('leaves sections that clear each other on one row', () => {
    const { placed, rows } = placeSections([{ x0: 0, section: section('Verse') }, { x0: 200, section: section('Chorus') }], 400);
    expect(rows).toBe(1);
    expect(placed.map(p => p.top)).toEqual([0, 0]);
  });

  it('wraps a long name to the room before the next section', () => {
    const { placed, rows } = placeSections([{ x0: 0, section: section(LONG) }, { x0: 150, section: section('Next') }], 800);
    const lines = placed[0].lines;
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(' ')).toBe(LONG);
    for (const line of lines) expect(sectionTextWidth(line)).toBeLessThanOrEqual(150 - SECTION_GAP);
    // Nothing moves up: the next section sits on the long one's last row, by the music.
    expect(placed[1].top).toBe(lines.length - 1);
    expect(rows).toBe(lines.length);
  });

  it('never wraps to less than 100px, and moves up a section that the wrapped name still runs into', () => {
    const { placed, rows } = placeSections([{ x0: 0, section: section(LONG) }, { x0: 40, section: section('Next') }], 800);
    // Rows count from the top: the moved one is on row 0, the long one under it.
    expect(placed[1].top).toBe(0);
    expect(placed[0].top).toBe(1);
    expect(rows).toBe(2);
    // Moved clear, the long name has the room to the line's end, so it keeps one line.
    expect(placed[0].lines).toEqual([LONG]);
  });

  it('moves up a single word wider than the room before the next', () => {
    const word = 'Prechorus';
    const { placed } = placeSections([{ x0: 0, section: section(word) }, { x0: sectionTextWidth(word) - 10, section: section('B') }], 400);
    expect(placed[0].lines).toEqual([word]);
    expect(placed.map(p => p.top)).toEqual([1, 0]);
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
    const { placed } = placeSections([
      { x0: 0, section: section(LONG) }, { x0: 40, section: section('Two') }, { x0: 400, section: section('Three') },
    ], 800);
    expect(placed.map(p => p.top)).toEqual([1, 0, 1]);
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
        const shareARow = boxes[i].y0 <= boxes[j].y1 && boxes[j].y0 <= boxes[i].y1;
        if (shareARow) expect(boxes[i].x1 + SECTION_GAP).toBeLessThanOrEqual(boxes[j].x0);
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

  it('picks a moved-up section where it is drawn', () => {
    const layout = layoutClip(clipOf(STACKED), W);
    const { rows, top } = layout.systems[0];
    const [low, raised] = sectionedOf(layout);
    expect(raised.sectionTop).toBe(0);
    expect(low.sectionTop).toBe(1);
    const box = sectionBox(raised, rows.section!);
    expect(textAt(layout, box.x0 + 10, top + box.y0)).toEqual({ kind: 'section', bar: raised.index });
    // The row under it is the row of the section it moved clear of: a press there picks that one, never this one.
    const under = sectionBox(low, rows.section!);
    expect(textAt(layout, under.x0 + 10, top + under.y0)).toEqual({ kind: 'section', bar: low.index });
    expect(textAt(layout, box.x0 + 10, top + under.y0)).toBeNull();
    const picked = textBox(layout, { kind: 'section', bar: raised.index })!;
    expect(picked.y + picked.height / 2).toBeCloseTo(top + box.y0);
  });

  it('opens a moved-up section\'s field over where it is drawn', () => {
    // On a later line, so the fields aren't held at the drawing's top.
    const names = Array.from({ length: 9 }, (_, k) => `\\section "Instrumental-break-${k}" 0.6.4 |`).join(' ');
    const layout = layoutClip(clipOf(`\\ts (1 4) ${names}`), 250);
    const system = layout.systems.find(s => s.top > 100 && s.sectionRows > 1)!;
    const raised = system.bars.find(b => b.sectionTop === 0)!;
    const low = system.bars.find(b => b.sectionTop === 1)!;
    const lowSpot = wordSpot(layout, W, { kind: 'section', bar: low.index, column: 0 });
    const raisedSpot = wordSpot(layout, W, { kind: 'section', bar: raised.index, column: 0 });
    expect(lowSpot.y - raisedSpot.y).toBe(SECTION_LINE);
  });
});
