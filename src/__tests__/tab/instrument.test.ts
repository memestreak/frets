/**
 * The clip's instrument (Jeremy, 2026-10-29): the Sound stored as alphaTex's `\instrument`, and the
 * nearest of Frets' three sounds for one it doesn't have, kept as written.
 */
import * as alphaTab from '@coderline/alphatab';
import { writeAlphaTex, writePart } from '@/features/tab/alphatex';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { sameMusic } from '@/features/tab/clipState';
import { parseClip, partOf, withPart, type Clip, type Part } from '@/features/tab/clip';
import { instrumentName, instrumentTag, keepsGuitarTuning, soundFor, substituteNote } from '@/features/tab/instrument';
import { perform } from '@/features/tab/playback';

const BARS = '\\ts (4 4)\n5.6.4 7.6.4 r.2 |\n';

function wholeOf(text: string): Clip {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.clip;
}

function clipOf(text: string): Part {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return partOf(result.clip);
}

describe('the sound for an instrument', () => {
  it('is the instrument itself when Frets has it, the steel guitar when none is named', () => {
    expect([0, 25, 27].map(soundFor)).toEqual([0, 25, 27]);
    expect(soundFor(undefined)).toBe(25);
  });

  it('is the nearest by family otherwise', () => {
    // Jazz, muted, overdriven, distortion and harmonics play as the clean electric.
    expect([26, 28, 29, 30, 31].map(soundFor)).toEqual([27, 27, 27, 27, 27]);
    // Pianos, keys and organs as the piano.
    expect([1, 4, 7, 16, 19, 23].map(soundFor)).toEqual([0, 0, 0, 0, 0, 0]);
    // The rest, nylon guitar and banjo too, as the steel guitar.
    expect([24, 8, 15, 33, 40, 56, 105, 127].map(soundFor)).toEqual([25, 25, 25, 25, 25, 25, 25, 25]);
  });

  it('says what it stands in for', () => {
    expect(substituteNote(30)).toBe('This arrangement asks for Distortion Guitar; Frets plays Clean Electric Guitar.');
    expect(substituteNote(40)).toBe('This arrangement asks for Violin; Frets plays Steel Guitar.');
    expect(substituteNote(27)).toBeNull();
    expect(substituteNote(undefined)).toBeNull();
    expect(instrumentName(127)).toBe('Gunshot');
  });

  it('writes Frets\' three by alphaTex\'s names', () => {
    expect([0, 25, 27].map(instrumentTag)).toEqual([
      '\\instrument acousticgrandpiano', '\\instrument acousticguitarsteel', '\\instrument electricguitarclean',
    ]);
  });

  it('keeps the guitar\'s tuning only for the guitars', () => {
    expect([23, 24, 31, 32].map(keepsGuitarTuning)).toEqual([false, true, true, false]);
  });
});

describe('the instrument in a clip\'s alphaTex', () => {
  it('reads the tag into the clip and writes it back as written', () => {
    const clip = clipOf(`\\instrument distortionguitar\n${BARS}`);
    expect(clip.instrument).toEqual({ program: 30, tag: '\\instrument distortionguitar' });
    expect(clip.header).toBeUndefined();
    expect(writePart(clip)).toBe(`\\instrument distortionguitar\n${BARS}`);
  });

  it('warns of a name alphaTab doesn\'t know, which it reads as the piano', () => {
    const result = readAlphaTexWith(alphaTab, `\\instrument banana\n${BARS}`);
    expect(result.ok && result.warnings).toEqual(['Frets doesn\'t know the instrument banana; it plays as Acoustic Grand Piano.']);
    const piano = readAlphaTexWith(alphaTab, `\\instrument acousticgrandpiano\n${BARS}`);
    expect(piano.ok && piano.warnings).toEqual([]);
  });

  it('writes no instrument for a clip that names none', () => {
    const clip = clipOf(BARS);
    expect(clip.instrument).toBeUndefined();
    expect(writePart(clip)).toBe(BARS);
  });

  it('reads a piano with no tuning as guitar tab in standard tuning, and writes the tuning with it', () => {
    // alphaTab gives a piano no strings, so this wouldn't read at all.
    const clip = clipOf(`\\instrument acousticgrandpiano\n${BARS}`);
    expect(clip.instrument?.program).toBe(0);
    expect(clip.tuning).toEqual(['E', 'A', 'D', 'G', 'B', 'E']);
    const written = writePart(clip);
    expect(written).toBe(`\\instrument acousticgrandpiano\n\\ts (4 4)\n\\tuning (E4 B3 G3 D3 A2 E2)\n5.6.4 7.6.4 r.2 |\n`);
    expect(clipOf(written)).toEqual(clip);
  });

  it('keeps refusing a bass or violin\'s own four strings', () => {
    const result = readAlphaTexWith(alphaTab, `\\instrument 40\n${BARS}`);
    expect(result.ok).toBe(false);
    expect(readAlphaTexWith(alphaTab, `\\instrument 40\n\\tuning (E4 B3 G3 D3 A2 E2)\n${BARS}`).ok).toBe(true);
  });

  it('takes the program of a kept \\track line that names one, without a tag of its own', () => {
    const whole = wholeOf(`\\track "Lead" { instrument 29 }\n${BARS}`);
    const clip = partOf(whole);
    expect(clip.instrument).toEqual({ program: 29 });
    expect(writeAlphaTex(whole)).toBe(`\\track "Lead" { instrument 29 }\n${BARS}`);
    // A Sound picked writes its tag after it, which wins.
    const picked = withPart(whole, { ...clip, instrument: { program: 27, tag: instrumentTag(27) } });
    expect(clipOf(writeAlphaTex(picked)).instrument?.program).toBe(27);
  });

  it('plays the substitute, whatever the clip names', () => {
    const clip = clipOf(`\\instrument distortionguitar\n${BARS}`);
    const programs = perform(alphaTab, clip, soundFor(clip.instrument?.program), { clicks: false }).midi.events
      .filter(e => e.type === alphaTab.midi.MidiEventType.ProgramChange)
      .map(e => (e as unknown as { program: number }).program);
    expect(new Set(programs)).toEqual(new Set([27]));
  });
});

describe('the instrument in a saved clip', () => {
  const clip = clipOf(BARS);
  const whole = wholeOf(BARS);
  const withSound = (instrument: unknown) => ({ ...whole, tracks: [{ ...whole.tracks[0], instrument }] });
  it('is checked', () => {
    expect(parseClip(withSound({ program: 30, tag: '\\instrument 30' }))?.tracks[0].instrument).toEqual({ program: 30, tag: '\\instrument 30' });
    expect(parseClip(withSound({ program: 128 }))).toBeNull();
    expect(parseClip(withSound({ program: 27, tag: 3 }))).toBeNull();
  });

  it('is no change to the music: a new sound doesn\'t stop playback', () => {
    expect(sameMusic(clip, { ...clip, instrument: { program: 0 } })).toBe(true);
  });
});
