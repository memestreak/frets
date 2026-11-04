/**
 * The Pickup bar (step 4, `docs/specs/2026-11-04-tab-bars-always-full-design.md`): a first bar shorter
 * than its time signature on purpose, set in bar 1's time signature panel, written `\ac`.
 */
import { vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { writeAlphaTex, writeBars } from '@/features/tab/alphatex';
import { setPickup } from '@/features/tab/barEdits';
import { BarTimePanel } from '@/features/tab/BarTimePanel';
import { barErrors, barNumber, partOf, WHOLE, type Part } from '@/features/tab/clip';
import { TabClip } from '@/features/tab/TabClip';
import { writeGuitarProWith } from '@/features/tab/guitarPro';
import { writeMusicXml } from '@/features/tab/musicxml';
import { reBar, reBarEnd, writeOver } from '@/features/tab/timeline';

const Q = WHOLE / 4;
const E = WHOLE / 8;

function clipOf(text: string): Part {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return partOf(result.clip);
}
const bars = (part: Part) => writeBars(part).join(' ');
/** The clip with its Pickup bar set `length` long and the music re-barred, as the panel's field does. */
const withPickup = (part: Part, length: number) => reBar(part, setPickup(part, length), 0, reBarEnd(part, 0))!;

describe('the Pickup field', () => {
  const panel = (text: string) => {
    const onPickup = vi.fn();
    render(<BarTimePanel clip={clipOf(text)} bar={0} x={0} y={0} onChange={() => {}} onPickup={onPickup} onGroups={() => {}} onClose={() => {}} />);
    return onPickup;
  };

  it('counts whole beats from 0 to one less than the bar has: 0–3 in 4/4', () => {
    const onPickup = panel('\\ts (4 4)\n\\ac 1.1.4 2.1.4 3.1.4 | 4.1.1 |');
    expect(screen.getByRole('spinbutton', { name: 'Pickup bar, in beats' })).toHaveValue('3');
    fireEvent.click(screen.getByRole('button', { name: 'Longer pickup' }));
    expect(onPickup).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Shorter pickup' }));
    expect(onPickup).toHaveBeenCalledWith(2 * Q);
  });

  it('counts eighths in 6/8, up to 5; 0 is none, and a double-click puts it back to 0', () => {
    const onPickup = panel('\\ts (6 8)\n1.1.4{d} 2.1.4{d} |');
    expect(screen.getByRole('spinbutton', { name: 'Pickup bar, in beats' })).toHaveValue('0');
    fireEvent.click(screen.getByRole('button', { name: 'Shorter pickup' }));
    expect(onPickup).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Longer pickup' }));
    expect(onPickup).toHaveBeenLastCalledWith(E);
    fireEvent.doubleClick(screen.getByText('Pickup beats'));
    expect(onPickup).toHaveBeenLastCalledWith(0);
  });

  it('is only on bar 1’s panel', () => {
    render(<BarTimePanel clip={clipOf('\\ts (4 4)\n1.1.1 | 2.1.1 |')} bar={1} x={0} y={0} onChange={() => {}} onPickup={() => {}} onGroups={() => {}} onClose={() => {}} />);
    expect(screen.queryByRole('spinbutton', { name: 'Pickup bar, in beats' })).toBeNull();
  });
});

describe('a Pickup bar', () => {
  const clip = clipOf('\\ts (4 4)\n1.1.4 2.1.4 3.1.4 4.1.4 | 5.1.1 |');

  it('set to 1 beat in 4/4 is a quarter long, the music re-barred after it, with no ⚠', () => {
    const picked = withPickup(clip, Q);
    expect(bars(picked)).toBe('\\ac 1.1.4 | 2.1.4 3.1.4 4.1.4 5.1.4 | -.1.2{d} r.4 |');
    expect(barErrors(picked).size).toBe(0);
    // Set back to 0, the music re-bars again: the bar of rests the pickup left goes at the clip's end.
    expect(bars(withPickup(picked, 0))).toBe(bars(clip));
  });

  it('has no number: the next bar is bar 1, in the drawing too', () => {
    const picked = withPickup(clip, Q);
    expect([0, 1, 2].map(b => barNumber(picked, b))).toEqual([0, 1, 2]);
    const { container } = render(<TabClip clip={picked} width={2000} parts="tab" barNumbers="every" title="Pickup" />);
    expect([...container.querySelectorAll('[data-testid="bar-number"]')].map(n => n.textContent)).toEqual(['1', '2']);
  });

  it('counts as the end of a full bar: an eighth on its last eighth has an eighth rest before it', () => {
    const empty = setPickup(clipOf('\\ts (4 4)\nr.1 |'), Q);
    const typed = writeOver(empty, E, [{ duration: { value: 8, dots: 0 }, notes: [{ fret: 5 }, null, null, null, null, null] }])!;
    expect(bars(typed).split(' | ')[0]).toBe('\\ac r.8 5.1.8');
  });

  it('is written \\ac in alphaTex and read back', () => {
    const text = '\\ts (4 4)\n\\ac 5.1.4 | 1.1.1 |';
    const result = readAlphaTexWith(alphaTab, text);
    if (!result.ok) throw new Error(result.errors.join());
    expect(result.clip.masterBars[0].pickup).toBe(Q);
    expect(result.warnings).toEqual([]);
    expect(writeAlphaTex(result.clip)).toContain('\\ac 5.1.4 |');
  });

  it('is measure 0, implicit, in MusicXML, and an anacrusis in Guitar Pro', () => {
    const result = readAlphaTexWith(alphaTab, '\\ts (4 4)\n\\ac 5.1.4 | 1.1.1 |');
    if (!result.ok) throw new Error(result.errors.join());
    const doc = new DOMParser().parseFromString(writeMusicXml(result.clip), 'application/xml');
    const measures = [...doc.querySelectorAll('part:first-of-type > measure')];
    expect(measures.map(m => [m.getAttribute('number'), m.getAttribute('implicit')])).toEqual([['0', 'yes'], ['1', null]]);
    const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(writeGuitarProWith(alphaTab, result.clip), new alphaTab.Settings());
    expect(score.masterBars.map(m => m.isAnacrusis)).toEqual([true, false]);
  });

  it('keeps an imported pickup of part of a beat as it is', () => {
    expect(clipOf('\\ts (4 4)\n\\ac 5.1.8 | 1.1.1 |').bars[0].pickup).toBe(E);
  });
});
