#!/usr/bin/env bash
set -euo pipefail

# Regenerates the raster favicons from the E minor chord-diagram logo.
#
# Source of truth is the primary site repo:
#   ~/repos/site/src/assets/img/eminor-logo.svg       (vector)
#   ~/repos/site/src/assets/img/eminor-logo-white-bg.svg
#   ~/repos/site/src/assets/img/eminor-logo-400x400.png
#
# The white-bg SVG is vendored directly as src/app/icon.svg, which modern
# browsers scale themselves. The 400x400 PNG is vendored here as the
# raster source because ImageMagick on this machine has no librsvg
# delegate and cannot rasterize the SVG.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
SRC="$SCRIPT_DIR/assets/eminor-logo-400x400.png"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

flatten() {
  magick "$SRC" -background white -alpha remove -alpha off "$@"
}

# Trim the logo's outer whitespace once; everything else derives from it.
flatten -fuzz 20% -trim +repage "$TMP/trim.png"

# 32 and 48 keep the full diagram: nut, open-string circles, and both
# fretted dots all resolve at these sizes.
magick "$TMP/trim.png" -resize 48x48! "$TMP/ico-48.png"
magick "$TMP/trim.png" -resize 32x32! "$TMP/ico-32.png"

# At 16 the open-string circles turn to mush, so crop them off and let
# the fretboard grid fill the frame instead.
magick "$TMP/trim.png" -crop 330x340+0+48 +repage -resize 16x16! \
  "$TMP/ico-16.png"

magick "$TMP/ico-16.png" "$TMP/ico-32.png" "$TMP/ico-48.png" \
  "$ROOT/src/app/favicon.ico"

# Apple touch icon needs no rounding; iOS applies its own mask. Named
# per the Next.js app-router convention so the link tag is generated.
flatten -resize 180x180 -gravity center -extent 180x180 \
  "$ROOT/src/app/apple-icon.png"

echo "Generated:"
echo "  $ROOT/src/app/favicon.ico (16x16 + 32x32 + 48x48)"
echo "  $ROOT/src/app/apple-icon.png (180x180)"
echo "Vendored (not generated):"
echo "  $ROOT/src/app/icon.svg"
