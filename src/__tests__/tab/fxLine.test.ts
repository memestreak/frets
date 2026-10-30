/**
 * Each track's FX as a `// frets:fx` comment line in its alphaTex (Jeremy, 2026-10-29; per track
 * 2026-10-30): under the track's `\track` line, or at the top for a clip of one track without one,
 * each part and setting checked on its own.
 */
import * as alphaTab from '@coderline/alphatab';
import { writeAlphaTex, writePart } from '@/features/tab/alphatex';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { clipReducer, sameMusic, type ClipState } from '@/features/tab/clipState';
import { parseClip, partOf, withPart, type Clip, type Part } from '@/features/tab/clip';
import { DEFAULT_FX, type FxSettings } from '@/features/tab/effects';
import { fxLine, readFxLine } from '@/features/tab/fxLine';

const FX: FxSettings = { on: true, distortionOn: false, drive: 0.8, tone: 0.25, reverbOn: true, reverb: 0.4, decay: 2.5 };
const LINE = '// frets:fx on; distortion off drive=0.8 tone=0.25; reverb on amount=0.4 decay=2.5';
const BARS = '\\title "Riff"\n\\ts (4 4)\n5.6.4 7.6.4 r.2 |\n';

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

describe('the FX line', () => {
  it('writes the FX button, then each effect with its switch and settings', () => {
    expect(fxLine(FX)).toBe(LINE);
    expect(fxLine(DEFAULT_FX)).toBe('// frets:fx off; distortion on drive=0.5 tone=0.5; reverb on amount=0.3 decay=1.5');
  });

  it('writes settings to two decimal places', () => {
    expect(fxLine({ ...FX, drive: 0.1 + 0.2, decay: 1.2345 })).toContain('drive=0.3 ');
    expect(fxLine({ ...FX, decay: 1.2345 })).toMatch(/decay=1\.23$/);
  });

  it('reads back what it writes', () => {
    expect(readFxLine(LINE.slice(2))).toEqual(FX);
  });

  it('is no FX line without its mark', () => {
    expect(readFxLine(' just a note to myself')).toBeNull();
    expect(readFxLine(' fx on')).toBeNull();
  });

  it('takes its default for a part or setting missing or wrong, in any order and case', () => {
    expect(readFxLine(' frets:fx')).toEqual(DEFAULT_FX);
    expect(readFxLine(' frets:fx ON; Reverb off decay=4 amount=1')).toEqual({ ...DEFAULT_FX, on: true, reverbOn: false, reverb: 1, decay: 4 });
    expect(readFxLine(' frets:fx maybe; distortion loud drive=2 tone=x; reverb on decay=99 amount'))
      .toEqual(DEFAULT_FX);
  });
});

describe('the FX in a clip\'s alphaTex', () => {
  it('reads the line into the clip and writes it back first', () => {
    const clip = clipOf(`${LINE}\n${BARS}`);
    expect(clip.fx).toEqual(FX);
    expect(writePart(clip)).toBe(`${LINE}\n${BARS}`);
  });

  it('writes no line for a clip whose FX were never set', () => {
    const clip = clipOf(BARS);
    expect(clip.fx).toBeUndefined();
    expect(writePart(clip)).toBe(BARS);
  });

  it('finds the line anywhere, the first when there are more, and not in a block comment', () => {
    const later = '// frets:fx off; reverb off';
    expect(clipOf(`\\title "Riff"\n${LINE}\n\\ts (4 4)\n5.6.4 7.6.4 r.2 | ${later}\n`).fx).toEqual(FX);
    expect(clipOf(`/* frets:fx on */\n${BARS}`).fx).toBeUndefined();
  });

  it('drops other comments, as before', () => {
    expect(writePart(clipOf(`// mine\n${BARS}`))).toBe(BARS);
  });
});

describe('each track\'s FX', () => {
  const TWO = (first: string, second: string) =>
    `\\title "Duo"\n\\track "Lead"\n${first}\\ts (4 4)\n5.6.4 7.6.4 r.2 |\n\\track "Rhythm"\n${second}3.6.2 r.2 |\n`;
  const OTHER: FxSettings = { ...DEFAULT_FX, on: true, reverbOn: false };
  const OTHER_LINE = '// frets:fx on; distortion on drive=0.5 tone=0.5; reverb off amount=0.3 decay=1.5';

  it('reads the line under each track\'s \\track as that track\'s, and writes it back there', () => {
    const text = TWO(`${LINE}\n`, `${OTHER_LINE}\n`);
    const clip = wholeOf(text);
    expect(clip.tracks.map(t => t.fx)).toEqual([FX, OTHER]);
    expect(writeAlphaTex(clip)).toBe(text);
  });

  it('gives a track no FX when only another has a line', () => {
    const clip = wholeOf(TWO('', `${OTHER_LINE}\n`));
    expect(clip.tracks.map(t => t.fx)).toEqual([undefined, OTHER]);
  });

  it('reads a line before any \\track as the first track\'s', () => {
    const clip = wholeOf(`${LINE}\n${TWO('', '')}`);
    expect(clip.tracks.map(t => t.fx)).toEqual([FX, undefined]);
    // Written back under the first track's \track.
    expect(writeAlphaTex(clip)).toBe(TWO(`${LINE}\n`, ''));
  });

  it('gives the part the shown track\'s FX, and an edit of them back to that track only', () => {
    const clip = wholeOf(TWO(`${LINE}\n`, `${OTHER_LINE}\n`));
    expect(partOf(clip, 1).fx).toEqual(OTHER);
    const louder = withPart(clip, { ...partOf(clip, 1), fx: { ...OTHER, drive: 0.9 } }, 1);
    expect(louder.tracks[0].fx).toBe(clip.tracks[0].fx);
    expect(louder.tracks[1].fx?.drive).toBe(0.9);
  });

  it('keeps a one-track clip with a \\track line\'s FX under it', () => {
    const text = `\\track "Lead"\n${LINE}\n\\ts (4 4)\n5.6.4 7.6.4 r.2 |\n`;
    expect(writeAlphaTex(wholeOf(text))).toBe(text);
  });
});

describe('the FX in a saved clip', () => {
  const clip = wholeOf(BARS);
  const withFx = (fx: unknown) => ({ ...clip, tracks: [{ ...clip.tracks[0], fx }] });

  it('keeps each track\'s, each setting checked', () => {
    expect(parseClip(withFx(FX))?.tracks[0].fx).toEqual(FX);
    expect(parseClip(withFx({ on: 'yes', drive: 0.7 }))?.tracks[0].fx).toEqual({ ...DEFAULT_FX, drive: 0.7 });
    expect(parseClip(clip)?.tracks[0].fx).toBeUndefined();
  });
});

describe('FX changes and undo', () => {
  const start: ClipState = { clip: wholeOf(BARS), past: [], future: [], id: 'a', example: null };

  it('makes a run of FX changes one undo step', () => {
    let state = clipReducer(start, { type: 'fx', track: 0, fx: { ...DEFAULT_FX, on: true } });
    state = clipReducer(state, { type: 'fx', track: 0, fx: { ...DEFAULT_FX, on: true, drive: 0.6 } });
    state = clipReducer(state, { type: 'fx', track: 0, fx: { ...DEFAULT_FX, on: true, drive: 0.7 } });
    expect(state.past).toHaveLength(1);
    expect(state.clip.tracks[0].fx?.drive).toBe(0.7);
    expect(clipReducer(state, { type: 'undo' }).clip).toBe(start.clip);
  });

  it('starts a new step after any other edit', () => {
    let state = clipReducer(start, { type: 'fx', track: 0, fx: { ...DEFAULT_FX, on: true } });
    state = clipReducer(state, { type: 'rename', name: 'Other' });
    state = clipReducer(state, { type: 'fx', track: 0, fx: { ...DEFAULT_FX, on: false } });
    expect(state.past).toHaveLength(3);
  });

  it('starts a new step when the FX of another track change', () => {
    const two = wholeOf('\\track "A"\n3.6.1 |\n\\track "B"\n5.6.1 |\n');
    let state: ClipState = { ...start, clip: two };
    state = clipReducer(state, { type: 'fx', track: 0, fx: { ...DEFAULT_FX, on: true } });
    state = clipReducer(state, { type: 'fx', track: 1, fx: { ...DEFAULT_FX, on: true } });
    expect(state.past).toHaveLength(2);
    expect(state.clip.tracks.map(t => t.fx?.on)).toEqual([true, true]);
  });

  it('tells a clip whose music changed from one whose FX alone did', () => {
    const a = start.clip;
    expect(sameMusic(a, { ...a, tracks: [{ ...a.tracks[0], fx: FX }] })).toBe(true);
    expect(sameMusic(a, { ...a, masterBars: [...a.masterBars] })).toBe(false);
    expect(sameMusic(a, { ...a, tracks: [{ ...a.tracks[0], capo: 2 }] })).toBe(false);
    expect(sameMusic(a, { ...a, tracks: [{ ...a.tracks[0], instrument: { program: 0 } }] })).toBe(true);
  });
});
