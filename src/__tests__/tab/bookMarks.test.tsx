/**
 * Three marks drawn as printed guitar books have them (docs/specs/2026-10-29-tab-book-marks-design.md):
 * a picked bend's starting pitch in brackets on the staff (#176), dead notes as a capital X on the tab
 * (#177), and one pair of brackets round a ghost chord on the staff (#178).
 */
import { render } from '@testing-library/react';
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import type { Clip } from '@/features/tab/clip';
import { layoutClip, noteLabel, signRoom, type Parts } from '@/features/tab/layout';
import { barHeads } from '@/features/tab/notation';
import { TabClip } from '@/features/tab/TabClip';

function clipOf(text: string): Clip {
  const result = readAlphaTexWith(alphaTab, `\\ts (4 4)\n${text}\n`);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.clip;
}

const drawn = (text: string, parts: Parts) =>
  render(<TabClip clip={clipOf(text)} width={1200} parts={parts} title="Book marks" />).container;

const count = (container: Element, id: string) => container.querySelectorAll(`[data-testid="${id}"]`).length;

describe('a picked bend on the staff (#176)', () => {
  // 15 on the B string is a D; a full bend takes it up a step, to E.
  const BEND = '15.2{b (0 4)}.4 -.2{b (4 0)}.4 r.2 |';

  it('is drawn at the pitch it reaches, after the pitch it starts from', () => {
    const [[bent], [letDown]] = barHeads(clipOf(BEND), 0);
    expect(bent.bendFrom).toEqual({ step: bent.step - 1, shows: null });
    expect(bent.bendBack).toBeUndefined();
    // The tied note let down is back at the starting pitch, in brackets as before.
    expect(letDown).toMatchObject({ step: bent.step - 1, bent: true });
  });

  it('draws the starting head and its line in Both and Staff, with room before the note', () => {
    for (const parts of ['both', 'staff'] as const) {
      const container = drawn(BEND, parts);
      expect(count(container, 'staff-bend-from')).toBe(1);
      expect(count(container, 'staff-bend-line')).toBe(1);
    }
    expect(count(drawn(BEND, 'tab'), 'staff-bend-from')).toBe(0);
    const plain = layoutClip(clipOf('15.2.4 14.2.4 r.2 |'), 1200, 'both').systems[0].bars[0].columns[0];
    const bent = layoutClip(clipOf(BEND), 1200, 'both').systems[0].bars[0].columns[0];
    expect(signRoom(bent.heads)).toBeGreaterThan(0);
    expect(bent.x - bent.start).toBeGreaterThan(plain.x - plain.start);
  });

  it('spells the starting pitch with its own accidental, which then holds in the bar', () => {
    // 8 on the G string is a D#; a half bend takes it to E.
    const [[bent], [after]] = barHeads(clipOf('8.3{b (0 2)}.4 8.3.4 r.2 |'), 0);
    expect(bent.bendFrom).toEqual({ step: bent.step - 1, shows: 1 });
    expect(bent.shows).toBeNull();
    expect(after.shows).toBeNull();
  });

  it('let down in the same note, comes back to a bracketed head after it, under a tab only', () => {
    const text = '7.1{b (0 2 0)}.4 r.4 r.2 |';
    const [[bent]] = barHeads(clipOf(text), 0);
    expect(bent.bendBack).toEqual({ step: bent.bendFrom!.step, shows: null });
    expect(count(drawn(text, 'both'), 'staff-bend-back')).toBe(1);
    expect(count(drawn(text, 'both'), 'staff-bend-line')).toBe(2);
    // The staff alone draws the bend's arrow down instead.
    expect(count(drawn(text, 'staff'), 'staff-bend-back')).toBe(0);
  });

  it('a let-down bend that stops part of the way comes back to where it stops', () => {
    // D bent up to E and let down to D#.
    const [[bent]] = barHeads(clipOf('15.2{b (0 4 2)}.4 r.4 r.2 |'), 0);
    expect(bent.bendBack).toEqual({ step: bent.bendFrom!.step, shows: 1 });
  });

  it('is not given to a pre-bend, a tied note, a grace note bent up, or a quarter-tone bend', () => {
    const heads = barHeads(clipOf('15.2{b (4 4)}.4 15.2.8{gr} -.2{b (0 4)}.4 -.2{b (4 4)}.4 15.2{b (0 1)}.4 |'), 0);
    expect(heads.flat().filter(h => h.bendFrom)).toEqual([]);
  });
});

describe('a dead note on the tab (#177)', () => {
  it('is a capital X, in brackets when it is a ghost note', () => {
    expect(noteLabel({ fret: null })).toBe('X');
    expect(noteLabel({ fret: null, ghost: true })).toBe('(X)');
    const numbers = [...drawn('x.3.4 x.4{g}.4 5.3.2 |', 'tab').querySelectorAll('[data-testid="tab-column"] text')].map(t => t.textContent);
    expect(numbers).toEqual(['X', '(X)', '5']);
  });

  it('keeps its × head on the staff', () => {
    expect(barHeads(clipOf('x.3.4 r.4 r.2 |'), 0)[0][0].dead).toBe(true);
  });
});

describe('a ghost chord on the staff (#178)', () => {
  it('gets one pair of brackets round its heads, and the tab brackets each number', () => {
    const container = drawn('(5.4{g} 3.5{g}).4 r.4 r.2 |', 'both');
    expect(count(container, 'staff-ghost-chord')).toBe(1);
    expect(count(container, 'staff-ghost')).toBe(0);
    const numbers = [...container.querySelectorAll('[data-testid="tab-column"] text')].map(t => t.textContent);
    expect(numbers).toEqual(['(5)', '(3)']);
  });

  it('brackets each head when its notes are far apart, or not all ghost notes', () => {
    // An E an octave and more under a G: too far apart for one pair.
    const wide = drawn('(3.1{g} 0.6{g}).4 r.4 r.2 |', 'staff');
    expect(count(wide, 'staff-ghost-chord')).toBe(0);
    expect(count(wide, 'staff-ghost')).toBe(2);
    const mixed = drawn('(5.4{g} 3.5).4 r.4 r.2 |', 'staff');
    expect(count(mixed, 'staff-ghost-chord')).toBe(0);
    expect(count(mixed, 'staff-ghost')).toBe(1);
  });
});
