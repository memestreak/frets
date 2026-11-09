/**
 * A clip written as alphaTex, the text notation of alphaTab
 * (https://alphatab.net/docs/alphatex/introduction). Pure; no React.
 *
 * The form written here is deliberately plain so a person or an agent can
 * follow it: lines of at most 80 characters broken at bar lines, every beat with its own duration, strings
 * numbered 1 (high e) to 6 (low E) as in tab. What Frets doesn't draw yet
 * (a clip's `header`, and `extra` on bars, columns and notes) is written
 * back as it was read. Reading is `alphatexRead.ts`.
 */
import {
  asClip, barTicks, defaultGroupCounts, ownVoice, fewestRests, isRest, isStandardTuningNames, keyTex, STRING_COUNT, type Bend, type Clip, type Column,
  type MasterBar, type Note, type Part, type TimeSignature, type Track, type TrackBar,
} from './clip';
import { chordDefTex } from './chordSet';
import { fxLine } from './fxLine';
import { keepsGuitarTuning } from './instrument';

/** A string in alphaTex quotes; a new line (a Text's, issue #445) as `\n`, so the string stays on one line. */
export function quoted(text: string): string {
  return `"${text.replace(/["\\]/g, '\\$&').replace(/\n/g, '\\n')}"`;
}

/** Where a note sits: bar, column and string (0 = high e), in one Voice. */
interface At { bar: number; column: number; string: number }

/** A bar as the writer takes it: its marks and each Voice's Columns. */
type WrittenBar = MasterBar & TrackBar;

/** Semitones above C for each natural note name. */
const NATURAL: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** Standard tuning as MIDI numbers, low E first. */
const STANDARD_MIDI = [40, 45, 50, 55, 59, 64];

/**
 * A tuning note with the octave that puts it nearest the standard string
 * it replaces, so "D" on the low string is D2 and "C#" on the A string C#3.
 */
function withOctave(name: string, string: number): string {
  const pc = NATURAL[name[0]] + (name.includes('#') ? 1 : 0) - (name.slice(1).includes('b') ? 1 : 0);
  const target = STANDARD_MIDI[string];
  let best = 0;
  for (let octave = 0; octave <= 8; octave++) {
    const midi = 12 * (octave + 1) + pc;
    if (Math.abs(midi - target) < Math.abs(12 * (best + 1) + pc - target)) best = octave;
  }
  return `${name}${best}`;
}

/**
 * The points of a bend in quarter-tones: (0 4) a full bend, (4 4 0) a pre-bend let down. On a tied
 * note a "pre-bend" carries on the bend before: (4 4) holds it, (4 0) lets it down and (4 6) pushes it
 * on up.
 */
function bendPoints({ quarters, pre, release, from, to }: Bend, tied: boolean): string {
  if (tied && pre && release && from === undefined) return `${quarters} ${to ?? 0}`;
  const points = pre ? [from ?? quarters, quarters] : [0, quarters];
  if (release) points.push(to ?? 0);
  return points.join(' ');
}

/**
 * For every note of one Voice (its Columns bar by bar), the effects it carries for the Voice's later
 * note on its string (h, sl or ss): joins stay within a Voice, as alphaTab reads them.
 */
function originMarks(bars: readonly Column[][]): Map<string, string[]> {
  const marks = new Map<string, string[]>();
  const last: (At | null)[] = Array(6).fill(null);
  bars.forEach((columns, b) => columns.forEach((column, c) => column.notes.forEach((note, s) => {
    if (!note) return;
    const prev = last[s];
    if (prev) {
      const key = `${prev.bar}:${prev.column}:${prev.string}`;
      if (note.legato) marks.set(key, [...(marks.get(key) ?? []), 'h']);
      if (note.slide === 'legato') marks.set(key, [...(marks.get(key) ?? []), 'sl']);
      if (note.slide === 'shift') marks.set(key, [...(marks.get(key) ?? []), 'ss']);
    }
    last[s] = { bar: b, column: c, string: s };
  })));
  return marks;
}

function noteTex(note: Note, at: At, marks: string[]): string {
  const fret = note.tie ? '-' : note.fret === null ? 'x' : String(note.fret);
  const effects = [...marks];
  if (note.slide === 'below') effects.push('sib');
  if (note.slide === 'above') effects.push('sia');
  if (note.bend) effects.push(`b (${bendPoints(note.bend, !!note.tie)})`);
  if (note.slideOut) effects.push(note.slideOut === 'down' ? 'sod' : 'sou');
  if (note.vibrato) effects.push(note.vibrato === 'wide' ? 'vw' : 'v');
  if (note.harmonic === 'artificial') effects.push(note.harmonicFret ? `ah ${note.harmonicFret}` : 'ah');
  else if (note.harmonic) effects.push(note.harmonic === 'pinch' ? 'ph' : 'nh');
  if (note.palmMute) effects.push('pm');
  if (note.letRing) effects.push('lr');
  if (note.ghost) effects.push('g');
  if (note.accent) effects.push(note.accent === 'heavy' ? 'hac' : 'ac');
  if (note.staccato) effects.push('st');
  if (note.mordent) effects.push(note.mordent === 'upper' ? 'umordent' : 'lmordent');
  effects.push(...(note.extra ?? []));
  return `${fret}.${at.string + 1}${effects.length ? `{${effects.join(' ')}}` : ''}`;
}

/**
 * How long a grace note is written, as alphaTab reads it back whatever is written: one alone an
 * eighth, two together sixteenths, three or more thirty-seconds. It takes no time in the bar either way.
 */
function graceValue(columns: Column[], index: number): Column['duration']['value'] {
  let first = index;
  while (columns[first - 1]?.grace) first--;
  let last = index;
  while (columns[last + 1]?.grace) last++;
  const size = last - first + 1;
  return size === 1 ? 8 : size === 2 ? 16 : 32;
}

/**
 * Beat groups as alphaTex `\beaming`, counted in eighths or shorter: alphaTab 1.8.4 reads a 4 there as a
 * quadruple whole note, so 4/4's 2+2 is written `(8 4 4)`.
 */
function beamingTex(time: TimeSignature, groups: number[]): string {
  const unit = Math.max(8, time.value);
  return `\\beaming (${unit} ${groups.map(n => (n * unit) / time.value).join(' ')})`;
}

function beatTex(columns: Column[], bar: number, index: number, marks: Map<string, string[]>): string {
  const column = columns[index];
  // A grace note is written plain, at the length alphaTab gives it.
  const { value, dots, tuplet, tupletSpan } = column.grace ? { value: graceValue(columns, index), dots: 0 } : column.duration;
  const effects: string[] = [];
  if (dots === 1) effects.push('d');
  if (dots === 2) effects.push('dd');
  if (tuplet) effects.push(tupletSpan ? `tu (${tuplet} ${tupletSpan})` : `tu ${tuplet}`);
  if (column.grace) effects.push(column.grace === 'on' ? 'gr ob' : 'gr');
  if (column.tremolo) effects.push(`tp ${column.tremolo}`);
  if (column.chord) effects.push(`ch ${quoted(column.chord)}`);
  if (column.text) effects.push(`txt ${quoted(column.text)}`);
  if (column.stroke) effects.push(column.stroke === 'down' ? 'sd' : 'su');
  if (column.notes.some(n => n?.tap)) effects.push('tt');
  if (column.ottava) effects.push(`ot ${column.ottava}`);
  if (column.wah) effects.push(column.wah === 'open' ? 'waho' : 'wahc');
  if (column.hairpin) effects.push(column.hairpin === 'crescendo' ? 'cre' : 'dec');
  if (column.fermata) effects.push(`fermata ${column.fermata}`);
  if (column.whammy) effects.push(`tb (${column.whammy.join(' ')})`);
  // A Beam override is written on the Column before, as alphaTab reads it.
  const nextBeam = columns[index + 1]?.beam;
  if (nextBeam) effects.push(nextBeam === 'break' ? 'beam split' : 'beam merge');
  effects.push(...(column.extra ?? []));
  const after = `.${value}${effects.length ? `{${effects.join(' ')}}` : ''}`;
  if (isRest(column)) return `r${after}`;
  const notes = column.notes.flatMap((note, s) => {
    if (!note) return [];
    const at = { bar, column: index, string: s };
    return [noteTex(note, at, marks.get(`${bar}:${index}:${s}`) ?? [])];
  });
  return `${notes.length === 1 ? notes[0] : `(${notes.join(' ')})`}${after}`;
}

/**
 * The clip as alphaTex: its header lines, then each track: its `\track` line when the clip has more
 * than one or one was written, its FX line, its own lines, then its bars, each ending in "|", wrapped
 * at `LINE_WIDTH`. A first track with no `\track` line has its FX line first in the text, where a
 * reader finds it before any track starts. The bar marks every track shares (signatures, repeats,
 * tempo, sections) are written in the first track's bars only; alphaTab gives them to every track.
 */
export function writeAlphaTex(clip: Clip): string {
  const lines = alphaTexTracks(clip).flatMap(track => [...track.head, ...wrapBars(track.bars)]);
  return `${lines.join('\n')}\n`;
}

/** One track of the clip as alphaTex (`alphaTexTracks`): the lines before its bars, and each bar's tokens. */
export interface TrackTex {
  /** The first track's carry the clip's own header lines too. */
  head: string[];
  /** Each bar's marks, beats and closing bar line. */
  bars: string[][];
}

/**
 * The clip as `writeAlphaTex` writes it, a track at a time and a bar at a time, unwrapped: what the
 * Chat panel numbers for a model and splices a model's bars into (`docs/specs/2026-11-08-tab-chat-design.md`).
 */
export function alphaTexTracks(clip: Clip): TrackTex[] {
  const several = clip.tracks.length > 1;
  const tagOf = (track: Track) => track.tag ?? (several ? (track.name ? `\\track ${quoted(track.name)}` : '\\track') : null);
  const first = clip.tracks[0];
  return clip.tracks.map((track, t) => {
    const head: string[] = [];
    if (t === 0) {
      if (first.fx && !tagOf(first)) head.push(fxLine(first.fx));
      if (clip.name) head.push(`\\title ${quoted(clip.name)}`);
      head.push(...(clip.header ?? []));
    }
    const tag = tagOf(track);
    if (tag) {
      head.push(tag);
      if (track.fx) head.push(fxLine(track.fx));
    }
    head.push(...(track.header ?? []));
    if (track.instrument?.tag) head.push(track.instrument.tag);
    if (t === 0) {
      if (clip.multiBarRests) head.push('\\multiBarRest');
      if (clip.systemsLayout?.length) head.push(`\\systemsLayout (${clip.systemsLayout.join(' ')})`);
      if (clip.defaultSystemsLayout !== undefined) head.push(`\\defaultSystemsLayout ${clip.defaultSystemsLayout}`);
      // Voices are written a bar at a time; a clip of one Voice writes none (`docs/specs/2026-11-03-tab-voices-design.md`).
      if (clip.tracks.some(each => each.bars.some(bar => bar.voices.length > 1))) head.push('\\voiceMode barWise');
      head.push(`\\ts (${clip.time.beats} ${clip.time.value})`);
    }
    head.push(...trackLines(track));
    // The bar marks every track shares are written in the first track's bars only.
    const bars = t === 0 ? clip.masterBars.map((master, b) => ({ ...master, ...track.bars[b] })) : track.bars;
    return { head, bars: barTokens(bars, clip.time) };
  });
}

/** The part alone as alphaTex, one track: what is copied, and what playback reads. */
export function writePart(part: Part): string {
  return writeAlphaTex(asClip(part));
}

/** A track's tuning, when it isn't standard or its sound wouldn't take guitar strings, its capo and its `\chord` definitions. */
function trackLines(track: Track): string[] {
  const lines: string[] = [];
  if (!isStandardTuningNames(track.tuning) || (track.instrument && !keepsGuitarTuning(track.instrument.program))) {
    const notes = track.tuning.map((n, i) => withOctave(n, i)).reverse();
    lines.push(`\\tuning (${notes.join(' ')})`);
  }
  if (track.capo) lines.push(`\\capo ${track.capo}`);
  for (const def of track.chords ?? []) lines.push(chordDefTex(def, quoted));
  return lines;
}

/** Each of the part's bars on one line, unwrapped (its own Voice only): what tests and anything comparing bars want. */
export function writeBars(part: Pick<Part, 'bars' | 'time'>): string[] {
  return barTokens(part.bars.map(bar => ({ ...ownVoice(bar), voices: [bar.columns] })), part.time).map(tokens => tokens.join(' '));
}

/**
 * Each bar's marks, beats and closing bar line, as the tokens a line break may go between. A bar with
 * more than one Voice writes each after `\voice`, Voice 1 first; an absent Voice before a present one
 * is written as rests the bar's length, since bar-wise Voices are counted in order.
 */
function barTokens(bars: readonly WrittenBar[], firstTime: TimeSignature): string[][] {
  const voiceCount = Math.max(1, ...bars.map(bar => bar.voices.length));
  const marks = Array.from({ length: voiceCount }, (_, v) => originMarks(bars.map(bar => bar.voices[v] ?? [])));
  let time = firstTime;
  let ownGroups = false;
  return bars.map((bar, b) => {
    if (bar.time) time = bar.time;
    const meta: string[] = [];
    if (bar.time) meta.push(`\\ts (${bar.time.beats} ${bar.time.value})`);
    // Beat groups with their time signature; after a time signature with groups of its own, the next
    // one writes its default too, since alphaTab carries a \beaming on to the next.
    if (b === 0 || bar.time) {
      const groups = bar.beatGroups ?? (ownGroups ? defaultGroupCounts(time) : null);
      if (groups) meta.push(beamingTex(time, groups));
      ownGroups = !!bar.beatGroups;
    }
    if (b === 0 && bar.pickup) meta.push('\\ac');
    if (bar.key) meta.push(`\\ks ${keyTex(bar.key)}`);
    if (bar.section) {
      const { text, marker } = bar.section;
      meta.push(marker ? `\\section (${quoted(marker)} ${quoted(text)})` : `\\section ${quoted(text)}`);
    }
    if (bar.tempo) meta.push(bar.tempo.label ? `\\tempo (${bar.tempo.bpm} ${quoted(bar.tempo.label)})` : `\\tempo ${bar.tempo.bpm}`);
    if (bar.repeatStart) meta.push('\\ro');
    if (bar.ending) meta.push(`\\ae ${bar.ending}`);
    if (bar.repeatEnd) meta.push(`\\rc ${bar.repeatEnd}`);
    if (bar.doubleBar) meta.push('\\db');
    if (bar.freeTime) meta.push('\\ft');
    meta.push(...(bar.extra ?? []));
    const beats = bar.voices.length === 1
      ? bar.voices[0].map((_, c, columns) => beatTex(columns, b, c, marks[0]))
      : bar.voices.flatMap((columns, v) => {
        const written = columns.length > 0 ? columns : restsFor(time);
        return ['\\voice', ...written.map((_, c) => beatTex(written, b, c, marks[v]))];
      });
    // The bar line goes with the last beat, so a wrapped bar never leaves it alone on a line.
    const last = beats.pop();
    return [...meta, ...beats, last === undefined ? '|' : `${last} |`];
  });
}

/** Rests as long as a bar of `time`. */
function restsFor(time: TimeSignature): Column[] {
  return fewestRests(barTicks(time)).map(duration => ({ duration, notes: Array<Note | null>(STRING_COUNT).fill(null) }));
}

/** The longest line the writer makes, unless one beat or bar mark is longer by itself. */
export const LINE_WIDTH = 80;
/** The start of a line that carries on a bar too long for one line. */
const CONTINUED = '  ';

/**
 * The bars as lines of at most `LINE_WIDTH` characters (Jeremy, 2026-10-27): as many whole bars on a
 * line as fit, a new line at a bar line when the next bar doesn't, or starts a section. A bar too long for a line by
 * itself starts a line of its own and breaks between its beats, each later line indented.
 */
function wrapBars(bars: string[][]): string[] {
  const lines: string[] = [];
  let line = '';
  for (const tokens of bars) {
    const bar = tokens.join(' ');
    // A new section starts a line, so the song's form reads down the left edge.
    const startsSection = tokens.some(t => t.startsWith('\\section'));
    if (line && !startsSection && line.length + 1 + bar.length <= LINE_WIDTH) {
      line += ` ${bar}`;
      continue;
    }
    if (line) lines.push(line);
    if (bar.length <= LINE_WIDTH) {
      line = bar;
      continue;
    }
    // Too long for one line: its beats fill lines, and the next bar starts a fresh one.
    let part = '';
    for (const token of tokens) {
      if (part && part.length + 1 + token.length > LINE_WIDTH) {
        lines.push(part);
        part = CONTINUED + token;
      } else {
        part = part ? `${part} ${token}` : token;
      }
    }
    lines.push(part);
    line = '';
  }
  if (line) lines.push(line);
  return lines;
}
