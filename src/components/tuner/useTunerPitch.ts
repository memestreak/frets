'use client';

import { useEffect, useState } from 'react';
import type { MicListener } from './listener';
import { median } from './tuner';

/** Pitches over this window are steadied by their median. */
const SMOOTH_READINGS = 5;
/** After the note stops, the reading stays up this long. */
const LINGER_MS = 400;

/**
 * The pitch the mic hears (a fractional MIDI note) steadied for a tuner,
 * or null when nothing has sounded lately. While `muted()` is true (a
 * reference note playing through the speakers) the mic is not heard.
 */
export function useTunerPitch(listener: MicListener, muted: () => boolean): number | null {
  const [pitch, setPitch] = useState<number | null>(null);
  useEffect(() => {
    const recent: number[] = [];
    let lastHeard = -Infinity;
    return listener.subscribe(() => {
      const now = performance.now();
      const heard = muted() ? null : listener.getReading().pitch;
      if (heard == null) {
        recent.length = 0;
        if (now - lastHeard > LINGER_MS) setPitch(null);
        return;
      }
      lastHeard = now;
      recent.push(heard);
      if (recent.length > SMOOTH_READINGS) recent.shift();
      setPitch(median(recent));
    });
  }, [listener, muted]);
  return pitch;
}
