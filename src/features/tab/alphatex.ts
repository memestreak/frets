/**
 * A clip written as alphaTex, the text notation of alphaTab
 * (https://alphatab.net/docs/alphatex/introduction). Pure; no React.
 *
 * The form written here is deliberately plain so a person or an agent can
 * follow it: one bar per line, every beat with its own duration, strings
 * numbered 1 (high e) to 6 (low E) as in tab. What Frets doesn't draw yet
 * (a clip's `header`, and `extra` on bars, columns and notes) is written
 * back as it was read. Reading is `alphatexRead.ts`.
 */
import { isRest, isStandardTuning, type Bend, type Clip, type Column, type Note } from './clip';

/** A string in alphaTex quotes. */
function quoted(text: string): string {
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

/** The points of a bend in quarter-tones: (0 4) a full bend, (4 4 0) a pre-bend let down. */
function bendPoints({ quarters, pre, release }: Bend): string {
  const points = pre ? [quarters, quarters] : [0, quarters];
  if (release) points.push(0);
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
  if (note.bend) effects.push(`b (${bendPoints(note.bend)})`);
  if (note.slideOut) effects.push(note.slideOut === 'down' ? 'sod' : 'sou');
  if (note.vibrato) effects.push(note.vibrato === 'wide' ? 'vw' : 'v');
  if (note.harmonic) effects.push(note.harmonic === 'pinch' ? 'ph' : 'nh');
  if (note.palmMute) effects.push('pm');
  if (note.letRing) effects.push('lr');
  if (note.ghost) effects.push('g');
  if (note.accent) effects.push(note.accent === 'heavy' ? 'hac' : 'ac');
  if (note.staccato) effects.push('st');
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
  const { value, dots, tuplet } = column.grace ? { value: graceValue(columns, index), dots: 0 } : column.duration;
  const effects: string[] = [];
  if (dots === 1) effects.push('d');
  if (dots === 2) effects.push('dd');
  if (tuplet) effects.push(`tu ${tuplet}`);
  if (column.grace) effects.push(column.grace === 'on' ? 'gr ob' : 'gr');
  if (column.tremolo) effects.push(`tp ${column.tremolo}`);
  if (column.chord) effects.push(`ch ${quoted(column.chord)}`);
  if (column.stroke) effects.push(column.stroke === 'down' ? 'sd' : 'su');
  if (column.notes.some(n => n?.tap)) effects.push('tt');
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

/** The clip as alphaTex: header lines, then one bar per line, each ending in "|". */
export function writeAlphaTex(clip: Clip): string {
  const lines: string[] = [];
  if (clip.name) lines.push(`\\title ${quoted(clip.name)}`);
  lines.push(...(clip.header ?? []));
  lines.push(`\\ts (${clip.time.beats} ${clip.time.value})`);
  if (!isStandardTuning(clip.tuning)) {
    const notes = clip.tuning.map((n, i) => withOctave(n, i)).reverse();
    lines.push(`\\tuning (${notes.join(' ')})`);
  }
  if (clip.capo) lines.push(`\\capo ${clip.capo}`);
  const marks = originMarks(clip);
  clip.bars.forEach((bar, b) => {
    const meta: string[] = [];
    if (bar.time) meta.push(`\\ts (${bar.time.beats} ${bar.time.value})`);
    if (bar.section) {
      const { text, marker } = bar.section;
      meta.push(marker ? `\\section (${quoted(marker)} ${quoted(text)})` : `\\section ${quoted(text)}`);
    }
    if (bar.tempo) meta.push(bar.tempo.label ? `\\tempo (${bar.tempo.bpm} ${quoted(bar.tempo.label)})` : `\\tempo ${bar.tempo.bpm}`);
    if (bar.repeatStart) meta.push('\\ro');
    if (bar.ending) meta.push(`\\ae ${bar.ending}`);
    if (bar.repeatEnd) meta.push(`\\rc ${bar.repeatEnd}`);
    meta.push(...(bar.extra ?? []));
    const beats = bar.columns.map((_, c) => beatTex(bar.columns, b, c, marks));
    lines.push([...meta, ...beats, '|'].join(' '));
  });
  return `${lines.join('\n')}\n`;
}
