/**
 * What Verse 1 and Chorus 1 of a book's tab need (docs/specs/2026-10-28-tab-sweet-child-verse-design.md):
 * double bars, multi-bar rests, tied notes named on the tab only where a bar starts under a staff,
 * a vibrato stopping at its bar line, the last line run to the full width, and chord names printed
 * with ♯ and ♭.
 */
import { render } from '@testing-library/react';
import * as alphaTab from '@coderline/alphatab';
import { writeAlphaTex } from '@/features/tab/alphatex';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import type { Clip } from '@/features/tab/clip';
import { toggleDoubleBar } from '@/features/tab/barEdits';
import { layoutClip, multiRests, MULTI_REST_WIDTH, prettyChord } from '@/features/tab/layout';
import { vibratoRuns } from '@/features/tab/runs';
import { TabClip } from '@/features/tab/TabClip';

const read = (text: string) => readAlphaTexWith(alphaTab, text);
function clipOf(text: string): Clip {
  const result = read(text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.clip;
}
const EIGHTS = '12.4.8 15.2.8 14.3.8 12.3.8 15.1.8 14.3.8 14.1.8 14.3.8 |';
const cursor = { bar: 0, column: 0, string: 0 };

describe('double bars', () => {
  it('reads \\db, writes it back, and warns of nothing', () => {
    const text = `\\ts (4 4)\n\\db ${EIGHTS}\n${EIGHTS}\n`;
    const result = read(text);
    expect(result.ok && result.warnings).toEqual([]);
    const clip = clipOf(text);
    expect(clip.bars.map(b => !!b.doubleBar)).toEqual([true, false]);
    expect(writeAlphaTex(clip)).toContain('\\db 12.4.8');
  });

  it('are set and taken away from the palette', () => {
    const clip = clipOf(`${EIGHTS}\n${EIGHTS}`);
    const on = toggleDoubleBar(clip, cursor);
    expect(on.bars[0].doubleBar).toBe(true);
    expect(toggleDoubleBar(on, cursor).bars[0].doubleBar).toBeUndefined();
  });

  it('are drawn as two thin lines at the bar end, on the tab and on the staff', () => {
    const clip = clipOf(`\\db ${EIGHTS}\n${EIGHTS}`);
    const { container } = render(<TabClip clip={clip} width={900} parts="both" title="Double" />);
    expect(container.querySelectorAll('[data-testid="double-bar"]')).toHaveLength(2);
  });
});

describe('multi-bar rests', () => {
  const RESTS = `\\multiBarRest\n${EIGHTS}\nr.1 |\nr.1 |\nr.1 |\n${EIGHTS}`;

  it('are read from \\multiBarRest and written back, with no warnings', () => {
    const result = read(RESTS);
    expect(result.ok && result.warnings).toEqual([]);
    const clip = clipOf(RESTS);
    expect(clip.multiBarRests).toBe(true);
    expect(clip.header).toBeUndefined();
    expect(writeAlphaTex(clip)).toContain('\\multiBarRest\n');
  });

  it('gather two or more plain bars of rest, only when the clip asks for them', () => {
    expect([...multiRests(clipOf(RESTS))]).toEqual([[1, 3]]);
    expect(multiRests(clipOf(RESTS.replace('\\multiBarRest\n', ''))).size).toBe(0);
    // A rest bar alone, a rest with a chord name over it, and a section in the middle each stand by themselves.
    expect(multiRests(clipOf(`\\multiBarRest\n${EIGHTS}\nr.1 |\n${EIGHTS}`)).size).toBe(0);
    expect([...multiRests(clipOf(`\\multiBarRest\nr.1 |\nr.1{ch "D"} |\nr.1 |\nr.1 |`))]).toEqual([[2, 2]]);
    expect([...multiRests(clipOf(`\\multiBarRest\nr.1 |\nr.1 |\n\\section "B" r.1 |\nr.1 |`))]).toEqual([[0, 2], [2, 2]]);
  });

  it('end at a double bar or a repeat, which their last bar keeps', () => {
    expect([...multiRests(clipOf(`\\multiBarRest\nr.1 |\n\\db r.1 |\nr.1 |\nr.1 |`))]).toEqual([[0, 2], [2, 2]]);
  });

  it('keep each bar as a slice of one wide bar, on one line, so the cursor still steps through them', () => {
    const layout = layoutClip(clipOf(RESTS), 2000, 'both');
    const bars = layout.systems[0].bars;
    expect(bars.map(b => b.restRun && [b.restRun.first, b.restRun.last])).toEqual([null, [true, false], [false, false], [false, true], null]);
    const span = bars[1].restRun!.span;
    expect(span).toBe(bars[3].restRun!.span);
    expect(span.x0).toBe(bars[1].x0);
    expect(span.x1).toBe(bars[3].x1);
    expect(span.x1 - span.x0).toBeGreaterThanOrEqual(MULTI_REST_WIDTH);
    expect(bars.flatMap(b => b.columns.map(c => c.index))).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
  });

  it('go to the next line whole when they do not fit', () => {
    const layout = layoutClip(clipOf(`\\multiBarRest\n${EIGHTS}\n${EIGHTS}\nr.1 |\nr.1 |\nr.1 |`), 800, 'tab');
    expect(layout.systems.map(s => s.bars.map(b => b.index))).toEqual([[0, 1], [2, 3, 4]]);
  });

  it('are drawn once, with their count, and the bars under them numbered once', () => {
    const { container } = render(<TabClip clip={clipOf(RESTS)} width={2000} parts="both" barNumbers="every" title="Rests" />);
    const rests = container.querySelectorAll('[data-testid="multi-rest"]');
    expect(rests).toHaveLength(1);
    expect(rests[0].textContent).toBe('3');
    expect([...container.querySelectorAll('[data-testid="bar-number"]')].map(n => n.textContent)).toEqual(['1', '2', '5']);
    expect(container.querySelectorAll('[data-testid="staff-rest"]')).toHaveLength(0);
  });

  it('are drawn on the tab when it stands alone', () => {
    const { container } = render(<TabClip clip={clipOf(RESTS)} width={2000} parts="tab" title="Rests" />);
    expect(container.querySelectorAll('[data-testid="multi-rest"]')).toHaveLength(1);
  });
});

describe('tied notes on the tab', () => {
  const TIES = '(15.2 14.3).2 (-.2 -.3).2 | (-.2 -.3).2 r.2 |';
  const numbers = (parts: 'tab' | 'both') => {
    const { container } = render(<TabClip clip={clipOf(TIES)} width={900} parts={parts} title="Ties" />);
    return [...container.querySelectorAll('[data-testid="tab-column"] text')].map(t => t.textContent);
  };

  it('are named only where a bar starts, under a staff', () => {
    expect(numbers('both')).toEqual(['15', '14', '(15)', '(14)']);
  });

  it('are all named on the tab alone, with their arcs', () => {
    expect(numbers('tab')).toEqual(['15', '14', '(15)', '(14)', '(15)', '(14)']);
  });
});

describe('the line', () => {
  it("stops a vibrato over a bar's last note at the bar line", () => {
    const layout = layoutClip(clipOf('(15.2{vw} 14.3{vw}).1 | (-.2 -.3).2 r.2 |'), 900, 'both');
    const [run] = vibratoRuns(layout.systems[0]);
    expect(run.end).toBeLessThanOrEqual(layout.systems[0].bars[0].x1);
  });

  it('runs the last line to the full width when it holds as many bars as the line before', () => {
    const six = Array(6).fill(EIGHTS).join('\n');
    const layout = layoutClip(clipOf(six), 1400, 'tab');
    const ends = layout.systems.map(s => s.bars[s.bars.length - 1].x1);
    expect(layout.systems.map(s => s.bars.length)).toEqual([3, 3]);
    expect(ends[1]).toBeCloseTo(ends[0]);
    // With fewer bars, it is spread only as much as the line before.
    const five = layoutClip(clipOf(Array(5).fill(EIGHTS).join('\n')), 1400, 'tab');
    expect(five.systems[1].bars[1].x1).toBeLessThan(ends[0] - 100);
  });

  it('prints the sharps and flats of a chord name, its root and bass, as signs', () => {
    expect(prettyChord('Ab5')).toBe('A♭5');
    expect(prettyChord('F#m7b5')).toBe('F♯m7b5');
    expect(prettyChord('C/Bb')).toBe('C/B♭');
    expect(prettyChord('Cadd9')).toBe('Cadd9');
    expect(prettyChord('Bbb')).toBe('B𝄫');
  });
});
