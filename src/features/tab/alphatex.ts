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
import { isRest, isStandardTuning, keyTex, type Bend, type Clip, type Column, type Note } from './clip';
import { fxLine } from './fxLine';

/** A string in alphaTex quotes. */
export function quoted(text: string): string {
  return `"${text.replace(/["\\]/g, '\\$&')}"`;
}

/** Where a note sits: bar, column and string (0 = high e). */
interface At { bar: number; column: number; string: number }

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

/** For every note, the effects it carries for a later note on its string (h, sl or ss). */
function originMarks(clip: Clip): Map<string, string[]> {
  const marks = new Map<string, string[]>();
  const last: (At | null)[] = Array(6).fill(null);
  clip.bars.forEach((bar, b) => bar.columns.forEach((column, c) => column.notes.forEach((note, s) => {
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

/** The clip as alphaTex: its FX line, header lines, then the bars, each ending in "|", wrapped at `LINE_WIDTH`. */
export function writeAlphaTex(clip: Clip): string {
  const lines: string[] = [];
  if (clip.fx) lines.push(fxLine(clip.fx));
  if (clip.name) lines.push(`\\title ${quoted(clip.name)}`);
  lines.push(...(clip.header ?? []));
  if (clip.multiBarRests) lines.push('\\multiBarRest');
  if (clip.systemsLayout?.length) lines.push(`\\systemsLayout (${clip.systemsLayout.join(' ')})`);
  if (clip.defaultSystemsLayout !== undefined) lines.push(`\\defaultSystemsLayout ${clip.defaultSystemsLayout}`);
  lines.push(`\\ts (${clip.time.beats} ${clip.time.value})`);
  if (!isStandardTuning(clip.tuning)) {
    const notes = clip.tuning.map((n, i) => withOctave(n, i)).reverse();
    lines.push(`\\tuning (${notes.join(' ')})`);
  }
  if (clip.capo) lines.push(`\\capo ${clip.capo}`);
  lines.push(...wrapBars(barTokens(clip)));
  return `${lines.join('\n')}\n`;
}

/** Each bar on one line, unwrapped: what tests and anything comparing bars want. */
export function writeBars(clip: Clip): string[] {
  return barTokens(clip).map(tokens => tokens.join(' '));
}

/** Each bar's marks, beats and closing bar line, as the tokens a line break may go between. */
function barTokens(clip: Clip): string[][] {
  const marks = originMarks(clip);
  return clip.bars.map((bar, b) => {
    const meta: string[] = [];
    if (bar.time) meta.push(`\\ts (${bar.time.beats} ${bar.time.value})`);
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
    const beats = bar.columns.map((_, c) => beatTex(bar.columns, b, c, marks));
    // The bar line goes with the last beat, so a wrapped bar never leaves it alone on a line.
    const last = beats.pop();
    return [...meta, ...beats, last === undefined ? '|' : `${last} |`];
  });
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
