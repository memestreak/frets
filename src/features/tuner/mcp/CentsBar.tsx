/**
 * The chat tuner's meter: a flat bar from −50 to +50 cents with a needle at the cents heard, the
 * in-tune zone in the middle lit when the needle is in it. Faded at the centre when nothing is heard.
 */
import { IN_TUNE_CENTS } from '@/components/tuner/tuner';

const W = 320;
const H = 28;
const PAD = 10;
const MAX_CENTS = 50;
/** A tick every 10 cents, a long one every 50. */
const TICKS = Array.from({ length: 11 }, (_, i) => i * 10 - MAX_CENTS);

const x = (cents: number) =>
  PAD + ((Math.max(-MAX_CENTS, Math.min(MAX_CENTS, cents)) + MAX_CENTS) / (2 * MAX_CENTS)) * (W - 2 * PAD);

export function CentsBar({ cents }: { cents: number | null }) {
  const inTune = cents != null && Math.abs(cents) <= IN_TUNE_CENTS;
  return (
    <svg className="cents-bar" viewBox={`0 0 ${W} ${H}`} data-in-tune={inTune} aria-hidden="true">
      <rect className="cents-bar-track" x={PAD} y="9" width={W - 2 * PAD} height="10" rx="5" />
      <rect className="cents-bar-zone" x={x(-IN_TUNE_CENTS)} y="9" width={x(IN_TUNE_CENTS) - x(-IN_TUNE_CENTS)} height="10" />
      {TICKS.map(c => (
        <line key={c} className="cents-bar-tick" data-major={c % 50 === 0} x1={x(c)} x2={x(c)} y1="21" y2={c % 50 === 0 ? 27 : 24} />
      ))}
      <g className="cents-bar-needle" data-idle={cents == null} style={{ transform: `translateX(${x(cents ?? 0) - W / 2}px)` }}>
        <rect x={W / 2 - 2} y="2" width="4" height="24" rx="2" />
      </g>
    </svg>
  );
}
