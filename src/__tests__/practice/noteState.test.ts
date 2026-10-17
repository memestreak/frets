import { noteReducer, type NoteState } from '@/features/practice/notes/noteState';
import { defaultNoteSettings, type NoteQuestion } from '@/features/practice/notes/notes';
import { emptyStats } from '@/features/practice/quiz/stats';

const base = (q: NoteQuestion, patch: Partial<NoteState['set']> = {}): NoteState => ({
  set: { ...defaultNoteSettings(), mode: q.mode, ...patch },
  stats: emptyStats(),
  q,
  picked: null,
  far: [],
  farLast: false,
  octaveLast: false,
  heard: null,
  answered: false,
  wrong: [],
  advanceMs: null,
});

// A on the A string: open (out of the default 1–12 range) or fret 12.
const findA = { mode: 'find', pc: 9, s: 1 } as const;

describe('noteReducer', () => {
  it('Name it: wrong then right scores one miss', () => {
    let s = base({ mode: 'name', pc: 0, s: 1, f: 3 });
    s = noteReducer(s, { type: 'answerName', key: 2 });
    s = noteReducer(s, { type: 'answerName', key: 0 });
    expect(s.answered).toBe(true);
    expect(s.stats).toMatchObject({ correct: 0, total: 1 });
    expect(s.stats.per[0]).toEqual({ c: 0, t: 1 });
  });

  it('Find it: one in-range tap on the target string solves it', () => {
    const s = noteReducer(base(findA), { type: 'answerFret', pos: { s: 1, f: 12 } });
    expect(s.answered).toBe(true);
    expect(s.picked).toEqual({ s: 1, f: 12 });
    expect(s.stats).toMatchObject({ correct: 1, total: 1 });
  });

  it('Find it: the right note outside the range is marked, not scored', () => {
    let s = noteReducer(base(findA), { type: 'answerFret', pos: { s: 1, f: 0 } });
    expect(s.answered).toBe(false);
    expect(s.far).toEqual([{ s: 1, f: 0 }]);
    expect(s.farLast).toBe(true);
    expect(s.wrong).toEqual([]);
    expect(s.stats).toEqual(emptyStats());
    // Tapping it again is ignored.
    expect(noteReducer(s, { type: 'answerFret', pos: { s: 1, f: 0 } })).toBe(s);
    // Solving afterwards still scores a clean correct answer.
    s = noteReducer(s, { type: 'answerFret', pos: { s: 1, f: 12 } });
    expect(s.farLast).toBe(false);
    expect(s.stats).toMatchObject({ correct: 1, total: 1 });
  });

  it('Find it: the right note on another string is a miss', () => {
    // A on the G string, fret 2.
    let s = noteReducer(base(findA), { type: 'answerFret', pos: { s: 3, f: 2 } });
    expect(s.wrong).toEqual([{ s: 3, f: 2 }]);
    expect(s.far).toEqual([]);
    expect(noteReducer(s, { type: 'answerFret', pos: { s: 3, f: 2 } })).toBe(s);
    s = noteReducer(s, { type: 'answerFret', pos: { s: 1, f: 12 } });
    expect(s.stats).toMatchObject({ correct: 0, total: 1 });
  });

  it('Find it: a miss after an out-of-range tap clears farLast', () => {
    let s = noteReducer(base(findA), { type: 'answerFret', pos: { s: 1, f: 0 } });
    s = noteReducer(s, { type: 'answerFret', pos: { s: 1, f: 5 } });
    expect(s.farLast).toBe(false);
    expect(s.far).toHaveLength(1);
    expect(s.wrong).toEqual([{ s: 1, f: 5 }]);
  });

  it('a new question clears picked, far and farLast', () => {
    let s = noteReducer(base(findA), { type: 'answerFret', pos: { s: 1, f: 0 } });
    s = noteReducer(s, { type: 'answerFret', pos: { s: 1, f: 12 } });
    s = noteReducer(s, { type: 'next', q: { mode: 'find', pc: 0, s: 2 } });
    expect(s).toMatchObject({ picked: null, far: [], farLast: false, answered: false });
  });

  describe('Find it by mic', () => {
    const play = (st: NoteState, midi: number, misses = true) =>
      noteReducer(st, { type: 'answerPitch', midi, heard: `#${midi}`, misses });

    it('solves with the asked pitch, marking its fret', () => {
      const s = play(base(findA), 57);
      expect(s).toMatchObject({ answered: true, picked: { s: 1, f: 12 }, heard: '#57' });
      expect(s.stats).toMatchObject({ correct: 1, total: 1 });
    });

    it('explains the note on the asked string outside the range', () => {
      const s = play(base(findA), 45);
      expect(s).toMatchObject({ answered: false, farLast: true, far: [{ s: 1, f: 0 }] });
      expect(s.stats.total).toBe(0);
    });

    it('explains the note in an octave the string cannot play, unscored', () => {
      for (const midi of [33, 69]) {
        const s = play(base(findA), midi);
        expect(s).toMatchObject({ answered: false, octaveLast: true, wrong: [] });
        expect(s.stats.total).toBe(0);
      }
    });

    it('scores a wrong note as a miss at its fret, once', () => {
      let s = play(base(findA), 47);
      expect(s).toMatchObject({ wrong: [{ s: 1, f: 2 }], heard: '#47', octaveLast: false });
      s = play(s, 47);
      expect(s.wrong).toHaveLength(1);
      expect(s.stats).toMatchObject({ correct: 0, total: 1 });
    });

    it('keeps a wrong note with no place on the string as its pitch', () => {
      let s = play(base(findA), 40);
      expect(s.wrong).toEqual([40]);
      s = play(s, 40);
      expect(s.wrong).toEqual([40]);
    });

    it('ignores wrong notes when misses are off, but still solves', () => {
      let s = play(base(findA), 47, false);
      expect(s).toEqual(base(findA));
      s = play(s, 57, false);
      expect(s.answered).toBe(true);
    });

    it('a tap afterwards clears what the mic heard', () => {
      let s = play(base(findA), 47);
      s = noteReducer(s, { type: 'answerFret', pos: { s: 1, f: 3 } });
      expect(s.heard).toBeNull();
    });

    it('is ignored in Name it', () => {
      const name = base({ mode: 'name', pc: 9, s: 1, f: 12 });
      expect(play(name, 57)).toBe(name);
    });
  });
});
