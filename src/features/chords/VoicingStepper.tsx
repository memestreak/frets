import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';

interface VoicingStepperProps {
  /** Whether the shape can slide a fret toward the nut, and away from it. */
  canMoveDown: boolean;
  canMoveUp: boolean;
  /** The tapping hint with nothing played; otherwise empty. */
  caption: string;
  onMove: (by: 1 | -1) => void;
}

/** ‹ › slide the shape on the neck a fret down or up, and a caption. */
export function VoicingStepper({ canMoveDown, canMoveUp, caption, onMove }: VoicingStepperProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="mode-steps">
        <button
          type="button" className="btn btn-secondary btn-icon" aria-label="Move shape down a fret"
          disabled={!canMoveDown} onClick={() => onMove(-1)}
        >
          <ChevronLeftIcon />
        </button>
        <button
          type="button" className="btn btn-secondary btn-icon" aria-label="Move shape up a fret"
          disabled={!canMoveUp} onClick={() => onMove(1)}
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
