import { clampFret, setRangeMax, setRangeMin } from '@/lib/fretRange';

describe('fret range', () => {
  it('pushes the max up to keep the window at least 3 frets', () => {
    expect(setRangeMin({ minFret: 0, maxFret: 15 }, 5)).toEqual({ minFret: 5, maxFret: 15 });
    expect(setRangeMin({ minFret: 0, maxFret: 5 }, 4)).toEqual({ minFret: 4, maxFret: 7 });
  });

  it('pulls the min down to keep the window at least 3 frets', () => {
    expect(setRangeMax({ minFret: 5, maxFret: 15 }, 6)).toEqual({ minFret: 3, maxFret: 6 });
  });

  it('clamps to the neck', () => {
    expect(setRangeMin({ minFret: 0, maxFret: 15 }, -4)).toEqual({ minFret: 0, maxFret: 15 });
    expect(setRangeMin({ minFret: 0, maxFret: 15 }, 14)).toEqual({ minFret: 12, maxFret: 15 });
    expect(setRangeMax({ minFret: 0, maxFret: 15 }, 99)).toEqual({ minFret: 0, maxFret: 15 });
    expect(setRangeMax({ minFret: 0, maxFret: 15 }, 1)).toEqual({ minFret: 0, maxFret: 3 });
    expect(clampFret(30)).toBe(15);
    expect(clampFret(-1)).toBe(0);
  });
});
