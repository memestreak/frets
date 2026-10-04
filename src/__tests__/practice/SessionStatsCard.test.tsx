import { fireEvent, render, screen, within } from '@testing-library/react';
import { SessionStatsCard } from '@/features/practice/quiz/SessionStatsCard';
import { emptyStats, recordAnswer } from '@/features/practice/quiz/stats';

const ROWS = [
  { label: 'm2', pct: 100 },
  { label: 'M2', pct: null },
];

describe('SessionStatsCard', () => {
  it('shows the summary line and one meter per row', () => {
    const stats = recordAnswer(emptyStats(), 1, true);
    render(
      <SessionStatsCard
        stats={stats} rows={ROWS} labelWidth={34}
        itemLabel="Per interval" onReset={() => {}}
      />,
    );
    const card = screen.getByRole('region', { name: 'Session stats' });
    expect(within(card).getByTestId('stats-line'))
      .toHaveTextContent('Streak 1 · best 1 · 100% of 1');
    const bars = within(card).getByRole('group', { name: 'Per interval' });
    expect(within(bars).getAllByRole('meter')).toHaveLength(2);
    expect(within(bars).getByRole('meter', { name: 'm2 accuracy' }))
      .toHaveAttribute('aria-valuenow', '100');
  });

  it('shows the placeholder before any answers', () => {
    render(
      <SessionStatsCard
        stats={emptyStats()} rows={ROWS} labelWidth={34}
        itemLabel="Per interval" onReset={() => {}}
      />,
    );
    expect(screen.getByTestId('stats-line'))
      .toHaveTextContent('No answers yet this session');
  });

  it('calls onReset from the reset button', () => {
    const onReset = vi.fn();
    render(
      <SessionStatsCard
        stats={emptyStats()} rows={ROWS} labelWidth={34}
        itemLabel="Per interval" onReset={onReset}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reset session stats' }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
