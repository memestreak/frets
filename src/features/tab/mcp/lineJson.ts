/**
 * `show_tab`'s line as JSON (`tool.ts`) and the clip it stands for, both ways
 * (`docs/specs/2026-11-04-show-tab-mcp-app-design.md`): `lineFromInput` checks a call and makes its
 * `Part`, placing each `pitch` as staff entry does; `lineOf` turns a `Part` back into the JSON the model
 * reads, every note on its string and fret. Pure; shared by the server (which checks) and the app.
 */
import { midiOf } from '@/lib/theory/notes';
import {
  COMMON_TIME, DEFAULT_BPM, STANDARD_TUNING, STRING_COUNT, isTimeSignature, tupletProblems, unevenBy,
  type Bar, type Column, type Duration, type Note, type Part, type TimeSignature,
} from '../clip';
import { choosePlace } from '../staffEntry';
import { inputSchema, type ColumnInput, type LineInput, type LoopEnd, type LoopInput, type NoteInput, type View } from './tool';

/** Loop points as the clip counts them: the first and last column looped, across the whole line from 0. */
export type LoopPoints = [number, number];

export type LineResult =
  | { ok: true; part: Part; line: LineInput; view: View; loop: LoopPoints | null }
  | { ok: false; error: string };

/** "Bar 2, column 3" for a place in the line, counted from 1 as the model counts them. */
const placeName = (bar: number, column: number) => `Bar ${bar + 1}, column ${column + 1}`;

/** A zod issue's path as the model would find it: "Bar 2, column 3, note 1, fret". */
function pathName(path: readonly PropertyKey[]): string {
  const words: string[] = [];
  for (let i = 0; i < path.length; i++) {
    const key = path[i];
    const next = path[i + 1];
    if (typeof next === 'number' && (key === 'bars' || key === 'columns' || key === 'notes')) {
      words.push(`${({ bars: 'Bar', columns: 'column', notes: 'note' } as const)[key]} ${next + 1}`);
      i++;
    } else {
      words.push(String(key));
    }
  }
  return words.join(', ');
}

/** The clip's own note for a note of the input, its string and fret already known. */
function noteOf(input: NoteInput, fret: number | null): Note {
  const note: Note = { fret };
  if (input.legato) note.legato = input.legato;
  if (input.slide) note.slide = input.slide;
  if (input.bend) note.bend = { quarters: input.bend.quarters, pre: input.bend.pre ?? false, release: input.bend.release ?? false };
  if (input.vibrato) note.vibrato = input.vibrato;
  if (input.tie) note.tie = true;
  return note;
}

function durationOf(input: ColumnInput['duration']): Duration {
  return input.tuplet ? { value: input.value, dots: input.dots ?? 0, tuplet: input.tuplet } : { value: input.value, dots: input.dots ?? 0 };
}

/** The note on a string in the nearest earlier column that has one, or null. */
function noteBefore(bars: readonly Bar[], bar: number, column: number, string: number): Note | null {
  for (let b = bar; b >= 0; b--) {
    const columns = bars[b].columns;
    for (let c = b === bar ? column - 1 : columns.length - 1; c >= 0; c--) {
      const note = columns[c].notes[string];
      if (note) return note;
    }
  }
  return null;
}

/** Why a note that carries on from the one before can't, or null. */
function joinProblem(bars: readonly Bar[], bar: number, column: number, string: number, note: Note): string | null {
  const what = note.tie ? 'tie' : note.legato === 'h' ? 'hammer-on' : note.legato === 'p' ? 'pull-off'
    : note.slide === 'legato' || note.slide === 'shift' ? 'slide' : null;
  if (!what) return null;
  const before = noteBefore(bars, bar, column, string);
  const where = `${placeName(bar, column)}: the ${what} on string ${string + 1}`;
  if (!before) return `${where} has no earlier note on that string.`;
  if (note.tie && before.fret !== note.fret) return `${where} is at fret ${note.fret ?? 'x'}, but the note it holds on from is at fret ${before.fret ?? 'x'}.`;
  return null;
}

/**
 * The line a call asks for, checked: zod for each field, then what spans fields (a note given one way,
 * one note a string, a pitch that can be played, a join with a note to join, full bars). The first
 * problem found is the error, worded so the model can fix it and call again.
 */
export function lineFromInput(raw: unknown): LineResult {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = pathName(issue.path);
    return { ok: false, error: where ? `${where}: ${issue.message}` : issue.message };
  }
  const line = parsed.data;
  let time: TimeSignature = COMMON_TIME;
  if (line.time) {
    const [beats, value] = line.time;
    if (!isTimeSignature(beats, value)) return { ok: false, error: `${beats}/${value} isn't a time signature Frets draws: up to 32 beats, of 2, 4, 8, 16 or 32.` };
    time = { beats, value: value as TimeSignature['value'] };
  }
  const part: Part = { name: '', time, tuning: [...STANDARD_TUNING], bars: [] };
  if (line.capo) part.capo = line.capo;

  for (const [b, barInput] of line.bars.entries()) {
    const bar: Bar = { columns: [] };
    if (b === 0 && line.bpm !== undefined) bar.tempo = { bpm: line.bpm };
    part.bars.push(bar);
    for (const [c, columnInput] of barInput.columns.entries()) {
      const column: Column = { duration: durationOf(columnInput.duration), notes: Array<Note | null>(STRING_COUNT).fill(null) };
      if (columnInput.chord?.trim()) column.chord = columnInput.chord.trim();
      bar.columns.push(column);
      const pitched: NoteInput[] = [];
      // Notes on a string first, so the pitches take the strings left free.
      for (const note of columnInput.notes) {
        const spot = note.string !== undefined || note.fret !== undefined;
        if (spot && note.pitch !== undefined) return { ok: false, error: `${placeName(b, c)}: give a note string and fret, or pitch, not both.` };
        if (note.pitch !== undefined) {
          pitched.push(note);
          continue;
        }
        if (note.string === undefined || note.fret === undefined) return { ok: false, error: `${placeName(b, c)}: a note needs string and fret, or pitch.` };
        const s = note.string - 1;
        if (column.notes[s]) return { ok: false, error: `${placeName(b, c)}: two notes on string ${note.string}.` };
        column.notes[s] = noteOf(note, note.fret);
      }
      for (const note of pitched) {
        const midi = midiOf(note.pitch!);
        if (midi === null) return { ok: false, error: `${placeName(b, c)}: "${note.pitch}" isn't a note such as E4, F#3 or Bb2.` };
        const place = choosePlace(part, { bar: b, column: c }, midi);
        if (!place) {
          const capo = part.capo ? ` with the capo at fret ${part.capo}` : '';
          return { ok: false, error: `${placeName(b, c)}: no free string plays ${note.pitch} in standard tuning${capo} (E2 to E6, frets 0 to 24).` };
        }
        column.notes[place.string] = noteOf(note, place.fret);
      }
      for (let s = 0; s < STRING_COUNT; s++) {
        const note = column.notes[s];
        const problem = note && joinProblem(part.bars, b, c, s, note);
        if (problem) return { ok: false, error: problem };
      }
    }
  }

  for (const [b, bar] of part.bars.entries()) {
    const tuplets = tupletProblems(bar, b);
    if (tuplets.length) return { ok: false, error: tuplets[0] };
    const off = unevenBy(part, b);
    if (off) return { ok: false, error: `Bar ${b + 1} is ${off.words} ${off.over ? 'over' : 'short of'} ${time.beats}/${time.value}.` };
  }
  let loop: LoopPoints | null = null;
  if (line.loop) {
    const points = loopPoints(part, line.loop);
    if (typeof points === 'string') return { ok: false, error: points };
    loop = points;
  }
  return { ok: true, part, line: lineOf(part), view: line.view ?? 'both', loop };
}

/** Each bar's first column, counted across the whole line from 0. */
function barStarts(part: Part): number[] {
  const starts: number[] = [];
  let n = 0;
  for (const bar of part.bars) {
    starts.push(n);
    n += bar.columns.length;
  }
  return starts;
}

/**
 * The loop points a call asks for, as the clip counts them, or why they can't be: an end in a bar or
 * column the line hasn't got, or a start after the end.
 */
export function loopPoints(part: Part, loop: LoopInput): LoopPoints | string {
  const starts = barStarts(part);
  const at = (which: 'start' | 'end'): number | string => {
    const end = loop[which];
    const label = `Loop ${which}`;
    const b = end ? end.bar - 1 : which === 'start' ? 0 : part.bars.length - 1;
    const bar = part.bars[b];
    if (!bar) return `${label}: there is no bar ${b + 1}; the line has ${part.bars.length}.`;
    const count = bar.columns.length;
    if (count === 0) return `${label}: bar ${b + 1} has no columns.`;
    const c = end?.column !== undefined ? end.column - 1 : which === 'start' ? 0 : count - 1;
    if (c >= count) return `${label}: bar ${b + 1} has ${count} column${count === 1 ? '' : 's'}.`;
    return starts[b] + c;
  };
  const start = at('start');
  if (typeof start === 'string') return start;
  const end = at('end');
  if (typeof end === 'string') return end;
  if (start > end) return 'Loop: the start comes after the end.';
  return [start, end];
}

/** A column counted across the line, as its bar and column in it, both from 0. */
function placeOf(part: Part, index: number): { bar: number; column: number } {
  const starts = barStarts(part);
  let b = 0;
  while (b + 1 < part.bars.length && starts[b + 1] <= index) b++;
  return { bar: b, column: index - starts[b] };
}

/**
 * Loop points as the model reads them, in `show_tab`'s own shape: each end's bar, and its column only
 * when it isn't where the bar starts (for the start) or ends (for the end).
 */
export function loopOf(part: Part, [first, last]: LoopPoints): { start: LoopEnd; end: LoopEnd } {
  const start = placeOf(part, first);
  const end = placeOf(part, last);
  return {
    start: start.column === 0 ? { bar: start.bar + 1 } : { bar: start.bar + 1, column: start.column + 1 },
    end: end.column === part.bars[end.bar].columns.length - 1 ? { bar: end.bar + 1 } : { bar: end.bar + 1, column: end.column + 1 },
  };
}

/** Loop points in words: "the whole line", "bar 2", "bars 2 to 3", "bar 2 to bar 3, column 4". */
export function describeLoop(part: Part, points: LoopPoints): string {
  const { start, end } = loopOf(part, points);
  const whole = start.bar === 1 && start.column === undefined && end.bar === part.bars.length && end.column === undefined;
  if (whole) return 'the whole line';
  const words = (e: LoopEnd) => (e.column === undefined ? `bar ${e.bar}` : `bar ${e.bar}, column ${e.column}`);
  if (start.column === undefined && end.column === undefined) return start.bar === end.bar ? `bar ${start.bar}` : `bars ${start.bar} to ${end.bar}`;
  return `${words(start)} to ${words(end)}`;
}

/** A note as the model reads it: on its string and fret, with the fields `show_tab` takes. */
function noteJson(note: Note, s: number): NoteInput {
  const out: NoteInput = { string: s + 1, fret: note.fret };
  if (note.legato) out.legato = note.legato;
  if (note.slide) out.slide = note.slide;
  if (note.bend) {
    out.bend = { quarters: note.bend.quarters };
    if (note.bend.pre) out.bend.pre = true;
    if (note.bend.release) out.bend.release = true;
  }
  if (note.vibrato) out.vibrato = note.vibrato;
  if (note.tie) out.tie = true;
  return out;
}

/**
 * A clip's part as `show_tab`'s JSON, cut to the fields it takes: what the model is given back (the
 * tool's result, and later the user's edits), every note on its string and fret.
 */
export function lineOf(part: Part): LineInput {
  const line: LineInput = { bars: [] };
  const bpm = part.bars[0]?.tempo?.bpm;
  if (bpm !== undefined) line.bpm = bpm;
  line.time = [part.time.beats, part.time.value];
  if (part.capo) line.capo = part.capo;
  line.bars = part.bars.map(bar => ({
    columns: bar.columns.map(column => {
      const { value, dots, tuplet } = column.duration;
      const duration: ColumnInput['duration'] = { value: value as ColumnInput['duration']['value'] };
      if (dots) duration.dots = dots;
      if (tuplet === 3) duration.tuplet = 3;
      const out: ColumnInput = {
        duration,
        notes: column.notes.flatMap((note, s) => (note ? [noteJson(note, s)] : [])),
      };
      if (column.chord) out.chord = column.chord;
      return out;
    }),
  }));
  return line;
}

/** One line for the model: "4 bars in 4/4 at 90 bpm". */
export function describeLine(part: Part): string {
  const n = part.bars.length;
  const bpm = part.bars[0]?.tempo?.bpm ?? DEFAULT_BPM;
  return `${n} bar${n === 1 ? '' : 's'} in ${part.time.beats}/${part.time.value} at ${bpm} bpm`;
}

/** How the line is drawn, in words. */
export const VIEW_WORDS: Readonly<Record<View, string>> = { both: 'staff over tab', staff: 'staff only', tab: 'tab only' };
