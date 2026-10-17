'use client';

import { useSyncExternalStore } from 'react';
import { MicIcon } from '@/components/icons';
import { SILENT, type MicListener, type MicStatus } from '@/components/tuner/listener';
import { pitchLabel } from '@/components/tuner/pitch';

interface MicButtonProps {
  listener: MicListener;
  status: MicStatus;
  onToggle: () => void;
}

/**
 * The mic toggle. On, it shows the note it hears and a level meter, in a
 * button the same size whatever it shows.
 */
export function MicButton({ listener, status, onToggle }: MicButtonProps) {
  const on = status === 'on' || status === 'starting';
  const { level, midi } = useSyncExternalStore(
    listener.subscribe, listener.getReading, () => SILENT,
  );
  return (
    <button
      type="button"
      className="btn btn-secondary btn-toggle mic-btn"
      aria-pressed={on}
      aria-label="Answer by playing (microphone)"
      title="Play the note on your guitar"
      onClick={onToggle}
    >
      <MicIcon />
      <span className="mic-note" data-testid="mic-note">
        {on ? (midi == null ? '–' : pitchLabel(midi)) : 'Mic'}
      </span>
      <span className="mic-meter" data-on={on}>
        <span style={{ transform: `scaleX(${on ? level : 0})` }} />
      </span>
    </button>
  );
}
