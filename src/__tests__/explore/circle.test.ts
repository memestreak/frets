import {
  ALL_CELLS, cellId, cellName, cellOf, keyForMode, keySignature, keyWheel, modeForKey,
  modeWheel, numeralOf, parallelKey, rootPc, signatureTip, type Cell, type CellLook,
} from '@/features/explore/circle/circle';

const OFF = { parallel: false, dominants: false, allNumerals: false };

/** The cells a model fills, as "name numeral" in wheel order. */
const filled = (cells: Map<string, CellLook>) =>
  ALL_CELLS.filter(c => cells.get(cellId(c))?.fill)
    .map(c => `${cellName(c)} ${cells.get(cellId(c))!.numeral}`);

const cell = (ring: Cell['ring'], spoke: number): Cell => ({ ring, spoke });

describe('the wheel', () => {
  it('names each ring clockwise from C', () => {
    expect([0, 1, 6, 7, 11].map(s => cellName(cell('major', s)))).toEqual(['C', 'G', 'F♯', 'D♭', 'F']);
    expect([0, 6].map(s => cellName(cell('minor', s)))).toEqual(['Am', 'D♯m']);
    expect([0, 6, 7].map(s => cellName(cell('dim', s)))).toEqual(['B°', 'E♯°', 'C°']);
  });

  it('finds a triad by root and quality', () => {
    expect(cellOf(9, 'minor')).toEqual(cell('minor', 0));
    expect(cellOf(1, 'diminished')).toEqual(cell('dim', 2));
    expect(cellOf(0, 'augmented')).toBeNull();
    expect(rootPc(cell('dim', 2))).toBe(1);
  });

  it('gives each spoke its key signature', () => {
    expect(keySignature(0).notes).toEqual([]);
    expect(keySignature(2)).toEqual({ sharps: true, notes: ['F♯', 'C♯'] });
    expect(keySignature(9)).toEqual({ sharps: false, notes: ['B♭', 'E♭', 'A♭'] });
    expect(signatureTip(2)).toBe('D major and B minor: F♯ C♯.');
  });

  it('numbers any chord against a tonic by its plainest degree', () => {
    expect(numeralOf(cell('major', 4), 0)).toEqual({ numeral: 'III', degree: 3 });
    expect(numeralOf(cell('major', 6), 0)).toEqual({ numeral: '♭V', degree: 5 });
    expect(numeralOf(cell('minor', 2), 0).numeral).toBe('vii');
    expect(numeralOf(cell('dim', 7), 0).numeral).toBe('i°');
  });
});

describe('keyWheel', () => {
  it('fills D major’s seven chords with their numerals', () => {
    expect(filled(keyWheel({ spoke: 2, minor: false }, OFF).cells))
      .toEqual(['G IV', 'D I', 'A V', 'Em ii', 'Bm vi', 'F♯m iii', 'C♯° vii°']);
  });

  it('numbers a minor key against the major scale and adds its major V', () => {
    const w = keyWheel({ spoke: 0, minor: true }, OFF);
    expect(w.title).toBe('A minor');
    expect(w.chords.map(c => `${c.numeral} ${c.name}`))
      .toEqual(['i Am', 'ii° B°', '♭III C', 'iv Dm', 'v Em', '♭VI F', '♭VII G', 'V E']);
    expect(w.cells.get('major:4')).toMatchObject({ edge: 5, numeral: 'V' });
  });

  it('explains the relative minor and the leading-tone chord', () => {
    const w = keyWheel({ spoke: 2, minor: false }, OFF);
    expect(w.cells.get('minor:2')!.tip).toMatch(/^Bm: vi in D major\. Also the tonic of B minor/);
    expect(w.cells.get('dim:2')!.tip).toMatch(/Built on C♯, the 7th degree, the leading tone/);
  });

  it('borrows from the parallel key', () => {
    expect(parallelKey({ spoke: 0, minor: false })).toEqual({ spoke: 9, minor: true });
    const w = keyWheel({ spoke: 0, minor: false }, { ...OFF, parallel: true });
    expect(w.parallelName).toBe('C minor');
    expect(w.borrowed.map(c => `${c.numeral} ${c.name}`))
      .toEqual(['i Cm', 'ii° D°', '♭III E♭', 'iv Fm', 'v Gm', '♭VI A♭', '♭VII B♭']);
    expect(w.cells.get('minor:8')).toMatchObject({ edge: 4, numeral: 'iv' });
  });

  it('marks secondary dominants and draws them resolving', () => {
    const w = keyWheel({ spoke: 0, minor: false }, { ...OFF, dominants: true });
    expect(w.dominants.map(c => `${c.numeral} ${c.name}`))
      .toEqual(['V/ii A7', 'V/iii B7', 'V/IV C7', 'V/V D7', 'V/vi E7']);
    expect(w.cells.get('major:3')!.ring).toBe('dashed');
    // C7 is the tonic itself, which stays unmarked.
    expect(w.cells.get('major:0')!.ring).toBeUndefined();
    expect(w.arrows).toHaveLength(5);
  });

  it('numbers every other chord with All numerals', () => {
    const w = keyWheel({ spoke: 0, minor: false }, { ...OFF, allNumerals: true });
    expect(ALL_CELLS.every(c => w.cells.get(cellId(c))?.numeral)).toBe(true);
    expect(w.cells.get('major:4')).toMatchObject({ numeral: 'III' });
    expect(w.cells.get('major:4')!.fill).toBeUndefined();
  });
});

describe('modeWheel', () => {
  it('lights B♭ major’s chords for C Dorian, numbered from C', () => {
    const w = modeWheel('C', 'dorian', { allNumerals: false });
    expect(w.title).toBe('C Dorian');
    expect(w.formula.join(' ')).toBe('1 2 ♭3 4 5 6 ♭7');
    expect(w.homeSpoke).toBe(10);
    expect(filled(w.cells)).toEqual(['E♭ ♭III', 'B♭ ♭VII', 'F IV', 'Cm i', 'Gm v', 'Dm ii', 'A° vi°']);
    expect(w.chords.filter(c => c.ringed).map(c => c.numeral)).toEqual(['i', 'IV']);
  });

  it('spells sharp modes properly: F♯ Lydian', () => {
    const w = modeWheel('F#', 'lydian', { allNumerals: false });
    expect(w.chords.map(c => c.name)).toEqual(['F♯', 'G♯', 'A♯m', 'B♯°', 'C♯', 'D♯m', 'E♯m']);
    expect(w.chords.map(c => c.numeral)).toEqual(['I', 'II', 'iii', '♯iv°', 'V', 'vi', 'vii']);
  });

  it('puts each mode name on the spoke whose notes it uses', () => {
    const w = modeWheel('C', 'dorian', { allNumerals: false });
    expect(w.rim.map(r => `${r.text}:${r.spoke}`))
      .toEqual(['Lydian:1', 'Ionian:0', 'Mixolydian:11', 'Dorian:10', 'Aeolian:9', 'Phrygian:8', 'Locrian:7']);
    expect(w.rim.find(r => r.text === 'Mixolydian')!.tip)
      .toBe('C Mixolydian: the notes of F major. Against C major: ♭7.');
  });

  it('lists the relative modes from the mode’s own root', () => {
    expect(modeWheel('C', 'dorian', { allNumerals: false }).relative.map(r => r.label))
      .toEqual(['C Dorian', 'D Phrygian', 'E♭ Lydian', 'F Mixolydian', 'G Aeolian', 'A Locrian', 'B♭ Ionian']);
  });

  it('marks the one note each parallel mode flattens', () => {
    const rows = modeWheel('C', 'ionian', { allNumerals: false }).parallel;
    expect(rows.map(r => r.name)).toEqual(['Lydian', 'Ionian', 'Mixolydian', 'Dorian', 'Aeolian', 'Phrygian', 'Locrian']);
    expect(rows.map(r => r.degrees.filter((_, j) => r.changed[j]).join('')))
      .toEqual(['', '4', '♭7', '♭3', '♭6', '♭2', '♭5']);
    expect(rows.map(r => r.parent)).toEqual(['G', 'C', 'F', 'B♭', 'E♭', 'A♭', 'D♭']);
    expect(rows[1].current).toBe(true);
  });
});

describe('switching views', () => {
  it('keeps the root', () => {
    expect(modeForKey({ spoke: 0, minor: true })).toEqual({ root: 'A', mode: 'aeolian' });
    expect(keyForMode('A', 'aeolian')).toEqual({ spoke: 0, minor: true });
    expect(keyForMode('C', 'dorian')).toEqual({ spoke: 0, minor: false });
  });
});
