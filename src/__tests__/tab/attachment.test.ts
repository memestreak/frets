import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { attachment } from '@/features/tab/attachment';
import { type Part, partOf } from '@/features/tab/clip';
import { layoutClip, stepY, stringY, type Layout, type Parts } from '@/features/tab/layout';
import { markBoxes, type MarkHit } from '@/features/tab/marks';

function clipOf(body: string): Part {
  const result = readAlphaTexWith(alphaTab, `\\ts (4 4)\n${body}\n`);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  expect(result.warnings).toEqual([]);
  return partOf(result.clip);
}

const WIDTH = 900;

/** The first drawn `mark`'s hit, on the tab or on the staff. */
function hitOf(layout: Layout, mark: MarkHit['mark'], on?: 'staff'): MarkHit {
  const found = markBoxes(layout).find(m => m.hit.mark === mark && m.hit.on === on);
  if (!found) throw new Error(`no ${mark} drawn${on ? ' on the staff' : ''}`);
  return found.hit;
}

function laidOut(body: string, parts: Parts = 'tab') {
  return layoutClip(clipOf(body), WIDTH, parts);
}

describe('Attachment lines (step 8)', () => {
  it('a picked chord name, accent and fermata draw one line; a let ring Span two, one to each end', () => {
    const layout = laidOut('0.3.4{ch "Am"} 2.3{ac}.4 3.3.4{fermata medium} 2.3{lr}.4 | 0.3{lr}.4 2.3{lr}.4 3.3.2 |');
    expect(attachment(layout, { kind: 'chord', index: 0 }).lines).toHaveLength(1);
    expect(attachment(layout, hitOf(layout, 'accent')).lines).toHaveLength(1);
    expect(attachment(layout, hitOf(layout, 'fermata')).lines).toHaveLength(1);
    const ring = attachment(layout, hitOf(layout, 'letRing'));
    expect(ring.lines).toHaveLength(2);
    const xs = layout.systems[0].bars.flatMap(b => b.columns).filter(c => c.index === 3 || c.index === 5).map(c => c.x);
    expect(ring.lines.map(l => l.x)).toEqual(xs);
  });

  it('a picked bend, tie, section and time signature draw none', () => {
    const layout = laidOut('\\section "A"\n5.2{b (0 4)}.4 5.3.4 -.3.4 2.3.4 |');
    expect(attachment(layout, hitOf(layout, 'bend')).lines).toEqual([]);
    expect(attachment(layout, hitOf(layout, 'tie')).lines).toEqual([]);
    expect(attachment(layout, { kind: 'section', bar: 0 }).lines).toEqual([]);
    expect(attachment(layout, { kind: 'time', bar: 0 }).lines).toEqual([]);
  });

  it('a Mark over the tab ends at its column’s top number; one under it at its bottom one', () => {
    const layout = laidOut('(0.2{ac} 2.4{ac}).4 (0.2 2.4).4{fermata medium} 3.3.2 |');
    const { rows, top } = layout.systems[0];
    // The accent sits over the tab: its line ends just over the top note (string 2, index 1).
    const accent = attachment(layout, hitOf(layout, 'accent')).lines[0];
    expect(accent.y1).toBe(top + stringY(rows, 1) - 7);
    expect(accent.y0).toBeLessThan(accent.y1);
    const below = laidOut('(0.2 2.4).4{tu 3} (0.2 2.4).4{tu 3} (0.2 2.4).4{tu 3} 3.3.2 |');
    const tuplet = attachment(below, hitOf(below, 'tuplet')).lines[0];
    const at = below.systems[0];
    // A tuplet number sits under the tab: its line ends just under the bottom note (string 4, index 3).
    expect(tuplet.y1).toBe(at.top + stringY(at.rows, 3) + 7);
    expect(tuplet.y0).toBeGreaterThan(tuplet.y1);
  });

  it('a Mark picked on the staff ends at the note head', () => {
    const layout = laidOut('5.2{ac}.4 5.3.4 3.3.2 |', 'both');
    const hit = hitOf(layout, 'accent', 'staff');
    const [line] = attachment(layout, hit).lines;
    const system = layout.systems[0];
    const head = system.bars[0].columns[0].heads[0];
    const y = system.top + stepY(system.rows.score!, head.step);
    expect(Math.abs(line.y1 - y)).toBeLessThan(8);
    expect(Math.abs(line.y1 - y)).toBeGreaterThan(0);
  });
});

describe('Handles (step 8)', () => {
  it('a picked Span draws two; a vibrato, an octave line and a hairpin are Spans', () => {
    for (const body of ['2.3{lr}.4 3.3{lr}.4 5.3.2 |', '2.3{v}.4 3.3{v}.4 5.3.2 |', '2.3.4{ot 8va} 3.3.4{ot 8va} 5.3.2 |', '2.3.4{cre} 3.3.4{cre} 5.3.2 |']) {
      const layout = laidOut(body, 'both');
      const mark = (['letRing', 'vibrato', 'ottava', 'hairpin'] as const).find(m => markBoxes(layout).some(b => b.hit.mark === m))!;
      const { handles } = attachment(layout, markBoxes(layout).find(b => b.hit.mark === mark)!.hit);
      expect(handles.map(h => h.end)).toEqual(['start', 'end']);
    }
  });

  it('a picked tuplet, tie and the whammy bar draw none', () => {
    const layout = laidOut('2.3.8{tu 3} 3.3.8{tu 3} 5.3.8{tu 3} 5.3.4 -.3.4 3.3.4{tb (0 -4)} |');
    for (const mark of ['tuplet', 'tie', 'whammy'] as const) expect(attachment(layout, hitOf(layout, mark)).handles).toEqual([]);
  });
});

describe('the related notes’ tint (step 8)', () => {
  const layout = laidOut('\\section "A"\n5.2{b (0 4)}.4 5.3.4 -.3.4 (2.3{ac} 3.2{ac}).4 | 0.3{lr}.4 2.3{lr}.4 3.3.2 |');

  it('a picked bend tints its note; a picked tie both its notes', () => {
    expect(attachment(layout, hitOf(layout, 'bend')).tint).toEqual([{ index: 0, string: 1 }]);
    expect(attachment(layout, hitOf(layout, 'tie')).tint).toEqual([{ index: 1, string: 2 }, { index: 2, string: 2 }]);
  });

  it('a picked accent every note of its column; a let ring Span every note of its run; a section nothing', () => {
    expect(attachment(layout, hitOf(layout, 'accent')).tint).toEqual([{ index: 3, string: 1 }, { index: 3, string: 2 }]);
    expect(attachment(layout, hitOf(layout, 'letRing')).tint).toEqual([{ index: 4, string: 2 }, { index: 5, string: 2 }]);
    expect(attachment(layout, { kind: 'section', bar: 0 }).tint).toEqual([]);
  });
});
