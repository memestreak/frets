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
    expect(g.fretLines).toHaveLength(16);
    // No "0" fret label.
    expect(g.fretNumbers.map(f => f.label)[0]).toBe('1');
    expect(g.width).toBe(PAD + OPENW + 15 * FW + 12);
    expect(g.height).toBe(TOP + 5 * SG + 34);
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
