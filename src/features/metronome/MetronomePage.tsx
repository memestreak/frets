'use client';

/**
 * The Metronome page (issue #149, `docs/specs/2026-10-31-metronome-design.md`): one metronome,
 * shown in the view picked by the switch in its head.
 */
import { useEffect, useState } from 'react';
import { HoverTips } from '@/components/HoverTips';
import { useShortcuts } from '@/components/shortcuts/useShortcuts';
import { usePersist } from '@/hooks/usePersist';
import { loadJson } from '@/lib/storage';
import { ViewChoice } from './controls';
import { METRONOME_SHORTCUTS } from './shortcuts';
import { DISPLAY_KEY, parseDisplay, type Display } from './storage';
import { useMetronome } from './useMetronome';
import { MetronomeView } from './views';

export default function MetronomePage() {
  const m = useMetronome();
  const [display, setDisplay] = useState<Display>(() => parseDisplay(loadJson(DISPLAY_KEY)));
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

  return (
    <ViewChoice.Provider value={{ view: display.view, setView: view => setDisplay({ view }) }}>
      <HoverTips>
        <MetronomeView view={display.view} m={m} />
      </HoverTips>
    </ViewChoice.Provider>
  );
}
