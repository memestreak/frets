// Renders every raster icon from the two SVG sources of the mark.
// Run with `npm run icons` after changing either SVG, and commit the output.
//
//   src/app/icon.svg                   rounded mark: "any" icons, favicon
//   scripts/icons/mark-full-bleed.svg  square mark: maskable and Apple icons
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const ROUNDED = 'src/app/icon.svg';
const FULL_BLEED = 'scripts/icons/mark-full-bleed.svg';

const PNGS = [
  { from: ROUNDED, size: 192, to: 'public/icons/icon-192.png' },
  { from: ROUNDED, size: 512, to: 'public/icons/icon-512.png' },
  { from: FULL_BLEED, size: 512, to: 'public/icons/maskable-512.png' },
  // iOS rounds the corners itself, so the Apple icon is the square one.
  { from: FULL_BLEED, size: 180, to: 'src/app/apple-icon.png' },
];

const FAVICON = { from: ROUNDED, sizes: [16, 32, 48], to: 'src/app/favicon.ico' };

/** The SVG drawn at `size` pixels as a PNG buffer. */
function render(from, size) {
  // density scales the 96-unit SVG up before resizing, so edges stay sharp.
  return sharp(from, { density: (72 * size) / 96 * 2 })
    .resize(size, size)
    .png()
    .toBuffer();
}

/**
 * An .ico file holding the given PNGs: a 6-byte header, one 16-byte
 * directory entry per image, then the PNG data itself.
 */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type 1: icon
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size, 0); // width
    entry.writeUInt8(size, 1); // height
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map(i => i.png)]);
}

for (const { from, size, to } of PNGS) {
  await writeFile(to, await render(from, size));
  console.log(`${to} (${size}px)`);
}

const images = await Promise.all(
  FAVICON.sizes.map(async size => ({ size, png: await render(FAVICON.from, size) })),
);
await writeFile(FAVICON.to, ico(images));
console.log(`${FAVICON.to} (${FAVICON.sizes.join(', ')}px)`);
