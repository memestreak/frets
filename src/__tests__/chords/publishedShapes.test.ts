import { TUNING } from '@/lib/music';
import { CHORD_ROOTS, chordOf, chordTypeDef, type ChordInfo } from '@/lib/chords/chordTypes';
import { PUBLISHED_TYPES, publishedShapes } from '@/lib/chords/publishedShapes';
import { findVoicings, voicingKey, type Voicing } from '@/lib/chords/voicings';

const keys = (vs: Voicing[]) => vs.map(voicingKey);

/** Semitones above the root of each sounding string, low to high. */
const tonesOf = (v: Voicing, chord: ChordInfo) =>
  v.flatMap((f, s) => (f === null ? [] : [(TUNING[s] + f - chord.rootPc + 120) % 12]));

describe('the imported Haus of Chords data', () => {
  it('names only chord types we have, with the same tones', () => {
    const SEMIS: Record<string, number> = {
      '1': 0, '♭9': 1, '2': 2, '9': 2, '♯9': 3, '♭3': 3, '3': 4, '4': 5, '11': 5,
      '♭5': 6, '5': 7, '♯5': 8, '6': 9, '13': 9, '°7': 9, '♭7': 10, '7': 11,
    };
    for (const [id, type] of Object.entries(PUBLISHED_TYPES)) {
      const ours = chordTypeDef(id);
      expect(ours, id).toBeDefined();
      const theirs = type.formula.split(' ').map(d => SEMIS[d]).sort((a, b) => a - b);
      expect(theirs, id).toEqual(ours!.semis);
    }
  });

  it('spells every chord on every root: root in the bass, chord tones only, every required tone, within five frets', () => {
    for (const id of Object.keys(PUBLISHED_TYPES)) {
      for (const root of CHORD_ROOTS) {
        const chord = chordOf(root, id);
        const { open, allMoveable } = publishedShapes(chord)!;
        for (const v of [...open, ...allMoveable]) {
          const tones = tonesOf(v, chord);
          const where = `${chord.symbol} ${voicingKey(v)}`;
          expect(tones[0], where).toBe(0);
          expect(tones.every(t => chord.tones.some(c => c.semis === t)), where).toBe(true);
          for (const t of chord.tones.filter(t => t.required)) expect(tones, where).toContain(t.semis);
          // Three strings at least, except a power chord's two notes on two.
          expect(tones.length, where).toBeGreaterThanOrEqual(Math.min(3, chord.tones.length));
          const fretted = v.filter((f): f is number => f !== null && f > 0);
          expect(Math.max(...fretted) - Math.min(...fretted), where).toBeLessThanOrEqual(4);
        }
      }
    }
  });
});

describe('publishedShapes', () => {
  it('has nothing for a type the source does not cover', () => {
    expect(publishedShapes(chordOf('C', '7#11'))).toBeNull();
  });

  it('gives each root only its own open shapes', () => {
    expect(keys(publishedShapes(chordOf('C', 'M'))!.open)).toEqual(['x-3-2-0-1-0', 'x-3-2-0-1-3']);
    expect(keys(publishedShapes(chordOf('F', 'M'))!.open)).toEqual([]);
  });

  it('slides moveable shapes to the root, as low on the neck as they go', () => {
    const f = keys(publishedShapes(chordOf('F', 'M'))!.moveable);
    expect(f).toContain('1-3-3-2-1-1'); // the F barre, not at fret 13
    expect(f).toContain('x-8-10-10-10-8');
  });

  it('keeps the better-sourced of two shapes that differ by one muted string', () => {
    const c = publishedShapes(chordOf('C', 'M'))!;
    expect(keys(c.moveable)).toContain('x-3-5-5-5-3');
    expect(keys(c.moveable)).not.toContain('x-3-5-5-5-x');
    expect(keys(c.allMoveable)).toContain('x-3-5-5-5-x');
  });
});

describe('findVoicings with published shapes', () => {
  it('shows the published shapes first and adds searched ones under Show all', () => {
    const cmaj7 = findVoicings(chordOf('C', 'maj7'));
    expect(keys(cmaj7.open)).toEqual(['x-3-2-0-0-0']);
    expect(keys(cmaj7.moveable)).toContain('8-x-9-9-8-x'); // drop 3
    expect(keys(cmaj7.allMoveable)).toEqual(expect.arrayContaining(keys(cmaj7.moveable)));
    expect(cmaj7.allMoveable.length).toBeGreaterThan(cmaj7.moveable.length);
  });
});
