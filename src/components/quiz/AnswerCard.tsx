import type { ReactNode } from 'react';
import { Keycap } from '../controls';

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
  success: 'text-(--color-success-deep)',
  danger: 'text-(--color-danger)',
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
  buttons, variant,
}: { buttons: AnswerButton[]; variant: 'interval' | 'note' }) {
  return (
    <div className="answer-grid" data-variant={variant}>
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

/** Centered Find-it target: large accent label and a description. */
export function FindPrompt({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-center gap-3.5 text-center">
      <span
        className="font-(family-name:--font-heading) text-[44px] leading-none font-semibold text-(--color-accent)"
        data-testid="find-label"
      >
        {label}
      </span>
      <span className="text-[15px]">{children}</span>
    </div>
  );
}
