import {
  gripAt, gripCaption, STRING_SETS, setLabel, TRIAD_TYPES, triadGrips, type Grip,
} from '@/features/explore/triads/triads';
import { chordOf, CHORD_ROOTS } from '@/lib/chords/chordTypes';
import { pitchClass } from '@/lib/music';

/** A grip as "inversion: frets on the set's strings", e.g. "1: 9-8-8". */
const show = (g: Grip) => `${g.inversion}: ${g.points.map(p => p.f).join('-')}`;

describe('triadGrips', () => {
  it('finds every C major grip on G-B-e, from the nut up', () => {
    expect(triadGrips(chordOf('C', 'M'), 3).map(show)).toEqual([
      '2: 0-1-0', '0: 5-5-3', '1: 9-8-8', '2: 12-13-12',
    ]);
  });

  it('plays only the set\'s strings, the bass on the lowest', () => {
    const [grip] = triadGrips(chordOf('A', 'm'), 0);
    expect(grip.voicing.slice(3)).toEqual([null, null, null]);
    expect(grip.points.map(p => p.s)).toEqual([0, 1, 2]);
  });

  it('plays the triad\'s tones in close position within four frets, every inversion somewhere', () => {
    for (const root of CHORD_ROOTS) {
      for (const [type] of TRIAD_TYPES) {
        const chord = chordOf(root, type);
        const tones = chord.tones.map(t => (chord.rootPc + t.semis) % 12);
        for (const set of STRING_SETS) {
          const grips = triadGrips(chord, set);
          for (const g of grips) {
            const frets = g.points.map(p => p.f);
            expect(Math.max(...frets) - Math.min(...frets)).toBeLessThanOrEqual(4);
            expect(frets.every(f => f >= 0 && f <= 15)).toBe(true);
            const played = g.points.map(p => pitchClass(p.s, p.f));
            expect(played).toEqual([0, 1, 2].map(k => tones[(g.inversion + k) % 3]));
          }
          expect(new Set(grips.map(g => g.inversion)).size).toBe(3);
        }
      }
    }
  });

  it('repeats one augmented grip every four frets', () => {
    const shapes = triadGrips(chordOf('C', 'aug'), 3)
      .map(g => g.points.map(p => p.f - g.points[0].f).join());
    expect(new Set(shapes).size).toBe(1);
  });
});

describe('gripAt', () => {
  const grips = [
    { inversion: 0, voicing: [], points: [{ s: 3, f: 5 }, { s: 4, f: 5 }] },
    { inversion: 1, voicing: [], points: [{ s: 3, f: 9 }, { s: 4, f: 5 }] },
  ] as Grip[];

  it('picks the grip with a dot there, or none', () => {
    expect(gripAt(grips, { s: 3, f: 9 }, null)).toBe(1);
    expect(gripAt(grips, { s: 3, f: 7 }, 1)).toBeNull();
  });

  it('clears on the picked grip, and moves on at a shared dot', () => {
    expect(gripAt(grips, { s: 3, f: 9 }, 1)).toBeNull();
    expect(gripAt(grips, { s: 4, f: 5 }, 0)).toBe(1);
    expect(gripAt(grips, { s: 4, f: 5 }, 1)).toBe(0);
  });
});

describe('gripCaption', () => {
  it('names the inversion, the slash chord and the bass', () => {
    const chord = chordOf('C', 'M');
    const [, root, first] = triadGrips(chord, 3);
    expect(gripCaption(chord, root)).toBe('Root position, C · root in the bass');
    expect(gripCaption(chord, first)).toBe('1st inversion, C/E · 3rd in the bass');
    const dim = chordOf('Bb', 'dim');
    const second = triadGrips(dim, 2).find(g => g.inversion === 2)!;
    expect(gripCaption(dim, second)).toBe('2nd inversion, B♭°/F♭ · 5th in the bass');
  });
});

describe('setLabel', () => {
  it('names the strings, low to high', () => {
    expect(STRING_SETS.map(setLabel)).toEqual(['E A D', 'A D G', 'D G B', 'G B e']);
  });
});
