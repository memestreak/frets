import type { ReactNode } from 'react';
import { PauseIcon, SlidersIcon } from '../icons';
import { ToggleButton } from '../controls';

interface TrainerHeaderProps {
  kicker: string;
  title: string;
  sub: string;
  /** Mode segmented control. */
  controls: ReactNode;
  pause: boolean;
  onTogglePause: () => void;
  onOpenSettings: () => void;
}

export function TrainerHeader({
  kicker, title, sub, controls, pause, onTogglePause, onOpenSettings,
}: TrainerHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3.5">
      <div>
        <h6 className="mb-1 text-(--color-accent)">{kicker}</h6>
        <h2 className="m-0">{title}</h2>
        <p className="text-muted mt-1 mb-0 text-[14px]">{sub}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        {controls}
        <ToggleButton
          pressed={pause}
          onClick={onTogglePause}
          title="Wait for a key press before the next question"
        >
          <PauseIcon />
          Pause b/w
        </ToggleButton>
        <button
          type="button"
          className="btn btn-secondary"
          aria-haspopup="dialog"
          onClick={onOpenSettings}
        >
          <SlidersIcon />
          Settings
        </button>
      </div>
    </header>
  );
}
