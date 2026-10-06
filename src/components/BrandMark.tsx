/* Upright chart geometry, in the 96-unit viewBox: low E on the left. */
const STRING_X = [16, 28.8, 41.6, 54.4, 67.2, 80];
const FRET_Y = [49, 66, 83];
const OPEN_Y = 18;

/**
 * The Frets mark: the open E minor chord (0 2 2 0 0 0, for eminor.net) as an
 * upright chord chart on a rosewood tile, drawn from the board and degree
 * tokens so it follows the theme. Open strings get a ring above the nut and
 * roots are square. `src/app/icon.svg` is the same drawing with the light
 * theme's values baked in.
 */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} aria-hidden="true">
      <rect width="96" height="96" rx="22" fill="var(--fretboard)" />
      <g stroke="var(--fret-wire)" strokeWidth="2">
        {FRET_Y.map(y => <line key={y} x1="12" y1={y} x2="84" y2={y} />)}
      </g>
      <rect x="12" y="28" width="72" height="4" rx="1.5" fill="var(--nut)" />
      <g stroke="var(--string)" strokeWidth="1.5">
        {STRING_X.map(x => <line key={x} x1={x} y1="32" x2={x} y2="87" />)}
      </g>
      <g fill="none" stroke="var(--dot-ring)" strokeWidth="2">
        <rect x={STRING_X[0] - 4.5} y={OPEN_Y - 4.5} width="9" height="9" rx="1.5" />
        <circle cx={STRING_X[3]} cy={OPEN_Y} r="4.5" />
        <circle cx={STRING_X[4]} cy={OPEN_Y} r="4.5" />
        <rect x={STRING_X[5] - 4.5} y={OPEN_Y - 4.5} width="9" height="9" rx="1.5" />
      </g>
      <g stroke="var(--dot-ring)" strokeWidth="2">
        <rect x={STRING_X[1] - 6.5} y="51" width="13" height="13" rx="2" fill="var(--degree-root)" />
        <circle cx={STRING_X[2]} cy="57.5" r="6.5" fill="var(--degree-fifth)" />
      </g>
    </svg>
  );
}
