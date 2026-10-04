import {
  initTrainerState, trainerReducer, wasTapped, type TrainerRules,
  type TrainerState,
} from '@/features/practice/quiz/trainerState';
import { AUTO_ADVANCE_MS } from '@/features/practice/quiz/quizFlow';
import { emptyStats } from '@/features/practice/quiz/stats';

// A toy trainer: the question is a fret number, named by that number or
// found on string 0. Frets past `reach` are out of range.
interface Settings { find: boolean; reach: number; pause: boolean }
type State = TrainerState<Settings, number>;

const RULES: TrainerRules<Settings, number> = {
  key: q => q,
  named: (_q, set) => !set.find,
  isCorrect: (q, pos, set) => pos.f === q && pos.s <= set.reach,
  isOutOfRange: (q, pos, set) => pos.f === q && pos.s > set.reach,
};

const base = (patch: Partial<Settings> = {}): State => ({
  set: { find: false, reach: 2, pause: false, ...patch },
  stats: emptyStats(),
  q: 7,
  picked: null,
  far: [],
  farLast: false,
  answered: false,
  wrong: [],
  advanceMs: null,
});

const reduce = (s: State, a: Parameters<typeof trainerReducer<Settings, number>>[2]) =>
  trainerReducer(RULES, s, a);

describe('trainerReducer', () => {
  it('scores a named answer under the question key', () => {
    const s = reduce(base(), { type: 'answerName', key: 7 });
    expect(s).toMatchObject({ answered: true, advanceMs: AUTO_ADVANCE_MS });
    expect(s.stats.per[7]).toEqual({ c: 1, t: 1 });
  });

  it('takes named answers or taps, never both', () => {
    const named = base();
    expect(reduce(named, { type: 'answerFret', pos: { s: 0, f: 7 } })).toBe(named);
    const find = base({ find: true });
    expect(reduce(find, { type: 'answerName', key: 7 })).toBe(find);
  });

  it('ignores answers with no question or once answered', () => {
    const none = { ...base(), q: null };
    expect(reduce(none, { type: 'answerName', key: 7 })).toBe(none);
    const done = reduce(base(), { type: 'answerName', key: 7 });
    expect(reduce(done, { type: 'answerName', key: 3 })).toBe(done);
  });

  it('sorts a tap into solved, out of range or missed', () => {
    let s = reduce(base({ find: true }), { type: 'answerFret', pos: { s: 4, f: 7 } });
    expect(s).toMatchObject({ far: [{ s: 4, f: 7 }], farLast: true, wrong: [] });
    s = reduce(s, { type: 'answerFret', pos: { s: 0, f: 6 } });
    expect(s).toMatchObject({ wrong: [{ s: 0, f: 6 }], farLast: false });
    s = reduce(s, { type: 'answerFret', pos: { s: 1, f: 7 } });
    expect(s).toMatchObject({ answered: true, picked: { s: 1, f: 7 } });
    expect(s.stats).toMatchObject({ correct: 0, total: 1 });
  });

  it('toggles pause in the settings', () => {
    expect(reduce(base(), { type: 'togglePause' }).set.pause).toBe(true);
  });

  it('resets the stats and nothing else', () => {
    const answered = reduce(base(), { type: 'answerName', key: 7 });
    const s = reduce(answered, { type: 'resetStats' });
    expect(s.stats).toEqual(emptyStats());
    expect(s).toMatchObject({ answered: true, q: 7 });
  });

  it('settings keep the attempt unless they bring a question', () => {
    const missed = reduce(base(), { type: 'answerName', key: 3 });
    const set = { ...missed.set, reach: 5 };
    expect(reduce(missed, { type: 'settings', set })).toMatchObject({ set, wrong: [3] });
    expect(reduce(missed, { type: 'settings', set, q: 9 }))
      .toMatchObject({ set, wrong: [], q: 9 });
    // null is a question too: none fits the new settings.
    expect(reduce(missed, { type: 'settings', set, q: null }))
      .toMatchObject({ wrong: [], q: null });
  });
});

describe('wasTapped', () => {
  it('finds misses and out-of-range taps, not named answers', () => {
    const taps = { wrong: [3, { s: 1, f: 2 }], far: [{ s: 4, f: 7 }] };
    expect(wasTapped(taps, { s: 1, f: 2 })).toBe(true);
    expect(wasTapped(taps, { s: 4, f: 7 })).toBe(true);
    expect(wasTapped(taps, { s: 3, f: 3 })).toBe(false);
  });
});

describe('initTrainerState', () => {
  const KEY = 'test.trainer';
  const parse = (raw: unknown): Settings => ({
    find: false, reach: 2, pause: false, ...(raw as Partial<Settings> | undefined),
  });
  const generate = (set: Settings) => set.reach;

  beforeEach(() => localStorage.clear());

  it('starts from defaults and empty stats with nothing saved', () => {
    expect(initTrainerState(KEY, parse, generate)).toMatchObject({
      set: { reach: 2 }, stats: emptyStats(), q: 2, answered: false, wrong: [],
    });
  });

  it('loads saved settings and stats, and draws the question from them', () => {
    const stats = { ...emptyStats(), streak: 2, best: 2, correct: 2, total: 2 };
    localStorage.setItem(KEY, JSON.stringify({ set: { reach: 4 }, stats }));
    expect(initTrainerState(KEY, parse, generate)).toMatchObject({
      set: { reach: 4 }, stats, q: 4,
    });
  });

  it('falls back to defaults when the saved value is not JSON', () => {
    localStorage.setItem(KEY, '{nope');
    expect(initTrainerState(KEY, parse, generate)).toMatchObject({
      set: { reach: 2 }, stats: emptyStats(),
    });
  });
});
