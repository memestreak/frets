/**
 * The clip's FX as a `// frets:fx` comment line in its alphaTex (Jeremy, 2026-10-29): written at the
 * top, read wherever it is, each part and setting checked on its own.
 */
import * as alphaTab from '@coderline/alphatab';
import { writeAlphaTex } from '@/features/tab/alphatex';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { clipReducer, sameMusic, type ClipState } from '@/features/tab/clipState';
import { parseClip, type Clip } from '@/features/tab/clip';
import { DEFAULT_FX, type FxSettings } from '@/features/tab/effects';
import { fxLine, readFxLine } from '@/features/tab/fxLine';

const FX: FxSettings = { on: true, distortionOn: false, drive: 0.8, tone: 0.25, reverbOn: true, reverb: 0.4, decay: 2.5 };
const LINE = '// frets:fx on; distortion off drive=0.8 tone=0.25; reverb on amount=0.4 decay=2.5';
const BARS = '\\title "Riff"\n\\ts (4 4)\n5.6.4 7.6.4 r.2 |\n';

function clipOf(text: string): Clip {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.clip;
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
    expect(writeAlphaTex(clip)).toBe(`${LINE}\n${BARS}`);
  });

  it('writes no line for a clip whose FX were never set', () => {
    const clip = clipOf(BARS);
    expect(clip.fx).toBeUndefined();
    expect(writeAlphaTex(clip)).toBe(BARS);
  });

  it('finds the line anywhere, the first when there are more, and not in a block comment', () => {
    const later = '// frets:fx off; reverb off';
    expect(clipOf(`\\title "Riff"\n${LINE}\n\\ts (4 4)\n5.6.4 7.6.4 r.2 | ${later}\n`).fx).toEqual(FX);
    expect(clipOf(`/* frets:fx on */\n${BARS}`).fx).toBeUndefined();
  });

  it('drops other comments, as before', () => {
    expect(writeAlphaTex(clipOf(`// mine\n${BARS}`))).toBe(BARS);
  });
});

describe('the FX in a saved clip', () => {
  const clip = clipOf(BARS);

  it('keeps them, each setting checked', () => {
    expect(parseClip({ ...clip, fx: FX })?.fx).toEqual(FX);
    expect(parseClip({ ...clip, fx: { on: 'yes', drive: 0.7 } })?.fx).toEqual({ ...DEFAULT_FX, drive: 0.7 });
    expect(parseClip(clip)?.fx).toBeUndefined();
  });
});

describe('FX changes and undo', () => {
  const start: ClipState = { clip: clipOf(BARS), past: [], future: [], id: 'a', example: null };

  it('makes a run of FX changes one undo step', () => {
    let state = clipReducer(start, { type: 'fx', fx: { ...DEFAULT_FX, on: true } });
    state = clipReducer(state, { type: 'fx', fx: { ...DEFAULT_FX, on: true, drive: 0.6 } });
    state = clipReducer(state, { type: 'fx', fx: { ...DEFAULT_FX, on: true, drive: 0.7 } });
    expect(state.past).toHaveLength(1);
    expect(state.clip.fx?.drive).toBe(0.7);
    expect(clipReducer(state, { type: 'undo' }).clip).toBe(start.clip);
  });

  it('starts a new step after any other edit', () => {
    let state = clipReducer(start, { type: 'fx', fx: { ...DEFAULT_FX, on: true } });
    state = clipReducer(state, { type: 'rename', name: 'Other' });
    state = clipReducer(state, { type: 'fx', fx: { ...DEFAULT_FX, on: false } });
    expect(state.past).toHaveLength(3);
  });

  it('tells a clip whose music changed from one whose FX alone did', () => {
    const a = start.clip;
    expect(sameMusic(a, { ...a, fx: FX })).toBe(true);
    expect(sameMusic(a, { ...a, bars: [...a.bars] })).toBe(false);
    expect(sameMusic(a, { ...a, capo: 2 })).toBe(false);
  });
});
