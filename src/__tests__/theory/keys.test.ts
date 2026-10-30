import {
  C_MAJOR, isKey, keyName, keyOfTonic, keyOnSpoke, keySignature, keyTonic, parallelKey,
  relativeKey, sameKey, spokeOf, wheelKey,
} from '@/lib/theory/keys';

describe('keys', () => {
  it('names a key by its tonic', () => {
    expect(keyTonic({ fifths: 3 })).toBe('A');
    expect(keyTonic({ fifths: 3, minor: true })).toBe('F#');
    expect(keyName({ fifths: -2 })).toBe('B♭ major');
    expect(keyName(C_MAJOR)).toBe('C major');
  });

  it('finds the key on a tonic, by its other name where a signature needs it', () => {
    expect(keyOfTonic('E', true)).toEqual({ fifths: 1, minor: true });
    expect(keyOfTonic('D#', false)).toEqual({ fifths: -3 });
    expect(keyOfTonic('Gb', false)).toEqual({ fifths: -6 });
  });

  it('goes to the parallel and relative keys', () => {
    expect(parallelKey({ fifths: 0 })).toEqual({ fifths: -3, minor: true });
    expect(parallelKey({ fifths: -3, minor: true })).toEqual({ fifths: 0 });
    expect(relativeKey({ fifths: 2 })).toEqual({ fifths: 2, minor: true });
  });

  it('writes the key signature in order', () => {
    expect(keySignature({ fifths: 2 })).toEqual({ sharps: true, notes: ['F♯', 'C♯'] });
    expect(keySignature({ fifths: -3, minor: true })).toEqual({ sharps: false, notes: ['B♭', 'E♭', 'A♭'] });
  });

  it('checks a stored key', () => {
    expect(isKey({ fifths: 7 })).toBe(true);
    expect(isKey({ fifths: 8 })).toBe(false);
    expect(isKey({ fifths: 1, minor: false })).toBe(false);
    expect(isKey(null)).toBe(false);
    expect(sameKey({ fifths: 1 }, { fifths: 1, minor: true })).toBe(false);
  });
});

describe('keys on the circle of fifths', () => {
  it('puts each spoke’s key as the circle names it: F♯ at the bottom, then D♭', () => {
    expect(keyOnSpoke(6, false)).toEqual({ fifths: 6 });
    expect(keyOnSpoke(7, false)).toEqual({ fifths: -5 });
    expect(keyTonic(keyOnSpoke(6, true))).toBe('D#');
    expect(keyTonic(keyOnSpoke(7, true))).toBe('Bb');
    for (let spoke = 0; spoke < 12; spoke++) expect(spokeOf(keyOnSpoke(spoke, false))).toBe(spoke);
  });

  it('finds the circle’s key on a tonic', () => {
    expect(wheelKey(1, false)).toEqual({ fifths: -5 });
    expect(wheelKey(1, true)).toEqual({ fifths: 4, minor: true });
    expect(wheelKey(9, true)).toEqual({ fifths: 0, minor: true });
  });
});
