// Renders the app's PNG icons from the two SVG sources of the mark.
// Run with `npm run icons` after changing either SVG, and commit the PNGs.
//
//   src/app/icon.svg              rounded mark, the "any" icons
//   scripts/icons/mark-full-bleed.svg  square mark, the maskable icon
import sharp from 'sharp';

const ROUNDED = 'src/app/icon.svg';
const FULL_BLEED = 'scripts/icons/mark-full-bleed.svg';

const ICONS = [
  { from: ROUNDED, size: 192, to: 'public/icons/icon-192.png' },
  { from: ROUNDED, size: 512, to: 'public/icons/icon-512.png' },
  { from: FULL_BLEED, size: 512, to: 'public/icons/maskable-512.png' },
];

for (const { from, size, to } of ICONS) {
  // density scales the 96-unit SVG up before resizing, so edges stay sharp.
  await sharp(from, { density: (72 * size) / 96 * 2 })
    .resize(size, size)
    .png()
    .toFile(to);
  console.log(`${to} (${size}px)`);
}
