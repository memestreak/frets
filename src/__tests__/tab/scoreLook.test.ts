/**
 * What a score prints round the music, and how its lines are set: credits and tuning under the title,
 * a tuned-down guitar written as fingered, bar numbers, eighths beamed by the half bar in 4/4, and
 * lines run to the full width. See docs/specs/2026-10-28-tab-sweet-child-intro-design.md.
 */
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { creditsOf, headerValue, tuningBlock } from '@/features/tab/credits';
import { layoutClip } from '@/features/tab/layout';
import { beamGroups } from '@/features/tab/beams';
import { barHeads, openStrings, tuningShift, writtenStrings } from '@/features/tab/notation';
import {
  mix, paletteOf, parseAlphaTex, parseAscii, parseColours, parseNotation, sectionsOf, shownColours, showsBarNumber, viewOf, DEFAULT_VIEW,
} from '@/features/tab/viewOptions';
import { type Part, partOf } from '@/features/tab/clip';

const read = (text: string) => readAlphaTexWith(alphaTab, text);
function clipOf(text: string): Part {
  const result = read(text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return partOf(result.clip);
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
    expect(tuningBlock(['D', 'A', 'D', 'G', 'B', 'E'])).toEqual({ heading: 'Drop D tuning', strings: [{ number: 6, name: 'D' }] });
    expect(tuningBlock(['E', 'A', 'D', 'G', 'B', 'E'])).toBeNull();
  });

  it('names a common tuning over its strings, and leaves a tuning of its own unnamed', () => {
    expect(tuningBlock(['D', 'A', 'D', 'G', 'A', 'D'])!.heading).toBe('DADGAD tuning');
    expect(tuningBlock(['C#', 'G#', 'C#', 'F#', 'A#', 'D#'])!.heading).toBe('Drop C♯ tuning');
    expect(tuningBlock(['D', 'G', 'D', 'G', 'B', 'D'])!.heading).toBe('Open G tuning');
    expect(tuningBlock(['E', 'A', 'D', 'G', 'B', 'D'])!.heading).toBeNull();
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
  it('read each section saved, keeping only valid fields', () => {
    expect(parseNotation(null)).toEqual({ show: 'tab', barNumbers: 'every', size: 100, lineBreaks: false, header: true });
    expect(parseNotation({ show: 'both', barNumbers: 'lines', size: 70, lineBreaks: true, header: false }))
      .toEqual({ show: 'both', barNumbers: 'lines', size: 70, lineBreaks: true, header: false });
    expect(parseNotation({ show: 'score', barNumbers: 'odd', size: 75, lineBreaks: 'yes', header: 'no' }))
      .toEqual({ show: 'tab', barNumbers: 'every', size: 100, lineBreaks: false, header: true });
    expect([parseNotation({ size: 50 }).size, parseNotation({ size: 200 }).size, parseNotation({ size: 40 }).size, parseNotation({ size: 210 }).size])
      .toEqual([50, 200, 100, 100]);
    expect(parseColours(null)).toEqual({ scheme: 'theme', text: '#000000', background: '#ffffff' });
    expect(parseColours({ scheme: 'custom', text: '#7A1F1F', background: '#f4ecd8' })).toEqual({ scheme: 'custom', text: '#7a1f1f', background: '#f4ecd8' });
    expect(parseColours({ scheme: 'pink', text: 'red', background: '#fff' })).toEqual({ scheme: 'theme', text: '#000000', background: '#ffffff' });
    expect([parseAscii(null), parseAscii({ rhythm: false }), parseAscii({ rhythm: 'no' })]).toEqual([{ rhythm: true }, { rhythm: false }, { rhythm: true }]);
    expect([parseAlphaTex(null), parseAlphaTex({ lineNumbers: false }), parseAlphaTex({ lineNumbers: 0 })])
      .toEqual([{ lineNumbers: true }, { lineNumbers: false }, { lineNumbers: true }]);
  });

  it('put the four sections together as the view, and back', () => {
    const view = viewOf(parseNotation(null), parseColours(null), parseAscii(null), parseAlphaTex(null));
    expect(view).toEqual(DEFAULT_VIEW);
    const custom = { text: '#7a1f1f', background: '#f4ecd8' };
    const changed = { ...DEFAULT_VIEW, barNumbers: 'none' as const, colours: 'custom' as const, custom, asciiRhythm: false };
    const back = sectionsOf(changed, 'both');
    expect(back.notation.show).toBe('both');
    expect(viewOf(back.notation, back.colours, back.ascii, back.alphatex)).toEqual(changed);
  });

  it('show the theme\'s colours, a named scheme\'s or Custom\'s, and draw the lines as a mix of the two', () => {
    expect(shownColours(DEFAULT_VIEW)).toBeNull();
    expect(shownColours({ ...DEFAULT_VIEW, colours: 'sepia' })).toEqual({ text: '#3b2a1a', background: '#f4ecd8' });
    const custom = { text: '#7a1f1f', background: '#f4ecd8' };
    expect(shownColours({ ...DEFAULT_VIEW, colours: 'custom', custom })).toEqual(custom);
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(paletteOf({ text: '#000000', background: '#ffffff' })).toEqual({
      ink: '#000000', inkMuted: '#4d4d4d', lineStrong: '#8c8c8c', line: '#d1d1d1', paper: '#ffffff',
    });
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
