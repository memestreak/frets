import { intervalReducer, type IntervalState } from '@/components/intervals/intervalState';
import { defaultIntervalSettings } from '@/lib/intervals';
import { AUTO_ADVANCE_MS, UNPAUSE_ADVANCE_MS } from '@/lib/quizFlow';
import { emptyStats } from '@/lib/stats';

// Root A string fret 5 (D3), target D string fret 3 (F3): minor third up.
const q = { root: { s: 1, f: 5 }, tgt: { s: 2, f: 3 }, semis: 3, up: true };

const base = (patch: Partial<IntervalState['set']> = {}): IntervalState => ({
  set: { ...defaultIntervalSettings(), ...patch },
  stats: emptyStats(),
  q,
  picked: null,
  far: [],
  farLast: false,
  answered: false,
  wrong: [],
  advanceMs: null,
});

describe('intervalReducer', () => {
  it('scores a first-try hit and schedules auto-advance', () => {
    const s = intervalReducer(base(), { type: 'answerName', semis: 3 });
    expect(s.answered).toBe(true);
    expect(s.advanceMs).toBe(AUTO_ADVANCE_MS);
    expect(s.stats).toMatchObject({ correct: 1, total: 1, streak: 1 });
  });

  it('scores a miss once and keeps the question open', () => {
    let s = intervalReducer(base(), { type: 'answerName', semis: 4 });
    s = intervalReducer(s, { type: 'answerName', semis: 5 });
    expect(s.answered).toBe(false);
    expect(s.wrong).toEqual([4, 5]);
    expect(s.stats).toMatchObject({ correct: 0, total: 1, streak: 0 });
    // Repeating a wrong answer is ignored.
    expect(intervalReducer(s, { type: 'answerName', semis: 4 })).toBe(s);
    s = intervalReducer(s, { type: 'answerName', semis: 3 });
    expect(s.answered).toBe(true);
    expect(s.stats.total).toBe(1);
    expect(s.stats.per[3]).toEqual({ c: 0, t: 1 });
  });

  it('waits for the user when paused, and resumes when unpaused', () => {
    let s = intervalReducer(base({ pause: true }), { type: 'answerName', semis: 3 });
    expect(s.advanceMs).toBeNull();
    s = intervalReducer(s, { type: 'togglePause' });
    expect(s.advanceMs).toBe(UNPAUSE_ADVANCE_MS);
    s = intervalReducer(s, { type: 'togglePause' });
    expect(s.advanceMs).toBeNull();
  });

  it('Find it: records the tapped position on success', () => {
    let s = intervalReducer(base({ mode: 'fret' }), { type: 'answerFret', pos: { s: 2, f: 4 } });
    expect(s.wrong).toEqual([{ s: 2, f: 4 }]);
    s = intervalReducer(s, { type: 'answerFret', pos: { s: 1, f: 8 } });
    expect(s.answered).toBe(true);
    expect(s.picked).toEqual({ s: 1, f: 8 });
  });

  it('Find it: the right interval outside the box is noted, not scored', () => {
    // G string fret 10 (F4) is a minor third up, but five frets away.
    const farPos = { s: 3, f: 10 };
    let s = intervalReducer(base({ mode: 'fret' }), { type: 'answerFret', pos: farPos });
    expect(s).toMatchObject({ far: [farPos], farLast: true, wrong: [], answered: false });
    expect(s.stats).toEqual(emptyStats());
    // Tapping it again changes nothing.
    expect(intervalReducer(s, { type: 'answerFret', pos: farPos })).toBe(s);

    // A real miss takes over the feedback; a later hit still scores as a miss.
    s = intervalReducer(s, { type: 'answerFret', pos: { s: 2, f: 4 } });
    expect(s).toMatchObject({ farLast: false, wrong: [{ s: 2, f: 4 }] });
    expect(s.stats.total).toBe(1);

    const clean = intervalReducer(
      intervalReducer(base({ mode: 'fret' }), { type: 'answerFret', pos: farPos }),
      { type: 'answerFret', pos: { s: 2, f: 3 } },
    );
    expect(clean).toMatchObject({ answered: true, farLast: false });
    expect(clean.stats).toMatchObject({ correct: 1, total: 1 });
  });

  it('Find it: a wrong note outside the box is an ordinary miss', () => {
    // The root itself, and a note on a lower string.
    for (const pos of [{ s: 1, f: 5 }, { s: 0, f: 6 }]) {
      const s = intervalReducer(base({ mode: 'fret' }), { type: 'answerFret', pos });
      expect(s).toMatchObject({ wrong: [pos], far: [], farLast: false });
      expect(s.stats.total).toBe(1);
    }
  });

  it('a new question clears the out-of-range taps', () => {
    const s = intervalReducer(
      base({ mode: 'fret' }), { type: 'answerFret', pos: { s: 3, f: 10 } },
    );
    expect(intervalReducer(s, { type: 'next', q })).toMatchObject({ far: [], farLast: false });
  });

  it('ignores answers from the other mode', () => {
    const s = base({ mode: 'fret' });
    expect(intervalReducer(s, { type: 'answerName', semis: 3 })).toBe(s);
  });

  it('next and regenerating settings reset the attempt', () => {
    const answered = intervalReducer(base(), { type: 'answerName', semis: 4 });
    const n = intervalReducer(answered, { type: 'next', q: null });
    expect(n).toMatchObject({ q: null, wrong: [], answered: false, advanceMs: null });
    const kept = intervalReducer(answered, {
      type: 'settings', set: { ...answered.set, noteNames: true },
    });
    expect(kept.wrong).toEqual([4]);
    expect(kept.set.noteNames).toBe(true);
  });
});
