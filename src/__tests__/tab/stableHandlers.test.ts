import { renderHook } from '@testing-library/react';
import { useStableHandlers } from '@/features/tab/useStableHandlers';

describe('useStableHandlers', () => {
  it('hands back the same handlers on every render, each calling the latest one given', () => {
    const calls: string[] = [];
    const { result, rerender } = renderHook(({ word }) => useStableHandlers({ onPick: (n: number) => calls.push(`${word} ${n}`) }), {
      initialProps: { word: 'first' },
    });
    const first = result.current.onPick;
    rerender({ word: 'second' });
    expect(result.current.onPick).toBe(first);
    first(1);
    expect(calls).toEqual(['second 1']);
  });

  it('leaves a handler out while it is undefined, and makes a new set when it comes back', () => {
    const { result, rerender } = renderHook(({ on }) => useStableHandlers({ onPick: () => 1, onDrag: on ? () => 2 : undefined }), {
      initialProps: { on: false },
    });
    expect(result.current.onDrag).toBeUndefined();
    const before = result.current;
    rerender({ on: true });
    expect(result.current.onDrag?.()).toBe(2);
    expect(result.current).not.toBe(before);
  });
});
