'use client';

import { useState } from 'react';

/**
 * A Tap button's flash (`.tap-pulse`, with `.tap-press` on the button): `pulse()` on each press shows
 * a fresh one, `flash` is the element to put inside the button. The Metronome's Tap and show_tab's.
 */
export function useTapPulse() {
  const [count, setCount] = useState(0);
  return {
    pulse: () => setCount(c => c + 1),
    flash: count > 0 ? <span key={count} className="tap-pulse" aria-hidden="true" /> : null,
  };
}
