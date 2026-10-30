import { isDotLabels, type DotLabels } from '@/components/DotLabels';
import { CHORD_ROOTS, type ChordRoot } from '@/lib/theory/chords';
import { STRING_SETS, TRIAD_TYPES, type StringSet, type TriadType } from './triads';

export interface TriadsSettings {
  root: ChordRoot;
  triad: TriadType;
  /** The string set, by its lowest string. */
  strings: StringSet;
  labels: DotLabels;
}

export const TRIADS_STORAGE_KEY = 'frets.explore.triads';

export const defaultTriadsSettings = (): TriadsSettings => ({
  root: 'C', triad: 'M', strings: 3, labels: 'interval',
});

const oneOf = <T>(values: readonly T[], v: unknown, fallback: T): T =>
  (values.includes(v as T) ? (v as T) : fallback);

/** Coerce stored JSON into settings, falling back to defaults per field. */
export function parseTriadsSettings(raw: unknown): TriadsSettings {
  const d = defaultTriadsSettings();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  return {
    root: oneOf(CHORD_ROOTS, r.root, d.root),
    triad: oneOf(TRIAD_TYPES.map(([id]) => id), r.triad, d.triad),
    strings: oneOf(STRING_SETS, r.strings, d.strings),
    labels: isDotLabels(r.labels) ? r.labels : d.labels,
  };
}
