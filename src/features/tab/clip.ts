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
  /**
   * A pre-bend's starting height when lower than its peak: on a tied note, a bend held at `from`
   * and pushed on up to `quarters`, as "full" then "1½" in bar 144 of Sweet Child O' Mine.
   */
  from?: BendQuarters;
  /**
   * A release's landing height when it isn't let all the way down: "full" let down to "½" in bar 165 of
   * Sweet Child O' Mine, where a tied note then pushes it back up (`from`).
   */
  to?: BendQuarters;
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
  harmonic?: 'natural' | 'pinch' | 'artificial';
  /**
   * An artificial harmonic's touch point, in frets above the fretted note (alphaTex ah 12); left out when not
   * given. Written only while the note is an artificial harmonic.
   */
  harmonicFret?: number;
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
  /**
   * A mordent over the column (alphaTex umordent, lmordent): the note, the one a step above (upper) or
   * below (lower), and back.
   */
  mordent?: 'upper' | 'lower';
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
  /** Written an octave or two from where it sounds, under an "8va" line and its like (alphaTex ot). */
  ottava?: Ottava;
  /**
   * The wah pedal from this column: closed, drawn "+" over the music, or open, drawn "o" (alphaTex wahc,
   * waho), as Guitar Pro prints Sweet Child O' Mine's solo. Drawn only; playback doesn't sound it.
   */
  wah?: 'open' | 'closed';
  /**
   * Getting louder (alphaTex cre) or softer (dec) from this column: neighbouring columns that share it
   * draw one hairpin under the staff, as the book prints bar 157 of Sweet Child O' Mine. Drawn only.
   */
  hairpin?: 'crescendo' | 'decrescendo';
  /** alphaTex beat effects Frets doesn't draw yet, kept as written ("tb (0 -4 0)"). */
  extra?: string[];
}

/** An octave line: play an octave (8) or two (15) above (va, ma) or below (vb, mb) where it is written. */
export type Ottava = '8va' | '8vb' | '15ma' | '15mb';
export const OTTAVAS: readonly Ottava[] = ['8va', '8vb', '15ma', '15mb'];
/** How far the notes under each line sound from where they are written, in semitones. */
export const OTTAVA_SHIFT: Record<Ottava, number> = { '8va': 12, '8vb': -12, '15ma': 24, '15mb': -24 };

/** How fast a tremolo picked note is picked: as eighths, sixteenths or thirty-seconds. */
export type TremoloValue = 8 | 16 | 32;
export const TREMOLO_VALUES: readonly TremoloValue[] = [8, 16, 32];

export interface Bar {
  columns: Column[];
  /** A new time signature from this bar on; the clip's own `time` holds until the first one. */
  time?: TimeSignature;
  /** A key signature from this bar on (the first bar's is the clip's own); C major until the first one. */
  key?: Key;
  repeatStart?: boolean;
  /** Ends a repeat played this many times (2 unless written). */
  repeatEnd?: number;
  /** Ends with a double bar line, as a section's last bar does (alphaTex's `\db`); a repeat's end draws its own. */
  doubleBar?: boolean;
  /** Under a 1st, 2nd … ending bracket. */
  ending?: number;
  /** A tempo from this bar on, in bpm (quarter notes), with an optional label ("Slowly"). */
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
/** The tempos Frets offers, in bpm. */
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

/**
 * A key signature: how many sharps (1 to 7) or flats (-1 to -7) it has, and whether it names the
 * minor key with them (E minor, one sharp) rather than the major (G major).
 */
export interface Key {
  fifths: number;
  minor?: true;
}
export const C_MAJOR: Key = { fifths: 0 };
export const MAX_FIFTHS = 7;

export function isKey(v: unknown): v is Key {
  return isObj(v) && Number.isInteger(v.fifths) && Math.abs(v.fifths as number) <= MAX_FIFTHS
    && (v.minor === undefined || v.minor === true);
}

export function sameKey(a: Key, b: Key): boolean {
  return a.fifths === b.fifths && !a.minor === !b.minor;
}

export const MAJOR_NAMES = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
export const MINOR_NAMES = ['Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#'];

/** The key's tonic as alphaTex and Frets spell it, "F#" or "Bb", without major or minor. */
export function keyTonic(key: Key): string {
  return (key.minor ? MINOR_NAMES : MAJOR_NAMES)[key.fifths + MAX_FIFTHS];
}

/** The key as alphaTex writes it after \ks: "G", "Bb", "Eminor". */
export function keyTex(key: Key): string {
  return `${keyTonic(key)}${key.minor ? 'minor' : ''}`;
}

/** The key signature in force in a bar: the latest one at or before it. */
export function keyAt(clip: Pick<Clip, 'bars'>, index: number): Key {
  for (let b = Math.min(index, clip.bars.length - 1); b >= 0; b--) {
    const key = clip.bars[b].key;
    if (key) return key;
  }
  return C_MAJOR;
}

/** Whether a bar starts a key signature different from the one before it (the first bar: any but C major). */
export function changesKey(clip: Pick<Clip, 'bars'>, index: number): boolean {
  const key = clip.bars[index]?.key;
  if (!key) return false;
  return !sameKey(key, index === 0 ? C_MAJOR : keyAt(clip, index - 1));
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
  /** Bars of rest in a row are drawn as one, with their count over it, as printed parts have them (alphaTex's `\multiBarRest`). */
  multiBarRests?: boolean;
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

/**
 * A bar whose durations don't fill its time signature exactly. An emptied bar is short too (Jeremy,
 * 2026-10-26); only a clip with nothing in it yet, one empty bar, isn't.
 */
export function isUneven(clip: Pick<Clip, 'time' | 'bars'>, index: number): boolean {
  const bar = clip.bars[index];
  if (bar.columns.length === 0 && clip.bars.every(b => b.columns.length === 0)) return false;
  return barLength(bar) !== barTicks(timeAt(clip, index));
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

/**
 * How a bar's columns (grace notes left out) fall into tuplet groups, by their places in that list:
 * each run of the same kind of tuplet is cut into groups of n of its shortest note (a quarter and an
 * eighth fill a triplet of eighths), the last one short if the run is. Each group is drawn with its
 * bracket and number.
 */
export function tupletGroups(columns: Column[]): { from: number; to: number; duration: Duration }[] {
  const groups: { from: number; to: number; duration: Duration }[] = [];
  let i = 0;
  while (i < columns.length) {
    const first = columns[i].duration;
    if (!first.tuplet) {
      i++;
      continue;
    }
    let end = i;
    while (end + 1 < columns.length && sameTuplet(columns[end + 1].duration, first)) end++;
    const plain = (c: Column) => ticks({ value: c.duration.value, dots: c.duration.dots });
    const unit = Math.min(...columns.slice(i, end + 1).map(plain));
    let from = i;
    let filled = 0;
    for (let k = i; k <= end; k++) {
      filled += plain(columns[k]);
      if (filled >= first.tuplet * unit || k === end) {
        groups.push({ from, to: k, duration: first });
        from = k + 1;
        filled = 0;
      }
    }
    i = end + 1;
  }
  return groups;
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

/** The mordent over the column, drawn once: any note's, an upper one first. */
export function columnMordent(column: Column): Note['mordent'] {
  if (column.notes.some(n => n?.mordent === 'upper')) return 'upper';
  return column.notes.some(n => n?.mordent === 'lower') ? 'lower' : undefined;
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

/**
 * Tied notes that carry on the bend of the note before them on their string: 'hold' keeps it bent
 * (alphaTex b (4 4) on the tie), 'release' lets it down (b (4 0)). A tied note's "pre-bend" can only
 * be that, as a note still sounding can't be bent before it is picked. The note before must end bent:
 * a bend up, or a hold.
 */
export function bendCarries(clip: Pick<Clip, 'bars'>): Map<Note, 'hold' | 'release'> {
  const out = new Map<Note, 'hold' | 'release'>();
  const last: (Note | null)[] = Array(STRING_COUNT).fill(null);
  for (const bar of clip.bars) {
    for (const column of bar.columns) {
      column.notes.forEach((note, s) => {
        if (!note) return;
        const before = last[s];
        // A bend let down only part of the way (`to`) is still bent for the note after it.
        const endsBent = !!before?.bend && (!before.bend.release || before.bend.to !== undefined);
        if (note.tie && note.bend?.pre && endsBent) out.set(note, note.bend.release ? 'release' : 'hold');
        last[s] = note;
      });
    }
  }
  return out;
}

/**
 * The line, in steps over a bend's usual height, at which each tied note carrying a held bend draws it:
 * a push on up (`Bend.from`) stands a step higher than the line before ("full" then "1½"), and a
 * release that stops part of the way down (`Bend.to`) lands a step lower, where the note after it goes
 * on ("full", down to "½", back up to "full"). Notes on the usual line are left out.
 */
export function bendRaises(clip: Pick<Clip, 'bars'>): Map<Note, number> {
  const carries = bendCarries(clip);
  const out = new Map<Note, number>();
  // The line the next tied note on each string starts from.
  const base: number[] = Array(STRING_COUNT).fill(0);
  for (const bar of clip.bars) {
    for (const column of bar.columns) {
      column.notes.forEach((note, s) => {
        if (!note) return;
        if (!carries.has(note)) {
          base[s] = note.bend?.to !== undefined ? -1 : 0;
          return;
        }
        const level = base[s] + (note.bend!.from !== undefined ? 1 : 0);
        if (level !== 0) out.set(note, level);
        base[s] = level - (note.bend!.to !== undefined ? 1 : 0);
      });
    }
  }
  return out;
}

/** Tied notes that carry on a bend from where the note before let it down part of the way (`Bend.to`). */
export function bendLandings(clip: Pick<Clip, 'bars'>): Set<Note> {
  const carries = bendCarries(clip);
  const out = new Set<Note>();
  const last: (Note | null)[] = Array(STRING_COUNT).fill(null);
  for (const bar of clip.bars) {
    for (const column of bar.columns) {
      column.notes.forEach((note, s) => {
        if (!note) return;
        if (carries.has(note) && last[s]?.bend?.to !== undefined) out.add(note);
        last[s] = note;
      });
    }
  }
  return out;
}

/** Notes a hammer-on, pull-off or legato slide leaves from: the note before one on its string. */
export function legatoStarts(clip: Pick<Clip, 'bars'>): Set<Note> {
  const out = new Set<Note>();
  const last: (Note | null)[] = Array(STRING_COUNT).fill(null);
  for (const bar of clip.bars) {
    for (const column of bar.columns) {
      column.notes.forEach((note, s) => {
        if (!note) return;
        const before = last[s];
        if (before && (note.legato || note.slide === 'legato')) out.add(before);
        last[s] = note;
      });
    }
  }
  return out;
}

/** How many semitones a tied note sounds above its fret: the bend it reaches, held or not yet let down. */
export function bentSemitones(note: Note): number {
  if (!note.tie || !note.bend || note.bend.release) return 0;
  return Math.floor(note.bend.quarters / 2);
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
    && typeof v.bend.pre === 'boolean' && typeof v.bend.release === 'boolean'
    && (v.bend.from === undefined || (v.bend.pre === true && BEND_QUARTERS.includes(v.bend.from as BendQuarters)
      && (v.bend.from as number) < (v.bend.quarters as number)))
    && (v.bend.to === undefined || (v.bend.release === true && BEND_QUARTERS.includes(v.bend.to as BendQuarters)
      && (v.bend.to as number) < (v.bend.quarters as number))));
  return fretOk && bendOk
    && (v.legato === undefined || v.legato === 'h' || v.legato === 'p')
    && (v.slide === undefined || SLIDES.includes(v.slide as Slide))
    && optOneOf(v.slideOut, ['down', 'up']) && optOneOf(v.vibrato, ['slight', 'wide'])
    && optOneOf(v.harmonic, ['natural', 'pinch', 'artificial'])
    && (v.harmonicFret === undefined || (Number.isInteger(v.harmonicFret) && (v.harmonicFret as number) > 0 && (v.harmonicFret as number) <= 24)) && optOneOf(v.accent, ['normal', 'heavy']) && optOneOf(v.mordent, ['upper', 'lower'])
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
    && (v.ottava === undefined || OTTAVAS.includes(v.ottava as Ottava))
    && optOneOf(v.wah, ['open', 'closed']) && optOneOf(v.hairpin, ['crescendo', 'decrescendo'])
    && optStrings(v.extra);
}

function isBar(v: unknown): v is Bar {
  return isObj(v) && Array.isArray(v.columns) && v.columns.every(isColumn)
    && (v.time === undefined || (isObj(v.time) && isTimeSignature(v.time.beats, v.time.value)))
    && (v.key === undefined || isKey(v.key))
    && optBool(v.repeatStart)
    && (v.repeatEnd === undefined || (Number.isInteger(v.repeatEnd) && (v.repeatEnd as number) >= 2))
    && optBool(v.doubleBar)
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
  if (!optBool(v.multiBarRests)) return null;
  return v as unknown as Clip;
}
