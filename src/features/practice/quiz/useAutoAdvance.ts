'use client';

import { useEffect, useEffectEvent } from 'react';

/** Calls `onNext` after `delayMs`; null means no advance is pending. */
export function useAutoAdvance(delayMs: number | null, onNext: () => void) {
  const fire = useEffectEvent(onNext);
  useEffect(() => {
    if (delayMs == null) return;
    const t = window.setTimeout(() => fire(), delayMs);
    return () => window.clearTimeout(t);
  }, [delayMs]);
}
