'use client';

import { useEffect, useId, useRef } from 'react';
import { IN_TUNE_CENTS, strobeStep } from './tuner';

/** The strobe's box, the same as the dial's. */
const W = 320;
const H = 190;

/** One band: where it sits, one light and one dark stripe, and how fast it drifts. */
const BANDS = [
  { y: 18, period: 48, speed: 1 },
  { y: 73, period: 24, speed: 2 },
  { y: 128, period: 12, speed: 4 },
] as const;
const BAND_H = 44;

/**
 * A strobe of three bands on a rosewood face: stripes that drift right
 * when sharp and left when flat, faster the further off, and stand still
 * in tune. The finer bands drift faster, so a few cents still show. With
 * `cents` null (nothing heard) they stand still, faded.
 */
export function Strobe({ cents }: { cents: number | null }) {
  // url(#…) wants a plain id.
  const id = `strobe${useId().replace(/[^\w-]/g, '')}`;
  const patterns = useRef<(SVGPatternElement | null)[]>([]);
  const latest = useRef(cents);
  useEffect(() => {
    latest.current = cents;
  });

  useEffect(() => {
    const offsets = BANDS.map(() => 0);
    let last = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      frame = requestAnimationFrame(tick);
      const c = latest.current;
      BANDS.forEach((band, i) => {
        if (c != null) {
          offsets[i] = (offsets[i] + band.speed * strobeStep(c, now - last)) % band.period;
        }
        patterns.current[i]?.setAttribute('patternTransform', `translate(${offsets[i]} 0)`);
      });
      last = now;
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const inTune = cents != null && Math.abs(cents) <= IN_TUNE_CENTS;
  return (
    <svg
      className="strobe" viewBox={`0 0 ${W} ${H}`} aria-hidden="true"
      data-state={cents == null ? 'idle' : inTune ? 'in-tune' : 'off'}
    >
      <defs>
        {BANDS.map((band, i) => (
          <pattern
            key={band.y} id={`${id}-${i}`} ref={el => { patterns.current[i] = el; }}
            width={band.period} height={H} patternUnits="userSpaceOnUse"
          >
            <rect className="strobe-stripe" width={band.period / 2} height={H} />
          </pattern>
        ))}
      </defs>
      <rect className="strobe-face" width={W} height={H} rx="12" />
      {BANDS.map((band, i) => (
        <rect
          key={band.y} className="strobe-band" x="10" y={band.y} width={W - 20} height={BAND_H} rx="4"
          fill={`url(#${id}-${i})`}
        />
      ))}
      <line className="strobe-mark" x1={W / 2} x2={W / 2} y1="2" y2="8" />
      <line className="strobe-mark" x1={W / 2} x2={W / 2} y1={H - 8} y2={H - 2} />
    </svg>
  );
}
