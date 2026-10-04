import { fireEvent, renderHook } from '@testing-library/react';
import { useQuizKeyboard } from '@/features/practice/quiz/useQuizKeyboard';

function setup(initial: { enabled?: boolean; answered?: boolean }) {
  const onNext = vi.fn();
  const onHint = vi.fn();
  const onAnswerKey = vi.fn();
  const onArrow = vi.fn();
  const view = renderHook(
    (props: { enabled?: boolean; answered?: boolean }) => useQuizKeyboard({
      answered: props.answered ?? false,
      pause: false,
      onNext,
      onHint,
      onAnswerKey,
      onArrow,
      enabled: props.enabled,
    }),
    { initialProps: initial },
  );
  return { onNext, onHint, onAnswerKey, onArrow, ...view };
}

describe('useQuizKeyboard', () => {
  it('handles keys by default', () => {
    const { onAnswerKey, onHint } = setup({});
    expect(onHint).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: '3' });
    fireEvent.keyDown(window, { key: 'h' });
    expect(onAnswerKey).toHaveBeenCalledWith('3');
    expect(onHint).toHaveBeenCalledWith(true);
  });

  it('ignores answer, hint and next keys when disabled', () => {
    const { onAnswerKey, onHint, onNext, rerender } = setup({ enabled: false });
    onHint.mockClear();
    fireEvent.keyDown(window, { key: '3' });
    fireEvent.keyDown(window, { key: 'h' });
    rerender({ enabled: false, answered: true });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onAnswerKey).not.toHaveBeenCalled();
    expect(onHint).not.toHaveBeenCalledWith(true);
    expect(onNext).not.toHaveBeenCalled();
  });

  it('releases a held hint when it becomes disabled', () => {
    const { onHint, rerender } = setup({ enabled: true });
    fireEvent.keyDown(window, { key: 'h' });
    onHint.mockClear();
    rerender({ enabled: false });
    expect(onHint).toHaveBeenCalledWith(false);
    onHint.mockClear();
    rerender({ enabled: true });
    expect(onHint).not.toHaveBeenCalled();
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
