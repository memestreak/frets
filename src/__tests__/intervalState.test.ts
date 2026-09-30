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
