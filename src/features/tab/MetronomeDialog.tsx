'use client';

/**
 * The Metronome dialog, from a right-click on the footer's Metronome (issue #477; Jeremy,
 * 2026-11-14: a modal panel, as REAPER's metronome settings are). It shows Tab › Metronome's fields,
 * the same as Settings (`METRONOME_FIELDS`), and each change takes effect at once, heard as the clip
 * plays: the toggle, the count-in, the sound, Subdivide, Click on and the volumes.
 */
import { Modal } from '@/components/Modal';
import { SettingsFields } from '@/components/settings/SettingsDialog';
import { DEFAULT_METRONOME, type MetronomeSettings } from './PlaybackFooter';
import { METRONOME_FIELDS } from './tabSettings';

export function MetronomeDialog({ open, metronome, onMetronome, onClose }: {
  open: boolean;
  metronome: MetronomeSettings;
  onMetronome: (metronome: MetronomeSettings) => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Metronome" className="tab-metronome-dialog">
      <SettingsFields fields={METRONOME_FIELDS} defaults={DEFAULT_METRONOME} value={metronome} onChange={onMetronome} />
    </Modal>
  );
}
