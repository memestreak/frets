/**
 * Playback's pure part: the clip as alphaTab's score and MIDI, and the way between its ticks and
 * the clip's columns. The sound itself needs a browser. See docs/specs/2026-10-26-tab-playback-design.md.
 */
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import type { Clip } from '@/features/tab/clip';
import { columnAtTick, DEFAULT_SOUND, isSound, perform, SOUND_FAMILIES, tickOf, ticksOf, timeline } from '@/features/tab/playback';
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
  it('offers every pitched General MIDI sound but the percussion and sound effects families', () => {
    const programs = SOUND_FAMILIES.flatMap(([, sounds]) => sounds.map(([program]) => program));
    expect(programs).toHaveLength(112);
    expect(programs.some(p => p >= 112)).toBe(false);
    expect(isSound(25) && isSound(0) && isSound(111)).toBe(true);
    expect(isSound(115) || isSound(127) || isSound('25')).toBe(false);
  });

  it('plays the clip in the sound chosen, whatever its alphaTex names', () => {
    const clip = clipOf('0.6.4 2.6.4 3.6.2 | 5.6.1 |');
    expect(new Set(programsOf(perform(alphaTab, clip).midi))).toEqual(new Set([DEFAULT_SOUND]));
    expect(new Set(programsOf(perform(alphaTab, clip, 40).midi))).toEqual(new Set([40]));
  });

  it('reads the saved settings, each field checked', () => {
    expect(parsePlaybackSettings(null)).toEqual({ shown: false, sound: DEFAULT_SOUND });
    expect(parsePlaybackSettings({ shown: true, sound: 0 })).toEqual({ shown: true, sound: 0 });
    expect(parsePlaybackSettings({ shown: 'yes', sound: 115 })).toEqual({ shown: false, sound: DEFAULT_SOUND });
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

  it('lays the clip along the progress line as written, a repeat once', () => {
    const clip = clipOf('\\ro \\rc 2 0.6.2 2.6.2 | 3.6.1 |');
    const line = timeline(clip);
    expect(line.columns.map(t => t / line.total)).toEqual([0, 0.25, 0.5]);
    expect(line.bars.map(t => t / line.total)).toEqual([0, 0.5]);
  });
});
