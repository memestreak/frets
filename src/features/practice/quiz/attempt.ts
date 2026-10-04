import type { FretDot } from '@/components/fretboard/Fretboard';
import { DOT } from '@/components/fretboard/theme';
import type { AnswerButton, FeedbackTone } from './AnswerCard';
import type { TrainerState } from './trainerState';

type Attempt = Pick<
  TrainerState<unknown, unknown>, 'q' | 'answered' | 'wrong' | 'far' | 'farLast'
>;

export const missSuffix = (n: number): string =>
  n ? ` (after ${n} ${n === 1 ? 'miss' : 'misses'})` : '';

/**
 * Board marks for the Find-it taps so far: an ✕ on each miss, and `farLabel`
 * on each right answer beyond the range (marked, but not as a miss).
 */
export function attemptDots(
  { wrong, far }: Pick<Attempt, 'wrong' | 'far'>, farLabel: string,
): FretDot[] {
  const dots: FretDot[] = [];
  for (const w of wrong) {
    if (typeof w === 'number') continue;
    dots.push({
      ...w, kind: 'wrong', ...DOT.wrong, label: '✕', fontSize: 12,
    });
  }
  for (const p of far) {
    dots.push({
      ...p, kind: 'far', ...DOT.other, label: farLabel, fontSize: 10,
    });
  }
  return dots;
}

/** State of the Name-it button for `key`; `right` is the question's answer. */
export const answerState = (
  { wrong, answered }: Pick<Attempt, 'wrong' | 'answered'>,
  key: number,
  right: number | undefined,
): AnswerButton['state'] =>
  wrong.includes(key) ? 'wrong' : answered && right === key ? 'correct' : 'idle';

interface FeedbackText {
  /** Shown when the settings allow no question. */
  none: string;
  /** Name of the right answer, after "Correct — ". */
  correct: string;
  /** Shown after a right answer beyond the range. */
  far: string;
  /** Name-it answer names, indexed by answer. */
  names: readonly string[];
}

/** The answer card's message for the attempt so far. */
export function attemptFeedback(
  { q, answered, wrong, farLast }: Attempt, text: FeedbackText,
): { feedback: string; tone: FeedbackTone } {
  if (!q) return { feedback: text.none, tone: 'neutral' };
  if (answered) {
    return {
      feedback: `Correct — ${text.correct}${missSuffix(wrong.length)}`,
      tone: 'success',
    };
  }
  if (farLast) return { feedback: text.far, tone: 'neutral' };
  if (wrong.length) {
    const last = wrong[wrong.length - 1];
    return {
      feedback: `Not ${typeof last === 'number' ? text.names[last] : 'that fret'} — try again`,
      tone: 'danger',
    };
  }
  return { feedback: '', tone: 'neutral' };
}
