import {
  answerState, attemptDots, attemptFeedback, missSuffix,
} from '@/features/practice/quiz/attempt';

const TEXT = {
  none: 'Nothing fits', correct: 'm3', far: 'Too far', names: ['P1', 'm2', 'M2'],
};
const attempt = (patch = {}) => ({
  q: {}, answered: false, wrong: [], far: [], farLast: false, ...patch,
});

describe('missSuffix', () => {
  it('counts the misses, or says nothing for a clean answer', () => {
    expect(missSuffix(0)).toBe('');
    expect(missSuffix(1)).toBe(' (after 1 miss)');
    expect(missSuffix(3)).toBe(' (after 3 misses)');
  });
});

describe('attemptDots', () => {
  it('marks tapped misses with ✕ and out-of-range taps with the label', () => {
    const dots = attemptDots(
      { wrong: [4, { s: 1, f: 2 }], far: [{ s: 3, f: 10 }] }, 'm3',
    );
    expect(dots).toMatchObject([
      { kind: 'wrong', s: 1, f: 2, label: '✕' },
      { kind: 'far', s: 3, f: 10, label: 'm3' },
    ]);
  });
});

describe('answerState', () => {
  it('is wrong for a missed answer, correct for the solved one, else idle', () => {
    const open = { wrong: [2], answered: false };
    expect(answerState(open, 2, 1)).toBe('wrong');
    expect(answerState(open, 1, 1)).toBe('idle');
    expect(answerState({ wrong: [2], answered: true }, 1, 1)).toBe('correct');
    expect(answerState({ wrong: [], answered: true }, 0, undefined)).toBe('idle');
  });
});

describe('attemptFeedback', () => {
  it('explains a missing question', () => {
    expect(attemptFeedback(attempt({ q: null }), TEXT))
      .toEqual({ feedback: 'Nothing fits', tone: 'neutral' });
  });

  it('is empty before any try', () => {
    expect(attemptFeedback(attempt(), TEXT)).toEqual({ feedback: '', tone: 'neutral' });
  });

  it('names the last wrong answer, or the fret for a tap', () => {
    expect(attemptFeedback(attempt({ wrong: [1, 2] }), TEXT))
      .toEqual({ feedback: 'Not M2 — try again', tone: 'danger' });
    expect(attemptFeedback(attempt({ wrong: [{ s: 0, f: 1 }] }), TEXT).feedback)
      .toBe('Not that fret — try again');
  });

  it('prefers the out-of-range note while it is the latest tap', () => {
    expect(attemptFeedback(attempt({ wrong: [{ s: 0, f: 1 }], farLast: true }), TEXT))
      .toEqual({ feedback: 'Too far', tone: 'neutral' });
  });

  it('confirms the answer with the miss count', () => {
    expect(attemptFeedback(attempt({ answered: true }), TEXT))
      .toEqual({ feedback: 'Correct — m3', tone: 'success' });
    expect(attemptFeedback(attempt({ answered: true, wrong: [1] }), TEXT).feedback)
      .toBe('Correct — m3 (after 1 miss)');
  });
});
