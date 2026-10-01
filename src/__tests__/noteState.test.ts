import { noteReducer, type NoteState } from '@/components/notes/noteState';
import { defaultNoteSettings, type NoteQuestion } from '@/lib/notes';
import { emptyStats } from '@/lib/stats';

const base = (q: NoteQuestion, patch: Partial<NoteState['set']> = {}): NoteState => ({
  set: { ...defaultNoteSettings(), mode: q.mode, ...patch },
  stats: emptyStats(),
  q,
  found: [],
  answered: false,
  wrong: [],
  advanceMs: null,
});

describe('noteReducer', () => {
  it('Name it: wrong then right scores one miss', () => {
    let s = base({ mode: 'name', pc: 0, s: 1, f: 3 });
    s = noteReducer(s, { type: 'answerName', pc: 2 });
    s = noteReducer(s, { type: 'answerName', pc: 0 });
    expect(s.answered).toBe(true);
    expect(s.stats).toMatchObject({ correct: 0, total: 1 });
    expect(s.stats.per[0]).toEqual({ c: 0, t: 1 });
  });

  it('Find on string: any octave on the target string counts', () => {
    // A on the A string: open or fret 12.
    let s = base({ mode: 'string', pc: 9, s: 1 });
    s = noteReducer(s, { type: 'answerFret', pos: { s: 3, f: 2 } }); // A, wrong string
    expect(s.wrong).toHaveLength(1);
    s = noteReducer(s, { type: 'answerFret', pos: { s: 1, f: 12 } });
    expect(s.answered).toBe(true);
    expect(s.found).toEqual([{ s: 1, f: 12 }]);
  });

  it('Find in range: completes when every target is found', () => {
    const targets = [{ s: 1, f: 7 }, { s: 4, f: 5 }];
    let s = base({ mode: 'range', pc: 4, targets });
    s = noteReducer(s, { type: 'answerFret', pos: { s: 1, f: 7 } });
    expect(s.answered).toBe(false);
    expect(s.found).toHaveLength(1);
    // Tapping a found cell again is ignored.
    expect(noteReducer(s, { type: 'answerFret', pos: { s: 1, f: 7 } })).toBe(s);
    s = noteReducer(s, { type: 'answerFret', pos: { s: 0, f: 3 } });
    expect(s.wrong).toEqual([{ s: 0, f: 3 }]);
    s = noteReducer(s, { type: 'answerFret', pos: { s: 4, f: 5 } });
    expect(s.answered).toBe(true);
    // One miss on the way means the question scores as a miss.
    expect(s.stats).toMatchObject({ correct: 0, total: 1 });
  });
});
