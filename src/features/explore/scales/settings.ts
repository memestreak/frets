import {
  ROOTS, scaleDef, type ChordSize, type NumeralStyle, type Root,
} from './theory';

export type DotLabels = 'interval' | 'note' | 'none';

export interface ScaleLabSettings {
  root: Root;
  /** A `ScaleDef` id. */
  scale: string;
  chordSize: ChordSize;
  numerals: NumeralStyle;
  labels: DotLabels;
}

export const SCALE_LAB_STORAGE_KEY = 'frets.explore.scales';

/** The board shows the open strings through this fret. */
export const SCALE_LAB_MAX_FRET = 15;

export const defaultScaleLabSettings = (): ScaleLabSettings => ({
  root: 'A', scale: 'dorian', chordSize: 4, numerals: 'parallel', labels: 'interval',
});

const CHORD_SIZES: unknown[] = [3, 4];
const NUMERALS: unknown[] = ['parallel', 'relative'];
const LABELS: unknown[] = ['interval', 'note', 'none'];

/** Coerce stored JSON into settings, falling back to defaults per field. */
export function parseScaleLabSettings(raw: unknown): ScaleLabSettings {
  const d = defaultScaleLabSettings();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  return {
    root: (ROOTS as readonly unknown[]).includes(r.root) ? (r.root as Root) : d.root,
    scale: typeof r.scale === 'string' && scaleDef(r.scale) ? r.scale : d.scale,
    chordSize: CHORD_SIZES.includes(r.chordSize) ? (r.chordSize as ChordSize) : d.chordSize,
    numerals: NUMERALS.includes(r.numerals) ? (r.numerals as NumeralStyle) : d.numerals,
    labels: LABELS.includes(r.labels) ? (r.labels as DotLabels) : d.labels,
  };
}
