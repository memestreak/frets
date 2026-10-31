'use client';

/**
 * The Metronome page (issue #149, `docs/specs/2026-10-31-metronome-design.md`): one metronome,
 * shown in the view picked in Settings › Metronome › Display.
 */
import { useEffect, useState } from 'react';
import { HoverTips } from '@/components/HoverTips';
import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { choiceField } from '@/components/settings/fields';
import { useGeneralGroup } from '@/components/settings/general';
import { section, type SettingsGroup } from '@/components/settings/types';
import { useShortcuts } from '@/components/shortcuts/useShortcuts';
import { usePersist } from '@/hooks/usePersist';
import { loadJson } from '@/lib/storage';
import { OpenSettings } from './controls';
import { METRONOME_SHORTCUTS } from './shortcuts';
import { DEFAULT_DISPLAY, DISPLAY_KEY, VIEWS, parseDisplay, type Display, type ViewId } from './storage';
import { useMetronome } from './useMetronome';
import { MetronomeView } from './views';

export default function MetronomePage() {
  const m = useMetronome();
  const [display, setDisplay] = useState<Display>(() => parseDisplay(loadJson(DISPLAY_KEY)));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const generalGroup = useGeneralGroup();
  usePersist(DISPLAY_KEY, display);
  useShortcuts(METRONOME_SHORTCUTS);

  // T taps the tempo, page-wide, but not while typing or in a dialog.
  const { tap } = m;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 't' && e.key !== 'T') return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if ((e.target as Element | null)?.closest?.('input, select, textarea, dialog')) return;
      tap();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tap]);

  const metronomeGroup: SettingsGroup = {
    id: 'metronome', name: 'Metronome',
    sections: [section<Display>({
      id: 'display', name: 'Display', value: display, defaults: DEFAULT_DISPLAY, save: setDisplay,
      fields: [choiceField<Display, 'view', ViewId>('view', 'View', VIEWS)],
    })],
  };
  const groups = [generalGroup, metronomeGroup];

  return (
    <OpenSettings.Provider value={() => setSettingsOpen(true)}>
      <HoverTips>
        <MetronomeView view={display.view} m={m} />
      </HoverTips>
      <SettingsDialog groups={groups} open={settingsOpen} at={{ group: 'metronome', section: 'display' }} onClose={() => setSettingsOpen(false)} />
    </OpenSettings.Provider>
  );
}
