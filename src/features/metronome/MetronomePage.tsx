'use client';

/**
 * The Metronome page (issue #149, `docs/specs/2026-10-31-metronome-design.md`): one metronome,
 * shown in the view picked by the switch in its head.
 */
import { useState } from 'react';
import { HoverTips } from '@/components/HoverTips';
import { showShortcuts, useShortcuts } from '@/components/shortcuts/useShortcuts';
import { usePersist, usePreferenceSaveProblem } from '@/hooks/usePersist';
import { loadJson } from '@/lib/storage';
import { HeadEnd, ViewChoice } from './controls';
import { METRONOME_SHORTCUTS } from './shortcuts';
import { DISPLAY_KEY, parseDisplay, type Display } from './storage';
import { useMetronome } from './useMetronome';
import { useTapKey } from './useTapKey';
import { MetronomeView } from './views';

export default function MetronomePage() {
  const m = useMetronome();
  const [display, setDisplay] = useState<Display>(() => parseDisplay(loadJson(DISPLAY_KEY)));
  usePersist(DISPLAY_KEY, display);
  useShortcuts(METRONOME_SHORTCUTS);

  useTapKey(m.tap);

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
