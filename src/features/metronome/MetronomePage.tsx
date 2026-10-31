'use client';

/**
 * The Metronome page (issue #149, `docs/specs/2026-10-31-metronome-design.md`): one metronome,
 * shown in the view picked by the switch in its head.
 */
import { useEffect, useState } from 'react';
import { HoverTips } from '@/components/HoverTips';
import { showShortcuts, useShortcuts } from '@/components/shortcuts/useShortcuts';
import { usePersist, usePreferenceSaveProblem } from '@/hooks/usePersist';
import { loadJson } from '@/lib/storage';
import { HeadEnd, ViewChoice } from './controls';
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
      <HeadEnd.Provider value={<PageHeadEnd />}>
        <HoverTips>
          <MetronomeView view={display.view} m={m} />
        </HoverTips>
      </HeadEnd.Provider>
    </ViewChoice.Provider>
  );
}

/** The head's end on the page: the ⚠ while the view can't be saved, and the shortcuts' `?`. */
function PageHeadEnd() {
  const saveProblem = usePreferenceSaveProblem();
  return (
    <>
      {saveProblem && (
        <span
          className="settings-save-problem" role="img" aria-label={`The view couldn't be saved: ${saveProblem}`}
          title={`The view couldn't be saved: ${saveProblem}`}
        >
          ⚠{'\uFE0E'}
        </span>
      )}
      <button type="button" className="btn btn-secondary btn-icon" aria-label="Shortcuts" data-tip="Shortcuts (?)" onClick={showShortcuts}>
        <span aria-hidden="true" className="shortcuts-button-mark">?</span>
      </button>
    </>
  );
}
