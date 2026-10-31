import {
  DEFAULT_BEATS, MAX_BPM, MIN_BPM, PRESETS, addTap, barClicks, countSyllable, cycleCell, defaultRhythm, defaultSteps,
  parseGroups, retempo, tapBpm, tempoName, timeAt, toggleCell, withAllSubs, withBeatSubs, withBeats, withGroups,
  withPreset, withSound, withVoice,
} from '@/features/metronome/rhythm';

const preset = (name: string) => PRESETS.flatMap(g => g.items).find(p => p.name === name)!;

describe('defaultSteps', () => {
  it('plays A on beat one, B on the other beats and C between them', () => {
    expect(defaultSteps(4, [1, 2, 1, 1], [])).toEqual([[0], [1, 2], [1], [1]]);
  });

  it('marks each group with B, the beats inside it with C, and puts D between the beats', () => {
    expect(defaultSteps(7, [1, 1, 1, 1, 1, 2, 1], [2, 2, 3])).toEqual([[0], [2], [1], [2], [1], [2, 3], [2]]);
  });
});

describe('changing the rhythm', () => {
  it('starts with 4 beats of quarters at 120 bpm', () => {
    const r = defaultRhythm();
    expect([r.bpm, r.beats, r.subs, r.steps]).toEqual([120, DEFAULT_BEATS, [1, 1, 1, 1], [[0], [1], [1], [1]]]);
  });

  it('new beats keep the first beat’s split, and drop the groups', () => {
    const r = withBeats(withGroups(withAllSubs(defaultRhythm(), 2), [3, 2]), 3);
    expect([r.beats, r.subs, r.groups]).toEqual([3, [2, 2, 2], []]);
    expect(r.steps).toEqual([[0, 2], [1, 2], [1, 2]]);
  });

  it('the same beats change nothing', () => {
    const r = defaultRhythm();
    expect(withBeats(r, 4)).toBe(r);
  });

  it('one beat split again keeps its first step’s voice', () => {
    const r = withBeatSubs(toggleCell(defaultRhythm(), 1, 0, 3), 1, 3);
    expect(r.subs).toEqual([1, 3, 1, 1]);
    expect(r.steps[1]).toEqual([3, 2, 2]);
  });

  it('a grid cell puts its voice on the step, and takes it off again', () => {
    const on = toggleCell(defaultRhythm(), 2, 0, 0);
    expect(on.steps[2]).toEqual([0]);
    expect(toggleCell(on, 2, 0, 0).steps[2]).toEqual([null]);
  });

  it('a tile cycles A, B, C, D, silent, A', () => {
    let r = defaultRhythm();
    const seen = [];
    for (let i = 0; i < 5; i++) {
      r = cycleCell(r, 0, 0);
      seen.push(r.steps[0][0]);
    }
    expect(seen).toEqual([1, 2, 3, null, 0]);
  });

  it('the main Sound sets every voice; a voice can then have its own', () => {
    const r = withVoice(withSound(defaultRhythm(), 'cowbell'), 0, { sound: 'clave', high: false });
    expect(r.voices.map(v => v.sound)).toEqual(['clave', 'cowbell', 'cowbell', 'cowbell']);
    expect(r.voices[0].high).toBe(false);
  });

  it('a preset sets the bar and the polyrhythm, and keeps the tempo and the sounds', () => {
    const start = { ...withSound(defaultRhythm(), 'beep'), bpm: 90 };
    const r = withPreset(start, preset('7/8 (2+2+3)'));
    expect([r.beats, r.groups, r.bpm, r.voices[0].sound]).toEqual([7, [2, 2, 3], 90, 'beep']);
    expect(withPreset(start, preset('3 over 2')).poly.count).toBe(3);
    expect(withPreset(withPreset(start, preset('3 over 2')), preset('Quarters')).poly.count).toBe(0);
  });

  it('every preset makes a bar whose parts agree', () => {
    for (const p of PRESETS.flatMap(g => g.items)) {
      const r = withPreset(defaultRhythm(), p);
      expect(r.subs).toHaveLength(r.beats);
      expect(r.steps.map(row => row.length)).toEqual(r.subs);
      if (r.groups.length) expect(r.groups.reduce((x, y) => x + y)).toBe(r.beats);
    }
  });
});

describe('parseGroups', () => {
  it('reads groups as typed, spaces and all', () => {
    expect(parseGroups('2 + 2+3')).toEqual([2, 2, 3]);
  });

  it('takes one group, nonsense, or more than 32 beats as none', () => {
    expect(parseGroups('4')).toEqual([]);
    expect(parseGroups('two+three')).toEqual([]);
    expect(parseGroups('20+20')).toEqual([]);
  });

  it('groups set the beats to their sum; none puts the usual steps back', () => {
    const r = withGroups(defaultRhythm(), [3, 3, 2]);
    expect([r.beats, r.subs.length]).toEqual([8, 8]);
    expect(withGroups(r, []).steps).toEqual(defaultSteps(8, r.subs, []));
  });
});

describe('barClicks', () => {
  it('places every step in beats, in order', () => {
    const clicks = barClicks(withAllSubs({ ...defaultRhythm(), beats: 2, subs: [1, 1], steps: [[0], [1]] }, 2));
    expect(clicks.map(c => [c.at, c.beat, c.step, c.voice])).toEqual([[0, 0, 0, 0], [0.5, 0, 1, 2], [1, 1, 0, 1], [1.5, 1, 1, 2]]);
  });

  it('swing moves every second step of a pair later', () => {
    const r = { ...withAllSubs(defaultRhythm(), 2), swing: 67 };
    expect(barClicks(r)[1].at).toBeCloseTo(0.67);
    const sixteenths = { ...withAllSubs(defaultRhythm(), 4), swing: 60 };
    expect(barClicks(sixteenths).slice(0, 4).map(c => c.at)).toEqual([0, 0.3, 0.5, 0.8]);
  });

  it('leaves triplets straight', () => {
    const r = { ...withAllSubs(defaultRhythm(), 3), swing: 67 };
    expect(barClicks(r)[1].at).toBeCloseTo(1 / 3);
  });

  it('spreads the polyrhythm evenly across the bar', () => {
    const r = { ...defaultRhythm(), poly: { count: 3, sound: 'cowbell' as const, level: 1 } };
    expect(barClicks(r).filter(c => c.poly !== null).map(c => c.at)).toEqual([0, 4 / 3, 8 / 3]);
  });
});

describe('the clock', () => {
  it('puts a beat a beat’s length apart at the tempo', () => {
    expect(timeAt({ pos: 0, time: 1, bpm: 120 }, 3)).toBe(2.5);
  });

  it('a new tempo keeps the last click where it was and spaces the next at the new tempo', () => {
    const a = { pos: 0, time: 0, bpm: 60 };
    const b = retempo(a, 2, 120);
    expect(timeAt(b, 2)).toBe(timeAt(a, 2));
    expect(timeAt(b, 3) - timeAt(b, 2)).toBe(0.5);
  });
});

describe('tap tempo', () => {
  it('needs two taps, then averages them', () => {
    expect(tapBpm([0])).toBeNull();
    expect(tapBpm([0, 500, 1000, 1500])).toBe(120);
  });

  it('starts again after a pause, and keeps the last 8 taps', () => {
    expect(addTap([0, 500], 4000)).toEqual([4000]);
    let taps: number[] = [];
    for (let t = 0; t <= 5000; t += 500) taps = addTap(taps, t);
    expect(taps).toHaveLength(8);
  });

  it('keeps within the metronome’s range', () => {
    expect(tapBpm([0, 50])).toBe(MAX_BPM);
    expect(tapBpm([0, 4000, 8000])).toBe(MIN_BPM);
  });

  it('reaches the slowest tempo: taps 3 seconds apart are one run', () => {
    expect(addTap([0], 3000)).toEqual([0, 3000]);
    expect(tapBpm([0, 3000])).toBe(MIN_BPM);
  });
});

describe('names', () => {
  it('names the tempo as a metronome’s scale does', () => {
    expect([tempoName(30), tempoName(96), tempoName(120), tempoName(240)]).toEqual(['Grave', 'Andante', 'Allegro', 'Prestissimo']);
  });

  it('counts steps as players say them', () => {
    expect([0, 1, 2, 3].map(s => countSyllable(2, s, 4))).toEqual(['3', 'e', '&', 'a']);
    expect([0, 1, 2].map(s => countSyllable(0, s, 3))).toEqual(['1', 'trip', 'let']);
    expect(countSyllable(0, 1, 5)).toBe('·');
  });
});
