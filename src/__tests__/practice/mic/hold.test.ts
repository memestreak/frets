import {
  DROPOUT_MS, heldEnough, heldFor, trackHold, type Hold, type Reading,
} from '@/features/practice/mic/hold';

/** Feeds readings 30 ms apart, from t = 0, and returns each hold. */
function run(readings: [number | null, number][]): (Hold | null)[] {
  let hold: Hold | null = null;
  return readings.map(([midi, rms], i) => {
    const reading: Reading = { midi, rms, at: i * 30 };
    hold = trackHold(hold, reading);
    return hold;
  });
}

describe('trackHold', () => {
  it('holds a steady note from its onset', () => {
    const holds = run([[45.1, 0.2], [44.9, 0.18], [45.2, 0.15], [45, 0.12]]);
    expect(holds.map(h => h?.since)).toEqual([0, 0, 0, 0]);
    expect(holds[3]).toMatchObject({ midi: 45, seen: 90 });
    expect(heldFor(holds[3]!)).toBe(90);
  });

  it('keeps a note that wavers near the edge of its semitone', () => {
    const holds = run([[45.4, 0.2], [45.6, 0.2], [44.6, 0.2]]);
    expect(holds.map(h => h?.since)).toEqual([0, 0, 0]);
  });

  it('starts again on a new note', () => {
    const holds = run([[45, 0.2], [47, 0.2]]);
    expect(holds[1]).toMatchObject({ midi: 47, since: 30 });
  });

  it('rides out a brief dropout but not silence', () => {
    const brief = run([[45, 0.2], [null, 0.01], [45, 0.15]]);
    expect(brief[1]?.since).toBe(0);
    expect(brief[2]?.since).toBe(0);
    const steps = Math.ceil(DROPOUT_MS / 30) + 1;
    const long = run([[45, 0.2], ...Array<[null, number]>(steps).fill([null, 0]), [45, 0.2]]);
    expect(long[steps]).toBeNull();
    expect(long[steps + 1]?.since).toBe((steps + 1) * 30);
  });

  it('starts again when the same note is plucked afresh', () => {
    const holds = run([[45, 0.2], [45, 0.1], [45, 0.3]]);
    expect(holds.map(h => h?.since)).toEqual([0, 0, 60]);
  });
});

describe('heldEnough', () => {
  it('judges the right note sooner than anything else', () => {
    expect(heldEnough(150, true)).toBe(true);
    expect(heldEnough(150, false)).toBe(false);
    expect(heldEnough(250, false)).toBe(true);
  });
});
