export interface ItemStats {
  /** Correct answers. */
  c: number;
  /** Total scored answers. */
  t: number;
}

export interface SessionStats {
  streak: number;
  best: number;
  correct: number;
  total: number;
  per: Record<string, ItemStats>;
}

export const emptyStats = (): SessionStats => ({
  streak: 0, best: 0, correct: 0, total: 0, per: {},
});

/** Score one question for `key` (an interval or pitch class). */
export function recordAnswer(
  stats: SessionStats,
  key: number,
  ok: boolean,
): SessionStats {
  const prev = stats.per[key] ?? { c: 0, t: 0 };
  const streak = ok ? stats.streak + 1 : 0;
  return {
    streak,
    best: Math.max(stats.best, streak),
    correct: stats.correct + (ok ? 1 : 0),
    total: stats.total + 1,
    per: { ...stats.per, [key]: { c: prev.c + (ok ? 1 : 0), t: prev.t + 1 } },
  };
}

/** "Streak 3 · best 7 · 85% of 20", or a placeholder before any answers. */
export function statsLine(stats: SessionStats): string {
  if (!stats.total) return 'No answers yet this session';
  const pct = Math.round((100 * stats.correct) / stats.total);
  return `Streak ${stats.streak} · best ${stats.best} · ${pct}% of ${stats.total}`;
}

/** Percent correct for one item, or null when it has never been asked. */
export function itemPercent(stats: SessionStats, key: number): number | null {
  const e = stats.per[key];
  return e && e.t ? Math.round((100 * e.c) / e.t) : null;
}

/** Coerce stored JSON into SessionStats, dropping anything malformed. */
export function parseStats(raw: unknown): SessionStats {
  const out = emptyStats();
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  for (const k of ['streak', 'best', 'correct', 'total'] as const) {
    const v = r[k];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = v;
  }
  if (r.per && typeof r.per === 'object') {
    for (const [k, v] of Object.entries(r.per as Record<string, unknown>)) {
      const e = v as Partial<ItemStats> | null;
      if (e && typeof e.c === 'number' && typeof e.t === 'number') {
        out.per[k] = { c: e.c, t: e.t };
      }
    }
  }
  return out;
}
