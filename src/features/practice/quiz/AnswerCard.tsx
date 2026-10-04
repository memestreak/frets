import type { ReactNode, Ref } from 'react';
import { Keycap } from '@/components/controls';

export type FeedbackTone = 'neutral' | 'success' | 'danger';

interface AnswerCardProps {
  kicker: string;
  /** Muted instruction beside the kicker, e.g. "Tap a fret on the board". */
  hint?: string;
  feedback: string;
  tone: FeedbackTone;
  answered: boolean;
  pause: boolean;
  onSkip: () => void;
  onNext: () => void;
  children: ReactNode;
}

const TONE_CLASS: Record<FeedbackTone, string> = {
  neutral: '',
  success: 'text-(--success)',
  danger: 'text-(--danger)',
};

export function AnswerCard({
  kicker, hint, feedback, tone, answered, pause, onSkip, onNext, children,
}: AnswerCardProps) {
  return (
    <section className="card gap-2 px-[18px] pt-2.5 pb-3">
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="card-kicker">{kicker}</span>
          {hint && <span className="text-muted text-[12px]">{hint}</span>}
          <span
            className={`text-[15px] font-medium ${TONE_CLASS[tone]}`}
            role="status"
            aria-live="polite"
            data-testid="feedback"
          >
            {feedback}
          </span>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost" onClick={onSkip}>
            Skip
          </button>
          {answered && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onNext}
            >
              Next <Keycap>{pause ? 'any key' : '↵'}</Keycap>
            </button>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

export interface AnswerButton {
  label: string;
  state: 'idle' | 'wrong' | 'correct';
  onClick: () => void;
}

/** One row of equal-width answer buttons. */
export function AnswerGrid({
  buttons, variant, ref,
}: {
  buttons: AnswerButton[];
  variant: 'interval' | 'note';
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <div className="answer-grid" data-variant={variant} ref={ref}>
      {buttons.map(b => (
        <button
          key={b.label}
          type="button"
          className="btn answer-btn"
          data-state={b.state}
          disabled={b.state === 'wrong'}
          onClick={b.onClick}
        >
          {b.label.split('/').map((part, i) => (
            <span key={part}>{i > 0 && '/'}{part}</span>
          ))}
        </button>
      ))}
    </div>
  );
}

/**
 * Focuses the answer button `delta` places from the focused one, skipping
 * disabled (wrong) buttons and wrapping at the ends. With none focused it
 * steps from button `from`; with `from` out of range too, the first step
 * lands on the first (right) or last (left) button. Returns the index
 * focused, or null when every button is disabled.
 */
export function stepAnswerFocus(
  grid: HTMLElement, delta: -1 | 1, from: number,
): number | null {
  const tiles = [...grid.querySelectorAll<HTMLButtonElement>('.answer-btn')];
  const n = tiles.length;
  const focused = tiles.findIndex(t => t === document.activeElement);
  let start = focused >= 0 ? focused : from;
  if (start < 0 || start >= n) start = delta > 0 ? -1 : n;
  for (let i = 1; i <= n; i++) {
    const index = (((start + delta * i) % n) + n) % n;
    if (!tiles[index].disabled) {
      tiles[index].focus();
      return index;
    }
  }
  return null;
}

/** Centered Find-it target: large display label and a description. */
export function FindPrompt({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-center gap-3.5 text-center">
      <span
        className="font-(family-name:--font-display) text-[44px] leading-none font-semibold text-(--primary)"
        data-testid="find-label"
      >
        {label}
      </span>
      <span className="text-[15px]">{children}</span>
    </div>
  );
}
