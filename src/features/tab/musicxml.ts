/**
 * The clip as MusicXML 4.0 (issue #241; `docs/specs/2026-10-30-tab-musicxml-export-design.md`), so it
 * opens in MuseScore, Guitar Pro, Sibelius, Dorico and the like. Every track is a part with two staves,
 * the notes written on a treble staff an octave down and a six-line tab staff with the track's tuning
 * and capo, whatever the page shows. Pitches are spelled in the key as Frets spells them (`notation.ts`).
 * Pure: `writeMusicXml` gives the file's text, `musicXmlLosses` what the file can't hold.
 */
import {
  barTicks, beatTicks, bendCarries, columnAccent, columnMordent, isLetRing, isPalmMuted, isRest, keyAt, partOf,
  spanOf, startsFreeTime, STRING_COUNT, ticks, timeAt, tupletGroups, WHOLE, barsPerLine, changesKey, changesTime,
  type Bar, type Clip, type Column, type Key, type Note, type NoteValue, type Ottava, type Part, type TimeSignature,
} from './clip';
import { beamGroups } from './beams';
import { headerValue, creditsOf, CREDIT_TAGS } from './credits';
import { instrumentName } from './instrument';
import { multiRests } from './layout';
import { keyAccidentals, openStrings, spell, tuningShift, writtenStrings, type Accidental } from './notation';

/* — a small XML tree, written out indented — */

interface XmlNode {
  name: string;
  attrs: Record<string, string | number | undefined>;
  children: (XmlNode | string)[];
}

/** An element: its attributes (none left out when undefined) and its children, text or elements. */
function el(name: string, attrs: XmlNode['attrs'] = {}, ...children: (XmlNode | string | number | null | undefined | false)[]): XmlNode {
  return {
    name,
    attrs,
    children: children.filter((c): c is XmlNode | string | number => c !== null && c !== undefined && c !== false).map(c => (typeof c === 'number' ? String(c) : c)),
  };
}

/** An element holding only text: `<fret>3</fret>`. */
function text(name: string, value: string | number, attrs: XmlNode['attrs'] = {}): XmlNode {
  return el(name, attrs, String(value));
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function render(node: XmlNode, depth = 0): string {
  const pad = '  '.repeat(depth);
  const attrs = Object.entries(node.attrs)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` ${k}="${escape(String(v))}"`)
    .join('');
  if (node.children.length === 0) return `${pad}<${node.name}${attrs}/>`;
  if (node.children.every(c => typeof c === 'string')) return `${pad}<${node.name}${attrs}>${escape(node.children.join(''))}</${node.name}>`;
  const inner = node.children.map(c => (typeof c === 'string' ? `${pad}  ${escape(c)}` : render(c, depth + 1))).join('\n');
  return `${pad}<${node.name}${attrs}>\n${inner}\n${pad}</${node.name}>`;
}

/* — durations — */

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

/**
 * MusicXML's `divisions`, the ticks in a quarter note: the fewest that make every note and bar in the
 * clip a whole number of them (1 for a clip of quarters and longer, 3 once there are eighth triplets).
 */
export function divisionsOf(clip: Clip): number {
  const quarter = WHOLE / 4;
  let step = quarter;
  clip.tracks.forEach((_, t) => {
    const part = partOf(clip, t);
    part.bars.forEach((bar, b) => {
      step = gcd(step, barTicks(timeAt(part, b)));
      for (const column of bar.columns) if (!column.grace) step = gcd(step, ticks(column.duration));
    });
  });
  return quarter / step;
}

const TYPE_NAMES: Record<NoteValue, string> = { 1: 'whole', 2: 'half', 4: 'quarter', 8: 'eighth', 16: '16th', 32: '32nd', 64: '64th' };
/** How many beams each note value has. */
const BEAMS: Record<NoteValue, number> = { 1: 0, 2: 0, 4: 0, 8: 1, 16: 2, 32: 3, 64: 4 };

/* — pitch — */

const STEPS = 'CDEFGAB';
const ACCIDENTAL_NAMES: Record<Accidental, string> = { [-2]: 'flat-flat', [-1]: 'flat', 0: 'natural', 1: 'sharp', 2: 'double-sharp' };

function pitchOf(midi: number, key: Key): XmlNode {
  const n = spell(midi, key);
  return el('pitch', {}, text('step', STEPS[n.letter]), n.accidental !== 0 && text('alter', n.accidental), text('octave', n.octave));
}

/** The six strings of `staff-tuning`, lowest first (line 1), each named as the tuning names it. */
function staffTuning(tuning: readonly string[]): XmlNode[] {
  const open = openStrings(tuning);
  return tuning.map((name, low) => {
    const midi = open[STRING_COUNT - 1 - low];
    const letter = STEPS.indexOf(name[0].toUpperCase());
    const alter = [...name.slice(1)].reduce((n, c) => n + (c === '#' ? 1 : c === 'b' ? -1 : 0), 0);
    const natural = [0, 2, 4, 5, 7, 9, 11][letter];
    const octave = Math.floor((midi - alter - natural) / 12) - 1;
    return el('staff-tuning', { line: low + 1 }, text('tuning-step', STEPS[letter]), alter !== 0 && text('tuning-alter', alter), text('tuning-octave', octave));
  });
}

/* — chord names — */

/** MusicXML's chord kinds for the suffixes chord names are usually written with; anything else is "other". */
const KINDS: Record<string, string> = {
  '': 'major', M: 'major', maj: 'major', m: 'minor', min: 'minor', '-': 'minor',
  '7': 'dominant', maj7: 'major-seventh', M7: 'major-seventh', 'Δ': 'major-seventh', 'Δ7': 'major-seventh',
  m7: 'minor-seventh', min7: 'minor-seventh', '-7': 'minor-seventh', dim: 'diminished', '°': 'diminished',
  dim7: 'diminished-seventh', '°7': 'diminished-seventh', aug: 'augmented', '+': 'augmented',
  m7b5: 'half-diminished', 'ø': 'half-diminished', 'ø7': 'half-diminished', '6': 'major-sixth', m6: 'minor-sixth',
  '9': 'dominant-ninth', maj9: 'major-ninth', m9: 'minor-ninth', '11': 'dominant-11th', '13': 'dominant-13th',
  sus: 'suspended-fourth', sus4: 'suspended-fourth', sus2: 'suspended-second', '5': 'power',
  mMaj7: 'major-minor', 'm(maj7)': 'major-minor',
};

const ROOT = /^([A-G])([#b♯♭]?)/;

function rootAlter(sign: string): number {
  return sign === '#' || sign === '♯' ? 1 : sign === 'b' || sign === '♭' ? -1 : 0;
}

/**
 * A chord name as a `harmony`: its root, its kind (the suffix as written kept as the kind's text, so it
 * reads as typed) and a bass after a slash. Null when the name doesn't start with a note, so it goes as words.
 */
export function harmonyOf(name: string): XmlNode | null {
  const trimmed = name.trim();
  const root = ROOT.exec(trimmed);
  if (!root) return null;
  let rest = trimmed.slice(root[0].length);
  let bass: RegExpExecArray | null = null;
  const slash = rest.lastIndexOf('/');
  if (slash >= 0) {
    bass = ROOT.exec(rest.slice(slash + 1));
    if (bass && bass[0].length === rest.length - slash - 1) rest = rest.slice(0, slash);
    else bass = null;
  }
  return el('harmony', { placement: 'above' },
    el('root', {}, text('root-step', root[1]), rootAlter(root[2]) !== 0 && text('root-alter', rootAlter(root[2]))),
    text('kind', KINDS[rest] ?? 'other', { text: rest }),
    bass && el('bass', {}, text('bass-step', bass[1]), rootAlter(bass[2]) !== 0 && text('bass-alter', rootAlter(bass[2]))),
  );
}

/* — what goes between notes: words, lines and signs over or under the staff — */

function direction(placement: 'above' | 'below', ...types: XmlNode[]): XmlNode {
  return el('direction', { placement }, ...types.map(t => el('direction-type', {}, t)), text('staff', 1));
}

function words(value: string): XmlNode {
  return text('words', value);
}

/** MusicXML says which way an octave line moves the notes as drawn: under 8va they are drawn down. */
const OCTAVE_SHIFTS: Record<Ottava, { type: 'up' | 'down'; size: number }> = {
  '8va': { type: 'down', size: 8 }, '8vb': { type: 'up', size: 8 }, '15ma': { type: 'down', size: 15 }, '15mb': { type: 'up', size: 15 },
};

/** A line drawn over a run of columns: where it starts, and what closes it after the last. */
interface RunMark {
  /** The run's value at a column; columns with equal values in a row make one run. */
  at: (column: Column) => string | undefined;
  start: (value: string) => XmlNode;
  stop: (value: string) => XmlNode;
}

const RUN_MARKS: RunMark[] = [
  {
    at: c => (isPalmMuted(c) ? 'P.M.' : undefined),
    start: v => direction('below', words(v), el('dashes', { type: 'start', number: 1 })),
    stop: () => direction('below', el('dashes', { type: 'stop', number: 1 })),
  },
  {
    at: c => (isLetRing(c) ? 'let ring' : undefined),
    start: v => direction('below', words(v), el('dashes', { type: 'start', number: 2 })),
    stop: () => direction('below', el('dashes', { type: 'stop', number: 2 })),
  },
  {
    at: c => c.hairpin,
    start: v => direction('below', el('wedge', { type: v === 'crescendo' ? 'crescendo' : 'diminuendo' })),
    stop: () => direction('below', el('wedge', { type: 'stop' })),
  },
  {
    at: c => c.ottava,
    start: v => {
      const shift = OCTAVE_SHIFTS[v as Ottava];
      return direction(shift.type === 'down' ? 'above' : 'below', el('octave-shift', { type: shift.type, size: shift.size }));
    },
    stop: v => direction(OCTAVE_SHIFTS[v as Ottava].type === 'down' ? 'above' : 'below', el('octave-shift', { type: 'stop', size: OCTAVE_SHIFTS[v as Ottava].size })),
  },
];

/* — one track — */

/** What a pass over a track's notes in order tells each note: what joins it to the note after it on its string. */
interface Joins {
  /** Notes the next note on their string is tied to. */
  tieStarts: Set<Note>;
  /** Notes the next note on their string hammers on ('h') or pulls off ('p') from. */
  legatoStarts: Map<Note, 'h' | 'p'>;
  /** Notes the next note on their string slides from. */
  slideStarts: Set<Note>;
  /** Notes under vibrato whose string's note before / after isn't, where a wavy line starts / stops. */
  vibratoStarts: Set<Note>;
  vibratoStops: Set<Note>;
}

function joinsOf(part: Part): Joins {
  const joins: Joins = { tieStarts: new Set(), legatoStarts: new Map(), slideStarts: new Set(), vibratoStarts: new Set(), vibratoStops: new Set() };
  const last: (Note | null)[] = Array(STRING_COUNT).fill(null);
  for (const bar of part.bars) {
    for (const column of bar.columns) {
      column.notes.forEach((note, s) => {
        if (!note) return;
        const before = last[s];
        if (before && note.tie) joins.tieStarts.add(before);
        if (before && note.legato) joins.legatoStarts.set(before, note.legato);
        if (before && (note.slide === 'legato' || note.slide === 'shift')) joins.slideStarts.add(before);
        if (note.vibrato && !before?.vibrato) joins.vibratoStarts.add(note);
        if (before?.vibrato && !note.vibrato) joins.vibratoStops.add(before);
        last[s] = note;
      });
    }
  }
  for (const note of last) if (note?.vibrato) joins.vibratoStops.add(note);
  return joins;
}

/** A beam's MusicXML state at each column of a bar, one list per column (first note of the chord only). */
function beamsOf(bar: Bar, time: TimeSignature): XmlNode[][] {
  const out: XmlNode[][] = bar.columns.map(() => []);
  const placed = { columns: bar.columns.map((column, index) => ({ column, index })), halfBars: time.beats === 4 && time.value === 4 };
  for (const group of beamGroups(placed, beatTicks(time))) {
    if (group.columns.length < 2) continue;
    const levels = group.columns.map(p => BEAMS[p.column.duration.value]);
    group.columns.forEach((p, k) => {
      for (let level = 1; level <= levels[k]; level++) {
        const before = k > 0 && levels[k - 1] >= level;
        const after = k < levels.length - 1 && levels[k + 1] >= level;
        const state = before && after ? 'continue' : before ? 'end' : after ? 'begin' : k === 0 ? 'forward hook' : 'backward hook';
        out[p.index].push(text('beam', state, { number: level }));
      }
    });
  }
  return out;
}

/** How many slashes a tremolo picked note's stem has. */
const TREMOLO_SLASHES = { 8: 1, 16: 2, 32: 3 } as const;
const FERMATA_SHAPES = { short: 'angled', medium: 'normal', long: 'square' } as const;

/** A note's bends as `bend` elements: up, held and pushed on, or let down, in semitones. */
function bendsOf(note: Note, carry: 'hold' | 'release' | undefined): XmlNode[] {
  const bend = note.bend;
  if (!bend) return [];
  const semis = (quarters: number) => quarters / 2;
  const letDown = () => el('bend', {}, text('bend-alter', -semis(bend.quarters - (bend.to ?? 0))), el('release'));
  if (carry === 'release') return [letDown()];
  if (carry === 'hold') return bend.from !== undefined ? [el('bend', {}, text('bend-alter', semis(bend.quarters - bend.from)))] : [];
  return [el('bend', {}, text('bend-alter', semis(bend.quarters)), bend.pre && el('pre-bend')), ...(bend.release ? [letDown()] : [])];
}

interface TrackContext {
  part: Part;
  /** Each string's open pitch as written, high e first. */
  open: number[];
  joins: Joins;
  carries: Map<Note, 'hold' | 'release'>;
  divisionTicks: number;
}

/** One `note` element: a note of a column, or its rest, on staff 1 (notation) or 2 (tab). */
function noteXml(ctx: TrackContext, column: Column, s: number | null, opts: {
  staff: 1 | 2; key: Key; chord: boolean; first: boolean; beams: XmlNode[]; accidental?: Accidental | null;
  tuplet?: 'start' | 'stop' | 'both';
}): XmlNode {
  const { staff, key } = opts;
  const note = s === null ? null : column.notes[s]!;
  const { duration } = column;
  const notations: XmlNode[] = [];
  const technical: XmlNode[] = [];
  const articulations: XmlNode[] = [];
  const ornaments: XmlNode[] = [];
  if (note) {
    if (note.tie) notations.push(el('tied', { type: 'stop' }));
    if (ctx.joins.tieStarts.has(note)) notations.push(el('tied', { type: 'start' }));
    if (note.slide === 'legato' || note.slide === 'shift') notations.push(el('slide', { type: 'stop', 'line-type': 'solid' }));
    if (ctx.joins.slideStarts.has(note)) notations.push(el('slide', { type: 'start', 'line-type': 'solid' }));
    if (note.slide === 'below') articulations.push(el('scoop'));
    if (note.slide === 'above') articulations.push(el('plop'));
    if (note.slideOut === 'down') articulations.push(el('falloff'));
    if (note.slideOut === 'up') articulations.push(el('doit'));
    if (note.legato) technical.push(text(note.legato === 'h' ? 'hammer-on' : 'pull-off', '', { type: 'stop' }));
    const leaves = ctx.joins.legatoStarts.get(note);
    if (leaves) technical.push(text(leaves === 'h' ? 'hammer-on' : 'pull-off', leaves.toUpperCase(), { type: 'start' }));
    technical.push(...bendsOf(note, ctx.carries.get(note)));
    if (column.whammy) {
      const depth = Math.min(...column.whammy);
      if (depth < 0) technical.push(el('bend', {}, text('bend-alter', depth / 2), el('with-bar')));
    }
    if (note.harmonic === 'natural') technical.push(el('harmonic', {}, el('natural')));
    if (note.harmonic === 'artificial') technical.push(el('harmonic', {}, el('artificial')));
    if (note.tap) technical.push(el('tap'));
    if (ctx.joins.vibratoStarts.has(note)) ornaments.push(el('wavy-line', { type: 'start' }));
    if (ctx.joins.vibratoStops.has(note)) ornaments.push(el('wavy-line', { type: 'stop' }));
    if (staff === 2) technical.push(text('string', s! + 1), text('fret', note.fret ?? 0));
  }
  // The column's own marks, once a chord, on the staff: accents, the fermata, the mordent, tremolo, strokes and the wah.
  if (opts.first && staff === 1) {
    const accent = columnAccent(column);
    if (accent) articulations.push(el(accent === 'heavy' ? 'strong-accent' : 'accent'));
    if (column.notes.some(n => n?.staccato)) articulations.push(el('staccato'));
    const mordent = columnMordent(column);
    if (mordent) ornaments.push(el(mordent === 'upper' ? 'inverted-mordent' : 'mordent'));
    if (column.tremolo) ornaments.push(text('tremolo', TREMOLO_SLASHES[column.tremolo], { type: 'single' }));
    if (column.fermata) notations.push(text('fermata', FERMATA_SHAPES[column.fermata], { type: 'upright' }));
    if (column.stroke) technical.push(el(column.stroke === 'down' ? 'down-bow' : 'up-bow'));
    if (column.wah) technical.push(el(column.wah === 'closed' ? 'stopped' : 'open'));
  }
  if (opts.first && opts.tuplet) {
    if (opts.tuplet === 'start' || opts.tuplet === 'both') notations.push(el('tuplet', { type: 'start', bracket: 'yes' }));
    if (opts.tuplet === 'stop' || opts.tuplet === 'both') notations.push(el('tuplet', { type: 'stop' }));
  }
  // The string and fret go first: alphaTab's importer matches a tie's notes by the pitch they give.
  if (technical.length) notations.unshift(el('technical', {}, ...technical));
  if (ornaments.length) notations.push(el('ornaments', {}, ...ornaments));
  if (articulations.length) notations.push(el('articulations', {}, ...articulations));

  const capo = ctx.part.capo ?? 0;
  const pitch = note ? pitchOf(ctx.open[s!] + capo + (note.fret ?? 0), key) : el('rest');
  const head = note?.fret === null ? text('notehead', 'x') : note?.ghost ? text('notehead', 'normal', { parentheses: 'yes' }) : null;
  return el('note', {},
    column.grace && el('grace', column.grace === 'before' ? { slash: 'yes' } : {}),
    opts.chord && el('chord'),
    pitch,
    !column.grace && text('duration', ticks(duration) / ctx.divisionTicks),
    note?.tie && el('tie', { type: 'stop' }),
    note && ctx.joins.tieStarts.has(note) && el('tie', { type: 'start' }),
    text('voice', staff === 1 ? 1 : 5),
    text('type', TYPE_NAMES[duration.value]),
    ...Array.from({ length: duration.dots }, () => el('dot')),
    opts.accidental !== undefined && opts.accidental !== null && text('accidental', ACCIDENTAL_NAMES[opts.accidental]),
    duration.tuplet && el('time-modification', {}, text('actual-notes', duration.tuplet), text('normal-notes', spanOf(duration))),
    head,
    text('staff', staff),
    ...(opts.first ? opts.beams : []),
    notations.length > 0 && el('notations', {}, ...notations),
  );
}

/**
 * The accidental each note of a bar shows on the staff, as Frets draws it: one only where the key and
 * the bar so far don't already say it, a sign holding to the bar's end on its line or space; a tied
 * note shows none. Keyed by note.
 */
function barAccidentals(ctx: TrackContext, bar: Bar, key: Key): Map<Note, Accidental | null> {
  const inKey = keyAccidentals(key);
  const now = new Map<number, Accidental>();
  const out = new Map<Note, Accidental | null>();
  const capo = ctx.part.capo ?? 0;
  for (const column of bar.columns) {
    column.notes.forEach((note, s) => {
      if (!note || note.fret === null) return;
      const n = spell(ctx.open[s] + capo + note.fret, key);
      const place = n.octave * 7 + n.letter;
      const current = now.get(place) ?? inKey[n.letter];
      out.set(note, note.tie || n.accidental === current ? null : n.accidental);
      now.set(place, n.accidental);
    });
  }
  return out;
}

/** The strings of a column's notes, lowest first, as a chord is written. */
function stringsOf(column: Column): number[] {
  const out: number[] = [];
  for (let s = STRING_COUNT - 1; s >= 0; s--) if (column.notes[s]) out.push(s);
  return out;
}

/** A bar's notes on one staff: each column's notes, or its rest, in order; an empty bar is one bar's rest. */
function staffNotes(ctx: TrackContext, b: number, staff: 1 | 2, between?: (k: number, when: 'before' | 'after') => XmlNode[]): XmlNode[] {
  const { part } = ctx;
  const bar = part.bars[b];
  const time = timeAt(part, b);
  const key = keyAt(part, b);
  if (bar.columns.length === 0) {
    return [el('note', {}, el('rest', { measure: 'yes' }), text('duration', barTicks(time) / ctx.divisionTicks), text('voice', staff === 1 ? 1 : 5), text('staff', staff))];
  }
  const beams = beamsOf(bar, time);
  const tuplets = new Map<number, 'start' | 'stop' | 'both'>();
  for (const group of tupletGroups(bar.columns)) {
    tuplets.set(group.from, group.from === group.to ? 'both' : 'start');
    if (group.to !== group.from) tuplets.set(group.to, 'stop');
  }
  const accidentals = staff === 1 ? barAccidentals(ctx, bar, key) : new Map<Note, Accidental | null>();
  const out: XmlNode[] = [];
  bar.columns.forEach((column, k) => {
    if (between) out.push(...between(k, 'before'));
    const strings = isRest(column) ? [null] : stringsOf(column);
    strings.forEach((s, i) => {
      const note = s === null ? null : column.notes[s];
      out.push(noteXml(ctx, column, s, {
        staff, key, chord: i > 0, first: i === 0, beams: beams[k], tuplet: tuplets.get(k),
        accidental: note ? accidentals.get(note) : undefined,
      }));
    });
    if (between) out.push(...between(k, 'after'));
  });
  return out;
}

/** The time a bar's notes take, in divisions, which the tab staff backs up over. */
function barDuration(ctx: TrackContext, b: number): number {
  const bar = ctx.part.bars[b];
  const length = bar.columns.length === 0 ? barTicks(timeAt(ctx.part, b)) : bar.columns.reduce((sum, c) => sum + (c.grace ? 0 : ticks(c.duration)), 0);
  return length / ctx.divisionTicks;
}

function timeXml(time: TimeSignature): XmlNode {
  return el('time', {}, text('beats', time.beats), text('beat-type', time.value));
}

function keyXml(key: Key): XmlNode {
  return el('key', {}, text('fifths', key.fifths), text('mode', key.minor ? 'minor' : 'major'));
}

/** The bar a 1st, 2nd … ending's bracket starts and ends on: bars in a row with the same ending number. */
function endingAt(part: Part, b: number): { start: boolean; stop: 'stop' | 'discontinue' | null; number: number } | null {
  const number = part.bars[b].ending;
  if (number === undefined) return null;
  const start = part.bars[b - 1]?.ending !== number;
  const last = part.bars[b + 1]?.ending !== number;
  return { start, number, stop: last ? (part.bars[b].repeatEnd !== undefined ? 'stop' : 'discontinue') : null };
}

/** The bars that start a line, when the clip says how many bars each line holds. */
function lineStarts(part: Part): Set<number> {
  const out = new Set<number>();
  if (barsPerLine(part, 0) === null) return out;
  for (let b = 0, line = 0; b < part.bars.length; line++) {
    out.add(b);
    b += barsPerLine(part, line) ?? part.bars.length;
  }
  return out;
}

function partXml(clip: Clip, t: number, divisions: number): XmlNode {
  const part = partOf(clip, t);
  const ctx: TrackContext = {
    part, open: writtenStrings(part.tuning), joins: joinsOf(part), carries: bendCarries(part), divisionTicks: WHOLE / 4 / divisions,
  };
  // Tempos, sections and "Free time" belong to the whole score, so the first part alone carries them.
  const scoreMarks = t === 0;
  const rests = multiRests(part);
  const lines = lineStarts(part);
  const shift = tuningShift(part.tuning);
  const columns = part.bars.flatMap(bar => bar.columns);
  let flat = 0;

  const measures = part.bars.map((bar, b) => {
    const time = timeAt(part, b);
    const key = keyAt(part, b);
    const children: XmlNode[] = [];
    if (b > 0 && lines.has(b)) children.push(el('print', { 'new-system': 'yes' }));

    const attributes: XmlNode[] = [];
    if (b === 0) {
      attributes.push(
        text('divisions', divisions), keyXml(key), timeXml(time), text('staves', 2),
        el('clef', { number: 1 }, text('sign', 'G'), text('line', 2), text('clef-octave-change', -1)),
        el('clef', { number: 2 }, text('sign', 'TAB'), text('line', 5)),
        el('staff-details', { number: 2 }, text('staff-lines', STRING_COUNT), ...staffTuning(part.tuning), part.capo && text('capo', part.capo)),
      );
      // Every string tuned alike is written as fingered in standard tuning; the transpose says how it sounds.
      if (shift !== 0) attributes.push(el('transpose', {}, text('chromatic', shift)));
    } else {
      if (changesKey(part, b)) attributes.push(keyXml(key));
      if (changesTime(part, b)) attributes.push(timeXml(time));
    }
    const restCount = rests.get(b);
    if (restCount) attributes.push(el('measure-style', {}, text('multiple-rest', restCount)));
    if (attributes.length) children.push(el('attributes', {}, ...attributes));

    const ending = endingAt(part, b);
    if (bar.repeatStart || ending?.start) {
      children.push(el('barline', { location: 'left' },
        bar.repeatStart && text('bar-style', 'heavy-light'),
        ending?.start && el('ending', { number: ending.number, type: 'start' }, `${ending.number}.`),
        bar.repeatStart && el('repeat', { direction: 'forward' }),
      ));
    }
    if (scoreMarks) {
      if (bar.section) {
        children.push(direction('above', ...(bar.section.marker ? [text('rehearsal', bar.section.marker, { enclosure: 'square' })] : []), words(bar.section.text)));
      }
      if (bar.tempo) {
        const metronome = el('metronome', {}, text('beat-unit', 'quarter'), text('per-minute', bar.tempo.bpm));
        const types = bar.tempo.label ? [words(bar.tempo.label), metronome] : [metronome];
        children.push(el('direction', { placement: 'above' }, ...types.map(x => el('direction-type', {}, x)), text('staff', 1), el('sound', { tempo: bar.tempo.bpm })));
      }
      if (startsFreeTime(part, b)) children.push(direction('above', words('Free time')));
    }

    // Words, chord names and lines over runs, before and after the columns they belong to.
    const between = (k: number, when: 'before' | 'after'): XmlNode[] => {
      const column = bar.columns[k];
      const at = flat + k;
      const out: XmlNode[] = [];
      for (const mark of RUN_MARKS) {
        const value = mark.at(column);
        if (value === undefined) continue;
        if (when === 'before' && (at === 0 || mark.at(columns[at - 1]) !== value)) out.push(mark.start(value));
        if (when === 'after' && (at === columns.length - 1 || mark.at(columns[at + 1]) !== value)) out.push(mark.stop(value));
      }
      if (when === 'before') {
        if (column.chord) out.push(harmonyOf(column.chord) ?? direction('above', words(column.chord)));
        if (column.text) out.push(direction('above', words(column.text)));
        if (column.notes.some(n => n?.harmonic === 'pinch')) out.push(direction('above', words('P.H.')));
      }
      return out;
    };
    children.push(...staffNotes(ctx, b, 1, between));
    children.push(el('backup', {}, text('duration', barDuration(ctx, b))));
    children.push(...staffNotes(ctx, b, 2));
    flat += bar.columns.length;

    const last = b === part.bars.length - 1;
    const style = bar.repeatEnd !== undefined || last ? 'light-heavy' : bar.doubleBar ? 'light-light' : bar.freeTime ? 'dashed' : null;
    if (style || ending?.stop) {
      children.push(el('barline', { location: 'right' },
        style && text('bar-style', style),
        ending?.stop && el('ending', { number: ending.number, type: ending.stop }),
        bar.repeatEnd !== undefined && el('repeat', { direction: 'backward', times: bar.repeatEnd }),
      ));
    }
    return el('measure', { number: b + 1 }, ...children);
  });
  return el('part', { id: partId(t) }, ...measures);
}

function partId(t: number): string {
  return `P${t + 1}`;
}

/** What a track is called in the score: its name, else "Guitar" (numbered when there are more). */
function partName(clip: Clip, t: number): string {
  const name = clip.tracks[t].name.trim();
  if (name) return name;
  return clip.tracks.length > 1 ? `Guitar ${t + 1}` : 'Guitar';
}

/** MIDI channels 1 to 16 for each track in turn, skipping 10, the drums'. */
function midiChannel(t: number): number {
  const channel = (t % 15) + 1;
  return channel >= 10 ? channel + 1 : channel;
}

function scorePartXml(clip: Clip, t: number): XmlNode {
  const id = partId(t);
  const program = clip.tracks[t].instrument?.program ?? 25;
  return el('score-part', { id },
    text('part-name', partName(clip, t)),
    el('score-instrument', { id: `${id}-I1` }, text('instrument-name', instrumentName(program))),
    el('midi-instrument', { id: `${id}-I1` }, text('midi-channel', midiChannel(t)), text('midi-program', program + 1)),
  );
}

/** An A4 page in tenths of a staff space (40 tenths to a 7.05 mm staff), as MuseScore writes it. */
const PAGE = { millimeters: 7.05, width: 1191, height: 1684, margin: 85 } as const;

/** The clip as a MusicXML 4.0 partwise score: every track a part, with notation and tab. */
export function writeMusicXml(clip: Clip): string {
  const first = partOf(clip, 0);
  const title = clip.name.trim();
  const artist = headerValue(first, 'artist');
  const wordsBy = headerValue(first, 'words');
  const musicBy = headerValue(first, 'music');
  const divisions = divisionsOf(clip);
  // The head of the first page, placed as a printed score's is: apps (MuseScore among them) put a credit in
  // the page's header only when its position says it is in the top half.
  const { width, height, margin } = PAGE;
  const credits: XmlNode[] = [];
  const credit = (type: string, value: string, y: number, size: number, justify: 'center' | 'right') =>
    el('credit', { page: 1 }, text('credit-type', type), text('credit-words', value, {
      'default-x': justify === 'center' ? width / 2 : width - margin, 'default-y': y, 'font-size': size, justify, valign: 'top',
    }));
  let y = height - margin;
  if (title) {
    credits.push(credit('title', title, y, 24, 'center'));
    y -= 90;
  }
  if (artist) {
    credits.push(credit('subtitle', artist, y, 14, 'center'));
    y -= 60;
  }
  for (const line of creditsOf(first).lines) {
    credits.push(credit('composer', line, y, 10, 'right'));
    y -= 30;
  }

  const score = el('score-partwise', { version: '4.0' },
    title && el('work', {}, text('work-title', title)),
    el('identification', {},
      musicBy && text('creator', musicBy, { type: 'composer' }),
      wordsBy && text('creator', wordsBy, { type: 'lyricist' }),
      artist && text('creator', artist, { type: 'artist' }),
      el('encoding', {},
        text('software', 'Frets'),
        el('supports', { element: 'accidental', type: 'yes' }),
        el('supports', { element: 'beam', type: 'yes' }),
        lineStarts(first).size > 0 && el('supports', { element: 'print', attribute: 'new-system', type: 'yes', value: 'yes' }),
      ),
    ),
    el('defaults', {},
      el('scaling', {}, text('millimeters', PAGE.millimeters), text('tenths', 40)),
      el('page-layout', {}, text('page-height', height), text('page-width', width),
        el('page-margins', { type: 'both' }, ...['left', 'right', 'top', 'bottom'].map(side => text(`${side}-margin`, margin)))),
    ),
    ...credits,
    el('part-list', {}, ...clip.tracks.map((_, t) => scorePartXml(clip, t))),
    ...clip.tracks.map((_, t) => partXml(clip, t, divisions)),
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
    render(score),
    '',
  ].join('\n');
}

/**
 * What the MusicXML file leaves out of the clip, in words, for the ⚠ by Download MusicXML: the
 * playback FX, and the alphaTex Frets keeps as written without drawing it. Empty when it holds it all.
 */
export function musicXmlLosses(clip: Clip): string[] {
  const out: string[] = [];
  if (clip.tracks.some(t => t.fx?.on)) out.push('the FX');
  const credits = new Set<string>(CREDIT_TAGS);
  const kept = [
    ...(clip.header ?? []).filter(line => !credits.has(/^\\([a-z]+)/i.exec(line.trim())?.[1].toLowerCase() ?? '')),
    ...clip.tracks.flatMap(track => [
      ...(track.header ?? []),
      ...track.bars.flatMap(bar => [
        ...(bar.extra ?? []),
        ...bar.columns.flatMap(c => [...(c.extra ?? []), ...c.notes.flatMap(n => n?.extra ?? [])]),
      ]),
    ]),
  ];
  if (kept.length) out.push(`alphaTex Frets keeps without drawing (${[...new Set(kept)].slice(0, 3).join(', ')}${new Set(kept).size > 3 ? ', …' : ''})`);
  return out;
}
