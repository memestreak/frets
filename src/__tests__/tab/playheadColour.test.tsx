import { act, render, screen } from '@testing-library/react';
import { readAscii } from '@/features/tab/ascii';
import { partOf } from '@/features/tab/clip';
import { Playhead, type Playback } from '@/features/tab/PlaybackFooter';

const result = readAscii(['e', 'B', 'G', 'D', 'A', 'E'].map(n => `${n}|-${n === 'E' ? '0' : '-'}-|`).join('\n'));
if (!result.ok) throw new Error(result.errors.join('\n'));
const clip = partOf(result.clip);

/** Only what `Playhead` reads: playing, no loop, the first column heard. */
const playing = {
  view: { state: 'playing' },
  loop: null,
  heardPosition: () => ({ column: 0, through: 0 }),
} as unknown as Playback;

describe('the playback line', () => {
  it('moves in the muted green, not red (issue #291)', () => {
    vi.useFakeTimers();
    render(<Playhead clip={clip} width={400} parts="tab" playback={playing} mark={null} markOnly={false} layer="over" />);
    act(() => { vi.advanceTimersByTime(50); });
    expect(screen.getByTestId('playhead')).toHaveAttribute('stroke', 'var(--playhead)');
    vi.useRealTimers();
  });
});
