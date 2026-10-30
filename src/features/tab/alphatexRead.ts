/**
 * Reads alphaTex into a clip, with alphaTab's own parser
 * (`@coderline/alphatab`, loaded only when tab is read). alphaTab decides
 * what the text means; this file maps its score onto Frets' clip and keeps,
 * as written, every effect and tag Frets doesn't draw yet so writing the
 * clip back loses nothing. `public/tab-alphatex.txt` is the agents' guide.
 */
import type * as AlphaTabModule from '@coderline/alphatab';
import { mod12, SHARP_NOTES } from '@/lib/theory/notes';
import type { ReadResult, TextSpot } from './ascii';
import {
  BEND_QUARTERS, isWhammy, unevenMessage, MAX_BPM, MAX_CAPO, MIN_BPM, NOTE_VALUES, STRING_COUNT, COMMON_TIME, isTimeSignature,
  TREMOLO_VALUES, tupletFields, type TimeSignature, type BendQuarters, type Clip, type Column, type Note,
  type NoteValue, type Fermata, isBarsPerLine, partOf, trackName, type MasterBar, type Track, type TrackBar,
} from './clip';
import { readFxLine } from './fxLine';
import { STANDARD_TUNING_TEX } from './instrument';
import type { FxSettings } from './effects';

type AlphaTab = typeof AlphaTabModule;
type Score = AlphaTabModule.model.Score;
type AtBeat = AlphaTabModule.model.Beat;
type AtNote = AlphaTabModule.model.Note;
type AtBar = AlphaTabModule.model.Bar;
type AtStaff = AlphaTabModule.model.Staff;

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
interface PropertyNode extends Located { property: { text: string }; arguments?: ArgumentsNode }
/** A property's arguments: numbers, words, or a bracketed list of them. */
interface ArgumentsNode { arguments?: (ArgumentsNode & { value?: unknown; text?: string })[] }
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
function beatReads(beat: AtBeat, column: Column, at: AlphaTab, node: BeatNode | undefined): Set<string> {
  const reads = new Set(BEAT_EFFECTS);
  const whammy = whammyOf(node?.beatEffects);
  if (whammy) {
    column.whammy = whammy;
    reads.add('tb');
  }
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

/**
 * A whammy bar as Frets draws it, from a beat's effects (or a note's, where alphaTab reads it for the
 * beat too): `tb` with only its points, two or more whole quarter tones none above the note, as written
 * (alphaTab's reading of them is the same points). A `tb` naming a type or style, a `tbe` with its own
 * offsets, or a pull-up is kept as written; null then, and with no `tb`.
 */
function whammyOf(effects: PropertiesNode | undefined): number[] | null {
  const property = effects?.properties.find(p => p.property.text === 'tb');
  let args = property?.arguments?.arguments ?? [];
  // `tb (0 -4)` and `tb 0 -4` both read; a list inside the brackets is one more level down.
  if (args.length === 1 && args[0].arguments) args = args[0].arguments;
  const values = args.map(a => (a.text === undefined && typeof a.value === 'number' ? a.value : NaN));
  return isWhammy(values) ? values : null;
}

/** Joins hammer-ons, pull-offs and slides to the note they lead to, the next on the same string. */
function joinToNext(bars: TrackBar[], origins: Map<Note, AtNote>, at: AlphaTab, warn: (w: string) => void) {
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
  let score: Score | null = null;
  try {
    score = importer.readScore();
  } catch {
    // Kept for below: the instrument may be why.
  }
  const tree = importer.scoreNode as unknown as ScoreNode | undefined;
  // A clip naming an instrument with no strings of its own (a piano, say) and no tuning is guitar
  // tab: alphaTab leaves it no strings to put its notes on, so it is read again in standard tuning.
  // alphaTab says so, failing, as a string out of the range 1-0.
  const stringless = tree && (score
    ? score.tracks[0]?.staves[0]?.stringTuning.tunings.length === 0
    : errorsOf(importer, text).errors.some(e => e.includes('range: 1-0')));
  const retried = stringless ? withGuitarTuning(tree, text) : null;
  if (retried) {
    const again = readAlphaTexWith(at, retried);
    if (again.ok) return again;
  }
  if (!score) {
    const { errors, spots } = errorsOf(importer, text);
    return { ok: false, errors: errors.length > 0 ? errors : ['This is not alphaTex Frets can read.'], spots };
  }
  // Each track's bars in the parse tree: a `\track` after the first bar starts the next track's.
  const starts = [0, ...tree?.bars.flatMap((bar, i) => (i > 0 && hasTag(bar, 'track') ? [i] : [])) ?? []];
  if (!tree || starts.length !== score.tracks.length) return { ok: false, errors: ['This is not alphaTex Frets can read.'] };
  for (const track of score.tracks) {
    const staff = track.staves[0];
    if (!staff || track.staves.length > 1) return { ok: false, errors: ['Frets reads one staff in each track.'] };
    if (staff.bars.some(b => b.voices.slice(1).some(v => !v.isEmpty))) {
      return { ok: false, errors: ['Frets reads one voice; this has more.'] };
    }
    const strings = staff.stringTuning.tunings.length;
    if (strings !== STRING_COUNT) return { ok: false, errors: [`Frets reads six-string tab; this has ${strings} strings.`] };
  }
  /** Track `t`'s bar `b` in the tree; a track written with fewer bars than the score has none past its last. */
  const nodeOf = (t: number, b: number): BarNode => {
    const index = starts[t] + b;
    return index < (starts[t + 1] ?? tree.bars.length) ? tree.bars[index] : { metaData: [], beats: [] };
  };

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

  // The bar marks every track shares, from alphaTab's master bars and the tags any track wrote for them.
  const firstStaff = score.tracks[0].staves[0];
  let timeNow = time;
  const masterBars: MasterBar[] = score.masterBars.map((master, b) => {
    const bar: MasterBar = {};
    const tags = new Set(score.tracks.flatMap((_, t) => nodeOf(t, b).metaData.map(m => m.tag.tag.text.toLowerCase())));
    if (master.isRepeatStart) bar.repeatStart = true;
    if (master.repeatCount > 0) bar.repeatEnd = master.repeatCount;
    if (master.isDoubleBar) bar.doubleBar = true;
    if (master.isFreeTime) bar.freeTime = true;
    if (master.alternateEndings > 0) bar.ending = Math.log2(master.alternateEndings & -master.alternateEndings) + 1;
    if (tags.has('section') && master.section) {
      bar.section = { text: master.section.text };
      if (master.section.marker) bar.section.marker = master.section.marker;
    }
    const tempo = master.tempoAutomations[0];
    if (tags.has('tempo') && tempo) {
      const bpm = Math.round(Math.min(MAX_BPM, Math.max(MIN_BPM, tempo.value)));
      if (bpm !== tempo.value) warn(`Read a tempo of ${tempo.value} as ${bpm}; Frets offers ${MIN_BPM} to ${MAX_BPM}.`);
      bar.tempo = { bpm };
      if (tempo.text) bar.tempo.label = tempo.text;
    }
    if (master.tempoAutomations.length > 1) warn('Frets draws one tempo a bar; read the first.');
    if (b > 0 && tags.has('ts')) {
      const later = { beats: master.timeSignatureNumerator, value: master.timeSignatureDenominator } as TimeSignature;
      if (!isTimeSignature(later.beats, later.value)) warn(`Frets doesn't offer ${later.beats}/${later.value}; bar ${b + 1} keeps ${timeNow.beats}/${timeNow.value}.`);
      else if (later.beats !== timeNow.beats || later.value !== timeNow.value) bar.time = timeNow = later;
    }
    // A key signature as written, even one the bar before already had, so the text reads back the same.
    const atBar = firstStaff.bars[b];
    if (atBar && tags.has('ks')) {
      bar.key = { fifths: atBar.keySignature as number };
      if ((atBar.keySignatureType as number) === 1) bar.key.minor = true;
    }
    return bar;
  });

  const tracks = score.tracks.map((atTrack, t): Track => {
    const staff = atTrack.staves[0];
    const origins = new Map<Note, AtNote>();
    const trackHeader: string[] = [];
    let tag: string | undefined;
    let instrumentTag: string | undefined;
    const bars = score.masterBars.map((_, b): TrackBar => {
      const barNode = nodeOf(t, b);
      const atBar = staff.bars[b];
      const bar: TrackBar = { columns: [] };
      for (const meta of barNode.metaData) {
        const name = meta.tag.tag.text.toLowerCase();
        if (TAGS.has(name)) continue;
        if (LAYOUT_TAGS.has(name) && t === 0 && b === 0 && layoutOk.has(name)) continue;
        if (b === 0 && name === 'instrument') {
          instrumentTag = written(text, meta);
          continue;
        }
        if (b === 0 && name === 'track') {
          tag = written(text, meta);
          continue;
        }
        if (b === 0 && CREDIT_TAGS.has(name)) {
          header.push(written(text, meta));
          continue;
        }
        kept.set(`\\${name}`, (kept.get(`\\${name}`) ?? 0) + 1);
        // The first track's lines before its `\track` are the clip's; the rest are the track's.
        if (b === 0 && !BAR_TAGS.has(name)) (t === 0 && tag === undefined ? header : trackHeader).push(written(text, meta));
        else (bar.extra ??= []).push(written(text, meta));
      }
      bar.columns = columnsOf(text, barNode, atBar, staff, at, origins, kept, warn);
      return bar;
    });
    joinToNext(bars, origins, at, warn);

    const track: Track = {
      name: tag === undefined ? '' : atTrack.name,
      tuning: [...staff.stringTuning.tunings].reverse().map(m => SHARP_NOTES[mod12(m)]),
      bars,
    };
    if (tag !== undefined) track.tag = tag;
    if (trackHeader.length > 0) track.header = trackHeader;
    // The instrument, from its tag or a `\track` line that names one.
    if (instrumentTag || (tag && /\binstrument\b/i.test(tag))) {
      track.instrument = { program: atTrack.playbackInfo.program };
      if (instrumentTag) track.instrument.tag = instrumentTag;
      // alphaTab reads a name it doesn't know as program 0, the piano, without a word.
      const value = instrumentTag?.replace(/^\\instrument\s*/i, '').replace(/["']/g, '').trim().toLowerCase();
      if (value !== undefined && track.instrument.program === 0 && value !== '0' && value !== 'acousticgrandpiano') {
        warn(`Frets doesn't know the instrument ${value}; it plays as Acoustic Grand Piano.`);
      }
    }
    if (hasTag(nodeOf(t, 0), 'capo') && staff.capo > 0) {
      track.capo = Math.min(MAX_CAPO, staff.capo);
      if (staff.capo > MAX_CAPO) warn(`Read capo ${staff.capo} as ${MAX_CAPO}, the highest Frets offers.`);
    }
    return track;
  });

  const clip: Clip = {
    name: score.title,
    time,
    masterBars: masterBars.length > 0 ? masterBars : [{}],
    tracks: masterBars.length > 0 ? tracks : tracks.map(track => ({ ...track, bars: [{ columns: [] }] })),
  };
  if (header.length > 0) clip.header = header;
  const trackStarts = score.tracks.map((_, t) => {
    const tag = nodeOf(t, 0).metaData.find(m => m.tag.tag.text.toLowerCase() === 'track');
    return tag?.start?.offset ?? Infinity;
  });
  for (const [t, fx] of fxOf(tree, trackStarts)) clip.tracks[t].fx = fx;
  if (layoutOk.has('systemslayout')) clip.systemsLayout = [...score.systemsLayout];
  if (layoutOk.has('defaultsystemslayout')) clip.defaultSystemsLayout = score.defaultSystemsLayout;
  if (hasTag(tree.bars[0], 'multibarrest')) clip.multiBarRests = true;

  if (kept.size > 0) {
    const list = [...kept].map(([k, n]) => `${k}${KEPT_NAMES[k] ? ` (${KEPT_NAMES[k]})` : ''}${n > 1 ? ` ×${n}` : ''}`);
    warnings.push(`Kept but not drawn yet: ${list.join(', ')}.`);
  }
  clip.tracks.forEach((_, t) => {
    const uneven = unevenMessage(partOf(clip, t));
    if (uneven) warnings.push(clip.tracks.length > 1 ? `${trackName(clip, t)}: ${uneven}` : uneven);
  });
  return { ok: true, clip, warnings };
}

/** Whether a bar of the tree carries the tag. */
function hasTag(bar: BarNode | undefined, tag: string): boolean {
  return !!bar?.metaData.some(m => m.tag.tag.text.toLowerCase() === tag);
}

/** A bar's columns: the tree's beats, one per beat alphaTab made (a beat written "*3" stands for three). */
function columnsOf(
  text: string, barNode: BarNode, atBar: AtBar | undefined, staff: AtStaff, at: AlphaTab,
  origins: Map<Note, AtNote>, kept: Map<string, number>, warn: (w: string) => void,
): Column[] {
  const beatNodes = barNode.beats.flatMap(n => Array<BeatNode>(n.beatMultiplierValue?.value ?? 1).fill(n));
  const atBeats = beatNodes.length === 0 ? [] : (atBar?.voices[0]?.beats ?? []);
  return atBeats.map((beat, i) => {
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
      // A whammy bar written with a note is the beat's, written back with the beat (`tb` after its length).
      const whammy = column.whammy || whammyOf(node?.beatEffects) ? null : whammyOf(noteNode?.noteEffects);
      if (whammy) column.whammy = whammy;
      const extra = keptEffects(text, noteNode?.noteEffects, whammy ? new Set([...NOTE_EFFECTS, 'tb']) : NOTE_EFFECTS, kept);
      if (extra.length > 0) n.extra = extra;
      column.notes[s] = n;
      origins.set(n, note);
    }
    const extra = keptEffects(text, node?.beatEffects, beatReads(beat, column, at, node), kept);
    if (extra.length > 0) column.extra = extra;
    return column;
  });
}

/**
 * The text with standard tuning written after its `\instrument` tag, or null when it has no
 * instrument tag or already has a tuning.
 */
function withGuitarTuning(tree: ScoreNode, text: string): string | null {
  const tags = tree.bars[0]?.metaData ?? [];
  const instrument = tags.find(m => m.tag.tag.text.toLowerCase() === 'instrument');
  if (!instrument?.end || tags.some(m => m.tag.tag.text.toLowerCase() === 'tuning')) return null;
  const at = stringIndex(text, instrument.end.offset);
  return `${text.slice(0, at)} ${STANDARD_TUNING_TEX}${text.slice(at)}`;
}

/** A comment as alphaTab's syntax tree keeps it, on the token it comes before or after. */
interface CommentNode { text: string; multiLine: boolean; start?: { offset: number } }

/**
 * Each track's FX, from its `// frets:fx` line (`fxLine.ts`), by track. A line belongs to the track
 * whose `\track` comes last before it, and a line before the second track's `\track` (or anywhere,
 * in a clip of one track) to the first; a track's first line counts if it has more. `trackStarts`
 * holds where each track's `\track` is (the first's is not needed). Other comments aren't kept.
 */
function fxOf(tree: unknown, trackStarts: number[]): Map<number, FxSettings> {
  const found = new Map<number, { at: number; fx: FxSettings }>();
  const trackAt = (at: number) => {
    let track = 0;
    trackStarts.forEach((start, t) => { if (t > 0 && start <= at) track = t; });
    return track;
  };
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
          if (!fx) continue;
          const at = comment.start?.offset ?? 0;
          const track = trackAt(at);
          const before = found.get(track);
          if (!before || at < before.at) found.set(track, { at, fx });
        }
      } else if (typeof value === 'object') stack.push(value);
    }
  }
  return new Map([...found].map(([track, { fx }]) => [track, fx]));
}

/** Reads alphaTex, loading alphaTab first. */
export async function readAlphaTex(text: string): Promise<ReadResult> {
  return readAlphaTexWith(await loadAlphaTab(), text);
}
