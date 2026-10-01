/** Fret column width (SVG units). */
export const FW = 62;
/** Gap between strings. */
export const SG = 30;
/** Left gutter for string labels. */
export const PAD = 20;
/** Width of the open-string column left of the nut. */
export const OPENW = 28;
export const TOP = 16;

const SINGLE_INLAYS = [3, 5, 7, 9, 15, 17, 19, 21];
const DOUBLE_INLAYS = [12, 24];

export interface FretboardGeometry {
  minFret: number;
  maxFret: number;
  /** True when the window starts at the nut (open strings shown). */
  open: boolean;
  /** First numbered fret column. */
  firstFret: number;
  boardX: number;
  boardY: number;
  boardW: number;
  boardH: number;
  boardRight: number;
  boardBottom: number;
  width: number;
  height: number;
  /** Left edge of the cell for fret `f`. */
  cellX: (f: number) => number;
  cellW: (f: number) => number;
  /** Center x of fret `f`'s cell. */
  cx: (f: number) => number;
  /** y of string `s` (0 = low E, drawn at the bottom). */
  cy: (s: number) => number;
  fretLines: { x: number; nut: boolean }[];
  fretNumbers: { x: number; label: string }[];
  inlays: { x: number; y: number }[];
}

export function fretboardGeometry(
  minFret: number,
  maxFret: number,
): FretboardGeometry {
  const open = minFret === 0;
  const firstFret = open ? 1 : minFret;
  const n = maxFret - firstFret + 1;
  const boardX = PAD + (open ? OPENW : 0);
  const boardY = TOP;
  const boardW = n * FW;
  const boardH = 5 * SG;
  const boardRight = boardX + boardW;
  const boardBottom = boardY + boardH;

  // Open strings get a narrow column left of the nut; the board itself
  // starts at the nut.
  const cellX = (f: number) => (f === 0 ? PAD : boardX + (f - firstFret) * FW);
  const cellW = (f: number) => (f === 0 ? OPENW : FW);
  const cx = (f: number) => cellX(f) + cellW(f) / 2;
  const cy = (s: number) => boardY + (5 - s) * SG;

  const fretLines = Array.from({ length: n + 1 }, (_, c) => ({
    x: boardX + c * FW,
    nut: open && c === 0,
  }));
  const fretNumbers = [];
  for (let f = firstFret; f <= maxFret; f++) {
    fretNumbers.push({ x: cx(f), label: String(f) });
  }
  const mid = boardY + boardH / 2;
  const inlays = [];
  for (let f = Math.max(minFret, 1); f <= maxFret; f++) {
    if (SINGLE_INLAYS.includes(f)) inlays.push({ x: cx(f), y: mid });
    if (DOUBLE_INLAYS.includes(f)) {
      inlays.push({ x: cx(f), y: mid - SG }, { x: cx(f), y: mid + SG });
    }
  }

  return {
    minFret, maxFret, open, firstFret,
    boardX, boardY, boardW, boardH, boardRight, boardBottom,
    width: boardRight + 12,
    height: boardBottom + 34,
    cellX, cellW, cx, cy, fretLines, fretNumbers, inlays,
  };
}
