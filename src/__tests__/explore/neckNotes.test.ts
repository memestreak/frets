import { neckNotes } from '@/features/explore/scales/neckNotes';
import { diatonicChords } from '@/lib/theory/diatonic';
import { scaleDef, scaleOf, type Root } from '@/lib/theory/scales';

const scale = (root: Root, id: string) => scaleOf(root, scaleDef(id)!);

describe('neckNotes', () => {
  it('finds every scale note on the neck', () => {
    const all = neckNotes(scale('A', 'minor-pentatonic'), 12);
    // Five of every twelve frets on each string, plus fret 12 doubling fret 0.
    expect(all.filter(n => n.s === 0).map(n => n.f)).toEqual([0, 3, 5, 8, 10, 12]);
    const root = all.find(n => n.s === 0 && n.f === 5)!;
    expect(root).toMatchObject({ note: 'A', label: '1', degree: 1 });
  });

  it('keeps only chord tones, labelled against the chord root', () => {
    const sc = scale('A', 'aeolian');
    const dm7 = diatonicChords(sc, 4)[3];
    const on = neckNotes(sc, 12, dm7);
    // Low E string: D at fret 10 is the chord root, A at 5 its fifth.
    expect(on.find(n => n.s === 0 && n.f === 10)).toMatchObject({ label: '1', degree: 1 });
    expect(on.find(n => n.s === 0 && n.f === 5)).toMatchObject({ label: '5', degree: 5 });
    // B at fret 7 is a scale note outside the chord.
    expect(on.find(n => n.s === 0 && n.f === 7)).toBeUndefined();
    expect(new Set(on.map(n => n.note))).toEqual(new Set(['D', 'F', 'A', 'C']));
  });
});
