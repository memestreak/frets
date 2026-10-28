/**
 * What the guitar solos of a book's tab need (docs/specs/2026-10-28-tab-sweet-child-solo-design.md and
 * docs/specs/2026-10-28-tab-sweet-child-solo-two-design.md): a bend held over tied notes is named on the
 * tab, under a staff, only where a bar starts; a let-down note is named where a bar starts or when a
 * pull-off leaves from it; a tied note is named when a slide leaves from it or under a mordent; and
 * mordents are read, written, drawn, set from the palette and played. Round 5
 * (docs/specs/2026-10-28-tab-sweet-child-solo-three-design.md): a tied note is named under vibrato, a
 * grace note bent up has no second number, and a tuplet no beam joins is bracketed. Round 6
 * (docs/specs/2026-10-28-tab-sweet-child-solo-four-design.md): every tuplet is bracketed, a let-down
 * note is named when it slides out, and the wah's + and o are read, written, drawn, set and picked.
 * Round 7 (docs/specs/2026-10-28-tab-sweet-child-solo-five-design.md): two strings bent at once stack
 * their heights' labels, the wah's row goes under the chord names, and a bend after a grace note rises
 * by the grace note's number. Round 8 (docs/specs/2026-10-28-tab-sweet-child-solo-six-design.md): a held
 * bend pushed on up is read, kept, written and drawn as an arrow rising from its dashed line, and a tap is a
 * circled T over the tab and the staff (docs/specs/2026-10-28-tab-circled-tap-design.md). Round 9
 * (docs/specs/2026-10-28-tab-sweet-child-outro-design.md): a slide from a dead note, a bend let down part of
 * the way and pushed back up, crescendo and decrescendo hairpins, and artificial harmonics. Round 10
 * (docs/specs/2026-10-28-tab-sweet-child-ending-design.md): free time and fermatas.
 */
import { render } from '@testing-library/react';
import * as alphaTab from '@coderline/alphatab';
import { writeAlphaTex } from '@/features/tab/alphatex';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { bendRaises, legatoStarts, parseClip, type Clip } from '@/features/tab/clip';
import { removeMark } from '@/features/tab/noteEdits';
import { layoutClip, rowsFor } from '@/features/tab/layout';
import { markBoxes, markTool } from '@/features/tab/marks';
import { perform } from '@/features/tab/playback';
import { TabClip } from '@/features/tab/TabClip';
import { applyCyclingKey, applyTool, isOn } from '@/features/tab/tools';

function clipOf(text: string): Clip {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.clip;
}

const numbers = (text: string, parts: 'tab' | 'both') => {
  const { container } = render(<TabClip clip={clipOf(text)} width={1600} parts={parts} title="Solo" />);
  return [...container.querySelectorAll('[data-testid="tab-column"] text')].map(t => t.textContent).filter(n => /\d/.test(n ?? ''));
};

describe('a held bend under a staff', () => {
  const HELD = '10.1.8 10.1{b (0 4)}.8 -.1{b (4 4)}.4 -.1{b (4 0)}.8 9.3{b (0 4)}.8 r.4 |\n-.3{b (4 4)}.1 |';

  it('names its tied note only where a bar starts', () => {
    expect(numbers(HELD, 'both')).toEqual(['10', '10', '9', '(9)']);
  });

  it('names every tied note on the tab alone', () => {
    expect(numbers(HELD, 'tab')).toEqual(['10', '10', '(10)', '9', '(9)']);
  });
});

describe('a let-down bend', () => {
  const PULLED = '10.2{b (0 4)}.8 -.2{b (4 0) h}.8 8.2.8 r.8 r.2 |';

  it('is named when a pull-off leaves from it, and its arrow comes down to the number', () => {
    expect(numbers(PULLED, 'both')).toEqual(['10', '(10)', '8']);
    const clip = clipOf(PULLED);
    expect(legatoStarts(clip).has(clip.bars[0].columns[1].notes[1]!)).toBe(true);
  });

  it('is not named otherwise', () => {
    expect(numbers('10.2{b (0 4)}.8 -.2{b (4 0)}.8 8.2.8 r.8 r.2 |', 'both')).toEqual(['10', '8']);
  });
});

describe('a let-down bend where a bar starts', () => {
  it('is named, as the book names it', () => {
    expect(numbers('r.2 r.4 7.2{b (0 2)}.4 |\n-.2{b (2 0)}.2 r.2 |', 'both')).toEqual(['7', '(7)']);
  });
});

describe('a tied note under a staff', () => {
  it('is named within a bar when a slide leaves from it', () => {
    expect(numbers('10.1.4 -.1{sl}.4 8.1.4 r.4 |', 'both')).toEqual(['10', '(10)', '8']);
  });

  it('is named within a bar under a mordent', () => {
    expect(numbers('7.3.4 -.3{umordent}.4 r.2 |', 'both')).toEqual(['7', '(7)']);
    expect(numbers('7.3.4 -.3.4 r.2 |', 'both')).toEqual(['7']);
  });
});

describe('mordents', () => {
  const TEXT = '7.3{umordent}.4 8.2{lmordent}.4 r.2 |\n';

  it('are read and written back, with no warnings', () => {
    const result = readAlphaTexWith(alphaTab, TEXT);
    expect(result.ok && result.warnings).toEqual([]);
    const clip = clipOf(TEXT);
    expect(clip.bars[0].columns.slice(0, 2).map((c, k) => c.notes[[2, 1][k]]?.mordent)).toEqual(['upper', 'lower']);
    expect(writeAlphaTex(clip)).toContain('7.3{umordent}.4 8.2{lmordent}.4');
  });

  it('are drawn over the staff and over the tab, or over the tab alone', () => {
    const both = render(<TabClip clip={clipOf(TEXT)} width={900} parts="both" title="Mordents" />).container;
    expect(both.querySelectorAll('[data-testid="staff-mordent"]')).toHaveLength(2);
    expect(both.querySelectorAll('[data-testid="mordent"]')).toHaveLength(2);
    const tab = render(<TabClip clip={clipOf(TEXT)} width={900} parts="tab" title="Mordents" />).container;
    expect(tab.querySelectorAll('[data-testid="mordent"]')).toHaveLength(2);
  });

  it('are set and taken away from the palette, and picked to light their own tool and be deleted', () => {
    const target = { cursor: { bar: 0, column: 0, string: 2 }, selection: null };
    const clip = applyTool(clipOf('7.3.4 r.4 r.2 |'), target, 'mordent');
    expect(clip.bars[0].columns[0].notes[2]?.mordent).toBe('upper');
    expect(isOn(clip, target.cursor, 'mordent')).toBe(true);
    expect(isOn(clip, target.cursor, 'lowerMordent')).toBe(false);
    expect(applyTool(clip, target, 'lowerMordent').bars[0].columns[0].notes[2]?.mordent).toBe('lower');
    expect(applyTool(clip, target, 'mordent').bars[0].columns[0].notes[2]?.mordent).toBeUndefined();
    const hit = markBoxes(layoutClip(clip, 900, 'tab')).find(m => m.hit.mark === 'mordent')!.hit;
    expect(markTool(clip, hit)).toBe('mordent');
    expect(removeMark(clip, hit).bars[0].columns[0].notes[2]?.mordent).toBeUndefined();
  });

  it('are played: the note, the one above it, and back', () => {
    const { midi } = perform(alphaTab, clipOf('7.3{umordent}.4 r.4 r.2 |'));
    const ons = midi.events.filter(e => e instanceof alphaTab.midi.NoteOnEvent) as alphaTab.midi.NoteOnEvent[];
    expect(ons.map(e => e.noteKey)).toEqual([62, 64, 62]);
  });
});

describe('a tied note under a staff', () => {
  const numbersOf = (text: string) => {
    const { container } = render(<TabClip clip={clipOf(text)} width={800} parts="both" title="Ties" />);
    return [...container.querySelectorAll('[data-testid="tab-column"] text')].map(t => t.textContent).filter(n => /\d/.test(n ?? ''));
  };

  it('is named within the bar under vibrato, as the book prints bars 114 and 117', () => {
    expect(numbersOf('\\ts (4 4)\n12.1{v}.4 -.1{v}.4 12.1.4 -.1.4 |\n')).toEqual(['12', '(12)', '12']);
  });

  it('has no number when it bends up after a grace note without vibrato (the book\'s bar 118)', () => {
    expect(numbersOf('\\ts (4 4)\nr.2 13.2.8{gr} -.2{b (0 4)}.4 -.2{b (4 4)}.4 |\n')).toEqual(['13']);
  });
});

describe('a tuplet\'s bracket on the tab alone (issue #179)', () => {
  const brackets = (text: string) => {
    const { container } = render(<TabClip clip={clipOf(text)} width={800} parts="tab" title="Tuplets" />);
    return container.querySelectorAll('[data-testid="tuplet-bracket"]').length;
  };

  it('is drawn under quarter-note triplets, which no beam joins (the book\'s bar 115)', () => {
    expect(brackets('\\ts (4 4)\n11.1.4{tu 3} 12.1.4{tu 3} 14.1.4{tu 3} r.2 |\n')).toBe(1);
  });

  it('is drawn under eighth-note triplets one beam joins too, as Guitar Pro prints them', () => {
    expect(brackets('\\ts (4 4)\n11.3.8{tu 3} 12.3.8{tu 3} 14.3.8{tu 3} r.4 r.2 |\n')).toBe(1);
  });
});

describe('the wah', () => {
  const TEXT = '10.2.8{wahc} 8.1.8{waho} r.4 r.2 |\n';

  it('is read and written back, with no warnings', () => {
    const result = readAlphaTexWith(alphaTab, TEXT);
    expect(result.ok && result.warnings).toEqual([]);
    const clip = clipOf(TEXT);
    expect(clip.bars[0].columns.slice(0, 2).map(c => c.wah)).toEqual(['closed', 'open']);
    expect(writeAlphaTex(clip)).toContain('10.2.8{wahc} 8.1.8{waho}');
  });

  it('goes under the chord names and every word over the music, nearest the notes (Jeremy, 2026-10-28)', () => {
    const clip = clipOf('\\section "Solo" \\tempo 120 10.2.8{wahc ch "Em" txt "slow"} 8.1.8{waho} r.4 r.2 |\n');
    for (const parts of ['both', 'tab', 'staff'] as const) {
      const rows = rowsFor(clip, parts);
      expect(rows.wah).toBeGreaterThan(Math.max(rows.chords!, rows.text!, rows.section!, rows.tempo!));
    }
  });

  it('draws + and o over the music in every view, as the book prints bars 127–130', () => {
    for (const parts of ['both', 'tab', 'staff'] as const) {
      const { container } = render(<TabClip clip={clipOf(TEXT)} width={900} parts={parts} title="Wah" />);
      const signs = [...container.querySelectorAll('[data-testid="wah"]')].map(e => e.tagName.toLowerCase());
      expect(signs).toEqual(['path', 'circle']);
    }
  });

  it('is set from the palette (closed, open, then off) and picked to light its tool and be deleted', () => {
    const target = { cursor: { bar: 0, column: 0, string: 1 }, selection: null };
    const closed = applyTool(clipOf('10.2.8 r.8 r.4 r.2 |\n'), target, 'wah');
    expect(closed.bars[0].columns[0].wah).toBe('closed');
    expect(isOn(closed, target.cursor, 'wah')).toBe(true);
    const open = applyTool(closed, target, 'wah');
    expect(open.bars[0].columns[0].wah).toBe('open');
    expect(applyTool(open, target, 'wah').bars[0].columns[0].wah).toBeUndefined();
    const hit = markBoxes(layoutClip(open, 900, 'both')).find(m => m.hit.mark === 'wah')!.hit;
    expect(markTool(open, hit)).toBe('wah');
    expect(removeMark(open, hit).bars[0].columns[0].wah).toBeUndefined();
  });
});

describe('a let-down note that slides out', () => {
  it('is named within the bar under a staff, as the book prints bar 120\'s "(15)"', () => {
    const text = '\\ts (4 4)\nr.4 r.8 15.1{b (0 4)}.8 -.1{b (4 4)}.8 -.1{b (4 0) sod}.8 r.4 |\n';
    const { container } = render(<TabClip clip={clipOf(text)} width={800} parts="both" title="Slide out" />);
    const numbers = [...container.querySelectorAll('[data-testid="tab-column"] text')].map(t => t.textContent).filter(n => /\d/.test(n ?? ''));
    expect(numbers).toEqual(['15', '(15)']);
  });
});

describe('two strings bent at once (round 7, the book\'s bar 132)', () => {
  const labelsOf = (text: string, parts: 'tab' | 'both' | 'staff') => {
    const { container } = render(<TabClip clip={clipOf(text)} width={800} parts={parts} title="Two bends" />);
    const testid = parts === 'staff' ? 'staff-bend' : 'bend';
    return [...container.querySelectorAll(`[data-testid="${testid}"] text`)].map(t => [t.textContent, Number(t.getAttribute('y'))] as const);
  };

  it('stack their heights, the top string\'s over the other\'s, on the tab and on the staff alone', () => {
    for (const parts of ['both', 'staff'] as const) {
      const labels = labelsOf('\\ts (4 4)\n(17.2{b (0 4)} 17.3{b (0 2)}).4 r.4 r.2 |\n', parts).sort((a, b) => a[1] - b[1]);
      expect(labels.map(([text]) => text)).toEqual(['full', '½']);
      expect(labels[1][1] - labels[0][1]).toBeGreaterThan(10);
    }
  });

  it('label one height once when both strings bend as far', () => {
    expect(labelsOf('\\ts (4 4)\n(15.1{b (0 4)} 15.2{b (0 4)}).4 r.4 r.2 |\n', 'tab').map(([text]) => text)).toEqual(['full']);
  });
});

describe('a tied note bent up after a grace note, with no number of its own (round 7)', () => {
  it('bends from the grace note\'s number, its dashed line running on over the tied note', () => {
    const text = '\\ts (4 4)\n17.2.8{gr} -.2{b (0 4)}.4 r.4 r.2 |\n';
    const { container } = render(<TabClip clip={clipOf(text)} width={800} parts="both" title="Grace bend" />);
    const grace = Number(container.querySelector('[data-testid="grace"]')!.getAttribute('x'));
    const bend = container.querySelector('[data-testid="bend"] path')!.getAttribute('d')!;
    const start = Number(/^M([\d.]+)/.exec(bend)![1]);
    expect(start - grace).toBeLessThan(10);
    expect(container.querySelector('[data-testid="bend"] line[stroke-dasharray]')).not.toBeNull();
  });
});

describe('a held bend pushed on up (round 8, the book\'s bar 144: "full" then "1½")', () => {
  const TEXT = '\\ts (4 4)\nr.2 r.4 15.1{b (0 4)}.4 |\n-.1{b (4 6)}.2 -.1{b (6 6)}.4 -.1{b (6 0)}.4 |\n';

  it('is read with the height it rises from and written back as it was', () => {
    const result = readAlphaTexWith(alphaTab, TEXT);
    expect(result.ok && result.warnings).toEqual([]);
    const clip = clipOf(TEXT);
    expect(clip.bars[1].columns[0].notes[0]!.bend).toEqual({ quarters: 6, pre: true, release: false, from: 4 });
    expect(writeAlphaTex(clip)).toContain('-.1{b (4 6)}.2 -.1{b (6 6)}.4 -.1{b (6 0)}.4');
    expect(parseClip(clip)).not.toBeNull();
    expect(parseClip({ ...clip, bars: [{ ...clip.bars[1], columns: [{ ...clip.bars[1].columns[0], notes: [{ fret: 15, tie: true, bend: { quarters: 4, pre: true, release: false, from: 6 } }, null, null, null, null, null] }] }] })).toBeNull();
  });

  it('rises from the dashed line to a line higher, labelled with its new height, on the tab and on the staff alone', () => {
    const tab = render(<TabClip clip={clipOf(TEXT)} width={900} parts="both" title="Rise" />).container;
    expect([...tab.querySelectorAll('[data-testid="bend-rise"] text')].map(t => t.textContent)).toEqual(['1½']);
    const hold = tab.querySelector('[data-testid="bend-hold"]')!;
    const first = tab.querySelector('[data-testid="bend"] path')!.getAttribute('d')!;
    // The hold after the rise stands higher than the first bend's top.
    expect(Number(hold.getAttribute('y1'))).toBeLessThan(Number(/ ([\d.]+)$/.exec(first)![1]));
    const staff = render(<TabClip clip={clipOf(TEXT)} width={900} parts="staff" title="Rise" />).container;
    expect([...staff.querySelectorAll('[data-testid="staff-bend"] text')].map(t => t.textContent)).toEqual(['full', '1½']);
  });
});

describe('a tap\'s circled T (round 8, the book\'s bar 141)', () => {
  // A tapped note under an accent, stem down, so the T must clear the accent too.
  const TEXT = '\\ts (4 4)\n14.2{ac}.4{tt} 12.1.4 r.2 |\n';

  it('is circled over its number on the tab and over the heads on the staff, in Both as with the staff alone', () => {
    const both = render(<TabClip clip={clipOf(TEXT)} width={900} parts="both" title="Tap" />).container;
    const tabTap = both.querySelector('[data-testid="tab-tap"]')!;
    expect(tabTap.querySelector('circle')).not.toBeNull();
    expect(tabTap.textContent).toBe('T');
    const staffTap = both.querySelector('[data-testid="staff-tap"]')!;
    expect(staffTap.querySelector('circle')).not.toBeNull();
    // Over the accent, which sits over the head.
    const tapBottom = Number(staffTap.querySelector('circle')!.getAttribute('cy')) + 5.5;
    const accent = both.querySelector('[data-testid="staff-accent"]')!.getAttribute('d')!;
    const accentYs = accent.match(/-?[\d.]+/g)!.map(Number).filter((_, i) => i % 2 === 1);
    expect(tapBottom).toBeLessThan(Math.min(...accentYs));
    const alone = render(<TabClip clip={clipOf(TEXT)} width={900} parts="staff" title="Tap" />).container;
    expect(alone.querySelectorAll('[data-testid="staff-tap"] circle')).toHaveLength(1);
  });

  it('gets room over the staff, so a tap on a high note stays inside the drawing', () => {
    // A high note, its stem down: the T stands over the head, in room the staff keeps for it.
    const both = render(<TabClip clip={clipOf('\\ts (4 4)\n12.1.8{tt} 5.1.8 r.4 r.2 |\n')} width={900} parts="both" title="Tap" />).container;
    const circle = both.querySelector('[data-testid="staff-tap"] circle')!;
    expect(Number(circle.getAttribute('cy')) - 5.5).toBeGreaterThanOrEqual(0);
  });
});

describe('a dead note slid into the next note (round 9, the book\'s bar 160)', () => {
  const TEXT = '\\ts (4 4)\nr.2 r.4 r.8 x.3{sl}.8 |\n19.3.4 r.4 r.2 |\n';

  it('is read and written back with its slide, and the slide is drawn', () => {
    const result = readAlphaTexWith(alphaTab, TEXT);
    expect(result.ok && result.warnings).toEqual([]);
    const clip = clipOf(TEXT);
    expect(clip.bars[1].columns[0].notes[2]).toMatchObject({ fret: 19, slide: 'legato' });
    expect(writeAlphaTex(clip)).toContain('x.3{sl}.8 |');
    // A hammer-on from a dead note still means nothing, and is left out.
    const hammer = readAlphaTexWith(alphaTab, '\\ts (4 4)\nx.3{h}.4 5.3.4 r.2 |\n');
    expect(hammer.ok && hammer.warnings).toEqual(['Left out a hammer-on, pull-off or slide with no later note on its string.']);
  });
});

describe('a bend let down part of the way and pushed back up (round 9, the book\'s bar 165)', () => {
  const TEXT = '\\ts (4 4)\n17.1{b (0 4)}.4 -.1{b (4 2)}.4 -.1{b (2 4)}.4 -.1{b (4 0)}.4 |\n';

  it('keeps the height the release stops at, writes it back as it was, and checks it', () => {
    const clip = clipOf(TEXT);
    const notes = clip.bars[0].columns.map(c => c.notes[0]!);
    expect(notes[1].bend).toEqual({ quarters: 4, pre: true, release: true, to: 2 });
    expect(notes[2].bend).toEqual({ quarters: 4, pre: true, release: false, from: 2 });
    expect(writeAlphaTex(clip)).toContain('-.1{b (4 2)}.4 -.1{b (2 4)}.4 -.1{b (4 0)}.4');
    // Let down half way on a picked note: (0 4 2).
    expect(writeAlphaTex(clipOf('\\ts (4 4)\n17.1{b (0 4 2)}.4 r.4 r.2 |\n'))).toContain('17.1{b (0 4 2)}.4');
    const withBend = (bend: object) => ({ ...clip, bars: [{ ...clip.bars[0], columns: [{ ...clip.bars[0].columns[0], notes: [{ fret: 17, bend }, null, null, null, null, null] }] }] });
    expect(parseClip(withBend({ quarters: 4, pre: false, release: true, to: 2 }))).not.toBeNull();
    expect(parseClip(withBend({ quarters: 4, pre: false, release: true, to: 4 }))).toBeNull();
    expect(parseClip(withBend({ quarters: 4, pre: false, release: false, to: 2 }))).toBeNull();
  });

  it('lands a step under the bend\'s line, labelled "½", and rises from there back to the first line', () => {
    const clip = clipOf(TEXT);
    // The rise goes back up to the line it came down from, the usual one, so no note leaves it; a note
    // holding the bend where it landed stands a step under it.
    expect(bendRaises(clip).size).toBe(0);
    expect([...bendRaises(clipOf('\\ts (4 4)\n17.1{b (0 4)}.4 -.1{b (4 2)}.4 -.1{b (2 2)}.2 |\n')).values()]).toEqual([-1]);
    const tab = render(<TabClip clip={clip} width={900} parts="both" title="Down and up" />).container;
    expect([...tab.querySelectorAll('[data-testid="bend-to"]')].map(t => t.textContent)).toEqual(['½']);
    const rise = tab.querySelector('[data-testid="bend-rise"]')!;
    expect(rise.querySelector('text')!.textContent).toBe('full');
    // No dashed line before the rise: it leaves straight from where the release landed.
    expect(rise.querySelector('line')).toBeNull();
    // The rise's arrowhead is as high as the first bend's.
    const firstTop = Number(/ ([\d.]+)$/.exec(tab.querySelector('[data-testid="bend"] path')!.getAttribute('d')!)![1]);
    const riseTop = Number(/ ([\d.]+)$/.exec(rise.querySelector('path')!.getAttribute('d')!)![1]);
    expect(riseTop).toBe(firstTop);
  });
});

describe('crescendo and decrescendo hairpins (round 9, the book\'s bar 157)', () => {
  const TEXT = '\\ts (4 4)\n7.3.8{cre} 9.3.8{cre} 7.3.8{cre} 9.3.8{cre} 7.3.8{dec} 9.3.8{dec} r.4 |\n';

  it('are read, written back, and drawn one wedge per run, opening and closing, under the staff and over the tab', () => {
    const clip = clipOf(TEXT);
    expect(clip.bars[0].columns.map(c => c.hairpin ?? null)).toEqual(['crescendo', 'crescendo', 'crescendo', 'crescendo', 'decrescendo', 'decrescendo', null]);
    expect(writeAlphaTex(clip)).toContain('7.3.8{cre} 9.3.8{cre} 7.3.8{cre} 9.3.8{cre} 7.3.8{dec} 9.3.8{dec} r.4 |');
    for (const parts of ['both', 'tab', 'staff'] as const) {
      const container = render(<TabClip clip={clip} width={900} parts={parts} title="Hairpins" />).container;
      const wedges = [...container.querySelectorAll('[data-testid="hairpin"]')].map(p => p.getAttribute('d')!.match(/-?[\d.]+/g)!.map(Number));
      expect(wedges).toHaveLength(2);
      // M wide-top L point L wide-bottom: a crescendo's point is on its left, a decrescendo's on its right.
      const [cre, dec] = wedges;
      expect(cre[2]).toBeLessThan(cre[0]);
      expect(dec[2]).toBeGreaterThan(dec[0]);
      const { rows } = layoutClip(clip, 900, parts).systems[0];
      if (rows.score) expect(cre[3]).toBeGreaterThan(rows.score.bottom);
      if (rows.tab) expect(cre[3]).toBeLessThan(rows.staffTop);
    }
  });
});

describe('an artificial harmonic (round 9, the book\'s bar 158)', () => {
  it('is read with or without its touch point, written back, and labelled "AH" over the tab', () => {
    const clip = clipOf('\\ts (4 4)\n(8.2{ah} 7.3{nh}).4 10.2{ah 12}.4 r.2 |\n');
    expect(clip.bars[0].columns[0].notes[1]).toMatchObject({ fret: 8, harmonic: 'artificial' });
    expect(clip.bars[0].columns[1].notes[1]).toMatchObject({ fret: 10, harmonic: 'artificial', harmonicFret: 12 });
    expect(writeAlphaTex(clip)).toContain('(8.2{ah} 7.3{nh}).4 10.2{ah 12}.4 r.2 |');
    expect(readAlphaTexWith(alphaTab, writeAlphaTex(clip)).ok && readAlphaTexWith(alphaTab, writeAlphaTex(clip))).toMatchObject({ warnings: [] });
    for (const parts of ['both', 'tab'] as const) {
      const container = render(<TabClip clip={clip} width={900} parts={parts} title="AH" />).container;
      expect([...container.querySelectorAll('[data-testid="artificial-harmonic"]')].map(t => t.textContent)).toEqual(['AH', 'AH']);
    }
  });

  it('comes after pinch in the N key\'s cycle, and is picked and deleted, lighting no tool', () => {
    const target = { cursor: { bar: 0, column: 0, string: 1 }, selection: null };
    let clip = clipOf('\\ts (4 4)\n8.2.4 r.4 r.2 |\n');
    const kinds = [];
    for (let i = 0; i < 4; i++) {
      clip = applyCyclingKey(clip, target, 'n')!;
      kinds.push(clip.bars[0].columns[0].notes[1]!.harmonic ?? null);
    }
    expect(kinds).toEqual(['natural', 'pinch', 'artificial', null]);
    clip = clipOf('\\ts (4 4)\n8.2{ah 12}.4 r.4 r.2 |\n');
    const hit = markBoxes(layoutClip(clip, 900, 'tab')).find(m => m.hit.mark === 'artificial')!.hit;
    expect(markTool(clip, hit)).toBeNull();
    expect(removeMark(clip, hit).bars[0].columns[0].notes[1]).toEqual({ fret: 8 });
  });
});

describe('free time (round 10, the book\'s bars 176 to 181)', () => {
  const TEXT = '\\ts (4 4)\n0.6.1 | \\ft 0.6.1 | \\ft 0.6.1 | 0.6.1 |\n';

  it('is read and written back as \\ft on each bar', () => {
    const clip = clipOf(TEXT);
    expect(clip.bars.map(b => b.freeTime ?? false)).toEqual([false, true, true, false]);
    expect(writeAlphaTex(clip)).toContain('\\ft 0.6.1 | \\ft 0.6.1 |');
    const again = readAlphaTexWith(alphaTab, writeAlphaTex(clip));
    expect(again.ok && again.warnings).toEqual([]);
    expect(parseClip(JSON.parse(JSON.stringify(clip)))).toEqual(clip);
    expect(parseClip({ ...clip, bars: [{ ...clip.bars[0], freeTime: 'yes' }] })).toBeNull();
  });

  it('says "Free time" once, brackets the time signature where it starts, and dashes each free bar\'s closing line', () => {
    const clip = clipOf(TEXT);
    for (const parts of ['both', 'tab', 'staff'] as const) {
      const container = render(<TabClip clip={clip} width={1600} parts={parts} title="Free" />).container;
      expect([...container.querySelectorAll('[data-testid="free-time"]')].map(t => t.textContent)).toEqual(['Free time']);
      // The clip's own time signature at the start, then the bracketed one at bar 2.
      expect(container.querySelectorAll('[data-testid="time-brackets"]')).toHaveLength(1);
      // Bars 2 and 3 close dashed, on the staff and the tab alike; bar 1 and the last bar don't.
      const dashed = container.querySelectorAll('line[stroke-dasharray="4 3"]');
      expect(dashed).toHaveLength(parts === 'both' ? 4 : 2);
    }
  });

  it('says "Free time" after a tempo in the same bar, and at a clip\'s start without brackets', () => {
    const tempo = clipOf('\\ts (4 4)\n0.6.1 | \\tempo (90 "Slowly") \\ft 0.6.1 | 0.6.1 |\n');
    const container = render(<TabClip clip={tempo} width={1600} parts="tab" title="Free" />).container;
    const label = container.querySelector('[data-testid="tempo"] text')!;
    const free = container.querySelector('[data-testid="free-time"]')!;
    expect(free.getAttribute('y')).toBe(label.getAttribute('y'));
    expect(Number(free.getAttribute('x'))).toBeGreaterThan(Number(label.getAttribute('x')) + 60);

    const first = clipOf('\\ts (4 4)\n\\ft 0.6.1 | 0.6.1 |\n');
    const drawn = render(<TabClip clip={first} width={1600} parts="both" title="Free" />).container;
    expect(drawn.querySelectorAll('[data-testid="free-time"]')).toHaveLength(1);
    expect(drawn.querySelectorAll('[data-testid="time-brackets"]')).toHaveLength(0);
    expect(drawn.querySelectorAll('[data-testid="staff-time-signature"]')).toHaveLength(1);
  });

  it('leaves the last bar\'s closing line thick and starts no multi-bar rest across it', () => {
    const clip = clipOf('\\ts (4 4)\n\\multiBarRest\nr.1 | \\ft r.1 | \\ft r.1 |\n');
    const container = render(<TabClip clip={clip} width={1600} parts="tab" title="Free" />).container;
    expect(container.querySelectorAll('[data-testid="multi-rest"]')).toHaveLength(0);
    expect(container.querySelectorAll('line[stroke-dasharray="4 3"]')).toHaveLength(1);
  });
});

describe('a fermata (round 10, the book\'s bars 180 and 181)', () => {
  it('is read in each shape and written back', () => {
    const clip = clipOf('\\ts (4 4)\n0.6.4{fermata short} 0.6.4{fermata (medium 2)} 0.6.4{fermata long} 0.6.4 |\n');
    expect(clip.bars[0].columns.map(c => c.fermata ?? null)).toEqual(['short', 'medium', 'long', null]);
    expect(writeAlphaTex(clip)).toContain('0.6.4{fermata short} 0.6.4{fermata medium} 0.6.4{fermata long} 0.6.4 |');
    const again = readAlphaTexWith(alphaTab, writeAlphaTex(clip));
    expect(again.ok && again.warnings).toEqual([]);
    expect(parseClip({ ...clip, bars: [{ columns: [{ ...clip.bars[0].columns[0], fermata: 'huge' }] }] })).toBeNull();
  });

  it('stands over the staff, clear of the bar number, and over the tab only without a staff', () => {
    const clip = clipOf('\\ts (4 4)\n0.6.1{fermata medium} |\n');
    for (const parts of ['both', 'tab', 'staff'] as const) {
      const container = render(<TabClip clip={clip} width={900} parts={parts} title="Fermata" />).container;
      expect(container.querySelectorAll('[data-testid="fermata"]')).toHaveLength(1);
      const y = Number(container.querySelector('[data-testid="fermata"]')!.getAttribute('transform')!.match(/translate\([-\d.]+ ([-\d.]+)\)/)![1]);
      const { rows } = layoutClip(clip, 900, parts).systems[0];
      if (rows.score) expect(y).toBeLessThan(rows.score.top - 10);
      else expect(y).toBeLessThan(rows.staffTop);
    }
  });

  it('is picked and deleted, lighting no tool', () => {
    const clip = clipOf('\\ts (4 4)\n0.6.1{fermata medium} |\n');
    for (const parts of ['both', 'tab'] as const) {
      const hit = markBoxes(layoutClip(clip, 900, parts)).find(m => m.hit.mark === 'fermata')!.hit;
      expect(markTool(clip, hit)).toBeNull();
      expect(removeMark(clip, hit).bars[0].columns[0].fermata).toBeUndefined();
    }
  });
});
