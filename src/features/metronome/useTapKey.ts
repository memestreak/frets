'use client';

import { useEffect } from 'react';

/** T taps the tempo, anywhere, but not while typing or in a dialog. */
export function useTapKey(tap: () => void) {
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
}
