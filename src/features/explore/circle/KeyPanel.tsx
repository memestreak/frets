import { ChordChips, PanelSection } from './ChordChips';
import type { KeyOptions, KeyWheel } from './circle';

/** The Key view's sections under the wheel: its chords, and what the checkboxes add. */
export function KeyPanel({ wheel, options }: { wheel: KeyWheel; options: KeyOptions }) {
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
          <ChordChips chips={wheel.dominants} />
        </PanelSection>
      )}
    </>
  );
}
