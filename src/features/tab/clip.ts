/**
 * A clip of tab: the data the Tab page draws, imports and exports. Pure;
 * no React. Strings are numbered from the highest (index 0, the high e)
 * to the lowest (index 5), the order tab is written in.
 */

/** A note value: 1 whole, 2 half, 4 quarter, 8 eighth, 16 sixteenth, 32 thirty-second, 64 sixty-fourth. */
export type NoteValue = 1 | 2 | 4 | 8 | 16 | 32 | 64;
export const NOTE_VALUES: readonly NoteValue[] = [1, 2, 4, 8, 16, 32, 64];
/** The shortest value that takes dots: a dotted sixty-fourth would need a 128th to fill its beat. */
export const SHORTEST_DOTTED: NoteValue = 32;

export interface Duration {
  value: NoteValue;
  /** Dots after the note: one adds half its length, two add three quarters. */
  dots: 0 | 1 | 2;
  /** One of a tuplet of this many notes (2 to 12), played in the time of `tupletSpan` plain ones. */
  tuplet?: number;
  /** The plain notes the tuplet takes the time of, when not its usual span (`tu (3 4)`: three in the time of four). */
  tupletSpan?: number;
}

/** The tuplets alphaTex names by one number, and the plain notes each takes the time of ("tu 9": nine in the time of eight). */
export const TUPLET_SPANS: Readonly<Record<number, number>> = { 3: 2, 5: 4, 6: 4, 7: 4, 9: 8, 10: 8, 11: 8, 12: 8 };
/** Those tuplets, in order: the palette's choices. */
export const TUPLETS: readonly number[] = [3, 5, 6, 7, 9, 10, 11, 12];
/** The most notes in a tuplet; with this many at most, every tuplet's notes are a whole number of ticks. */
export const MAX_TUPLET = 12;

/** How many plain notes a duration's tuplet takes the time of: its own span, else the usual one. */
export function spanOf(duration: Duration): number {
  return duration.tupletSpan ?? TUPLET_SPANS[duration.tuplet ?? 0] ?? 1;
}

/** A tuplet and span alphaTex can write, as Frets keeps them: the span only when it isn't the usual one. */
export function tupletFields(n: number, span: number): Pick<Duration, 'tuplet' | 'tupletSpan'> | null {
  if (!Number.isInteger(n) || !Number.isInteger(span) || n < 2 || n > MAX_TUPLET || span < 1 || span > 2 * MAX_TUPLET || n === span) return null;
  return TUPLET_SPANS[n] === span ? { tuplet: n } : { tuplet: n, tupletSpan: span };
}

/** A tuplet's name as drawn over it: "9", or "3:4" when its span isn't the usual one. */
export function tupletLabel(duration: Duration): string {
  return duration.tupletSpan ? `${duration.tuplet}:${duration.tupletSpan}` : String(duration.tuplet);
}

/** Whether two durations are in the same kind of tuplet (or neither is). */
export function sameTuplet(a: Duration, b: Duration): boolean {
  return a.tuplet === b.tuplet && a.tupletSpan === b.tupletSpan;
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
  /** Slides away after it is played, to no fret in particular (alphaTex sod, sou). */
  slideOut?: 'down' | 'up';
  vibrato?: 'slight' | 'wide';
  /** Keeps sounding from the previous note on the string; not played again. */
  tie?: boolean;
  harmonic?: 'natural' | 'pinch';
  tap?: boolean;
  palmMute?: boolean;
  /** Left to ring over the notes after it. */
  letRing?: boolean;
  /** Played softly, a ghost note: its number in brackets. */
  ghost?: boolean;
  /** Played harder: '>' over the column, a heavy accent '^'. */
  accent?: 'normal' | 'heavy';
  /** Cut short: a dot over the column. */
  staccato?: boolean;
  /** alphaTex note effects Frets doesn't draw yet, kept as written ("ah", "tr 7 16"). */
  extra?: string[];
}

/** Notes played at one time; a column with no notes is a rest. */
export interface Column {
  duration: Duration;
  /** Six slots, high e first. */
  notes: (Note | null)[];
  stroke?: 'down' | 'up';
  /** A chord name written over the column, as typed ("Am7", "C/G"). */
  chord?: string;
  /** Free text written over the column, from it rightward ("let ring", "slowly"; alphaTex txt). */
  text?: string;
  /**
   * A grace note, drawn small and taking no time in the bar: played just before the beat, or on it,
   * taking its time from the note after it (alphaTex gr, gr ob).
   */
  grace?: 'before' | 'on';
  /** Tremolo picked: picked over and over as fast as eighths, sixteenths or thirty-seconds, a slash on the stem for each beam. */
  tremolo?: TremoloValue;
  /** alphaTex beat effects Frets doesn't draw yet, kept as written ("tb (0 -4 0)"). */
  extra?: string[];
}

/** How fast a tremolo picked note is picked: as eighths, sixteenths or thirty-seconds. */
export type TremoloValue = 8 | 16 | 32;
export const TREMOLO_VALUES: readonly TremoloValue[] = [8, 16, 32];

export interface Bar {
  columns: Column[];
  /** A new time signature from this bar on; the clip's own `time` holds until the first one. */
  time?: TimeSignature;
  repeatStart?: boolean;
  /** Ends a repeat played this many times (2 unless written). */
  repeatEnd?: number;
  /** Under a 1st, 2nd … ending bracket. */
  ending?: number;
  /** A tempo from this bar on, in quarter notes a minute, with an optional word ("Slowly"). */
  tempo?: Tempo;
  /** A section starting at this bar ("Chorus"), with an optional rehearsal mark ("A"). */
  section?: Section;
  /** alphaTex bar metadata Frets doesn't draw yet, kept as written ('\section "Chorus"'). */
  extra?: string[];
}

export interface Tempo {
  bpm: number;
  label?: string;
}
/** The tempos Frets offers, in quarter notes a minute. */
export const MIN_BPM = 20;
export const MAX_BPM = 400;

export interface Section {
  text: string;
  marker?: string;
}

/** The highest fret a capo goes on. */
export const MAX_CAPO = 12;

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
  /** The fret the capo is on, if any; frets are counted from it, as tab is written. */
  capo?: number;
  /** alphaTex score and staff metadata Frets doesn't use, kept as written ('\artist "Me"'). */
  header?: string[];
}

export const STRING_COUNT = 6;

/* — durations in ticks: a whole note is 3548160 (1024 × 9 × 5 × 7 × 11), so every value, dotted or in
   a tuplet of up to twelve, is a whole number (a double-dotted thirty-second in a tuplet of eleven
   is 194040 × 8 / 11 = 141120) — */

export const WHOLE = 3548160;

export function ticks(duration: Duration): number {
  const { value, dots, tuplet } = duration;
  let t = WHOLE / value;
  if (dots === 1) t *= 1.5;
  if (dots === 2) t *= 1.75;
  if (tuplet) t = (t * spanOf(duration)) / tuplet;
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

/** The time a bar's columns take; grace notes take none. */
export function barLength(bar: Bar): number {
  return bar.columns.reduce((sum, c) => sum + (c.grace ? 0 : ticks(c.duration)), 0);
}

/** The time signature bar `index` is in: the last one set at or before it, else the clip's. */
export function timeAt(clip: Pick<Clip, 'time' | 'bars'>, index: number): TimeSignature {
  for (let b = Math.min(index, clip.bars.length - 1); b > 0; b--) {
    const time = clip.bars[b].time;
    if (time) return time;
  }
  return clip.time;
}

/** Whether bar `index` starts a new time signature, one that differs from the bar before it. */
export function changesTime(clip: Clip, index: number): boolean {
  const time = clip.bars[index]?.time;
  if (index === 0 || !time) return false;
  const before = timeAt(clip, index - 1);
  return time.beats !== before.beats || time.value !== before.value;
}

/** A bar whose durations don't fill its time signature exactly; an empty bar counts as full. */
export function isUneven(clip: Pick<Clip, 'time' | 'bars'>, index: number): boolean {
  const bar = clip.bars[index];
  return bar.columns.length > 0 && barLength(bar) !== barTicks(timeAt(clip, index));
}

/** A list of numbers in words: "2", "2 and 5", "2, 5 and 7". */
export function listed(numbers: number[]): string {
  return numbers.length < 2 ? numbers.join('') : `${numbers.slice(0, -1).join(', ')} and ${numbers[numbers.length - 1]}`;
}

/**
 * The line that names the bars that don't add up, by the time signature each should fill
 * ("Bars 2 and 3 don't add up to 4/4; bar 5 doesn't add up to 3/4."), or null when every bar does.
 */
export function unevenMessage(clip: Pick<Clip, 'time' | 'bars'>): string | null {
  const byTime = new Map<string, number[]>();
  clip.bars.forEach((bar, i) => {
    if (!isUneven(clip, i)) return;
    const time = timeAt(clip, i);
    const key = `${time.beats}/${time.value}`;
    byTime.set(key, [...(byTime.get(key) ?? []), i + 1]);
  });
  if (byTime.size === 0) return null;
  const parts = [...byTime].map(([time, bars]) =>
    `${bars.length === 1 ? `bar ${bars[0]} doesn't` : `bars ${listed(bars)} don't`} add up to ${time}`);
  const line = `${parts.join('; ')}.`;
  return line[0].toUpperCase() + line.slice(1);
}

/**
 * What is wrong with the tuplets in one bar, a sentence each ("The tuplet of 5 in bar 2 has 4 notes;
 * it needs 5."). A run of columns in the same kind of tuplet is counted in its shortest note, so a
 * quarter and an eighth make a whole triplet; the run must come to a whole number of groups. Grace
 * notes take no part.
 */
export function tupletProblems(bar: Bar, index: number): string[] {
  const problems: string[] = [];
  const columns = bar.columns.filter(c => !c.grace);
  let i = 0;
  while (i < columns.length) {
    const first = columns[i].duration;
    if (!first.tuplet) {
      i++;
      continue;
    }
    let end = i;
    while (end + 1 < columns.length && sameTuplet(columns[end + 1].duration, first)) end++;
    const plain = columns.slice(i, end + 1).map(c => ticks({ value: c.duration.value, dots: c.duration.dots }));
    const notes = plain.reduce((sum, t) => sum + t, 0) / Math.min(...plain);
    const n = first.tuplet;
    if (notes % n !== 0) {
      const needs = Math.ceil(notes / n) * n;
      const count = Number.isInteger(notes) ? String(notes) : notes.toFixed(1);
      problems.push(`The tuplet of ${tupletLabel(first)} in bar ${index + 1} has ${count} note${notes === 1 ? '' : 's'}; it needs ${needs}.`);
    }
    i = end + 1;
  }
  return problems;
}

/** The line that names every tuplet missing notes or with extra ones, or null when every one is whole. */
export function brokenTupletMessage(clip: Pick<Clip, 'bars'>): string | null {
  const lines = clip.bars.flatMap((bar, b) => tupletProblems(bar, b));
  return lines.length > 0 ? lines.join(' ') : null;
}

/**
 * Each bar with something wrong (it doesn't add up, a tuplet in it isn't whole) and what, in
 * sentences: the tip on the warning drawn under the bar's start.
 */
export function barErrors(clip: Pick<Clip, 'time' | 'bars'>): Map<number, string> {
  const errors = new Map<number, string>();
  clip.bars.forEach((bar, b) => {
    const time = timeAt(clip, b);
    const lines = [
      ...(isUneven(clip, b) ? [`Bar ${b + 1} doesn't add up to ${time.beats}/${time.value}.`] : []),
      ...tupletProblems(bar, b),
    ];
    if (lines.length > 0) errors.set(b, lines.join(' '));
  });
  return errors;
}

export function isRest(column: Column): boolean {
  return column.notes.every(n => n === null);
}

/** Whether any note of the column is palm muted; the P.M. line runs over such columns. */
export function isPalmMuted(column: Column): boolean {
  return column.notes.some(n => n?.palmMute);
}

/** Whether any note of the column is let ring; the "let ring" line runs over such columns. */
export function isLetRing(column: Column): boolean {
  return column.notes.some(n => n?.letRing);
}

/** The strongest accent on any note of the column, drawn once over it. */
export function columnAccent(column: Column): Note['accent'] {
  if (column.notes.some(n => n?.accent === 'heavy')) return 'heavy';
  return column.notes.some(n => n?.accent === 'normal') ? 'normal' : undefined;
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
  let best: Duration = { value: 4, dots: 0 };
  let bestGap = Infinity;
  // Spacing is too rough to tell thirty-seconds, so a guess is a sixteenth at the shortest.
  for (const value of NOTE_VALUES.filter(v => v <= 16)) {
    for (const dots of [0, 1] as const) {
      if (dots && value === 16) continue; // a guessed dotted sixteenth would need a guessed thirty-second
      const d: Duration = { value, dots };
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
const optOneOf = (v: unknown, values: readonly string[]) => v === undefined || values.includes(v as string);
const optString = (v: unknown) => v === undefined || typeof v === 'string';
const optStrings = (v: unknown) => v === undefined || (Array.isArray(v) && v.every(x => typeof x === 'string'));

export function isBpm(v: unknown): v is number {
  return Number.isInteger(v) && (v as number) >= MIN_BPM && (v as number) <= MAX_BPM;
}

export function isCapo(v: unknown): v is number {
  return Number.isInteger(v) && (v as number) >= 1 && (v as number) <= MAX_CAPO;
}

function isDuration(v: unknown): v is Duration {
  return isObj(v) && NOTE_VALUES.includes(v.value as NoteValue)
    && (v.dots === 0 || v.dots === 1 || v.dots === 2) && isTuplet(v);
}

/** No tuplet, or one `tupletFields` would make: the span written only when it isn't the usual one. */
function isTuplet(v: Record<string, unknown>): boolean {
  if (v.tuplet === undefined) return v.tupletSpan === undefined;
  const fields = tupletFields(v.tuplet as number, (v.tupletSpan ?? TUPLET_SPANS[v.tuplet as number]) as number);
  return fields !== null && fields.tupletSpan === v.tupletSpan;
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
    && optOneOf(v.slideOut, ['down', 'up']) && optOneOf(v.vibrato, ['slight', 'wide'])
    && optOneOf(v.harmonic, ['natural', 'pinch']) && optOneOf(v.accent, ['normal', 'heavy'])
    && optBool(v.tie) && optBool(v.tap) && optBool(v.palmMute) && optBool(v.letRing) && optBool(v.ghost) && optBool(v.staccato)
    && optStrings(v.extra);
}

function isColumn(v: unknown): v is Column {
  return isObj(v) && isDuration(v.duration)
    && Array.isArray(v.notes) && v.notes.length === STRING_COUNT
    && v.notes.every(n => n === null || isNote(n))
    && (v.stroke === undefined || v.stroke === 'down' || v.stroke === 'up')
    && (v.chord === undefined || typeof v.chord === 'string')
    && (v.text === undefined || typeof v.text === 'string')
    && optOneOf(v.grace, ['before', 'on'])
    && (v.tremolo === undefined || TREMOLO_VALUES.includes(v.tremolo as TremoloValue))
    && optStrings(v.extra);
}

function isBar(v: unknown): v is Bar {
  return isObj(v) && Array.isArray(v.columns) && v.columns.every(isColumn)
    && (v.time === undefined || (isObj(v.time) && isTimeSignature(v.time.beats, v.time.value)))
    && optBool(v.repeatStart)
    && (v.repeatEnd === undefined || (Number.isInteger(v.repeatEnd) && (v.repeatEnd as number) >= 2))
    && (v.ending === undefined || (Number.isInteger(v.ending) && (v.ending as number) >= 1))
    && (v.tempo === undefined || (isObj(v.tempo) && isBpm(v.tempo.bpm) && optString(v.tempo.label)))
    && (v.section === undefined || (isObj(v.section) && typeof v.section.text === 'string' && optString(v.section.marker)))
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
  if (v.capo !== undefined && !isCapo(v.capo)) return null;
  return v as unknown as Clip;
}
