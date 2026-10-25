/**
 * A clip of tab: the data the Tab page draws, imports and exports. Pure;
 * no React. Strings are numbered from the highest (index 0, the high e)
 * to the lowest (index 5), the order tab is written in.
 */

/** A note value: 1 whole, 2 half, 4 quarter, 8 eighth, 16 sixteenth. */
export type NoteValue = 1 | 2 | 4 | 8 | 16;
export const NOTE_VALUES: readonly NoteValue[] = [1, 2, 4, 8, 16];

export interface Duration {
  value: NoteValue;
  dotted: boolean;
  /** Three of these fill the time of two plain ones. */
  triplet: boolean;
}

/** Bends in quarter-steps: 1 a ¼-tone curl, 2 a ½, 4 full, 6 1½, 8 two steps. */
export type BendQuarters = 1 | 2 | 4 | 6 | 8;
export const BEND_QUARTERS: readonly BendQuarters[] = [1, 2, 4, 6, 8];

export interface Bend {
  quarters: BendQuarters;
  /** Bent before it is picked. */
  pre: boolean;
  /** Let back down to the fret afterwards. */
  release: boolean;
}

export interface Note {
  /** 0–24, or null for a muted (dead) note, written x. */
  fret: number | null;
  /** Hammer-on or pull-off from the previous note on the string. */
  legato?: 'h' | 'p';
  /** "/" up or "\" down: from the previous note on the string, or into this one when there is none. */
  slide?: 'up' | 'down';
  bend?: Bend;
  vibrato?: boolean;
  /** Keeps sounding from the previous note on the string; not played again. */
  tie?: boolean;
  harmonic?: boolean;
  tap?: boolean;
}

/** Notes played at one time; a column with no notes is a rest. */
export interface Column {
  duration: Duration;
  /** Six slots, high e first. */
  notes: (Note | null)[];
  palmMute?: boolean;
  stroke?: 'down' | 'up';
  /** Its duration was guessed on import, so the page tints it. */
  guessed?: boolean;
}

export interface Bar {
  columns: Column[];
  repeatStart?: boolean;
  /** Ends a repeat played this many times (2 unless written). */
  repeatEnd?: number;
  /** Under a 1st, 2nd … ending bracket. */
  ending?: number;
}

export interface TimeSignature {
  beats: number;
  value: 4 | 8;
}

export const TIME_SIGNATURES: readonly TimeSignature[] = [
  { beats: 2, value: 4 }, { beats: 3, value: 4 }, { beats: 4, value: 4 },
  { beats: 6, value: 8 }, { beats: 12, value: 8 },
];

export const STANDARD_TUNING: readonly string[] = ['E', 'A', 'D', 'G', 'B', 'E'];

export interface Clip {
  name: string;
  time: TimeSignature;
  /** Six note names, lowest string first, as tuning is said; recorded and shown, not used. */
  tuning: string[];
  bars: Bar[];
}

export const STRING_COUNT = 6;

/* — durations in ticks: a whole note is 192, so every value, dotted or in a triplet, is whole — */

export const WHOLE = 192;

export function ticks({ value, dotted, triplet }: Duration): number {
  let t = WHOLE / value;
  if (dotted) t *= 1.5;
  if (triplet) t = (t * 2) / 3;
  return t;
}

export function barTicks(time: TimeSignature): number {
  return (time.beats * WHOLE) / time.value;
}

/** The beat that eighths and sixteenths are beamed within: a quarter, or a dotted quarter in 6/8 and 12/8. */
export function beatTicks(time: TimeSignature): number {
  return time.value === 8 ? (3 * WHOLE) / 8 : WHOLE / 4;
}

export function barLength(bar: Bar): number {
  return bar.columns.reduce((sum, c) => sum + ticks(c.duration), 0);
}

/** A bar whose durations don't fill the time signature exactly; an empty bar counts as full. */
export function isUneven(bar: Bar, time: TimeSignature): boolean {
  return bar.columns.length > 0 && barLength(bar) !== barTicks(time);
}

export function isRest(column: Column): boolean {
  return column.notes.every(n => n === null);
}

export function isStandardTuning(tuning: readonly string[]): boolean {
  return tuning.every((n, i) => n === STANDARD_TUNING[i]);
}

export function emptyClip(): Clip {
  return { name: '', time: { beats: 4, value: 4 }, tuning: [...STANDARD_TUNING], bars: [{ columns: [] }] };
}

/** The plain or dotted duration nearest to `t` ticks (ties go to the plain one). */
export function nearestDuration(t: number): Duration {
  let best: Duration = { value: 4, dotted: false, triplet: false };
  let bestGap = Infinity;
  for (const value of NOTE_VALUES) {
    for (const dotted of [false, true]) {
      if (dotted && value === 16) continue; // a dotted sixteenth needs a thirty-second to pair with
      const d = { value, dotted, triplet: false };
      const gap = Math.abs(ticks(d) - t);
      if (gap < bestGap) {
        best = d;
        bestGap = gap;
      }
    }
  }
  return best;
}

/* — checking a clip read back from storage — */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const optBool = (v: unknown) => v === undefined || typeof v === 'boolean';

function isDuration(v: unknown): v is Duration {
  return isObj(v) && NOTE_VALUES.includes(v.value as NoteValue)
    && typeof v.dotted === 'boolean' && typeof v.triplet === 'boolean';
}

function isNote(v: unknown): v is Note {
  if (!isObj(v)) return false;
  const fretOk = v.fret === null || (Number.isInteger(v.fret) && (v.fret as number) >= 0 && (v.fret as number) <= 24);
  const bendOk = v.bend === undefined || (isObj(v.bend)
    && BEND_QUARTERS.includes(v.bend.quarters as BendQuarters)
    && typeof v.bend.pre === 'boolean' && typeof v.bend.release === 'boolean');
  return fretOk && bendOk
    && (v.legato === undefined || v.legato === 'h' || v.legato === 'p')
    && (v.slide === undefined || v.slide === 'up' || v.slide === 'down')
    && optBool(v.vibrato) && optBool(v.tie) && optBool(v.harmonic) && optBool(v.tap);
}

function isColumn(v: unknown): v is Column {
  return isObj(v) && isDuration(v.duration)
    && Array.isArray(v.notes) && v.notes.length === STRING_COUNT
    && v.notes.every(n => n === null || isNote(n))
    && optBool(v.palmMute) && optBool(v.guessed)
    && (v.stroke === undefined || v.stroke === 'down' || v.stroke === 'up');
}

function isBar(v: unknown): v is Bar {
  return isObj(v) && Array.isArray(v.columns) && v.columns.every(isColumn)
    && optBool(v.repeatStart)
    && (v.repeatEnd === undefined || (Number.isInteger(v.repeatEnd) && (v.repeatEnd as number) >= 2))
    && (v.ending === undefined || (Number.isInteger(v.ending) && (v.ending as number) >= 1));
}

/** A stored clip, checked field by field; null when anything is off. */
export function parseClip(v: unknown): Clip | null {
  if (!isObj(v) || typeof v.name !== 'string') return null;
  const time = v.time;
  if (!isObj(time) || !TIME_SIGNATURES.some(t => t.beats === time.beats && t.value === time.value)) return null;
  if (!Array.isArray(v.tuning) || v.tuning.length !== STRING_COUNT || !v.tuning.every(n => typeof n === 'string')) return null;
  if (!Array.isArray(v.bars) || v.bars.length === 0 || !v.bars.every(isBar)) return null;
  return v as unknown as Clip;
}
