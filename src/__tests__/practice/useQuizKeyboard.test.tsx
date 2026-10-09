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
    fireEvent.keyDown(window, { key: ' ' });
    expect(onAnswerKey).toHaveBeenCalledWith('3');
    expect(onToggleHint).toHaveBeenCalledTimes(1);
  });

  it('toggles the hint once per Space press, ignoring auto-repeat', () => {
    const { onToggleHint } = setup({});
    fireEvent.keyDown(window, { key: ' ' });
    fireEvent.keyDown(window, { key: ' ', repeat: true });
    fireEvent.keyUp(window, { key: ' ' });
    expect(onToggleHint).toHaveBeenCalledTimes(1);
  });

  it('takes Space before a focused button or board cell sees it', () => {
    const { onToggleHint } = setup({});
    const el = document.createElement('button');
    const pressed = vi.fn();
    el.addEventListener('keydown', pressed);
    el.addEventListener('keyup', pressed);
    document.body.append(el);
    const down = fireEvent.keyDown(el, { key: ' ' });
    const up = fireEvent.keyUp(el, { key: ' ' });
    expect(onToggleHint).toHaveBeenCalledTimes(1);
    expect(pressed).not.toHaveBeenCalled();
    // Default prevented: no button press, no page scroll.
    expect(down).toBe(false);
    expect(up).toBe(false);
    el.remove();
  });

  it('leaves Space alone in a text field', () => {
    const { onToggleHint } = setup({});
    const input = document.createElement('input');
    document.body.append(input);
    fireEvent.keyDown(input, { key: ' ' });
    expect(onToggleHint).not.toHaveBeenCalled();
    input.remove();
  });

  it('once answered, Enter goes to the next question and Space only toggles the hint', () => {
    const { onNext, onToggleHint } = setup({ answered: true });
    fireEvent.keyDown(window, { key: ' ' });
    expect(onNext).not.toHaveBeenCalled();
    expect(onToggleHint).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('ignores answer, hint and next keys when disabled', () => {
    const { onAnswerKey, onToggleHint, onNext, rerender } = setup({ enabled: false });
    fireEvent.keyDown(window, { key: '3' });
    fireEvent.keyDown(window, { key: ' ' });
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
