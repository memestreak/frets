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
  /** Dots after the note: one adds half its length, two add three quarters. */
  dots: 0 | 1 | 2;
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

export type Slide = 'legato' | 'shift' | 'below' | 'above';
const SLIDES: readonly Slide[] = ['legato', 'shift', 'below', 'above'];

export interface Note {
  /** 0–24, or null for a muted (dead) note, written x. */
  fret: number | null;
  /** Hammer-on or pull-off from the previous note on the string. */
  legato?: 'h' | 'p';
  /**
   * How the note is slid into. 'legato' (alphaTex sl) and 'shift' (ss) come from the previous note
   * on the string, up or down as the frets go; 'below' (sib) and 'above' (sia) come from no fret in
   * particular. `slideDirections` says which way each one goes.
   */
  slide?: Slide;
  bend?: Bend;
  vibrato?: boolean;
  /** Keeps sounding from the previous note on the string; not played again. */
  tie?: boolean;
  harmonic?: boolean;
  tap?: boolean;
  palmMute?: boolean;
  /** alphaTex note effects Frets doesn't draw yet, kept as written ("g", "lr"). */
  extra?: string[];
}

/** Notes played at one time; a column with no notes is a rest. */
export interface Column {
  duration: Duration;
  /** Six slots, high e first. */
  notes: (Note | null)[];
  stroke?: 'down' | 'up';
  /** alphaTex beat effects Frets doesn't draw yet, kept as written ("gr", "tp 16"). */
  extra?: string[];
}

export interface Bar {
  columns: Column[];
  repeatStart?: boolean;
  /** Ends a repeat played this many times (2 unless written). */
  repeatEnd?: number;
  /** Under a 1st, 2nd … ending bracket. */
  ending?: number;
  /** alphaTex bar metadata Frets doesn't draw yet, kept as written ('\section "Chorus"'). */
  extra?: string[];
}

export interface TimeSignature {
  /** How many beats a bar holds, 1 to `MAX_BEATS`. */
  beats: number;
  /** The note value of one beat. */
  value: TimeValue;
}

/** The note values a time signature's lower number may be. */
export const TIME_VALUES = [2, 4, 8, 16, 32] as const;
export type TimeValue = (typeof TIME_VALUES)[number];
/** alphaTab, which reads the clip's alphaTex, refuses a count over 32, as Guitar Pro does. */
export const MAX_BEATS = 32;
export const COMMON_TIME: TimeSignature = { beats: 4, value: 4 };

/** Whether `beats` over `value` is a time signature Frets can hold. */
export function isTimeSignature(beats: unknown, value: unknown): boolean {
  return Number.isInteger(beats) && (beats as number) >= 1 && (beats as number) <= MAX_BEATS
    && TIME_VALUES.includes(value as TimeValue);
}

export const STANDARD_TUNING: readonly string[] = ['E', 'A', 'D', 'G', 'B', 'E'];

export interface Clip {
  name: string;
  time: TimeSignature;
  /** Six note names, lowest string first, as tuning is said; recorded and shown, not used. */
  tuning: string[];
  bars: Bar[];
  /** alphaTex score and staff metadata Frets doesn't use, kept as written ('\artist "Me"'). */
  header?: string[];
}

export const STRING_COUNT = 6;

/* — durations in ticks: a whole note is 192, so every value, dotted or in a triplet, is whole — */

export const WHOLE = 192;

export function ticks({ value, dots, triplet }: Duration): number {
  let t = WHOLE / value;
  if (dots === 1) t *= 1.5;
  if (dots === 2) t *= 1.75;
  if (triplet) t = (t * 2) / 3;
  return t;
}

export function barTicks(time: TimeSignature): number {
  return (time.beats * WHOLE) / time.value;
}

/**
 * The span short notes are beamed within. In compound time (6/8, 9/8, 12/16: beats in threes over
 * an eighth or shorter) it is three beats, a dotted quarter in 6/8. Otherwise it is one beat, but
 * never shorter than a quarter, so eighths in 5/8 still beam in pairs.
 */
export function beatTicks(time: TimeSignature): number {
  const beat = WHOLE / time.value;
  if (time.value >= 8 && time.beats % 3 === 0) return 3 * beat;
  return Math.max(beat, WHOLE / 4);
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

/** Whether any note of the column is palm muted; the P.M. line runs over such columns. */
export function isPalmMuted(column: Column): boolean {
  return column.notes.some(n => n?.palmMute);
}

/**
 * Which way every slid-into note goes. A slide from the previous note on the string goes up or down
 * as the frets do (from a dead note, or with no note before it, it counts as from below); 'below'
 * goes up and 'above' down.
 */
export function slideDirections(clip: Clip): Map<Note, 'up' | 'down'> {
  const out = new Map<Note, 'up' | 'down'>();
  const last: (Note | null)[] = Array(STRING_COUNT).fill(null);
  for (const bar of clip.bars) {
    for (const column of bar.columns) {
      column.notes.forEach((note, s) => {
        if (!note) return;
        if (note.slide === 'above') out.set(note, 'down');
        else if (note.slide === 'below') out.set(note, 'up');
        else if (note.slide) {
          const from = last[s]?.fret ?? null;
          out.set(note, from !== null && note.fret !== null && note.fret < from ? 'down' : 'up');
        }
        last[s] = note;
      });
    }
  }
  return out;
}

export function isStandardTuning(tuning: readonly string[]): boolean {
  return tuning.every((n, i) => n === STANDARD_TUNING[i]);
}

export function emptyClip(): Clip {
  return { name: '', time: COMMON_TIME, tuning: [...STANDARD_TUNING], bars: [{ columns: [] }] };
}

/** The plain or dotted duration nearest to `t` ticks (ties go to the plain one). */
export function nearestDuration(t: number): Duration {
  let best: Duration = { value: 4, dots: 0, triplet: false };
  let bestGap = Infinity;
  for (const value of NOTE_VALUES) {
    for (const dots of [0, 1] as const) {
      if (dots && value === 16) continue; // a dotted sixteenth needs a thirty-second to pair with
      const d: Duration = { value, dots, triplet: false };
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
const optStrings = (v: unknown) => v === undefined || (Array.isArray(v) && v.every(x => typeof x === 'string'));

function isDuration(v: unknown): v is Duration {
  return isObj(v) && NOTE_VALUES.includes(v.value as NoteValue)
    && (v.dots === 0 || v.dots === 1 || v.dots === 2) && typeof v.triplet === 'boolean';
}

function isNote(v: unknown): v is Note {
  if (!isObj(v)) return false;
  const fretOk = v.fret === null || (Number.isInteger(v.fret) && (v.fret as number) >= 0 && (v.fret as number) <= 24);
  const bendOk = v.bend === undefined || (isObj(v.bend)
    && BEND_QUARTERS.includes(v.bend.quarters as BendQuarters)
    && typeof v.bend.pre === 'boolean' && typeof v.bend.release === 'boolean');
  return fretOk && bendOk
    && (v.legato === undefined || v.legato === 'h' || v.legato === 'p')
    && (v.slide === undefined || SLIDES.includes(v.slide as Slide))
    && optBool(v.vibrato) && optBool(v.tie) && optBool(v.harmonic) && optBool(v.tap) && optBool(v.palmMute)
    && optStrings(v.extra);
}

function isColumn(v: unknown): v is Column {
  return isObj(v) && isDuration(v.duration)
    && Array.isArray(v.notes) && v.notes.length === STRING_COUNT
    && v.notes.every(n => n === null || isNote(n))
    && (v.stroke === undefined || v.stroke === 'down' || v.stroke === 'up')
    && optStrings(v.extra);
}

function isBar(v: unknown): v is Bar {
  return isObj(v) && Array.isArray(v.columns) && v.columns.every(isColumn)
    && optBool(v.repeatStart)
    && (v.repeatEnd === undefined || (Number.isInteger(v.repeatEnd) && (v.repeatEnd as number) >= 2))
    && (v.ending === undefined || (Number.isInteger(v.ending) && (v.ending as number) >= 1))
    && optStrings(v.extra);
}

/** A stored clip, checked field by field; null when anything is off. */
export function parseClip(v: unknown): Clip | null {
  if (!isObj(v) || typeof v.name !== 'string') return null;
  const time = v.time;
  if (!isObj(time) || !isTimeSignature(time.beats, time.value)) return null;
  if (!Array.isArray(v.tuning) || v.tuning.length !== STRING_COUNT || !v.tuning.every(n => typeof n === 'string')) return null;
  if (!Array.isArray(v.bars) || v.bars.length === 0 || !v.bars.every(isBar)) return null;
  if (!optStrings(v.header)) return null;
  return v as unknown as Clip;
}
