import {
  ALL_CELLS, cellId, cellName, cellOf, keyForMode, keySignature, keyWheel, modeForKey,
  modeWheel, numeralOf, parallelKey, parentKey, rootPc, signatureTip, type Cell, type CellLook,
} from '@/features/explore/circle/circle';

const OFF = { parallel: false, dominants: false, allNumerals: false };

/** The cells a model fills, as "name numeral" in wheel order, named as drawn. */
const filled = (cells: Map<string, CellLook>) =>
  ALL_CELLS.filter(c => cells.get(cellId(c))?.fill).map(c => {
    const look = cells.get(cellId(c))!;
    return `${look.name ?? cellName(c)} ${look.numeral}`;
  });

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
  const off = { allNumerals: false };
  const ring = (w: ReturnType<typeof modeWheel>) =>
    w.notes.filter(n => n.lit).map(n => `${n.root ? '*' : ''}${n.name} ${n.label}`);

  it('lights B♭ major’s chords for C Dorian, numbered from C', () => {
    const w = modeWheel('C', 'dorian', off);
    expect(w.title).toBe('C Dorian');
    expect(w.formula.join(' ')).toBe('1 2 ♭3 4 5 6 ♭7');
    expect(w.homeSpoke).toBe(10);
    expect(filled(w.cells)).toEqual(['E♭ ♭III', 'B♭ ♭VII', 'F IV', 'Cm i', 'Gm v', 'Dm ii', 'A° vi°']);
    expect(['minor:9', 'major:11'].map(id => w.cells.get(id)!.ring)).toEqual(['solid', 'solid']);
  });

  it('lights the parent key’s seven notes on the ring, each named for its mode', () => {
    const w = modeWheel('C', 'dorian', off);
    expect(ring(w)).toEqual([
      '*C Dorian', 'G Aeolian', 'D Phrygian', 'A Locrian', 'E♭ Lydian', 'B♭ Ionian', 'F Mixolydian',
    ]);
    expect(w.notes[0]).toMatchObject({ name: 'C', pick: { root: 'C', mode: 'dorian' } });
    expect(w.notes[2]).toMatchObject({ pick: { root: 'D', mode: 'phrygian' } });
    expect(w.notes[2].tip).toBe('D Phrygian: the same notes as C Dorian, starting on D.');
    expect(w.notes[4]).toMatchObject({ lit: false, name: 'E' });
  });

  it('spells a mode from its parent key: D♭ Locrian is C♯ Locrian', () => {
    expect(parentKey('Db', 'locrian')).toEqual({ spoke: 2, key: 'D', root: 'C#' });
    const w = modeWheel('Db', 'locrian', off);
    expect(w.title).toBe('C♯ Locrian');
    expect(filled(w.cells)).toEqual(['G ♭V', 'D ♭II', 'A ♭VI', 'Em ♭iii', 'Bm ♭vii', 'F♯m iv', 'C♯° i°']);
  });

  it('keeps the root’s name where the key’s other spelling allows it', () => {
    expect(parentKey('F#', 'lydian')).toEqual({ spoke: 7, key: 'C#', root: 'F#' });
    expect(parentKey('F', 'locrian')).toEqual({ spoke: 6, key: 'Gb', root: 'F' });
    const w = modeWheel('F#', 'lydian', off);
    expect(w.title).toBe('F♯ Lydian');
    // The wheel's cells take the mode's spelling: C♯, not D♭.
    expect(filled(w.cells)).toEqual(['F♯ I', 'C♯ V', 'G♯ II', 'D♯m vi', 'A♯m iii', 'E♯m vii', 'B♯° ♯iv°']);
    expect(ring(w)).toContain('B♯ Locrian');
  });

  it('lists every mode on the root as its chords, marking what each lends', () => {
    const rows = modeWheel('C', 'dorian', off).parallel;
    expect(rows.map(r => r.title)).toEqual([
      'C Lydian', 'C Ionian', 'C Mixolydian', 'C Dorian', 'C Aeolian', 'C Phrygian', 'C Locrian',
    ]);
    const aeolian = rows[4];
    expect(aeolian.chords.map(c => `${c.same ? '' : '+'}${c.name}`))
      .toEqual(['Cm', '+D°', 'E♭', '+Fm', 'Gm', '+A♭', 'B♭']);
    expect(aeolian.chords[5].tip).toBe('A♭: ♭VI in C Aeolian. C Dorian has A° here: borrow A♭ for Aeolian colour.');
    expect(rows.map(r => r.swap)).toEqual([null, 'F♯ → F', 'B → B♭', 'E → E♭', 'A → A♭', 'D → D♭', 'G → G♭']);
    expect(rows.map(r => r.spoke)).toEqual([1, 0, 11, 10, 9, 8, 7]);
    expect(rows[3].current).toBe(true);
    expect(rows[2].tip).toBe('C Mixolydian: the notes of F major. Against C major: ♭7.');
  });

  it('respells a row only when its key needs it', () => {
    expect(modeWheel('C#', 'locrian', off).parallel.map(r => r.title)[0]).toBe('D♭ Lydian');
  });
});

describe('switching views', () => {
  it('keeps the root', () => {
    expect(modeForKey({ spoke: 0, minor: true })).toEqual({ root: 'A', mode: 'aeolian' });
    expect(keyForMode('A', 'aeolian')).toEqual({ spoke: 0, minor: true });
    expect(keyForMode('C', 'dorian')).toEqual({ spoke: 0, minor: false });
  });
});
