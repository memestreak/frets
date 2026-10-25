/**
 * Reads alphaTex into a clip, with alphaTab's own parser
 * (`@coderline/alphatab`, loaded only when tab is read). alphaTab decides
 * what the text means; this file maps its score onto Frets' clip and keeps,
 * as written, every effect and tag Frets doesn't draw yet so writing the
 * clip back loses nothing. `public/tab-alphatex.txt` is the agents' guide.
 */
import type * as AlphaTabModule from '@coderline/alphatab';
import type { ReadResult } from './ascii';
import {
  BEND_QUARTERS, isUneven, NOTE_VALUES, STRING_COUNT, TIME_SIGNATURES,
  type Bar, type BendQuarters, type Clip, type Column, type Note, type NoteValue,
} from './clip';

type AlphaTab = typeof AlphaTabModule;
type Score = AlphaTabModule.model.Score;
type AtBeat = AlphaTabModule.model.Beat;
type AtNote = AlphaTabModule.model.Note;

let loading: Promise<AlphaTab> | null = null;
/** alphaTab, imported once and only when first needed. */
export function loadAlphaTab(): Promise<AlphaTab> {
  loading ??= import('@coderline/alphatab');
  return loading;
}

/* — what Frets reads itself; everything else is kept as written — */

/** Note effects Frets reads. */
const NOTE_EFFECTS = new Set(['h', 'sl', 'ss', 'sib', 'sia', 'b', 'be', 'v', 'x', 't', 'nh', 'pm']);
/** Beat effects Frets draws. */
const BEAT_EFFECTS = new Set(['d', 'dd', 'tu', 'sd', 'su', 'tt']);
/** Tags Frets reads: the title, the tuning, the time signature, repeats and endings. */
const TAGS = new Set(['title', 'tuning', 'ts', 'ro', 'rc', 'ae']);
/** Tags that belong to a bar (the rest, in the first bar, belong to the whole clip). */
const BAR_TAGS = new Set([
  'ts', 'ro', 'rc', 'ae', 'ks', 'clef', 'ottava', 'tempo', 'tf', 'ac', 'section', 'jump', 'ft',
  'simile', 'barlineleft', 'barlineright', 'scale', 'width', 'sync', 'accidentals', 'spd', 'sph',
  'spu', 'db', 'voicemode', 'barnumberdisplay', 'beaming',
]);

/** What a few kept keywords are, for the line that lists them. */
const KEPT_NAMES: Record<string, string> = {
  g: 'ghost note', lr: 'let ring', ac: 'accent', hac: 'heavy accent', st: 'staccato',
  vw: 'wide vibrato', ah: 'artificial harmonic', ph: 'pinch harmonic', th: 'tapped harmonic',
  sh: 'semi harmonic', fh: 'feedback harmonic', tr: 'trill', gr: 'grace note',
  tp: 'tremolo picking', tb: 'whammy bar', txt: 'text',
  sou: 'slide out up', sod: 'slide out down', psu: 'pick slide up', psd: 'pick slide down',
  fermata: 'fermata', rasg: 'rasgueado', bu: 'brush up', bd: 'brush down',
  au: 'arpeggio up', ad: 'arpeggio down', dy: 'dynamics', lf: 'left-hand fingering',
  rf: 'right-hand fingering', ten: 'tenuto',
};

/* — the parse tree, as far as this file uses it — */

interface Located { start?: { line: number; col: number; offset: number }; end?: { offset: number } }
interface PropertyNode extends Located { property: { text: string } }
interface PropertiesNode { properties: PropertyNode[] }
interface MetaNode extends Located { tag: { tag: { text: string } } }
interface NoteNode { noteString?: { value: number }; noteEffects?: PropertiesNode }
interface BeatNode { notes?: { notes: NoteNode[] }; beatEffects?: PropertiesNode; beatMultiplierValue?: { value: number } }
interface BarNode { metaData: MetaNode[]; beats: BeatNode[] }
interface ScoreNode { bars: BarNode[] }

/** A node's text as written. alphaTab's end offset stops short of a closing quote, so close it. */
function written(text: string, node: Located): string {
  let raw = text.slice(node.start?.offset ?? 0, node.end?.offset ?? 0).trim();
  if ((raw.match(/(?<!\\)"/g) ?? []).length % 2 === 1) raw += '"';
  const open = (raw.match(/\(/g) ?? []).length - (raw.match(/\)/g) ?? []).length;
  return raw + ')'.repeat(Math.max(0, open));
}

/** The effects Frets doesn't read, as written, counting each keyword in `kept`. */
function keptEffects(text: string, node: PropertiesNode | undefined, reads: Set<string>, kept: Map<string, number>): string[] {
  return (node?.properties ?? []).filter(p => !reads.has(p.property.text)).map(p => {
    kept.set(p.property.text, (kept.get(p.property.text) ?? 0) + 1);
    return written(text, p);
  });
}

/* — from alphaTab's score to the clip — */

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function nearestQuarters(q: number): BendQuarters {
  return BEND_QUARTERS.reduce((best, b) => (Math.abs(b - q) < Math.abs(best - q) ? b : best));
}

/** A note's own marks; the ones that come from the note before it (h, slides) are added later. */
function noteOf(note: AtNote, at: AlphaTab): Note {
  const n: Note = { fret: note.isDead ? null : note.fret };
  if (note.isTieDestination) {
    n.tie = true;
    n.fret = note.tieOrigin?.fret ?? note.fret;
  }
  if (note.slideInType === at.model.SlideInType.IntoFromBelow) n.slide = 'below';
  if (note.slideInType === at.model.SlideInType.IntoFromAbove) n.slide = 'above';
  if (note.isPalmMute) n.palmMute = true;
  const points = note.bendPoints ?? [];
  if (points.length > 0) {
    const values = points.map(p => p.value);
    const peak = Math.max(...values);
    if (peak > 0) {
      n.bend = { quarters: nearestQuarters(peak), pre: values[0] > 0, release: values[values.length - 1] < peak };
    }
  }
  if (note.vibrato === at.model.VibratoType.Slight) n.vibrato = true;
  if (note.harmonicType === at.model.HarmonicType.Natural) n.harmonic = true;
  return n;
}

function durationOf(beat: AtBeat, warn: (w: string) => void): Column['duration'] {
  let value = beat.duration as number;
  if (!NOTE_VALUES.includes(value as NoteValue)) {
    warn(`Read a 1/${value} note as the nearest length Frets draws.`);
    value = value < 1 ? 1 : 16;
  }
  return {
    value: value as NoteValue,
    dots: beat.dots >= 2 ? 2 : beat.dots === 1 ? 1 : 0,
    triplet: beat.hasTuplet && beat.tupletNumerator === 3 && beat.tupletDenominator === 2,
  };
}

/** Joins hammer-ons, pull-offs and slides to the note they lead to, the next on the same string. */
function joinToNext(bars: Bar[], origins: Map<Note, AtNote>, at: AlphaTab, warn: (w: string) => void) {
  const notes = bars.flatMap(b => b.columns.map(c => c.notes));
  for (let s = 0; s < STRING_COUNT; s++) {
    const onString = notes.map(ns => ns[s]).filter((n): n is Note => n !== null);
    onString.forEach((note, i) => {
      const source = origins.get(note);
      if (!source) return;
      const slide = source.slideOutType === at.model.SlideOutType.Shift ? 'shift'
        : source.slideOutType === at.model.SlideOutType.Legato ? 'legato' : null;
      if (!source.isHammerPullOrigin && !slide) return;
      const next = onString[i + 1];
      if (!next || note.fret === null || next.fret === null) {
        warn('Left out a hammer-on, pull-off or slide with no later note on its string.');
        return;
      }
      if (source.isHammerPullOrigin) next.legato = next.fret < note.fret ? 'p' : 'h';
      if (slide) next.slide = slide;
    });
  }
}

function errorLines(importer: AlphaTabModule.importer.AlphaTexImporter): string[] {
  const all = [...importer.lexerDiagnostics.items, ...importer.parserDiagnostics.items, ...importer.semanticDiagnostics.items];
  return all
    .filter(d => d.severity === 2)
    .map(d => (d.start ? `Line ${d.start.line}, column ${d.start.col}: ${d.message}` : d.message));
}

/** Reads alphaTex with an already loaded alphaTab (tests pass it in; the page uses `readAlphaTex`). */
export function readAlphaTexWith(at: AlphaTab, text: string): ReadResult {
  const importer = new at.importer.AlphaTexImporter();
  importer.logErrors = false;
  importer.initFromString(text, new at.Settings());
  let score: Score;
  try {
    score = importer.readScore();
  } catch {
    const errors = errorLines(importer);
    return { ok: false, errors: errors.length > 0 ? errors : ['This is not alphaTex Frets can read.'] };
  }
  const tree = importer.scoreNode as unknown as ScoreNode | undefined;
  const track = score.tracks[0];
  const staff = track?.staves[0];
  if (!tree || !staff || score.tracks.length > 1 || track.staves.length > 1) {
    return { ok: false, errors: ['Frets reads one track with one staff.'] };
  }
  if (staff.bars.some(b => b.voices.slice(1).some(v => !v.isEmpty))) {
    return { ok: false, errors: ['Frets reads one voice; this has more.'] };
  }
  const tunings = staff.stringTuning.tunings;
  if (tunings.length !== STRING_COUNT) {
    return { ok: false, errors: [`Frets reads six-string tab; this has ${tunings.length} strings.`] };
  }

  const warnings: string[] = [];
  const warn = (w: string) => { if (!warnings.includes(w)) warnings.push(w); };
  const kept = new Map<string, number>();
  const first = score.masterBars[0];
  let time = { beats: first.timeSignatureNumerator, value: first.timeSignatureDenominator as 4 | 8 };
  if (!TIME_SIGNATURES.some(t => t.beats === time.beats && t.value === time.value)) {
    warn(`Frets doesn't offer ${time.beats}/${time.value} yet; read as 4/4.`);
    time = { beats: 4, value: 4 };
  }

  const header: string[] = [];
  const origins = new Map<Note, AtNote>();
  const bars: Bar[] = tree.bars.map((barNode, b) => {
    const master = score.masterBars[b];
    const atBar = staff.bars[b];
    const bar: Bar = { columns: [] };
    if (master?.isRepeatStart) bar.repeatStart = true;
    if (master && master.repeatCount > 0) bar.repeatEnd = master.repeatCount;
    if (master && master.alternateEndings > 0) bar.ending = Math.log2(master.alternateEndings & -master.alternateEndings) + 1;
    for (const meta of barNode.metaData) {
      const tag = meta.tag.tag.text.toLowerCase();
      if (tag === 'ts' && b > 0) warn('Frets draws one time signature; later changes are kept but not drawn.');
      if (TAGS.has(tag) && !(tag === 'ts' && b > 0)) continue;
      kept.set(`\\${tag}`, (kept.get(`\\${tag}`) ?? 0) + 1);
      if (b === 0 && !BAR_TAGS.has(tag)) header.push(written(text, meta));
      else (bar.extra ??= []).push(written(text, meta));
    }

    // The tree's beats, one per beat alphaTab made (a beat written "*3" stands for three).
    const beatNodes = barNode.beats.flatMap(n => Array<BeatNode>(n.beatMultiplierValue?.value ?? 1).fill(n));
    const atBeats = beatNodes.length === 0 ? [] : (atBar?.voices[0]?.beats ?? []);
    atBeats.forEach((beat, i) => {
      const node = beatNodes[i];
      const column: Column = { duration: durationOf(beat, warn), notes: Array<Note | null>(STRING_COUNT).fill(null) };
      if (beat.pickStroke === at.model.PickStroke.Down) column.stroke = 'down';
      if (beat.pickStroke === at.model.PickStroke.Up) column.stroke = 'up';
      for (const note of beat.notes) {
        const s = STRING_COUNT - note.string;
        const n = noteOf(note, at);
        if (beat.tap) n.tap = true;
        const noteNode = node?.notes?.notes.find(nn => nn.noteString?.value === s + 1);
        const extra = keptEffects(text, noteNode?.noteEffects, NOTE_EFFECTS, kept);
        if (note.vibrato === at.model.VibratoType.Wide && !extra.includes('vw')) extra.push('vw');
        if (extra.length > 0) n.extra = extra;
        column.notes[s] = n;
        origins.set(n, note);
      }
      const extra = keptEffects(text, node?.beatEffects, BEAT_EFFECTS, kept);
      if (beat.hasTuplet && !column.duration.triplet) warn('Frets draws triplets only; other tuplets are read as plain notes.');
      if (extra.length > 0) column.extra = extra;
      bar.columns.push(column);
    });
    return bar;
  });
  joinToNext(bars, origins, at, warn);

  const clip: Clip = {
    name: score.title,
    time,
    tuning: [...tunings].reverse().map(m => SHARP_NAMES[m % 12]),
    bars: bars.length > 0 ? bars : [{ columns: [] }],
  };
  if (header.length > 0) clip.header = header;

  if (kept.size > 0) {
    const list = [...kept].map(([k, n]) => `${k}${KEPT_NAMES[k.replace('\\', '')] ? ` (${KEPT_NAMES[k.replace('\\', '')]})` : ''}${n > 1 ? ` ×${n}` : ''}`);
    warnings.push(`Kept but not drawn yet: ${list.join(', ')}.`);
  }
  const uneven = clip.bars.map((bar, i) => (isUneven(bar, clip.time) ? i + 1 : 0)).filter(Boolean);
  if (uneven.length === 1) warnings.push(`Bar ${uneven[0]} doesn't add up to ${clip.time.beats}/${clip.time.value}.`);
  if (uneven.length > 1) warnings.push(`Bars ${uneven.join(', ')} don't add up to ${clip.time.beats}/${clip.time.value}.`);
  return { ok: true, clip, warnings };
}

/** Reads alphaTex, loading alphaTab first. */
export async function readAlphaTex(text: string): Promise<ReadResult> {
  return readAlphaTexWith(await loadAlphaTab(), text);
}
