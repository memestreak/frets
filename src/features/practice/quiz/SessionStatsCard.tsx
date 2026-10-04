import { statsLine, type SessionStats } from '@/features/practice/quiz/stats';
import { PerItemStats, type PerItemRow } from './SettingsParts';

interface SessionStatsCardProps {
  stats: SessionStats;
  rows: PerItemRow[];
  labelWidth: number;
  /** Group label for the bars, e.g. "Per interval". */
  itemLabel: string;
  onReset: () => void;
}

/** Session summary, reset, and per-item accuracy bars, below the board. */
export function SessionStatsCard(
  { stats, rows, labelWidth, itemLabel, onReset }: SessionStatsCardProps,
) {
  return (
    <section
      className="card mt-3.5 gap-3 px-[18px] py-3.5"
      aria-label="Session stats"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[14px] font-medium" data-testid="stats-line">
          {statsLine(stats)}
        </span>
        <button type="button" className="btn btn-ghost" onClick={onReset}>
          Reset session stats
        </button>
      </div>
      <div role="group" aria-label={itemLabel}>
        <PerItemStats rows={rows} labelWidth={labelWidth} />
      </div>
    </section>
  );
}
