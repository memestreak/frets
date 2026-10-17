'use client';

import { useEffect, useId, useRef } from 'react';
import { IN_TUNE_CENTS, strobeStep } from './tuner';

/** One light and one dark stripe, in SVG units. */
const PERIOD = 24;

/**
 * A strobe band: stripes that drift right when sharp and left when flat,
 * faster the further off, and stand still in tune. With `cents` null
 * (nothing heard) they stand still, faded.
 */
export function Strobe({ cents, height = 44 }: { cents: number | null; height?: number }) {
  // url(#…) wants a plain id.
  const patternId = `strobe${useId().replace(/[^\w-]/g, '')}`;
  const pattern = useRef<SVGPatternElement>(null);
  const latest = useRef(cents);
  useEffect(() => {
    latest.current = cents;
  });

  useEffect(() => {
    let offset = 0;
    let last = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      frame = requestAnimationFrame(tick);
      const c = latest.current;
      if (c != null) offset = (offset + strobeStep(c, now - last)) % PERIOD;
      last = now;
      pattern.current?.setAttribute('patternTransform', `translate(${offset} 0)`);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const inTune = cents != null && Math.abs(cents) <= IN_TUNE_CENTS;
  return (
    <svg
      className="strobe"
      data-state={cents == null ? 'idle' : inTune ? 'in-tune' : 'off'}
      width="100%"
      height={height}
      aria-hidden="true"
    >
      <defs>
        <pattern
          ref={pattern} id={patternId} width={PERIOD} height={height}
          patternUnits="userSpaceOnUse"
        >
          <rect className="strobe-stripe" width={PERIOD / 2} height={height} />
        </pattern>
      </defs>
      <rect className="strobe-track" width="100%" height={height} rx="8" />
      <rect width="100%" height={height} rx="8" fill={`url(#${patternId})`} />
    </svg>
  );
}
