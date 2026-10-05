import { fireEvent, renderHook } from '@testing-library/react';
import { useQuizKeyboard } from '@/features/practice/quiz/useQuizKeyboard';

function setup(initial: { enabled?: boolean; answered?: boolean }) {
  const onNext = vi.fn();
  const onToggleHint = vi.fn();
  const onAnswerKey = vi.fn();
  const onArrow = vi.fn();
  const view = renderHook(
    (props: { enabled?: boolean; answered?: boolean }) => useQuizKeyboard({
      answered: props.answered ?? false,
      pause: false,
      onNext,
      onToggleHint,
      onAnswerKey,
      onArrow,
      enabled: props.enabled,
    }),
    { initialProps: initial },
  );
  return { onNext, onToggleHint, onAnswerKey, onArrow, ...view };
}

describe('useQuizKeyboard', () => {
  it('handles keys by default', () => {
    const { onAnswerKey, onToggleHint } = setup({});
    expect(onToggleHint).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: '3' });
    fireEvent.keyDown(window, { key: 'h' });
    expect(onAnswerKey).toHaveBeenCalledWith('3');
    expect(onToggleHint).toHaveBeenCalledTimes(1);
  });

  it('toggles the hint once per H press, ignoring auto-repeat', () => {
    const { onToggleHint } = setup({});
    fireEvent.keyDown(window, { key: 'h' });
    fireEvent.keyDown(window, { key: 'h', repeat: true });
    fireEvent.keyUp(window, { key: 'h' });
    expect(onToggleHint).toHaveBeenCalledTimes(1);
  });

  it('ignores answer, hint and next keys when disabled', () => {
    const { onAnswerKey, onToggleHint, onNext, rerender } = setup({ enabled: false });
    fireEvent.keyDown(window, { key: '3' });
    fireEvent.keyDown(window, { key: 'h' });
    rerender({ enabled: false, answered: true });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onAnswerKey).not.toHaveBeenCalled();
    expect(onToggleHint).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('sends left and right arrows to onArrow while the question is open', () => {
    const { onArrow, onAnswerKey, rerender } = setup({});
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onArrow.mock.calls).toEqual([[1], [-1]]);
    expect(onAnswerKey).not.toHaveBeenCalled();
    onArrow.mockClear();
    rerender({ answered: true });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onArrow).not.toHaveBeenCalled();
  });

  it('leaves arrows a control already handled', () => {
    const { onArrow } = setup({});
    const el = document.createElement('button');
    el.addEventListener('keydown', e => e.preventDefault());
    document.body.append(el);
    fireEvent.keyDown(el, { key: 'ArrowRight' });
    expect(onArrow).not.toHaveBeenCalled();
    el.remove();
  });
});
