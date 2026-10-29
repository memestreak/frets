/**
 * Reads alphaTex into a clip, with alphaTab's own parser
 * (`@coderline/alphatab`, loaded only when tab is read). alphaTab decides
 * what the text means; this file maps its score onto Frets' clip and keeps,
 * as written, every effect and tag Frets doesn't draw yet so writing the
 * clip back loses nothing. `public/tab-alphatex.txt` is the agents' guide.
 */
import type * as AlphaTabModule from '@coderline/alphatab';
import type { ReadResult, TextSpot } from './ascii';
import {
  BEND_QUARTERS, unevenMessage, MAX_BPM, MAX_CAPO, MIN_BPM, NOTE_VALUES, STRING_COUNT, COMMON_TIME, isTimeSignature,
  TREMOLO_VALUES, tupletFields, type TimeSignature, type Bar, type BendQuarters, type Clip, type Column, type Note,
  type NoteValue, type Fermata, isBarsPerLine,
} from './clip';
import { readFxLine } from './fxLine';
import type { FxSettings } from './effects';

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
const NOTE_EFFECTS = new Set([
  'h', 'sl', 'ss', 'sib', 'sia', 'sod', 'sou', 'b', 'be', 'v', 'vw', 'x', 't', 'nh', 'ph', 'ah', 'pm', 'lr', 'g', 'ac', 'hac', 'st', 'umordent', 'lmordent',
]);
/** Beat effects Frets draws; tu, gr and tp only in the forms `beatReads` allows. */
const BEAT_EFFECTS = new Set(['d', 'dd', 'tu', 'sd', 'su', 'tt', 'ch', 'txt', 'gr', 'tp', 'ot', 'waho', 'wahc', 'cre', 'dec', 'fermata']);
/**
 * Tags Frets reads: the title, tuning, capo, time and key signatures, tempo, sections, repeats, endings, double bars,
 * multi-bar rests, and the line breaks (`systemsLayout`, `defaultSystemsLayout`; read only when their values are
 * ones Frets offers, else kept as written).
 */
const TAGS = new Set(['title', 'tuning', 'capo', 'ts', 'ks', 'tempo', 'section', 'ro', 'rc', 'ae', 'db', 'ft', 'multibarrest']);
/** The line-break tags, read when their values are good. */
const LAYOUT_TAGS = new Set(['systemslayout', 'defaultsystemslayout']);
/** Header tags kept as written in the clip's header and drawn from there: the credits under the title (`credits.ts`). */
const CREDIT_TAGS = new Set(['artist', 'words', 'music']);
/** Frets's fermata for each of alphaTab's FermataType values (Short, Medium, Long). */
const FERMATA_OF: Fermata[] = ['short', 'medium', 'long'];

/** Tags that belong to a bar (the rest, in the first bar, belong to the whole clip). */
const BAR_TAGS = new Set([
  'ts', 'ro', 'rc', 'ae', 'ks', 'clef', 'ottava', 'tempo', 'tf', 'ac', 'section', 'jump', 'ft',
  'simile', 'barlineleft', 'barlineright', 'scale', 'width', 'sync', 'accidentals', 'spd', 'sph',
  'spu', 'db', 'voicemode', 'barnumberdisplay', 'beaming',
]);

/** What a few kept keywords are, for the line that lists them; tags keep their backslash (\ac is a pickup bar, ac an accent). */
const KEPT_NAMES: Record<string, string> = {
  '\\ac': 'pickup bar',
  th: 'tapped harmonic',
  sh: 'semi harmonic', fh: 'feedback harmonic', tr: 'trill', gr: 'grace note',
  tp: 'tremolo picking', tb: 'whammy bar',
  psu: 'pick slide up', psd: 'pick slide down',
  rasg: 'rasgueado', bu: 'brush up', bd: 'brush down',
  au: 'arpeggio up', ad: 'arpeggio down', dy: 'dynamics', lf: 'left-hand fingering',
  rf: 'right-hand fingering', ten: 'tenuto', tu: 'tuplet',
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

/** A node's text as written. alphaTab's end offset stops short of a closing quote (double or single), so close it. */
function written(text: string, node: Located): string {
  let raw = text.slice(node.start?.offset ?? 0, node.end?.offset ?? 0).trim();
  const open = openQuote(raw);
  if (open) raw += open;
  const brackets = (raw.match(/\(/g) ?? []).length - (raw.match(/\)/g) ?? []).length;
  return raw + ')'.repeat(Math.max(0, brackets));
}

/** The quote a string left open at the end of some alphaTex is in ('"' or "'"), or null; a backslash escapes. */
function openQuote(raw: string): string | null {
  let quote: string | null = null;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (quote && c === '\\') i++;
    else if (quote && c === quote) quote = null;
    else if (!quote && (c === '"' || c === "'")) quote = c;
  }
  return quote;
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
      const quarters = nearestQuarters(peak);
      n.bend = { quarters, pre: values[0] > 0, release: values[values.length - 1] < peak };
      // A bend that starts bent but lower than its peak rises on from there: (4 6).
      if (values[0] > 0 && nearestQuarters(values[0]) < quarters) n.bend.from = nearestQuarters(values[0]);
      // A release that stops short of the fret lands at its last point: (4 2) lets "full" down to "½".
      const last = values[values.length - 1];
      if (n.bend.release && last > 0 && nearestQuarters(last) < quarters) n.bend.to = nearestQuarters(last);
    }
  }
  if (note.slideOutType === at.model.SlideOutType.OutDown) n.slideOut = 'down';
  if (note.slideOutType === at.model.SlideOutType.OutUp) n.slideOut = 'up';
  if (note.vibrato === at.model.VibratoType.Slight) n.vibrato = 'slight';
  if (note.vibrato === at.model.VibratoType.Wide) n.vibrato = 'wide';
  if (note.harmonicType === at.model.HarmonicType.Natural) n.harmonic = 'natural';
  if (note.harmonicType === at.model.HarmonicType.Pinch) n.harmonic = 'pinch';
  if (note.harmonicType === at.model.HarmonicType.Artificial) {
    n.harmonic = 'artificial';
    if (note.harmonicValue > 0) n.harmonicFret = note.harmonicValue;
  }
  if (note.isLetRing) n.letRing = true;
  if (note.isGhost) n.ghost = true;
  if (note.accentuated === at.model.AccentuationType.Normal) n.accent = 'normal';
  if (note.accentuated === at.model.AccentuationType.Heavy) n.accent = 'heavy';
  if (note.isStaccato) n.staccato = true;
  if (note.ornament === at.model.NoteOrnament.UpperMordent) n.mordent = 'upper';
  if (note.ornament === at.model.NoteOrnament.LowerMordent) n.mordent = 'lower';
  return n;
}

/** The beat's tuplet, when Frets draws it: up to twelve notes in the time of any number of plain ones. */
function tupletOf(beat: AtBeat): ReturnType<typeof tupletFields> {
  return beat.hasTuplet ? tupletFields(beat.tupletNumerator, beat.tupletDenominator) : null;
}

function durationOf(beat: AtBeat, warn: (w: string) => void): Column['duration'] {
  let value = beat.duration as number;
  if (!NOTE_VALUES.includes(value as NoteValue)) {
    warn(`Read a 1/${value} note as the nearest length Frets draws.`);
    value = value < 1 ? 1 : 64;
  }
  const duration: Column['duration'] = { value: value as NoteValue, dots: beat.dots >= 2 ? 2 : beat.dots === 1 ? 1 : 0 };
  return { ...duration, ...tupletOf(beat) };
}

/**
 * Reads a beat's grace note, tremolo picking and octave line onto its column, and says which of tu, gr and tp
 * Frets read; any other form (a tuplet of thirteen, a bend grace note, four tremolo slashes) is kept as written.
 */
function beatReads(beat: AtBeat, column: Column, at: AlphaTab): Set<string> {
  const reads = new Set(BEAT_EFFECTS);
  if (beat.hasTuplet && !column.duration.tuplet) reads.delete('tu');
  if (beat.graceType === at.model.GraceType.BeforeBeat) column.grace = 'before';
  else if (beat.graceType === at.model.GraceType.OnBeat) column.grace = 'on';
  else reads.delete('gr');
  const tremolo = beat.tremoloPicking;
  const value = tremolo ? TREMOLO_VALUES[tremolo.marks - 1] : undefined;
  if (tremolo && value && tremolo.style === at.model.TremoloPickingStyle.Default) column.tremolo = value;
  else reads.delete('tp');
  const ottavas = { [at.model.Ottavia._8va]: '8va', [at.model.Ottavia._8vb]: '8vb', [at.model.Ottavia._15ma]: '15ma', [at.model.Ottavia._15mb]: '15mb' } as const;
  const ottava = ottavas[beat.ottava as keyof typeof ottavas];
  if (ottava) column.ottava = ottava;
  return reads;
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
      // A slide may start from a dead note (the book's bar 160 slides an x up into a 19); a hammer-on needs two frets.
      const from = note.fret;
      const hammer = source.isHammerPullOrigin && from !== null;
      if (!next || next.fret === null || (!hammer && !slide)) {
        warn('Left out a hammer-on, pull-off or slide with no later note on its string.');
        return;
      }
      if (hammer) next.legato = next.fret < from ? 'p' : 'h';
      if (slide) next.slide = slide;
    });
  }
}

/** alphaTab's errors, each as a line for Import and, where it has one, a spot in the text for the AlphaTex editor. */
function errorsOf(importer: AlphaTabModule.importer.AlphaTexImporter, text: string): { errors: string[]; spots: TextSpot[] } {
  const all = [...importer.lexerDiagnostics.items, ...importer.parserDiagnostics.items, ...importer.semanticDiagnostics.items]
    .filter(d => d.severity === 2);
  const errors = all.map(d => (d.start ? `Line ${d.start.line}, column ${d.start.col}: ${d.message}` : d.message));
  const spots = all.flatMap(d => {
    if (!d.start) return [];
    const from = stringIndex(text, d.start.offset);
    return [{ from, to: Math.max(from, stringIndex(text, d.end?.offset ?? d.start.offset)), message: d.message }];
  });
  return { errors, spots };
}

/** alphaTab counts characters (code points); a JavaScript string counts UTF-16 units, two for some symbols. */
function stringIndex(text: string, codePoints: number): number {
  let index = 0;
  for (let n = 0; n < codePoints && index < text.length; n++) index += text.codePointAt(index)! > 0xffff ? 2 : 1;
  return index;
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
    const { errors, spots } = errorsOf(importer, text);
    return { ok: false, errors: errors.length > 0 ? errors : ['This is not alphaTex Frets can read.'], spots };
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
  const beats = first.timeSignatureNumerator;
  const value = first.timeSignatureDenominator;
  let time: TimeSignature = COMMON_TIME;
  if (isTimeSignature(beats, value)) time = { beats, value } as TimeSignature;
  else warn(`Frets doesn't offer ${beats}/${value}; read as 4/4.`);

  const header: string[] = [];
  // Line breaks, as alphaTab reads them into the score; a bad value is kept as written and named.
  const firstTags = tree.bars[0]?.metaData.map(m => m.tag.tag.text.toLowerCase()) ?? [];
  const layoutOk = new Set<string>();
  if (firstTags.includes('systemslayout')) {
    if (score.systemsLayout.length > 0 && score.systemsLayout.every(isBarsPerLine)) layoutOk.add('systemslayout');
    else warn('\\systemsLayout takes whole numbers from 1, a line\'s bars each; kept as written but not used.');
  }
  if (firstTags.includes('defaultsystemslayout')) {
    if (isBarsPerLine(score.defaultSystemsLayout)) layoutOk.add('defaultsystemslayout');
    else warn('\\defaultSystemsLayout takes a whole number from 1; kept as written but not used.');
  }
  const origins = new Map<Note, AtNote>();
  let timeNow = time;
  const bars: Bar[] = tree.bars.map((barNode, b) => {
    const master = score.masterBars[b];
    const atBar = staff.bars[b];
    const bar: Bar = { columns: [] };
    if (master?.isRepeatStart) bar.repeatStart = true;
    if (master && master.repeatCount > 0) bar.repeatEnd = master.repeatCount;
    if (master?.isDoubleBar) bar.doubleBar = true;
    if (master?.isFreeTime) bar.freeTime = true;
    if (master && master.alternateEndings > 0) bar.ending = Math.log2(master.alternateEndings & -master.alternateEndings) + 1;
    const tags = barNode.metaData.map(m => m.tag.tag.text.toLowerCase());
    if (master && tags.includes('section') && master.section) {
      bar.section = { text: master.section.text };
      if (master.section.marker) bar.section.marker = master.section.marker;
    }
    const tempo = master?.tempoAutomations[0];
    if (tags.includes('tempo') && tempo) {
      const bpm = Math.round(Math.min(MAX_BPM, Math.max(MIN_BPM, tempo.value)));
      if (bpm !== tempo.value) warn(`Read a tempo of ${tempo.value} as ${bpm}; Frets offers ${MIN_BPM} to ${MAX_BPM}.`);
      bar.tempo = { bpm };
      if (tempo.text) bar.tempo.label = tempo.text;
    }
    if (master && master.tempoAutomations.length > 1) warn('Frets draws one tempo a bar; read the first.');
    if (master && b > 0 && tags.includes('ts')) {
      const later = { beats: master.timeSignatureNumerator, value: master.timeSignatureDenominator } as TimeSignature;
      if (!isTimeSignature(later.beats, later.value)) warn(`Frets doesn't offer ${later.beats}/${later.value}; bar ${b + 1} keeps ${timeNow.beats}/${timeNow.value}.`);
      else if (later.beats !== timeNow.beats || later.value !== timeNow.value) bar.time = timeNow = later;
    }
    // A key signature as written, even one the bar before already had, so the text reads back the same.
    if (atBar && tags.includes('ks')) {
      bar.key = { fifths: atBar.keySignature as number };
      if ((atBar.keySignatureType as number) === 1) bar.key.minor = true;
    }
    for (const meta of barNode.metaData) {
      const tag = meta.tag.tag.text.toLowerCase();
      if (TAGS.has(tag)) continue;
      if (LAYOUT_TAGS.has(tag) && b === 0 && layoutOk.has(tag)) continue;
      if (b === 0 && CREDIT_TAGS.has(tag)) {
        header.push(written(text, meta));
        continue;
      }
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
      if (beat.wahPedal === at.model.WahPedal.Open) column.wah = 'open';
      if (beat.wahPedal === at.model.WahPedal.Closed) column.wah = 'closed';
      if (beat.crescendo === at.model.CrescendoType.Crescendo) column.hairpin = 'crescendo';
      if (beat.crescendo === at.model.CrescendoType.Decrescendo) column.hairpin = 'decrescendo';
      if (beat.fermata) column.fermata = FERMATA_OF[beat.fermata.type as number];
      const chord = beat.chordId ? staff.getChord(beat.chordId) : null;
      if (chord?.name) column.chord = chord.name;
      if (beat.text) column.text = beat.text;
      for (const note of beat.notes) {
        const s = STRING_COUNT - note.string;
        const n = noteOf(note, at);
        if (beat.tap) n.tap = true;
        const noteNode = node?.notes?.notes.find(nn => nn.noteString?.value === s + 1);
        const extra = keptEffects(text, noteNode?.noteEffects, NOTE_EFFECTS, kept);
        if (extra.length > 0) n.extra = extra;
        column.notes[s] = n;
        origins.set(n, note);
      }
      const extra = keptEffects(text, node?.beatEffects, beatReads(beat, column, at), kept);
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
  const fx = fxOf(tree);
  if (fx) clip.fx = fx;
  if (layoutOk.has('systemslayout')) clip.systemsLayout = [...score.systemsLayout];
  if (layoutOk.has('defaultsystemslayout')) clip.defaultSystemsLayout = score.defaultSystemsLayout;
  if (tree.bars[0]?.metaData.some(m => m.tag.tag.text.toLowerCase() === 'multibarrest')) clip.multiBarRests = true;
  if (tree.bars[0]?.metaData.some(m => m.tag.tag.text.toLowerCase() === 'capo') && staff.capo > 0) {
    clip.capo = Math.min(MAX_CAPO, staff.capo);
    if (staff.capo > MAX_CAPO) warn(`Read capo ${staff.capo} as ${MAX_CAPO}, the highest Frets offers.`);
  }

  if (kept.size > 0) {
    const list = [...kept].map(([k, n]) => `${k}${KEPT_NAMES[k] ? ` (${KEPT_NAMES[k]})` : ''}${n > 1 ? ` ×${n}` : ''}`);
    warnings.push(`Kept but not drawn yet: ${list.join(', ')}.`);
  }
  const uneven = unevenMessage(clip);
  if (uneven) warnings.push(uneven);
  return { ok: true, clip, warnings };
}

/** A comment as alphaTab's syntax tree keeps it, on the token it comes before or after. */
interface CommentNode { text: string; multiLine: boolean; start?: { offset: number } }

/**
 * The FX in the clip's `// frets:fx` line (`fxLine.ts`), wherever it is, the first if there are
 * more; null when there is none. Other comments aren't kept.
 */
function fxOf(tree: unknown): FxSettings | null {
  let first: { at: number; fx: FxSettings } | null = null;
  const seen = new Set<object>();
  const stack: unknown[] = [tree];
  while (stack.length > 0) {
    const node = stack.pop();
    if (typeof node !== 'object' || node === null || seen.has(node)) continue;
    seen.add(node);
    for (const [key, value] of Object.entries(node)) {
      if ((key === 'leadingComments' || key === 'trailingComments') && Array.isArray(value)) {
        for (const comment of value as CommentNode[]) {
          const fx = comment.multiLine ? null : readFxLine(comment.text);
          const at = comment.start?.offset ?? 0;
          if (fx && (!first || at < first.at)) first = { at, fx };
        }
      } else if (typeof value === 'object') stack.push(value);
    }
  }
  return first?.fx ?? null;
}

/** Reads alphaTex, loading alphaTab first. */
export async function readAlphaTex(text: string): Promise<ReadResult> {
  return readAlphaTexWith(await loadAlphaTab(), text);
}
