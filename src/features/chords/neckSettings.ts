import { isDotLabels, type DotLabels } from '@/components/DotLabels';

/** The Chords page's saved choices for its neck. */
export interface NeckSettings {
  labels: DotLabels;
}

export const NECK_STORAGE_KEY = 'frets.chords.neck';

/** Coerce stored JSON into settings, falling back to defaults per field. */
export function parseNeckSettings(raw: unknown): NeckSettings {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return { labels: isDotLabels(r.labels) ? r.labels : 'interval' };
}
