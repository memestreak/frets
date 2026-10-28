/**
 * What a score prints round the music, and how its lines are set: credits and tuning under the title,
 * a tuned-down guitar written as fingered, bar numbers, eighths beamed by the half bar in 4/4, and
 * lines run to the full width. See docs/specs/2026-10-28-tab-sweet-child-intro-design.md.
 */
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import type { Clip } from '@/features/tab/clip';
import { creditsOf, headerValue, tuningBlock } from '@/features/tab/credits';
import { beamGroups, layoutClip } from '@/features/tab/layout';
import { barHeads, openStrings, tuningShift, writtenStrings } from '@/features/tab/notation';
import { parseView, showsBarNumber } from '@/features/tab/viewOptions';

const read = (text: string) => readAlphaTexWith(alphaTab, text);
function clipOf(text: string): Clip {
  const result = read(text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.clip;
}
const E_FLAT = '\\tuning (D#4 A#3 F#3 C#3 G#2 D#2)';
const EIGHTS = '12.4.8 15.2.8 14.3.8 12.3.8 15.1.8 14.3.8 14.1.8 14.3.8 |';

describe('credits', () => {
  it('reads the artist and says "Words & Music by" when one set of people wrote both', () => {
    const clip = clipOf(`\\title "Song"\n\\artist "Band"\n\\words "A & B"\n\\music "A & B"\n${EIGHTS}`);
    expect(creditsOf(clip)).toEqual({ artist: 'Band', lines: ['Words & Music by A & B'] });
  });

  it('says words and music apart when different people wrote them, and reads single quotes', () => {
    const clip = clipOf(`\\words 'Ann'\n\\music "Bo"\n${EIGHTS}`);
    expect(creditsOf(clip)).toEqual({ artist: null, lines: ['Words by Ann', 'Music by Bo'] });
    expect(headerValue(clip, 'artist')).toBeNull();
    // Kept as written, closing quote and all.
    expect(clip.header).toEqual(["\\words 'Ann'", '\\music "Bo"']);
  });

  it('are drawn, so reading them warns of nothing', () => {
    const result = read(`\\artist "Band"\n\\words "A"\n\\music "B"\n${EIGHTS}`);
    expect(result.ok && result.warnings).toEqual([]);
  });
});

describe('the tuning block', () => {
  it('says "Tune down 1/2 step" and names every string with a flat for E♭ tuning', () => {
    expect(tuningBlock(['D#', 'G#', 'C#', 'F#', 'A#', 'D#'])).toEqual({
      heading: 'Tune down 1/2 step',
      strings: [
        { number: 1, name: 'E♭' }, { number: 2, name: 'B♭' }, { number: 3, name: 'G♭' },
        { number: 4, name: 'D♭' }, { number: 5, name: 'A♭' }, { number: 6, name: 'E♭' },
      ],
    });
  });

  it('says whole steps, and lists only the retuned strings when they are tuned apart', () => {
    expect(tuningBlock(['D', 'G', 'C', 'F', 'A', 'D'])!.heading).toBe('Tune down 1 step');
    expect(tuningBlock(['D', 'A', 'D', 'G', 'B', 'E'])).toEqual({ heading: null, strings: [{ number: 6, name: 'D' }] });
    expect(tuningBlock(['E', 'A', 'D', 'G', 'B', 'E'])).toBeNull();
  });
});

describe('the staff for a tuned-down guitar', () => {
  it('is written as if in standard tuning when every string is tuned alike', () => {
    const tuning = ['D#', 'G#', 'C#', 'F#', 'A#', 'D#'];
    expect(tuningShift(tuning)).toBe(-1);
    expect(writtenStrings(tuning)).toEqual(openStrings(['E', 'A', 'D', 'G', 'B', 'E']));
  });

  it('is written as it sounds for drop D, whose strings are tuned apart', () => {
    const tuning = ['D', 'A', 'D', 'G', 'B', 'E'];
    expect(tuningShift(tuning)).toBe(0);
    expect(writtenStrings(tuning)).toEqual(openStrings(tuning));
  });

  it('writes the fourth string\'s 12th fret as the D the book prints, not the C♯ it sounds', () => {
    const tuned = clipOf(`${E_FLAT}\n\\ks G 12.4.4 |`);
    const standard = clipOf('\\ks G 12.4.4 |');
    expect(barHeads(tuned, 0)[0][0]).toEqual(barHeads(standard, 0)[0][0]);
  });
});

describe('view options', () => {
  it('start on bar numbers over every bar at 100%, and keep only a valid saved choice', () => {
    expect(parseView(null)).toEqual({ barNumbers: 'every', size: 100 });
    expect(parseView({ barNumbers: 'lines', size: 70 })).toEqual({ barNumbers: 'lines', size: 70 });
    expect(parseView({ barNumbers: 'odd', size: 75 })).toEqual({ barNumbers: 'every', size: 100 });
    expect([parseView({ size: 50 }).size, parseView({ size: 200 }).size, parseView({ size: 40 }).size, parseView({ size: 210 }).size])
      .toEqual([50, 200, 100, 100]);
  });

  it('number every bar, the first of each line, or none', () => {
    expect([showsBarNumber('every', false), showsBarNumber('lines', false), showsBarNumber('lines', true), showsBarNumber('none', true)])
      .toEqual([true, false, true, false]);
  });
});

describe('beams', () => {
  it('join plain eighths four at a time in 4/4, by the half bar', () => {
    const bar = layoutClip(clipOf(EIGHTS), 800).systems[0].bars[0];
    expect(beamGroups(bar, bar.beat).map(g => g.columns.map(c => c.index))).toEqual([[0, 1, 2, 3], [4, 5, 6, 7]]);
  });

  it('stay by the beat in 2/4, and where a beat has sixteenths', () => {
    const two = layoutClip(clipOf('\\ts (2 4) 1.1.8 1.1.8 1.1.8 1.1.8 |'), 800).systems[0].bars[0];
    expect(beamGroups(two, two.beat).map(g => g.columns.length)).toEqual([2, 2]);
    const mixed = layoutClip(clipOf('1.1.8 1.1.8 1.1.16 1.1.16 1.1.8 r.2 |'), 800).systems[0].bars[0];
    expect(beamGroups(mixed, mixed.beat).map(g => g.columns.length)).toEqual([2, 3]);
  });
});

describe('lines', () => {
  it('run to the full width but the last, which spreads only as much as the line before', () => {
    const clip = clipOf(Array(5).fill(EIGHTS).join('\n'));
    const { systems } = layoutClip(clip, 700);
    expect(systems.length).toBeGreaterThan(1);
    const ends = systems.map(s => s.bars[s.bars.length - 1].x1);
    for (const end of ends.slice(0, -1)) expect(end).toBeCloseTo(700, 5);
    expect(ends[ends.length - 1]).toBeLessThanOrEqual(700 + 1e-6);
  });
});
