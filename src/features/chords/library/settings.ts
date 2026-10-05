import { CHORD_ROOTS, chordTypeDef, type ChordRoot } from '../chordTypes';

export interface ChordLibrarySettings {
  root: ChordRoot;
  /** A `ChordTypeDef` id: tonal's first alias, e.g. "m7". */
  type: string;
}

export const CHORD_LIBRARY_STORAGE_KEY = 'frets.chords.library';

/** The neck shows the open strings through this fret. */
export const CHORD_LIBRARY_MAX_FRET = 15;

export const defaultChordLibrarySettings = (): ChordLibrarySettings => ({ root: 'A', type: 'm7' });

/** Coerce stored JSON into settings, falling back to defaults per field. */
export function parseChordLibrarySettings(raw: unknown): ChordLibrarySettings {
  const d = defaultChordLibrarySettings();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  return {
    root: (CHORD_ROOTS as readonly unknown[]).includes(r.root) ? (r.root as ChordRoot) : d.root,
    type: typeof r.type === 'string' && chordTypeDef(r.type) ? r.type : d.type,
  };
}
