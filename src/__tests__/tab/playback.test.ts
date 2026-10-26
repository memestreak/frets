/**
 * Playback's pure part: the clip as alphaTab's score and MIDI, and the way between its ticks and
 * the clip's columns. The sound itself needs a browser. See docs/specs/2026-10-26-tab-playback-design.md.
 */
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import type { Clip } from '@/features/tab/clip';
import { columnAtTick, DEFAULT_SOUND, isSound, perform, SOUND_FAMILIES, tickOf, ticksOf } from '@/features/tab/playback';
import { parsePlaybackSettings } from '@/features/tab/PlaybackFooter';

function clipOf(text: string): Clip {
  const result = readAlphaTexWith(alphaTab, text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.clip;
}

/** alphaTab's ticks: 960 to a quarter note. */
const Q = 960;

/** The programs the MIDI sets, from its program changes. */
function programsOf(midi: alphaTab.midi.MidiFile): number[] {
  return midi.events
    .filter(e => e.type === alphaTab.midi.MidiEventType.ProgramChange)
    .map(e => (e as alphaTab.midi.ProgramChangeEvent).program);
}

describe('playback sounds', () => {
  it('offers the General MIDI sounds but the synth effects, percussion and sound effects families', () => {
    const programs = SOUND_FAMILIES.flatMap(([, sounds]) => sounds.map(([program]) => program));
    expect(programs).toHaveLength(104);
    expect(programs.some(p => p >= 112 || (p >= 96 && p <= 103))).toBe(false);
    expect(isSound(25) && isSound(0) && isSound(111)).toBe(true);
    expect(isSound(100) || isSound(115) || isSound(127) || isSound('25')).toBe(false);
  });

  it('plays the clip in the sound chosen, whatever its alphaTex names', () => {
    const clip = clipOf('0.6.4 2.6.4 3.6.2 | 5.6.1 |');
    expect(new Set(programsOf(perform(alphaTab, clip).midi))).toEqual(new Set([DEFAULT_SOUND]));
    expect(new Set(programsOf(perform(alphaTab, clip, 40).midi))).toEqual(new Set([40]));
  });

  it('reads the saved settings, each field checked', () => {
    expect(parsePlaybackSettings(null)).toEqual({ shown: false, sound: DEFAULT_SOUND, volume: 1 });
    expect(parsePlaybackSettings({ shown: true, sound: 0, volume: 0.4 })).toEqual({ shown: true, sound: 0, volume: 0.4 });
    expect(parsePlaybackSettings({ shown: 'yes', sound: 115, volume: 2 })).toEqual({ shown: false, sound: DEFAULT_SOUND, volume: 1 });
  });
});

describe('playback', () => {
  it('plays each column at its tick, and finds the column sounding at any tick', () => {
    const clip = clipOf('0.6.4 2.6.4 3.6.2 | 5.6.1 |');
    const played = perform(alphaTab, clip);
    expect(played.endTick).toBe(8 * Q);
    expect([0, 1, 2, 3].map(i => tickOf(clip, played, i))).toEqual([0, Q, 2 * Q, 4 * Q]);
    expect(columnAtTick(clip, played, Q + 10)).toBe(1);
    expect(columnAtTick(clip, played, 5 * Q)).toBe(3);
  });

  it('lets the last notes ring a little after the clip ends', () => {
    const clip = clipOf('0.6.4 2.6.4 3.6.2 | 5.6.1 |');
    const played = perform(alphaTab, clip);
    const lastTick = Math.max(...played.midi.events.map(e => e.tick));
    expect(lastTick).toBe(played.endTick + 2 * Q);
  });

  it('plays repeats twice: the second time through finds the same columns', () => {
    const clip = clipOf('\\ro \\rc 2 0.6.2 2.6.2 | 3.6.1 |');
    const played = perform(alphaTab, clip);
    expect(played.endTick).toBe(12 * Q);
    expect(columnAtTick(clip, played, 4 * Q + 10)).toBe(0);
    expect(columnAtTick(clip, played, 6 * Q + 10)).toBe(1);
    expect(columnAtTick(clip, played, 8 * Q + 10)).toBe(2);
  });

  it('gives a loop the ticks from its first column to the end of its last', () => {
    const clip = clipOf('0.6.4 2.6.4 3.6.2 | 5.6.1 |');
    expect(ticksOf(clip, perform(alphaTab, clip), [1, 2])).toEqual({ startTick: Q, endTick: 4 * Q });
  });

});
