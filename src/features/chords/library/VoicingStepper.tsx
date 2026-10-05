import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';

interface VoicingStepperProps {
  /** 0-based place of the shown voicing in the list ‹ › walk through. */
  index: number;
  total: number;
  /** "Moveable 2 of 9 · root on E · frets 5–7" */
  caption: string;
  onStep: (by: 1 | -1) => void;
}

/** ‹ › through the voicings, and where the one on the neck sits. */
export function VoicingStepper({ index, total, caption, onStep }: VoicingStepperProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="mode-steps">
        <button
          type="button" className="btn btn-secondary btn-icon" aria-label="Previous shape"
          disabled={index <= 0} onClick={() => onStep(-1)}
        >
          <ChevronLeftIcon />
        </button>
        <button
          type="button" className="btn btn-secondary btn-icon" aria-label="Next shape"
          disabled={index >= total - 1} onClick={() => onStep(1)}
        >
          <ChevronRightIcon />
        </button>
      </div>
      <span className="text-(--ink-muted)" aria-live="polite" data-testid="shape-caption">
        {caption}
      </span>
    </div>
  );
}
