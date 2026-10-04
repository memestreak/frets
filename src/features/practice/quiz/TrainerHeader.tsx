import type { ReactNode } from 'react';
import { PauseIcon, SlidersIcon } from '@/components/icons';
import { ToggleButton } from '@/components/controls';

interface TrainerHeaderProps {
  title: string;
  /** Mode segmented control. */
  controls: ReactNode;
  pause: boolean;
  onTogglePause: () => void;
  onOpenSettings: () => void;
}

export function TrainerHeader({
  title, controls, pause, onTogglePause, onOpenSettings,
}: TrainerHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3.5">
      <h2 className="m-0">{title}</h2>
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
