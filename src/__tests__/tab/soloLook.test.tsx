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
 * by the grace note's number.
 */
import { render } from '@testing-library/react';
import * as alphaTab from '@coderline/alphatab';
import { writeAlphaTex } from '@/features/tab/alphatex';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { legatoStarts, type Clip } from '@/features/tab/clip';
import { removeMark } from '@/features/tab/noteEdits';
import { layoutClip, rowsFor } from '@/features/tab/layout';
import { markBoxes, markTool } from '@/features/tab/marks';
import { perform } from '@/features/tab/playback';
import { TabClip } from '@/features/tab/TabClip';
import { applyTool, isOn } from '@/features/tab/tools';

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
