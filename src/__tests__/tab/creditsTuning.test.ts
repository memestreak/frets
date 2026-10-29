/**
 * Setting the artist, credits and tuning from the score's head (issues #202, #203): the header lines
 * written back, and the tunings offered. See docs/specs/2026-10-29-tab-credits-tuning-design.md.
 */
import * as alphaTab from '@coderline/alphatab';
import { writeAlphaTex } from '@/features/tab/alphatex';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { STANDARD_TUNING, type Clip } from '@/features/tab/clip';
import { creditsOf, headerValue, setCredit, tuningBlock } from '@/features/tab/credits';
import { presetOf, stringNote, TUNING_PRESETS, withStringNote, withTuning } from '@/features/tab/tuning';

function clipOf(text: string): Clip {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.clip;
}
const RIFF = '0.6.4 3.6.4 5.6.2 |';

describe('setCredit', () => {
  it('adds a credit in the order a score prints them, after the credits before it', () => {
    let clip = clipOf(`\\music "Ann"\n${RIFF}`);
    clip = setCredit(clip, 'artist', 'Band');
    clip = setCredit(clip, 'words', 'Bob');
    expect(clip.header).toEqual(['\\artist "Band"', '\\words "Bob"', '\\music "Ann"']);
    expect(creditsOf(clip)).toEqual({ artist: 'Band', lines: ['Words by Bob', 'Music by Ann'] });
  });

  it('keeps every other header line as written, and a credit whose value is unchanged', () => {
    const clip = clipOf(`\\subtitle  'Live'\n\\artist  'Guns N\\' Roses'\n${RIFF}`);
    expect(setCredit(clip, 'artist', "Guns N' Roses ")).toBe(clip);
    const next = setCredit(clip, 'artist', 'GN\'R "live"');
    expect(next.header).toEqual(["\\subtitle  'Live'", '\\artist "GN\'R \\"live\\""']);
    expect(headerValue(next, 'artist')).toBe('GN\'R "live"');
  });

  it('takes the tag away when the field is cleared, and the header with its last line', () => {
    const clip = clipOf(`\\artist "Band"\n${RIFF}`);
    const cleared = setCredit(clip, 'artist', '  ');
    expect(cleared.header).toBeUndefined();
    expect(writeAlphaTex(cleared)).not.toContain('\\artist');
  });

  it('reads back as written', () => {
    const clip = setCredit(setCredit(clipOf(RIFF), 'words', 'A & B'), 'music', 'A & B');
    const back = clipOf(writeAlphaTex(clip));
    expect(creditsOf(back)).toEqual({ artist: null, lines: ['Words & Music by A & B'] });
  });
});

describe('tuning', () => {
  it('names the preset a tuning is, however its notes are spelled', () => {
    expect(presetOf(STANDARD_TUNING)?.name).toBe('Standard');
    expect(presetOf(['Eb', 'Ab', 'Db', 'Gb', 'Bb', 'Eb'])?.name).toBe('E♭');
    expect(presetOf(['D', 'A', 'D', 'G', 'B', 'E'])?.name).toBe('Drop D');
    expect(presetOf(['C', 'A', 'D', 'G', 'B', 'E'])).toBeNull();
  });

  it('names each string as the head does: flat when tuned down, sharp when tuned up', () => {
    const eFlat = TUNING_PRESETS.find(p => p.name === 'E♭')!.notes;
    expect(stringNote(eFlat, 0)).toBe('Eb');
    expect(stringNote(['F', 'A', 'D', 'G', 'B', 'E'], 0)).toBe('F');
    expect(stringNote(['F#', 'A', 'D', 'G', 'B', 'E'], 0)).toBe('F#');
    expect(stringNote(STANDARD_TUNING, 5)).toBe('E');
  });

  it('keeps every fret when the tuning changes, and is no change when the pitches are the same', () => {
    const clip = clipOf(RIFF);
    const dropD = withTuning(clip, ['D', 'A', 'D', 'G', 'B', 'E']);
    expect(dropD.bars).toBe(clip.bars);
    expect(dropD.tuning).toEqual(['D', 'A', 'D', 'G', 'B', 'E']);
    expect(withTuning(dropD, ['D', 'A', 'D', 'G', 'B', 'E'])).toBe(dropD);
    expect(withTuning(clip, STANDARD_TUNING)).toBe(clip);
  });

  it('sets one string, spelling it with a sharp as the clip reads a tuning', () => {
    const clip = withStringNote(clipOf(RIFF), 0, 'Db');
    expect(clip.tuning).toEqual(['C#', 'A', 'D', 'G', 'B', 'E']);
    expect(tuningBlock(clip.tuning)?.strings).toEqual([{ number: 6, name: 'D♭' }]);
  });

  it('writes every preset so it reads back as itself, standard tuning as no tag at all', () => {
    for (const preset of TUNING_PRESETS) {
      const text = writeAlphaTex(withTuning(clipOf(RIFF), preset.notes));
      expect(text.includes('\\tuning')).toBe(preset.name !== 'Standard');
      expect(presetOf(clipOf(text).tuning)).toBe(preset);
    }
  });
});
