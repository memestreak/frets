import { fretboardGeometry, FW, OPENW, PAD, SG, TOP } from '@/lib/fretboardGeometry';

describe('fretboardGeometry', () => {
  it('starts at the nut with an open-string column when minFret is 0', () => {
    const g = fretboardGeometry(0, 15);
    expect(g.open).toBe(true);
    expect(g.firstFret).toBe(1);
    expect(g.boardX).toBe(PAD + OPENW);
    expect(g.boardW).toBe(15 * FW);
    expect(g.cellX(0)).toBe(PAD);
    expect(g.cellW(0)).toBe(OPENW);
    expect(g.cx(1)).toBe(PAD + OPENW + FW / 2);
    expect(g.fretLines[0]).toEqual({ x: PAD + OPENW, nut: true });
    // Nut + frets 1–14; the line at the fill's rounded right end is omitted.
    expect(g.fretLines).toHaveLength(15);
    // No "0" fret label.
    expect(g.fretNumbers.map(f => f.label)[0]).toBe('1');
    expect(g.width).toBe(PAD + OPENW + 15 * FW + 12);
    expect(g.fretNumberY).toBe(TOP + 5 * SG + SG / 2 + 18);
    expect(g.height).toBe(TOP + 5 * SG + SG / 2 + 28);
  });

  it('draws low E at the bottom', () => {
    const g = fretboardGeometry(0, 12);
    expect(g.cy(0)).toBe(TOP + 5 * SG);
    expect(g.cy(5)).toBe(TOP);
  });

  it('has no nut when the window starts up the neck', () => {
    const g = fretboardGeometry(5, 12);
    expect(g.open).toBe(false);
    expect(g.boardX).toBe(PAD);
    expect(g.fretLines.every(l => !l.nut)).toBe(true);
    expect(g.fretNumbers.map(f => f.label)).toEqual(
      ['5', '6', '7', '8', '9', '10', '11', '12'],
    );
  });

  it('extends the fingerboard fill half a string gap past the outer strings', () => {
    const g = fretboardGeometry(0, 15);
    expect(g.fillY).toBe(TOP - SG / 2);
    expect(g.fillH).toBe(5 * SG + SG);
    // Starts 4 units left of the nut so the nut sits inside the fill.
    expect(g.fillX).toBe(g.boardX - 4);
    expect(g.fillX + g.fillW).toBe(g.boardRight);
  });

  it('starts the fill at the board edge when there is no nut', () => {
    const g = fretboardGeometry(5, 12);
    expect(g.fillX).toBe(g.boardX);
    expect(g.fillW).toBe(g.boardW);
    // 8 columns have 9 edges; both rounded ends are omitted.
    expect(g.fretLines).toHaveLength(7);
    expect(g.fretLines[0].x).toBe(g.boardX + FW);
  });

  it('places single inlays and double dots at 12', () => {
    const g = fretboardGeometry(0, 15);
    const mid = TOP + (5 * SG) / 2;
    const at = (f: number) => g.inlays.filter(d => d.x === g.cx(f));
    expect(at(3)).toEqual([{ x: g.cx(3), y: mid }]);
    expect(at(12).map(d => d.y)).toEqual([mid - SG, mid + SG]);
    expect(at(4)).toEqual([]);
    expect(g.inlays).toHaveLength(7); // 3 5 7 9 15 + two at 12
  });
});
