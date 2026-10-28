/**
 * A bend held over tied notes and let down (b (4 4) and b (4 0) on a tie), as Guitar Pro writes it:
 * read, written back exactly, drawn as one bend on the tab and at the bent pitch on the staff, and played.
 */
import * as alphaTab from '@coderline/alphatab';
import { writeAlphaTex } from '@/features/tab/alphatex';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { bendCarries, bentSemitones, type Clip } from '@/features/tab/clip';
import { barHeads } from '@/features/tab/notation';
import { perform } from '@/features/tab/playback';
import { TabClip } from '@/features/tab/TabClip';
import { render } from '@testing-library/react';

const TEXT = [
  '\\ts (4 4)',
  '17.1.8{gr} -.1{b (0 4) v}.2 -.1{b (4 4) v}.4 -.1{b (4 0)}.8 15.1.8 |',
].join('\n') + '\n';

function clipOf(text: string): Clip {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.clip;
}

const notesOn1 = (clip: Clip) => clip.bars[0].columns.map(c => c.notes[0]!);

describe('a held bend', () => {
  it('reads with no warnings and writes back exactly', () => {
    const result = readAlphaTexWith(alphaTab, TEXT);
    expect(result.ok && result.warnings).toEqual([]);
    expect(writeAlphaTex(clipOf(TEXT))).toBe(TEXT);
  });

  it('carries the bend on over the ties: held, then let down', () => {
    const clip = clipOf(TEXT);
    const notes = notesOn1(clip);
    const carries = bendCarries(clip);
    expect(notes.map(n => carries.get(n) ?? null)).toEqual([null, null, 'hold', 'release', null]);
    expect(notes.map(bentSemitones)).toEqual([0, 2, 2, 0, 0]);
  });

  it('is no carry when the note before is not bent: a tied pre-bend stays a pre-bend', () => {
    const clip = clipOf('\\ts (4 4)\n7.3.2 -.3{b (4 4)}.2 |\n');
    expect(bendCarries(clip).size).toBe(0);
  });

  it('puts the tied notes on the staff at the pitch the bend reaches, in brackets, spelled in the key', () => {
    const clip = clipOf('\\ts (4 4)\n\\ks G 17.1.8{gr} -.1{b (0 4)}.2 -.1{b (4 4)}.4 -.1{b (4 0)}.8 15.1.8 |\n');
    const heads = barHeads(clip, 0).map(h => h[0]);
    // A6, then B6 (bent) twice, then A6 (let down), then G6: guitar is written an octave above how it sounds.
    expect(heads.map(h => h.step)).toEqual([17, 18, 18, 17, 16]);
    expect(heads.map(h => h.bent ?? false)).toEqual([false, true, true, true, false]);
    // B and A are in G major: no signs.
    expect(heads.map(h => h.shows)).toEqual([null, null, null, null, null]);
  });

  it('plays as one picked note, bent up, held and let down', () => {
    const { midi } = perform(alphaTab, clipOf(TEXT), undefined, { clicks: false });
    const ons = midi.events.filter(e => e instanceof alphaTab.midi.NoteOnEvent) as alphaTab.midi.NoteOnEvent[];
    expect(ons.map(e => e.noteKey)).toEqual([81, 79]);
    const bends = (midi.events.filter(e => e instanceof alphaTab.midi.PitchBendEvent) as alphaTab.midi.PitchBendEvent[])
      .filter(e => e.channel === ons[0].channel).map(e => e.value);
    const peak = Math.max(...bends);
    expect(peak).toBeGreaterThan(8192);
    expect(bends[bends.length - 1]).toBe(8192);
  });

  it('draws one bend on the tab: the arrow, a dashed hold, and a release with no number', () => {
    const { container } = render(<TabClip clip={clipOf(TEXT)} width={800} parts="both" title="Held bends" />);
    expect(container.querySelectorAll('[data-testid="bend"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-testid="bend-hold"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-testid="bend-release"]')).toHaveLength(1);
    const numbers = [...container.querySelectorAll('[data-testid="tab-column"] text')].map(t => t.textContent);
    // The grace 17, the bent (17), the held (17), then 15: under the staff a held note is named within
    // the bar only under vibrato, as here (the book's bar 113), and the let-down note has none.
    expect(numbers.filter(n => /\d/.test(n ?? ''))).toEqual(['17', '(17)', '(17)', '15']);
    expect(container.querySelectorAll('[data-testid="staff-bent"]')).toHaveLength(3);
  });

  it('names the held note on the tab alone', () => {
    const { container } = render(<TabClip clip={clipOf(TEXT)} width={800} parts="tab" title="Held bends" />);
    const numbers = [...container.querySelectorAll('[data-testid="tab-column"] text')].map(t => t.textContent);
    expect(numbers.filter(n => /\d/.test(n ?? ''))).toEqual(['17', '(17)', '(17)', '15']);
  });
});
