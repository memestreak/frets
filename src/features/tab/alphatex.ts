/**
 * A clip written as alphaTex, the text notation of alphaTab
 * (https://alphatab.net/docs/alphatex/introduction). Pure; no React.
 *
 * The form written here is deliberately plain so a person or an agent can
 * follow it: one bar per line, every beat with its own duration, strings
 * numbered 1 (high e) to 6 (low E) as in tab.
 */
import { isRest, isStandardTuning, type Bend, type Clip, type Column, type Note } from './clip';

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

/** For every note, the effects it carries for a later note on its string (h or sl). */
function originMarks(clip: Clip): Map<string, string[]> {
  const marks = new Map<string, string[]>();
  const last: (At | null)[] = Array(6).fill(null);
  clip.bars.forEach((bar, b) => bar.columns.forEach((column, c) => column.notes.forEach((note, s) => {
    if (!note) return;
    const prev = last[s];
    if (prev) {
      const key = `${prev.bar}:${prev.column}:${prev.string}`;
      if (note.legato) marks.set(key, [...(marks.get(key) ?? []), 'h']);
      if (note.slide) marks.set(key, [...(marks.get(key) ?? []), 'sl']);
    }
    last[s] = { bar: b, column: c, string: s };
  })));
  return marks;
}

/** Whether a note has an earlier note on its string, for a slide that starts there. */
function hasEarlier(clip: Clip, at: At): boolean {
  for (let b = at.bar; b >= 0; b--) {
    const columns = clip.bars[b].columns;
    for (let c = b === at.bar ? at.column - 1 : columns.length - 1; c >= 0; c--) {
      if (columns[c].notes[at.string]) return true;
    }
  }
  return false;
}

function noteTex(note: Note, at: At, column: Column, clip: Clip, marks: string[]): string {
  const fret = note.tie ? '-' : note.fret === null ? 'x' : String(note.fret);
  const effects = [...marks];
  if (note.slide && !hasEarlier(clip, at)) effects.push(note.slide === 'up' ? 'sib' : 'sia');
  if (note.bend) effects.push(`b (${bendPoints(note.bend)})`);
  if (note.vibrato) effects.push('v');
  if (note.harmonic) effects.push('nh');
  if (column.palmMute) effects.push('pm');
  return `${fret}.${at.string + 1}${effects.length ? `{${effects.join(' ')}}` : ''}`;
}

function beatTex(column: Column, bar: number, index: number, clip: Clip, marks: Map<string, string[]>): string {
  const { value, dotted, triplet } = column.duration;
  const effects: string[] = [];
  if (dotted) effects.push('d');
  if (triplet) effects.push('tu 3');
  if (column.stroke) effects.push(column.stroke === 'down' ? 'sd' : 'su');
  if (column.notes.some(n => n?.tap)) effects.push('tt');
  const after = `.${value}${effects.length ? `{${effects.join(' ')}}` : ''}`;
  if (isRest(column)) return `r${after}`;
  const notes = column.notes.flatMap((note, s) => {
    if (!note) return [];
    const at = { bar, column: index, string: s };
    return [noteTex(note, at, column, clip, marks.get(`${bar}:${index}:${s}`) ?? [])];
  });
  return `${notes.length === 1 ? notes[0] : `(${notes.join(' ')})`}${after}`;
}

/** The clip as alphaTex: header lines, then one bar per line, each ending in "|". */
export function writeAlphaTex(clip: Clip): string {
  const lines: string[] = [];
  if (clip.name) lines.push(`\\title "${clip.name.replace(/["\\]/g, '\\$&')}"`);
  lines.push(`\\ts (${clip.time.beats} ${clip.time.value})`);
  if (!isStandardTuning(clip.tuning)) {
    const notes = clip.tuning.map((n, i) => withOctave(n, i)).reverse();
    lines.push(`\\tuning (${notes.join(' ')})`);
  }
  const marks = originMarks(clip);
  clip.bars.forEach((bar, b) => {
    const meta: string[] = [];
    if (bar.repeatStart) meta.push('\\ro');
    if (bar.ending) meta.push(`\\ae ${bar.ending}`);
    if (bar.repeatEnd) meta.push(`\\rc ${bar.repeatEnd}`);
    const beats = bar.columns.map((column, c) => beatTex(column, b, c, clip, marks));
    lines.push([...meta, ...beats, '|'].join(' '));
  });
  return `${lines.join('\n')}\n`;
}
