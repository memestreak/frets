import {
  emptyStats, itemPercent, parseStats, recordAnswer, statsLine,
} from '@/features/practice/quiz/stats';

describe('stats', () => {
  it('tracks streak, best, totals and per-item counts', () => {
    let s = emptyStats();
    s = recordAnswer(s, 3, true);
    s = recordAnswer(s, 3, true);
    s = recordAnswer(s, 5, false);
    s = recordAnswer(s, 3, true);
    expect(s).toMatchObject({ streak: 1, best: 2, correct: 3, total: 4 });
    expect(s.per[3]).toEqual({ c: 3, t: 3 });
    expect(s.per[5]).toEqual({ c: 0, t: 1 });
    expect(itemPercent(s, 3)).toBe(100);
    expect(itemPercent(s, 5)).toBe(0);
    expect(itemPercent(s, 7)).toBeNull();
  });

  it('formats the stats line', () => {
    expect(statsLine(emptyStats())).toBe('No answers yet this session');
    let s = emptyStats();
    for (let i = 0; i < 17; i++) s = recordAnswer(s, 1, true);
    for (let i = 0; i < 3; i++) s = recordAnswer(s, 1, false);
    s = recordAnswer(s, 1, true);
    expect(statsLine(s)).toBe('Streak 1 · best 17 · 86% of 21');
  });

  it('parses stored stats defensively', () => {
    expect(parseStats(null)).toEqual(emptyStats());
    expect(parseStats({ streak: 'x', best: 4, per: { 3: { c: 1, t: 2 }, 4: 'bad' } }))
      .toEqual({ streak: 0, best: 4, correct: 0, total: 0, per: { 3: { c: 1, t: 2 } } });
  });
});
