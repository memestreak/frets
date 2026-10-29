/**
 * The quarter note of a tempo mark ("♩ = 92"), as SVG: its head and stem, sized for text of `size`
 * pixels, its head's middle at (x, y). The drawn tab's tempos, the score's head and the exported
 * image all draw it, since fonts' own ♩ differ in size and some have none.
 */
export function TempoNote({ x, y, size, ink }: { x: number; y: number; size: number; ink: string }) {
  const k = size / 11;
  return (
    <>
      <ellipse cx={x + 2 * k} cy={y} rx={3.2 * k} ry={2.4 * k} transform={`rotate(-20 ${x + 2 * k} ${y})`} fill={ink} />
      <line x1={x + 5 * k} x2={x + 5 * k} y1={y - 1 * k} y2={y - 11 * k} stroke={ink} strokeWidth={1.1 * k} />
    </>
  );
}

/** How wide the note is drawn for text of `size` pixels, with the room after it. */
export function tempoNoteWidth(size: number): number {
  return 7 * (size / 11);
}
