import { IN_TUNE_CENTS } from './tuner';

/** The needle's pivot and the scale's radius, in the 320 × 190 box. */
const CX = 160;
const CY = 172;
const R = 138;
/** The scale runs from −50 to +50 cents; the needle stops at its ends. */
const MAX_CENTS = 50;
/** How far either side of upright the ends of the scale are. */
const SWEEP_DEG = 62;
/** A tick every 5 cents, a long one every 25. */
const TICKS = Array.from({ length: 21 }, (_, i) => i * 5 - MAX_CENTS);

const angle = (cents: number) =>
  (Math.max(-MAX_CENTS, Math.min(MAX_CENTS, cents)) / MAX_CENTS) * SWEEP_DEG;

/** The point `r` from the pivot, at `cents` on the scale. */
function at(cents: number, r: number): [number, number] {
  const a = (angle(cents) * Math.PI) / 180;
  return [CX + r * Math.sin(a), CY - r * Math.cos(a)];
}

function arc(from: number, to: number): string {
  const [x1, y1] = at(from, R);
  const [x2, y2] = at(to, R);
  return `M${x1} ${y1} A${R} ${R} 0 0 1 ${x2} ${y2}`;
}

/**
 * A half-circle gauge: a needle at the cents heard, upright and faded when
 * nothing is heard; the zone round the top lit, and the needle green, in
 * tune.
 */
export function Dial({ cents }: { cents: number | null }) {
  const inTune = cents != null && Math.abs(cents) <= IN_TUNE_CENTS;
  const [flatX, flatY] = at(-MAX_CENTS, R);
  const [sharpX, sharpY] = at(MAX_CENTS, R);
  return (
    <svg className="dial" viewBox="0 0 320 190" data-in-tune={inTune} aria-hidden="true">
      <path className="dial-track" d={arc(-MAX_CENTS, MAX_CENTS)} />
      <path className="dial-zone" d={arc(-IN_TUNE_CENTS, IN_TUNE_CENTS)} />
      {TICKS.map(c => {
        const major = c % 25 === 0;
        const [x1, y1] = at(c, R - 10);
        const [x2, y2] = at(c, R - (major ? 26 : 18));
        return (
          <line
            key={c} className="dial-tick" data-major={major}
            x1={x1} y1={y1} x2={x2} y2={y2}
          />
        );
      })}
      {[-50, -25, 25, 50].map(c => {
        const [x, y] = at(c, R - 42);
        return (
          <text key={c} className="dial-label" x={x} y={y + 4}>
            {c > 0 ? `+${c}` : `−${-c}`}
          </text>
        );
      })}
      <text className="dial-sign" x={flatX} y={flatY + 36}>♭</text>
      <text className="dial-sign" x={sharpX} y={sharpY + 36}>♯</text>
      <g
        className="dial-needle" data-idle={cents == null}
        style={{ transform: `rotate(${cents == null ? 0 : angle(cents)}deg)` }}
      >
        <line x1={CX} y1={CY} x2={CX} y2={CY - R + 4} />
      </g>
      <circle className="dial-hub" cx={CX} cy={CY} r="9" />
    </svg>
  );
}
