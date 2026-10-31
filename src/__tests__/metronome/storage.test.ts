import { defaultRhythm, withGroups, withPreset, PRESETS } from '@/features/metronome/rhythm';
import { parseDisplay, parsePlayback, parseRhythm } from '@/features/metronome/storage';

describe('parseRhythm', () => {
  it('reads back what was saved', () => {
    const r = { ...withPreset(defaultRhythm(), PRESETS[3].items[0]), bpm: 88, swing: 60 };
    expect(parseRhythm(JSON.parse(JSON.stringify(r)))).toEqual(r);
    const grouped = withGroups(defaultRhythm(), [2, 2, 3]);
    expect(parseRhythm(JSON.parse(JSON.stringify(grouped)))).toEqual(grouped);
  });

  it('gives the default for nothing, or for something that isn’t a rhythm', () => {
    expect(parseRhythm(null)).toEqual(defaultRhythm());
    expect(parseRhythm('120')).toEqual(defaultRhythm());
    expect(parseRhythm([1, 2])).toEqual(defaultRhythm());
  });

  it('keeps the tempo in range', () => {
    expect(parseRhythm({ bpm: 1000 }).bpm).toBe(400);
    expect(parseRhythm({ bpm: 'fast' }).bpm).toBe(120);
  });

  it('a field gone wrong takes its own default and leaves the others', () => {
    const r = parseRhythm({ bpm: 90, swing: 99, poly: { count: 3, sound: 'tuba', level: 2 } });
    expect([r.bpm, r.swing]).toEqual([90, 50]);
    expect(r.poly).toEqual({ count: 3, sound: 'cowbell', level: 0.6 });
  });

  it('steps that don’t match the beats give the usual steps for those beats', () => {
    const r = parseRhythm({ beats: 3, subs: [2, 2, 2], groups: [], steps: [[0], [1]] });
    expect(r.steps).toEqual([[0, 2], [1, 2], [1, 2]]);
  });

  it('groups that don’t add up to the beats are dropped', () => {
    expect(parseRhythm({ beats: 5, subs: [1, 1, 1, 1, 1], groups: [2, 2] }).groups).toEqual([]);
  });

  it('more than 32 beats is not a bar', () => {
    expect(parseRhythm({ beats: 33 }).beats).toBe(4);
  });

  it('a voice list of the wrong length gives the usual voices', () => {
    expect(parseRhythm({ voices: [{ sound: 'beep', high: true, level: 1 }] }).voices).toEqual(defaultRhythm().voices);
  });
});

describe('preferences', () => {
  it('reads the view, and the Readout otherwise', () => {
    expect(parseDisplay({ view: 'pendulum' })).toEqual({ view: 'pendulum' });
    expect(parseDisplay({ view: 'clock' })).toEqual({ view: 'readout' });
  });

  it('reads the volume, 0 to 1', () => {
    expect(parsePlayback({ volume: 0.3 })).toEqual({ volume: 0.3 });
    expect(parsePlayback({ volume: 3 })).toEqual({ volume: 0.8 });
  });
});
