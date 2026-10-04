/**
 * The Fretwood mark: a chord shape on a rosewood tile, drawn from the board
 * and degree tokens so it follows the theme. `src/app/icon.svg` is the same
 * drawing with the light theme's values baked in.
 */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} aria-hidden="true">
      <rect width="96" height="96" rx="22" fill="var(--fretboard)" />
      <g stroke="var(--fret-wire)" strokeWidth="2">
        <line x1="38" y1="16" x2="38" y2="80" />
        <line x1="62" y1="16" x2="62" y2="80" />
      </g>
      <rect x="14" y="16" width="4" height="64" rx="1.5" fill="var(--nut)" />
      <g stroke="var(--string)" strokeWidth="1.5">
        {[24, 40, 56, 72].map(y => <line key={y} x1="16" y1={y} x2="86" y2={y} />)}
      </g>
      <g stroke="var(--dot-ring)" strokeWidth="2.5">
        <rect x="18" y="62" width="20" height="20" rx="5" fill="var(--degree-root)" />
        <circle cx="50" cy="56" r="9" fill="var(--degree-fifth)" />
        <circle cx="74" cy="40" r="9" fill="var(--degree-third)" />
        <circle cx="50" cy="24" r="9" fill="var(--degree-seventh)" />
      </g>
    </svg>
  );
}
