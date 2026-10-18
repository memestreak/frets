import { Segmented } from './controls';

/** What the dots on a big neck say: the interval, the note, or nothing. */
export type DotLabels = 'interval' | 'note' | 'none';

const OPTIONS = [['interval', 'Interval'], ['note', 'Note'], ['none', 'None']] as const;

export const isDotLabels = (v: unknown): v is DotLabels =>
  OPTIONS.some(([value]) => value === v);

/** The Interval / Note / None control over a neck's dot labels. */
export function DotLabelsPicker(
  { value, onChange }: { value: DotLabels; onChange: (value: DotLabels) => void },
) {
  return <Segmented<DotLabels> label="Dot labels" options={OPTIONS} value={value} onChange={onChange} />;
}
