import { prettyNote } from '@/lib/notation';
import {
  diatonicChords, intervalLabel, intervalWords, modeFamily, neckNotes, ROOTS,
  rotateMode, scaleDef, scaleOf, SCALES, type Root,
} from '@/features/explore/scales/theory';

const scale = (root: Root, id: string) => scaleOf(root, scaleDef(id)!);
const notes = (root: Root, id: string) =>
  scale(root, id).degrees.map(d => prettyNote(d.note)).join(' ');
const formula = (root: Root, id: string) =>
  scale(root, id).degrees.map(d => d.label).join(' ');

describe('spelling', () => {
  it('prints real accidentals', () => {
    expect(prettyNote('Bb')).toBe('B♭');
    expect(prettyNote('F#')).toBe('F♯');
    expect(prettyNote('F##')).toBe('F𝄪');
    expect(prettyNote('Bbb')).toBe('B𝄫');
    expect(prettyNote('B')).toBe('B');
  });

  it('labels intervals as degrees against the major scale', () => {
    expect(['1P', '3m', '4A', '5d', '7d', '6M'].map(intervalLabel))
      .toEqual(['1', '♭3', '♯4', '♭5', '𝄫7', '6']);
  });

  it('spells seven-note scales one letter per degree', () => {
    expect(notes('A', 'dorian')).toBe('A B C D E F♯ G');
    expect(notes('G#', 'ionian')).toBe('G♯ A♯ B♯ C♯ D♯ E♯ F𝄪');
    expect(notes('Eb', 'harmonic-minor')).toBe('E♭ F G♭ A♭ B♭ C♭ D');
    for (const def of SCALES.filter(t => t.intervals.length === 7)) {
      for (const root of ROOTS) {
        const letters = scaleOf(root, def).degrees.map(d => d.note[0]);
        expect(new Set(letters).size, `${root} ${def.id}`).toBe(7);
      }
    }
  });

  it('spells Altered with one letter per degree', () => {
    expect(formula('C', 'altered')).toBe('1 ♭2 ♭3 ♭4 ♭5 ♭6 ♭7');
    expect(notes('C', 'altered')).toBe('C D♭ E♭ F♭ G♭ A♭ B♭');
  });

  it('keeps tonal’s spelling for the other scales', () => {
    expect(formula('C', 'lydian-dominant')).toBe('1 2 3 ♯4 5 6 ♭7');
    expect(formula('C', 'ultralocrian')).toBe('1 ♭2 ♭3 ♭4 ♭5 ♭6 𝄫7');
    expect(formula('A', 'minor-blues')).toBe('1 ♭3 4 ♭5 5 ♭7');
  });

});

const row = (root: Root, id: string, size: 3 | 4) => diatonicChords(scale(root, id), size);

describe('diatonicChords', () => {
  it('stacks the triads of C major', () => {
    expect(row('C', 'ionian', 3).map(c => c.symbol))
      .toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'B°']);
    expect(row('C', 'ionian', 3).map(c => c.numeral))
      .toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
  });

  it('stacks the sevenths of A harmonic minor', () => {
    const chords = row('A', 'harmonic-minor', 4);
    expect(chords.map(c => c.symbol))
      .toEqual(['Am(maj7)', 'Bm7♭5', 'C+maj7', 'Dm7', 'E7', 'Fmaj7', 'G♯°7']);
    expect(chords.map(c => c.numeral))
      .toEqual(['i(maj7)', 'iiø7', '♭III+maj7', 'iv7', 'V7', '♭VImaj7', 'vii°7']);
    expect(chords[6].quality).toBe('diminished 7');
    expect(chords[6].labels).toEqual(['1', '♭3', '♭5', '𝄫7']);
    expect(chords[6].thirds).toEqual(['m3', 'm3', 'm3']);
    expect(chords[6].fromRoot).toEqual(['m3', 'd5', 'd7']);
    expect(chords[2].thirds).toEqual(['M3', 'M3', 'm3']);
  });

  it('numbers chords against the major scale on the same root', () => {
    expect(row('A', 'aeolian', 3).map(c => c.numeral))
      .toEqual(['i', 'ii°', '♭III', 'iv', 'v', '♭VI', '♭VII']);
  });

  it('marks raised degrees', () => {
    expect(row('C', 'lydian', 3)[3].numeral).toBe('♯iv°');
  });

  it('spells chord tones from the scale', () => {
    const am7 = row('A', 'dorian', 4)[0];
    expect(am7.tones).toEqual(['A', 'C', 'E', 'G']);
    expect(am7.labels).toEqual(['1', '♭3', '5', '♭7']);
    expect(am7.semis).toEqual([0, 3, 7, 10]);
    expect(am7.thirds).toEqual(['m3', 'M3', 'm3']);
    expect(am7.fromRoot).toEqual(['m3', 'P5', 'm7']);
  });

  it('climbs past the octave for the ladder', () => {
    const chords = row('A', 'dorian', 4);
    expect(chords[3].rising).toEqual([5, 9, 12, 15]);
    expect(chords[6].rising).toEqual([10, 14, 17, 21]);
  });

  it('fits every stack in two octaves, rising', () => {
    for (const def of SCALES) {
      for (const c of diatonicChords(scaleOf('C', def), 4)) {
        c.rising.slice(1).forEach((r, k) => expect(r).toBeGreaterThan(c.rising[k]));
        expect(c.rising.at(-1)).toBeLessThan(24);
      }
    }
  });

  it('names every chord of every scale from the chord table', () => {
    // Stacks outside the table would show their notes as the symbol.
    for (const def of SCALES) {
      for (const root of ROOTS) {
        for (const size of [3, 4] as const) {
          for (const c of diatonicChords(scaleOf(root, def), size)) {
            expect(c.symbol, `${root} ${def.id}`).not.toContain(' ');
          }
        }
      }
    }
  });

  it('has no chords outside seven-note scales', () => {
    expect(row('A', 'minor-pentatonic', 3)).toEqual([]);
    expect(row('A', 'minor-blues', 4)).toEqual([]);
  });
});

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

describe('intervalWords', () => {
  it('spells interval names out', () => {
    expect(intervalWords('M3')).toBe('major 3rd');
    expect(intervalWords('d5')).toBe('diminished 5th');
    expect(intervalWords('m7')).toBe('minor 7th');
  });
});

describe('rotateMode', () => {
  const rotated = (root: Root, id: string, step: number) => {
    const m = rotateMode(root, scaleDef(id)!, step);
    return `${m.root} ${m.type.id} +${m.shift}`;
  };

  it('moves the root up the scale and renames the scale for it', () => {
    expect(rotated('C', 'ionian', 0)).toBe('C ionian +0');
    expect(rotated('C', 'ionian', 1)).toBe('D dorian +2');
    expect(rotated('C', 'ionian', 6)).toBe('B locrian +11');
    // From a mode other than the first, the family wraps round.
    expect(rotated('A', 'dorian', 6)).toBe('G ionian +10');
    expect(rotated('A', 'melodic-minor', 6)).toBe('G# altered +11');
    expect(rotated('A', 'harmonic-minor', 2)).toBe('C ionian-sharp5 +3');
  });

  it('respells a root the picker lacks', () => {
    // C♯ major's third note is E♯: F Phrygian, the same pitches.
    expect(rotated('C#', 'ionian', 2)).toBe('F phrygian +4');
    expect(rotated('A#', 'ionian', 6)).toBe('A locrian +11');
    expect(rotated('Gb', 'ionian', 3)).toBe('B lydian +5');
  });

  it('keeps the pitches of every mode of every family', () => {
    const pcs = (root: Root, id: string) =>
      scale(root, id).degrees.map(d => d.pc).sort((a, b) => a - b).join();
    for (const type of SCALES.filter(t => modeFamily(t))) {
      for (const root of ROOTS) {
        for (let step = 0; step < 7; step++) {
          const m = rotateMode(root, type, step);
          expect(pcs(m.root, m.type.id)).toBe(pcs(root, type.id));
        }
      }
    }
  });

  it('leaves pentatonic and blues scales alone', () => {
    for (const id of ['major-pentatonic', 'minor-pentatonic', 'minor-blues']) {
      expect(modeFamily(scaleDef(id)!)).toBeNull();
      expect(rotated('C', id, 3)).toBe(`C ${id} +0`);
    }
  });
});
