/**
 * Reads and writes ASCII tab in the format `public/tab-ascii.txt` defines.
 * That file is the rulebook: where this code and it disagree, this code is
 * wrong. Pure; no React.
 *
 * Positions are character indices into a line. A block is six string lines
 * (high e first) with up to four lines above them: endings and repeat
 * counts, palm mute, strokes and rhythm, each lined up with the strings
 * character for character.
 */
import {
  barTicks, isPalmMuted, isStandardTuning, isUneven, nearestDuration, slideDirections, STANDARD_TUNING, STRING_COUNT,
  ticks, TIME_SIGNATURES,
  type Bar, type BendQuarters, type Clip, type Column, type Duration, type Note, type NoteValue,
  type TimeSignature,
} from './clip';

export type ReadResult =
  | { ok: true; clip: Clip; warnings: string[] }
  | { ok: false; errors: string[] };

/* ———————————————————————————— reading ———————————————————————————— */

const RHYTHM_LETTERS: Record<string, NoteValue> = { w: 1, h: 2, q: 4, e: 8, s: 16 };
const NOTE_NAME = /^[A-Ga-g][#b♯♭]?$/;
/** Some tabs number the strings 1 (high e) to 6 instead of naming them. */
const STRING_NUMBER = /^[1-6]$/;

type LineKind = 'rhythm' | 'strokes' | 'palmMute' | 'endings';

/** What an annotation line above the strings holds, or null if it is something else. */
function annotationKind(line: string): LineKind | null {
  const tokens = line.split(/[\s|]+/).filter(Boolean);
  if (tokens.length === 0) return null;
  if (tokens.every(t => /^[whqes](?:\.\.?|3)?$/.test(t))) return 'rhythm';
  if (tokens.every(t => STROKE_MARKS.test(t))) return 'strokes';
  if (/P\.?M/.test(line) && /^[\sPM.\-|]+$/.test(line)) return 'palmMute';
  if (/^(?:[\s\-|]|\d+\.|x\d+)+$/.test(line) && /\d\.|x\d/.test(line)) return 'endings';
  return null;
}

/** A stroke: "d" or "n" down, "u" or "V" up (some tabs use the bowing marks' letters). */
const STROKE_MARKS = /^[dunVv]$/;

/**
 * Where a string line's first "|" is, and the name before it; null if the
 * line isn't a string line. A line with no name and no opening "|" (it
 * starts with "-") opens just before its first character, at -1.
 */
function stringLineStart(line: string): { bar: number; name: string } | null {
  const unopened = /^-/.test(line);
  const bar = unopened ? -1 : line.indexOf('|');
  if (bar < 0 && !unopened) return null;
  const name = unopened ? '' : line.slice(0, bar).trim();
  if (name !== '' && !NOTE_NAME.test(name) && !STRING_NUMBER.test(name)) return null;
  // Mostly dashes: tab, not a line of text that happens to hold a "|".
  const body = line.slice(bar + 1).replace(/\s/g, '');
  const dashes = (body.match(/-/g) ?? []).length;
  if (dashes === 0 || dashes < body.length * 0.3) return null;
  return { bar, name };
}

function normalNote(name: string): string {
  return name[0].toUpperCase() + name.slice(1).replace('♯', '#').replace('♭', 'b');
}

/** A note as read, with where it was, for checks that need the line. */
interface ReadNote {
  note: Note;
  line: number;
}

interface StringParse {
  notes: Map<number, ReadNote>;
  bars: Set<number>;
  colons: Set<number>;
  /** Notes marked palm-muted by an "M" after them ("0M"). */
}

/** Reads one string line from `from` on. */
function parseStringLine(
  text: string, from: number, lineNo: number, errors: string[], tally: Tally,
): StringParse {
  const notes = new Map<number, ReadNote>();
  const bars = new Set<number>();
  const colons = new Set<number>();
  let prefix: Partial<Note> = {};
  let hasPrefix = false;
  /** "s" and "^" say a slide or a hammer/pull without a direction; the frets give it. */
  let joinFromLast: 'slide' | 'legato' | null = null;
  let lastFret: number | null = null;
  /** Dashes read since a joining mark: "5h-7" still joins, as some tabs write it. */
  let dashesAfterJoin = 0;
  let i = from;
  const isDigit = (c: string | undefined) => c !== undefined && c >= '0' && c <= '9';
  const readNumber = (at: number) => {
    let j = at;
    while (isDigit(text[j])) j++;
    return { value: j > at ? Number(text.slice(at, j)) : null, end: j };
  };

  while (i < text.length) {
    const c = text[i];
    if (isDigit(c)) {
      const { value: fret, end } = readNumber(i);
      if (fret! > 24) {
        errors.push(`Line ${lineNo}: fret ${text.slice(i, end)} is above 24. Digits next to each other are one fret, so put a "-" between notes.`);
      }
      const note: Note = { fret: fret!, ...prefix };
      if (joinFromLast) {
        const up = lastFret === null || fret! >= lastFret;
        if (joinFromLast === 'slide') note.slide = 'legato';
        else note.legato = up ? 'h' : 'p';
      }
      let k = end;
      if (note.harmonic && (text[k] === '>' || text[k] === ']')) k++;
      // A natural harmonic written "12*".
      if (text[k] === '*') {
        note.harmonic = true;
        k++;
      }
      if (note.tie && text[k] === ')') k++;
      // A bend: "7b9", "7b", "7b9r7", or a pre-bend "7pb9r7". A "p" before a digit is the next note's pull-off.
      const pre = text[k] === 'p' && text[k + 1] === 'b';
      if (pre || text[k] === 'b') {
        k += pre ? 2 : 1;
        const target = readNumber(k);
        k = target.end;
        let release = false;
        if (text[k] === 'r' && isDigit(text[k + 1])) {
          release = true;
          k = readNumber(k + 1).end;
        }
        const quarters = bendQuarters(note.fret!, target.value, lineNo, tally);
        if (quarters) note.bend = { quarters, pre, release };
      }
      // Vibrato: "~" (any number), or "v".
      while (text[k] === '~' || (text[k] === 'v' && !isDigit(text[k + 1]))) {
        note.vibrato = true;
        k++;
      }
      if (text[k] === 'M') {
        note.palmMute = true;
        k++;
      }
      notes.set(i, { note, line: lineNo });
      lastFret = fret;
      prefix = {};
      hasPrefix = false;
      joinFromLast = null;
      dashesAfterJoin = 0;
      i = k;
      continue;
    }
    const joining = joinFromLast !== null || prefix.legato !== undefined || prefix.slide !== undefined;
    if (c === '-' && hasPrefix && joining && dashesAfterJoin < 2) {
      dashesAfterJoin++;
      i++;
      continue;
    }
    dashesAfterJoin = 0;
    if (hasPrefix) tally.unknown++; // a mark not followed by a fret
    prefix = {};
    hasPrefix = false;
    joinFromLast = null;
    if (c === 'x' || c === 'X') {
      notes.set(i, { note: { fret: null }, line: lineNo });
    } else if (c === 'h' || c === 'p') {
      prefix = { legato: c };
      hasPrefix = true;
    } else if (c === '/' || c === '\\') {
      // From below or above; checkJoins makes it a slide from the earlier note when there is one.
      prefix = { slide: c === '/' ? 'below' : 'above' };
      hasPrefix = true;
    } else if (c === '(') {
      prefix = { tie: true };
      hasPrefix = true;
    } else if (c === 's' || c === '^') {
      joinFromLast = c === 's' ? 'slide' : 'legato';
      hasPrefix = true;
    } else if (c === '<' || c === '[') {
      prefix = { harmonic: true };
      hasPrefix = true;
    } else if (c === 't') {
      prefix = { tap: true };
      hasPrefix = true;
    } else if (c === '|') {
      bars.add(i);
    } else if (c === ':') {
      colons.add(i);
    } else if (c !== '-' && c !== ' ') {
      tally.unknown++;
    }
    i++;
  }
  return { notes, bars, colons };
}

function bendQuarters(fret: number, target: number | null, lineNo: number, tally: Tally): BendQuarters | null {
  if (target === null) return 1;
  const steps = target - fret;
  if (steps <= 0) {
    tally.messages.push(`Line ${lineNo}: a bend to fret ${target} from ${fret} goes nowhere; left out.`);
    return null;
  }
  if (steps > 4) {
    tally.messages.push(`Line ${lineNo}: a bend past 2 steps, drawn as 2.`);
    return 8;
  }
  return (steps * 2) as BendQuarters;
}

/** Problems that don't stop an import, counted and listed afterwards. */
interface Tally {
  unknown: number;
  guessed: number;
  padded: boolean;
  messages: string[];
}

/** A run of bar lines with nothing but ":" between them ("|", ":|", "||:"), and the repeats it marks. */
interface Boundary {
  left: number;
  right: number;
  endRepeat: boolean;
  startRepeat: boolean;
}

function boundaries(barSet: number[], colons: Set<number>, opening: number, lineEnd: number): Boundary[] {
  const sorted = [opening, ...barSet.filter(b => b > opening)].sort((a, b) => a - b);
  const out: Boundary[] = [];
  for (const b of sorted) {
    const last = out[out.length - 1];
    if (last && (b - last.right === 1 || (b - last.right === 2 && colons.has(b - 1)))) {
      last.right = b;
    } else {
      out.push({ left: b, right: b, endRepeat: false, startRepeat: false });
    }
  }
  for (const g of out) {
    g.endRepeat = colons.has(g.left - 1) || hasColonInside(g, colons, 'end');
    g.startRepeat = colons.has(g.right + 1) || hasColonInside(g, colons, 'start');
  }
  // Tab that doesn't end on a bar line still ends there.
  if (out[out.length - 1].right < lineEnd - 1) {
    out.push({ left: lineEnd, right: lineEnd, endRepeat: false, startRepeat: false });
  }
  return out;
}

/** ":" between the bars of one group: "|:|" reads as a start, ":||" is caught by the outer checks. */
function hasColonInside(g: Boundary, colons: Set<number>, side: 'start' | 'end'): boolean {
  for (let i = g.left + 1; i < g.right; i++) {
    if (colons.has(i)) return side === 'start';
  }
  return false;
}

function parseDuration(token: string): Duration {
  return {
    value: RHYTHM_LETTERS[token[0]],
    dots: token.startsWith('..', 1) ? 2 : token[1] === '.' ? 1 : 0,
    triplet: token[1] === '3',
  };
}

interface Block {
  /** Index of the first string line. */
  first: number;
  annotations: Partial<Record<LineKind, string>>;
}

export function readAscii(text: string): ReadResult {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
  const errors: string[] = [];
  const tally: Tally = { unknown: 0, guessed: 0, padded: false, messages: [] };

  // Header lines.
  const header: Record<string, string> = {};
  const used = new Set<number>();
  lines.forEach((line, i) => {
    const m = /^\s*(title|time|tuning)\s*:\s*(.*?)\s*$/i.exec(line);
    if (m && !(m[1].toLowerCase() in header)) {
      header[m[1].toLowerCase()] = m[2];
      used.add(i);
    }
  });

  let time: TimeSignature = { beats: 4, value: 4 };
  if (header.time !== undefined) {
    const m = /^(\d+)\s*\/\s*(\d+)$/.exec(header.time);
    const found = m && TIME_SIGNATURES.find(t => t.beats === Number(m[1]) && t.value === Number(m[2]));
    if (found) time = found;
    else tally.messages.push(`Time "${header.time}" isn't offered, so 4/4 is used.`);
  }

  let tuning: string[] | null = null;
  if (header.tuning !== undefined) {
    const notes = header.tuning.split(/[\s,]+/).filter(Boolean);
    if (notes.length === STRING_COUNT && notes.every(n => NOTE_NAME.test(n))) tuning = notes.map(normalNote);
    else tally.messages.push(`Tuning "${header.tuning}" isn't six note names, so it is left out.`);
  }

  // Blocks: six string lines in a row, and the annotation lines just above.
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    if (used.has(i) || !stringLineStart(lines[i])) {
      i++;
      continue;
    }
    let j = i;
    while (j < lines.length && !used.has(j) && stringLineStart(lines[j])) j++;
    const count = j - i;
    if (count !== STRING_COUNT) {
      errors.push(`Line ${i + 1}: ${count} string lines in a row; tab needs six, highest string first.`);
    } else {
      const annotations: Block['annotations'] = {};
      for (let k = i - 1, seen = 0; k >= 0 && seen < 4 && !used.has(k); k--, seen++) {
        const kind = annotationKind(lines[k]);
        if (!kind || annotations[kind] !== undefined) break;
        annotations[kind] = lines[k];
      }
      blocks.push({ first: i, annotations });
    }
    i = j;
  }
  if (blocks.length === 0 && errors.length === 0) {
    errors.push('No tab found: tab needs six string lines in a row, like "e|--5--7--|".');
  }
  if (errors.length > 0) return { ok: false, errors };

  if (!tuning) {
    // String names that differ from standard tuning are read as the tuning.
    const names = lines.slice(blocks[0].first, blocks[0].first + STRING_COUNT)
      .map(l => stringLineStart(l)!.name);
    if (names.every(n => NOTE_NAME.test(n))) {
      const fromNames = names.map(normalNote).reverse();
      if (!isStandardTuning(fromNames)) tuning = fromNames;
    }
  }

  const bars: Bar[] = [];
  for (const block of blocks) {
    bars.push(...readBlock(lines, block, time, errors, tally));
  }
  if (errors.length > 0) return { ok: false, errors };

  checkJoins(bars, errors);
  if (errors.length > 0) return { ok: false, errors };

  const warnings = [...tally.messages];
  if (tally.guessed > 0) {
    warnings.unshift(`Guessed the length of ${tally.guessed} ${tally.guessed === 1 ? 'note' : 'notes'} from the spacing.`);
  }
  const uneven = bars.flatMap((bar, i) => (isUneven(bar, time) ? [i + 1] : []));
  if (uneven.length > 0) {
    const which = uneven.length === 1 ? `Bar ${uneven[0]} doesn't` : `Bars ${listed(uneven)} don't`;
    warnings.push(`${which} add up to ${time.beats}/${time.value}.`);
  }
  if (tally.unknown > 0) {
    warnings.push(`Ignored ${tally.unknown} ${tally.unknown === 1 ? 'character that isn\'t' : 'characters that aren\'t'} tab.`);
  }
  if (tally.padded) warnings.push('Some string lines were shorter than others and were padded.');

  return {
    ok: true,
    clip: { name: header.title ?? '', time, tuning: tuning ?? [...STANDARD_TUNING], bars },
    warnings,
  };
}

/** "2, 5 and 7". */
function listed(numbers: number[]): string {
  return numbers.length === 1 ? `${numbers[0]}` : `${numbers.slice(0, -1).join(', ')} and ${numbers[numbers.length - 1]}`;
}

function readBlock(lines: string[], block: Block, time: TimeSignature, errors: string[], tally: Tally): Bar[] {
  // Line the string lines up on their first "|", then pad them to one length.
  const raw = lines.slice(block.first, block.first + STRING_COUNT);
  const starts = raw.map(l => stringLineStart(l)!.bar);
  const opening = Math.max(...starts);
  const shifted = raw.map((l, s) => ' '.repeat(opening - starts[s]) + l.trimEnd());
  const length = Math.max(...shifted.map(l => l.length));
  if (shifted.some(l => l.length !== length)) tally.padded = true;
  const strings = shifted.map(l => l.padEnd(length, '-'));

  const parsed = strings.map((l, s) => parseStringLine(l, opening + 1, block.first + s + 1, errors, tally));

  // Bar lines are "|" on every string at one position; ":" next to them marks repeats.
  const barSet = [...parsed[0].bars].filter(b => parsed.every(p => p.bars.has(b)));
  if (parsed.some(p => [...p.bars].some(b => !barSet.includes(b)))) {
    tally.messages.push(`Line ${block.first + 1}: a bar line missing on some strings was ignored.`);
  }
  const colons = new Set(parsed.flatMap(p => [...p.colons]));
  const groups = boundaries(barSet, colons, opening, length);

  // Columns: every position where a note starts, on any string.
  const positions = [...new Set(parsed.flatMap(p => [...p.notes.keys()]))].sort((a, b) => a - b);
  const columnAt = new Map<number, Column>();
  for (const pos of positions) {
    columnAt.set(pos, {
      duration: { value: 4, dots: 0, triplet: false },
      notes: parsed.map(p => p.notes.get(pos)?.note ?? null),
    });
  }

  // The rhythm line: a letter over each column, or over an empty position for a rest.
  const rhythm = block.annotations.rhythm;
  const known = new Set<number>();
  if (rhythm !== undefined) {
    for (const m of rhythm.matchAll(/[whqes](?:\.\.?|3)?/g)) {
      const at = m.index!;
      const column = columnAt.get(at);
      if (column) {
        column.duration = parseDuration(m[0]);
        known.add(at);
      } else if (at > opening && at < length && strings.every(l => l[at] === '-')) {
        columnAt.set(at, { duration: parseDuration(m[0]), notes: Array(STRING_COUNT).fill(null) });
        known.add(at);
      } else {
        tally.messages.push(`Line ${block.first}: a rhythm letter not above a note was ignored.`);
      }
    }
  }
  const all = [...columnAt.keys()].sort((a, b) => a - b);

  // Columns between bar lines.
  const segments = groups.slice(0, -1).map((g, k) => {
    const next = groups[k + 1];
    return {
      from: g, to: next,
      positions: all.filter(p => p > g.right && p < next.left),
    };
  });

  // Durations nobody wrote are guessed from spacing.
  const guess = (pos: number, nextPos: number, unit: number) => {
    const column = columnAt.get(pos)!;
    column.duration = nearestDuration(((nextPos - pos) / unit));
    tally.guessed++;
  };
  // Tab with no bar lines inside and no rhythm line is split into bars by the time signature.
  const onlyOneBar = segments.length === 1 && rhythm === undefined;
  if (onlyOneBar) {
    // No bar lines inside: the most common gap is an eighth (24 ticks).
    const ps = segments[0].positions;
    const gaps = ps.slice(1).map((p, k) => p - ps[k]);
    const common = mostCommon(gaps) ?? 4;
    ps.forEach((p, k) => {
      if (!known.has(p)) guess(p, ps[k + 1] ?? p + common, common / 24);
    });
  } else {
    for (const seg of segments) {
      const ps = seg.positions;
      if (ps.length === 0) continue;
      const width = seg.to.left - ps[0];
      ps.forEach((p, k) => {
        if (!known.has(p)) guess(p, ps[k + 1] ?? seg.to.left, width / barTicks(time));
      });
    }
  }

  // Palm mute runs, strokes.
  const pm = block.annotations.palmMute;
  if (pm !== undefined) {
    // "PM-----|", "P.M.----", or dashes spaced out: "PM - - - -|".
    for (const m of pm.matchAll(/P\.?M\.?(?:[-M]| (?=-))*\|?/g)) {
      const from = m.index!;
      const to = from + m[0].length - 1;
      for (const p of all) {
        if (p >= from && p <= to) for (const note of columnAt.get(p)!.notes) if (note) note.palmMute = true;
      }
    }
  }
  const strokes = block.annotations.strokes;
  if (strokes !== undefined) {
    for (const m of strokes.matchAll(/[dunVv]/g)) {
      // A stroke one character off its note still counts.
      const at = [m.index!, m.index! - 1, m.index! + 1].find(p => columnAt.has(p));
      if (at !== undefined) columnAt.get(at)!.stroke = m[0] === 'd' || m[0] === 'n' ? 'down' : 'up';
      else tally.messages.push(`Line ${block.first}: a stroke not above a note was ignored.`);
    }
  }

  // Bars.
  let bars: Bar[];
  if (onlyOneBar) {
    bars = splitByTime(segments[0].positions.map(p => columnAt.get(p)!), time);
    if (segments[0].from.startRepeat) bars[0].repeatStart = true;
    if (segments[0].to.endRepeat) bars[bars.length - 1].repeatEnd = 2;
  } else {
    bars = segments.map(seg => {
      const bar: Bar = { columns: seg.positions.map(p => columnAt.get(p)!) };
      if (seg.from.startRepeat) bar.repeatStart = true;
      if (seg.to.endRepeat) bar.repeatEnd = 2;
      return bar;
    });
  }

  // Endings and repeat counts.
  const endings = block.annotations.endings;
  if (endings !== undefined && !onlyOneBar) {
    for (const m of endings.matchAll(/(\d+)\./g)) {
      const from = m.index!;
      const close = endings.indexOf('|', from);
      const to = close < 0 ? length : close;
      segments.forEach((seg, k) => {
        if (seg.from.right < to && seg.to.left > from) bars[k].ending = Number(m[1]);
      });
    }
    for (const m of endings.matchAll(/x(\d+)/g)) {
      const last = m.index! + m[0].length - 1;
      const k = segments.findIndex(seg => seg.to.endRepeat && seg.to.right >= last - 1);
      if (k >= 0 && Number(m[1]) >= 2) bars[k].repeatEnd = Number(m[1]);
      else tally.messages.push(`Line ${block.first}: a repeat count with no repeat sign was ignored.`);
    }
  }

  // Keep the line numbers for the join checks.
  for (const bar of bars) for (const c of bar.columns) lineNumbers.set(c, block.first + 1);
  return bars.length > 0 ? bars : [{ columns: [] }];
}

/** Which block each column came from, for messages about joins. */
const lineNumbers = new WeakMap<Column, number>();

function mostCommon(values: number[]): number | null {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: number | null = null;
  let bestCount = 0;
  for (const [v, n] of counts) {
    if (n > bestCount || (n === bestCount && best !== null && v < best)) {
      best = v;
      bestCount = n;
    }
  }
  return best;
}

/** Columns with no bar lines between them, filled into bars of the time signature. */
function splitByTime(columns: Column[], time: TimeSignature): Bar[] {
  const bars: Bar[] = [{ columns: [] }];
  let filled = 0;
  for (const c of columns) {
    if (filled >= barTicks(time)) {
      bars.push({ columns: [] });
      filled = 0;
    }
    bars[bars.length - 1].columns.push(c);
    filled += ticks(c.duration);
  }
  return bars;
}

/**
 * Hammer-ons, pull-offs and ties need an earlier note on their string; a tie needs the same fret.
 * A slide is from the earlier note when there is one, and from below or above when there isn't.
 */
function checkJoins(bars: Bar[], errors: string[]) {
  const previous: (Note | null)[] = Array(STRING_COUNT).fill(null);
  for (const bar of bars) {
    for (const column of bar.columns) {
      column.notes.forEach((note, s) => {
        if (!note) return;
        const line = (lineNumbers.get(column) ?? 0) + s;
        const before = previous[s];
        if (note.slide === 'below' || note.slide === 'above') {
          if (before) note.slide = 'legato';
        } else if (note.slide && !before) {
          note.slide = 'below';
        }
        if (note.legato && !before) {
          errors.push(`Line ${line}: "${note.legato}" with no earlier note on that string.`);
        }
        if (note.tie && (!before || before.fret !== note.fret)) {
          errors.push(`Line ${line}: the tie (${note.fret}) doesn't continue a ${note.fret} on that string.`);
        }
        previous[s] = note;
      });
    }
  }
}

/* ———————————————————————————— writing ———————————————————————————— */

/** How a note is written: the mark before its position, then the note itself. */
export function noteText(note: Note, slide: 'up' | 'down' = 'up'): { prefix: string; text: string } {
  let prefix = '';
  if (note.legato) prefix = note.legato;
  else if (note.slide) prefix = slide === 'up' ? '/' : '\\';
  else if (note.tie) prefix = '(';
  else if (note.harmonic) prefix = '<';
  else if (note.tap) prefix = 't';
  if (note.fret === null) return { prefix, text: 'x' };
  let text = String(note.fret);
  if (note.harmonic && prefix === '<') text += '>';
  if (note.tie && prefix === '(') text += ')';
  if (note.bend) {
    const target = note.fret + note.bend.quarters / 2;
    text += note.bend.pre ? `pb${target}` : note.bend.quarters === 1 ? 'b' : `b${target}`;
    if (note.bend.release) text += `r${note.fret}`;
  }
  if (note.vibrato) text += '~';
  return { prefix, text };
}

export function rhythmToken({ value, dots, triplet }: Duration): string {
  const letter = Object.keys(RHYTHM_LETTERS).find(k => RHYTHM_LETTERS[k] === value)!;
  return letter + '.'.repeat(dots) + (triplet ? '3' : '');
}

/** Characters a column takes: two a sixteenth, and room for its notes and the next column's marks. */
function columnWidth(column: Column): number {
  const own = Math.max(1, ...column.notes.map(n => {
    if (!n) return 0;
    const { prefix, text } = noteText(n);
    return prefix.length + text.length;
  }));
  return Math.max(own + 2, Math.round(ticks(column.duration) / 6), rhythmToken(column.duration).length + 1);
}

const MAX_LINE = 80;

/** One block's lines, names first: endings, palm mute, strokes, rhythm, then the six strings. */
function writeBlock(bars: Bar[], names: string[], slides: Map<Note, 'up' | 'down'>): string[] {
  const strings: string[][] = names.map(() => []);
  const rhythm: string[] = [];
  const strokes: string[] = [];
  const pm: string[] = [];
  const endings: string[] = [];
  const annotations = [rhythm, strokes, pm, endings];
  const push = (onStrings: string, onOthers = ' '.repeat(onStrings.length)) => {
    for (const l of strings) l.push(...onStrings);
    for (const a of annotations) a.push(...onOthers);
  };

  push(bars[0].repeatStart ? ':-' : '-');
  let endingFrom = -1;
  bars.forEach((bar, b) => {
    const contentStart = strings[0].length;
    if (bar.ending && bars[b - 1]?.ending !== bar.ending) endingFrom = contentStart;
    for (const column of bar.columns) {
      const start = strings[0].length;
      const width = columnWidth(column);
      push('-'.repeat(width));
      [...rhythmToken(column.duration)].forEach((ch, k) => { rhythm[start + k] = ch; });
      if (column.stroke) strokes[start] = column.stroke === 'down' ? 'd' : 'u';
      if (isPalmMuted(column)) for (let k = 0; k < width; k++) pm[start + k] = '-';
      column.notes.forEach((note, s) => {
        if (!note) return;
        const { prefix, text } = noteText(note, slides.get(note));
        [...text].forEach((ch, k) => { strings[s][start + k] = ch; });
        [...prefix].forEach((ch, k) => { strings[s][start - prefix.length + k] = ch; });
      });
    }
    if (bar.columns.length === 0) push('-'.repeat(8));

    const last = b === bars.length - 1;
    const end = bar.repeatEnd !== undefined;
    const start = !last && bars[b + 1].repeatStart;
    const mark = end ? (start ? ':|:' : ':|') : (start ? '|:' : '|');
    const at = strings[0].length;
    const pipe = at + mark.indexOf('|');
    push(last ? mark : `${mark}-`);
    rhythm[pipe] = '|';
    if (bar.ending && bars[b + 1]?.ending !== bar.ending) {
      for (let k = endingFrom; k < pipe; k++) endings[k] = '-';
      [...`${bar.ending}.`].forEach((ch, k) => { endings[endingFrom + k] = ch; });
      endings[pipe] = '|';
    }
    if (end && bar.repeatEnd !== 2) {
      const count = `x${bar.repeatEnd}`;
      [...count].forEach((ch, k) => { endings[pipe - count.length + 1 + k] = ch; });
    }
  });

  // Palm mute runs: "PM" where each starts, "|" where it ends.
  for (let k = 0; k < pm.length; k++) {
    if (pm[k] === '-' && (k === 0 || pm[k - 1] === ' ')) {
      let e = k;
      while (e < pm.length && pm[e] === '-') e++;
      pm[k] = 'P';
      pm[k + 1] = 'M';
      pm[e - 1] = '|';
      k = e;
    }
  }

  const width = Math.max(...names.map(n => n.length)) + 1;
  const indent = ' '.repeat(width);
  const out: string[] = [];
  for (const a of [endings, pm, strokes, rhythm]) {
    const line = a.join('');
    if (/[^\s|]/.test(line)) out.push((indent + line).trimEnd());
  }
  strings.forEach((l, s) => out.push(`${names[s].padEnd(width - 1)}|${l.join('')}`));
  return out;
}

/** The clip in the canonical form of `tab-ascii.txt`. Reading it back gives the same clip. */
export function writeAscii(clip: Clip): string {
  const head: string[] = [];
  if (clip.name.trim()) head.push(`Title: ${clip.name.trim()}`);
  head.push(`Time: ${clip.time.beats}/${clip.time.value}`);
  if (!isStandardTuning(clip.tuning)) head.push(`Tuning: ${clip.tuning.join(' ')}`);

  // Names high string first, the top one lower case as tab writes "e".
  const names = [...clip.tuning].reverse();
  names[0] = names[0].toLowerCase();

  const slides = slideDirections(clip);
  const blocks: string[][] = [];
  let current: Bar[] = [];
  for (const bar of clip.bars) {
    const tried = [...current, bar];
    const lines = writeBlock(tried, names, slides);
    if (current.length > 0 && lines[lines.length - 1].length > MAX_LINE) {
      blocks.push(writeBlock(current, names, slides));
      current = [bar];
    } else {
      current = tried;
    }
  }
  if (current.length > 0) blocks.push(writeBlock(current, names, slides));
  return [head.join('\n'), ...blocks.map(b => b.join('\n'))].join('\n\n');
}

