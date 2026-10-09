import { ChordChips, PanelSection } from './ChordChips';
import type { KeyOptions, KeyWheel } from './circle';

/** The Circle view's sections under the wheel: its chords, and what the checkboxes add. */
export function KeyPanel({ wheel, options, onHighlight }: {
  wheel: KeyWheel;
  options: KeyOptions;
  /** A secondary dominant's chip is hovered (its cell's id) or left (null). */
  onHighlight: (cell: string | null) => void;
}) {
  return (
    <>
      <PanelSection title="Chords">
        <ChordChips chips={wheel.chords} />
      </PanelSection>
      {options.parallel && (
        <PanelSection title={`Borrowed from ${wheel.parallelName}`}>
          <ChordChips chips={wheel.borrowed} />
        </PanelSection>
      )}
      {options.dominants && (
        <PanelSection title="Secondary dominants">
          <ChordChips chips={wheel.dominants} onHighlight={onHighlight} />
        </PanelSection>
      )}
    </>
  );
}
