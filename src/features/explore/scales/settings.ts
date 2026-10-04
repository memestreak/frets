import {
  modeFamily, ROOTS, scaleDef, type ChordSize, type NumeralStyle, type Root,
} from './theory';

export type DotLabels = 'interval' | 'note' | 'none';
/** How a selected chord is drawn against the scale. */
export type ChordView = 'ladder' | 'clock';
/** Which intervals the chord diagram names: each tone from the chord root, or each third. */
export type ChordIntervals = 'root' | 'between';

export interface ScaleLabSettings {
  /** The root and scale last picked from the dropdowns. */
  root: Root;
  /** A `ScaleDef` id. */
  scale: string;
  /** How many notes Rotate mode has moved the root up the picked scale, 0–6. */
  mode: number;
  chordSize: ChordSize;
  numerals: NumeralStyle;
  labels: DotLabels;
  chordView: ChordView;
  chordIntervals: ChordIntervals;
}

export const SCALE_LAB_STORAGE_KEY = 'frets.explore.scales';

/** The board shows the open strings through this fret. */
export const SCALE_LAB_MAX_FRET = 15;

export const defaultScaleLabSettings = (): ScaleLabSettings => ({
  root: 'A', scale: 'dorian', mode: 0, chordSize: 4, numerals: 'parallel', labels: 'interval',
  chordView: 'ladder', chordIntervals: 'root',
});

const CHORD_SIZES: unknown[] = [3, 4];
const NUMERALS: unknown[] = ['parallel', 'relative'];
const LABELS: unknown[] = ['interval', 'note', 'none'];
const CHORD_VIEWS: unknown[] = ['ladder', 'clock'];
const CHORD_INTERVALS: unknown[] = ['root', 'between'];

/** Coerce stored JSON into settings, falling back to defaults per field. */
export function parseScaleLabSettings(raw: unknown): ScaleLabSettings {
  const d = defaultScaleLabSettings();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  const scale = typeof r.scale === 'string' && scaleDef(r.scale) ? r.scale : d.scale;
  const rotates = modeFamily(scaleDef(scale)!) !== null;
  return {
    root: (ROOTS as readonly unknown[]).includes(r.root) ? (r.root as Root) : d.root,
    scale,
    mode: rotates && Number.isInteger(r.mode) && (r.mode as number) >= 0 && (r.mode as number) < 7
      ? (r.mode as number) : d.mode,
    chordSize: CHORD_SIZES.includes(r.chordSize) ? (r.chordSize as ChordSize) : d.chordSize,
    numerals: NUMERALS.includes(r.numerals) ? (r.numerals as NumeralStyle) : d.numerals,
    labels: LABELS.includes(r.labels) ? (r.labels as DotLabels) : d.labels,
    chordView: CHORD_VIEWS.includes(r.chordView) ? (r.chordView as ChordView) : d.chordView,
    chordIntervals: CHORD_INTERVALS.includes(r.chordIntervals)
      ? (r.chordIntervals as ChordIntervals) : d.chordIntervals,
  };
}
