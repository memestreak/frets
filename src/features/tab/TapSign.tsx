import { TAP_RADIUS } from './layout';
import { type TabLook } from './tabLook';

/** A tap's sign: a T in a circle centred on (x, y), filled with the paper so a line under it is hidden. */
export function TapSign({ x, y, look, testId }: { x: number; y: number; look: TabLook; testId: string }) {
  return (
    <g data-testid={testId}>
      <circle cx={x} cy={y} r={TAP_RADIUS} fill={look.paper} stroke={look.ink} strokeWidth={0.9} />
      <text x={x} y={y + 3} fontSize={8.5} fontWeight={700} fill={look.ink} textAnchor="middle">T</text>
    </g>
  );
}
