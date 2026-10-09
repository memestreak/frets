import { TUNING } from '@/lib/music';
import { CHORD_ROOTS, CHORD_TYPES, chordOf, type ChordInfo } from '@/lib/chords/chordTypes';
import {
  DIAGRAM_FRETS, diagramStartFret, findVoicings, fingersNeeded, LAST_POSITION, POSITION_FRETS,
  shapesInPosition, voicingCaption, voicingKey, type Voicing,
} from '@/lib/chords/voicings';

const keys = (vs: Voicing[]) => vs.map(voicingKey);

function expectPlayable(v: Voicing, chord: ChordInfo) {
  const strings = v.flatMap((f, s) => (f === null ? [] : [s]));
  const tones = strings.map(s => (TUNING[s] + v[s]! - chord.rootPc + 120) % 12);
  const chordTones = chord.tones.map(t => t.semis);
  const fretted = v.filter((f): f is number => f !== null && f > 0);
  expect(strings.length).toBeGreaterThanOrEqual(3);
  expect(tones[0]).toBe(0);
  expect(tones.every(t => chordTones.includes(t))).toBe(true);
  for (const t of chord.tones.filter(t => t.required)) expect(tones).toContain(t.semis);
  if (fretted.length) expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThanOrEqual(4);
  expect(fingersNeeded(v)).toBeLessThanOrEqual(4);
}

describe('findVoicings', () => {
  it('finds the shapes every guitarist knows', () => {
    const c = findVoicings(chordOf('C', 'M'));
    expect(keys(c.open)).toContain('x-3-2-0-1-0');
    expect(keys(c.moveable)).toContain('8-10-10-9-8-8'); // E-shape barre
    expect(keys(c.moveable)).toContain('x-3-5-5-5-3'); // A-shape barre

    const am7 = findVoicings(chordOf('A', 'm7'));
    expect(keys(am7.open)).toContain('x-0-2-0-1-0');
    expect(keys(am7.moveable)).toContain('5-7-5-5-5-5');

    // Same notes as the full F barre, but its own shape: the bass is on the D string.
    expect(keys(findVoicings(chordOf('F', 'M')).moveable)).toContain('x-x-3-2-1-1');
    expect(keys(findVoicings(chordOf('G', '7')).open)).toContain('3-2-0-0-0-1');
    expect(keys(findVoicings(chordOf('E', 'M')).open)).toContain('0-2-2-1-0-0');
  });

  it('keeps every shape playable, the best few among all, and open apart from moveable', () => {
    for (const [root, id] of [['A', 'm7'], ['C', 'M'], ['G', '7'], ['Bb', '13'], ['F#', 'dim7']] as const) {
      const chord = chordOf(root, id);
      const { open, moveable, allMoveable } = findVoicings(chord);
      for (const v of [...open, ...allMoveable]) expectPlayable(v, chord);
      expect(keys(allMoveable)).toEqual(expect.arrayContaining(keys(moveable)));
      expect(allMoveable.length).toBeGreaterThan(moveable.length);
      expect(open.every(v => v.includes(0))).toBe(true);
      expect(allMoveable.some(v => v.includes(0))).toBe(false);
    }
  });

  it('lists moveable shapes from the nut up', () => {
    const lowest = (v: Voicing) => Math.min(...v.filter((f): f is number => f !== null));
    const frets = findVoicings(chordOf('A', 'm7')).moveable.map(lowest);
    expect(frets).toEqual([...frets].sort((a, b) => a - b));
  });

  it('keeps drop 3 grips, which leave out a middle string', () => {
    // C7♯11 has no published shapes, so these come from the search.
    expect(keys(findVoicings(chordOf('C', '7#11')).allMoveable)).toContain('8-x-8-9-7-x');
  });

  it('allows a stretch across five frets', () => {
    expect(keys(findVoicings(chordOf('A', 'm7')).allMoveable)).toContain('x-x-7-5-x-3');
  });

  it('has nothing open for a chord without an open shape', () => {
    expect(findVoicings(chordOf('C', 'm6')).open).toEqual([]);
  });

  it('runs fast enough to search every chord type', () => {
    const start = performance.now();
    for (const t of CHORD_TYPES) findVoicings(chordOf(CHORD_ROOTS[3], t.id));
    expect(performance.now() - start).toBeLessThan(5000);
  });
});

describe('fingersNeeded', () => {
  it('counts a barre as one finger, on any fret', () => {
    expect(fingersNeeded([null, 3, 5, 5, 5, 3])).toBe(2); // index barre at 3, ring barre at 5
    expect(fingersNeeded([null, 3, 2, 3, 3, 3])).toBe(3); // C9: the D string's fret 2 splits fret 3
  });

  it('rejects a barre across an open string at the lowest fret', () => {
    expect(fingersNeeded([1, 0, 3, 2, 1, 1])).toBe(Infinity);
    expect(fingersNeeded([null, 1, 0, 3, 3, 1])).toBe(Infinity);
  });
});

describe('captions and diagram windows', () => {
  it('says where a shape sits', () => {
    expect(voicingCaption([5, 7, 5, 5, 5, 5])).toBe('root on E · frets 5–7');
    expect(voicingCaption([null, 0, 2, 0, 1, 0])).toBe('root on A · frets 1–2');
  });

  it('starts a diagram at fret 1 when the shape fits there', () => {
    expect(diagramStartFret([null, 3, 2, 0, 1, 0])).toBe(1);
    expect(diagramStartFret([null, 12, 14, 12, 13, 12])).toBe(12);
  });

  it('fits every shape of every chord type in a diagram', () => {
    for (const t of CHORD_TYPES) {
      const { open, allMoveable } = findVoicings(chordOf('A', t.id));
      for (const v of [...open, ...allMoveable]) {
        const fretted = v.filter((f): f is number => f !== null && f > 0);
        if (fretted.length) {
          expect(Math.max(...fretted) - diagramStartFret(v)).toBeLessThan(DIAGRAM_FRETS);
        }
      }
    }
  });
});

describe('shapesInPosition', () => {
  const am7 = findVoicings(chordOf('A', 'm7'));

  it('offers the core shapes that fit in five frets, easiest first', () => {
    expect(keys(shapesInPosition(am7, 5))).toEqual([
      '5-7-5-5-5-5', '5-x-5-5-5-x', '5-7-5-5-8-5', '5-7-5-5-5-8', 'x-x-7-9-8-8',
    ]);
  });

  it('finds a core moveable shape an octave up too', () => {
    // The library lists the F barre at fret 1; the last position finds it at fret 13.
    const f = findVoicings(chordOf('F', 'M'));
    expect(keys(f.moveable)).toContain('1-3-3-2-1-1');
    expect(keys(shapesInPosition(f, LAST_POSITION))).toContain('13-15-15-14-13-13');
  });

  it('takes in the open strings only in the first position', () => {
    expect(keys(shapesInPosition(am7, 1))).toContain('x-0-2-0-1-0');
    for (let first = 2; first <= LAST_POSITION; first++) {
      for (const v of shapesInPosition(am7, first)) {
        expect(v).not.toContain(0);
        for (const f of v) if (f !== null) expect(f - first).toBeLessThan(POSITION_FRETS);
      }
    }
  });

  it('falls back to the easiest shape when no core shape fits', () => {
    const fits = (first: number) => shapesInPosition(am7, first);
    // Every position has a shape for Am7, from the nut to the last position.
    for (let first = 1; first <= LAST_POSITION; first++) expect(fits(first).length).toBeGreaterThan(0);
    const core = new Set(keys([...am7.open, ...am7.moveable]));
    const fallbacks = Array.from({ length: LAST_POSITION }, (_, i) => fits(i + 1))
      .filter(list => !core.has(voicingKey(list[0])));
    for (const list of fallbacks) expect(list).toHaveLength(1);
    expect(fallbacks.length).toBeGreaterThan(0);
  });
});
