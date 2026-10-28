/**
 * What the guitar solos of a book's tab need (docs/specs/2026-10-28-tab-sweet-child-solo-design.md and
 * docs/specs/2026-10-28-tab-sweet-child-solo-two-design.md): a bend held over tied notes is named on the
 * tab, under a staff, only where a bar starts; a let-down note is named where a bar starts or when a
 * pull-off leaves from it; a tied note is named when a slide leaves from it or under a mordent; and
 * mordents are read, written, drawn, set from the palette and played. Round 5
 * (docs/specs/2026-10-28-tab-sweet-child-solo-three-design.md): a tied note is named under vibrato, a
 * grace note bent up has no second number, and a tuplet no beam joins is bracketed.
 */
import { render } from '@testing-library/react';
import * as alphaTab from '@coderline/alphatab';
import { writeAlphaTex } from '@/features/tab/alphatex';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { legatoStarts, type Clip } from '@/features/tab/clip';
import { removeMark } from '@/features/tab/noteEdits';
import { layoutClip } from '@/features/tab/layout';
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

describe('a tuplet\'s bracket on the tab alone', () => {
  const brackets = (text: string) => {
    const { container } = render(<TabClip clip={clipOf(text)} width={800} parts="tab" title="Tuplets" />);
    return container.querySelectorAll('[data-testid="tuplet-bracket"]').length;
  };

  it('is drawn under quarter-note triplets, which no beam joins (the book\'s bar 115)', () => {
    expect(brackets('\\ts (4 4)\n11.1.4{tu 3} 12.1.4{tu 3} 14.1.4{tu 3} r.2 |\n')).toBe(1);
  });

  it('is left out under eighth-note triplets one beam joins', () => {
    expect(brackets('\\ts (4 4)\n11.3.8{tu 3} 12.3.8{tu 3} 14.3.8{tu 3} r.4 r.2 |\n')).toBe(0);
  });
});
