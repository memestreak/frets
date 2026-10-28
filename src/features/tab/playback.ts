/**
 * Plays a clip with alphaTab's synthesizer (`@coderline/alphatab`, loaded on first Play, as reading
 * alphaTex loads it) and the SONiVOX soundfont in `public/soundfont/`. The clip is written as
 * alphaTex, read back into alphaTab's score and turned into MIDI, so whatever alphaTab plays
 * (bends, slides, repeats, tempo changes) sounds as written. alphaTab's own player needs its
 * renderer; this file uses the synthesizer alone, on the main thread, with a small Web Audio output.
 * See docs/specs/2026-10-26-tab-playback-design.md.
 */
import type * as AlphaTabModule from '@coderline/alphatab';
import { writeAlphaTex } from './alphatex';
import { loadAlphaTab } from './alphatexRead';
import { STRING_COUNT, type Clip, type Note } from './clip';
import { indexOf, placeOf } from './editing';

type AlphaTab = typeof AlphaTabModule;
type Score = AlphaTabModule.model.Score;
type Beat = AlphaTabModule.model.Beat;
type TickLookup = AlphaTabModule.midi.MidiTickLookup;

/** Where the soundfont is served from. */
export const SOUNDFONT_URL = '/soundfont/sonivox.sf3';
/** The speeds the slider offers, as fractions of the clip's own tempo. */
export const MIN_SPEED = 0.25;
export const MAX_SPEED = 1.5;

/**
 * The sounds the footer offers, grouped by General MIDI family: every pitched sound the soundfont
 * has, by program number (Jeremy, 2026-10-26: "everything except for percussion", so the
 * Percussion family, 112 to 119, and the drum kits are left out; then "remove sound effects", 120
 * to 127, and "Synth effects as well", 96 to 103). Steel Guitar is alphaTex's default.
 */
export const SOUND_FAMILIES: readonly (readonly [string, readonly (readonly [number, string])[]])[] = [
  ['Piano', [[0, 'Acoustic Grand Piano'], [1, 'Bright Acoustic Piano'], [2, 'Electric Grand Piano'], [3, 'Honky-tonk Piano'], [4, 'Electric Piano 1'], [5, 'Electric Piano 2'], [6, 'Harpsichord'], [7, 'Clavinet']]],
  ['Chromatic percussion', [[8, 'Celesta'], [9, 'Glockenspiel'], [10, 'Music Box'], [11, 'Vibraphone'], [12, 'Marimba'], [13, 'Xylophone'], [14, 'Tubular Bells'], [15, 'Dulcimer']]],
  ['Organ', [[16, 'Drawbar Organ'], [17, 'Percussive Organ'], [18, 'Rock Organ'], [19, 'Church Organ'], [20, 'Reed Organ'], [21, 'Accordion'], [22, 'Harmonica'], [23, 'Tango Accordion']]],
  ['Guitar', [[24, 'Nylon Guitar'], [25, 'Steel Guitar'], [26, 'Jazz Guitar'], [27, 'Clean Electric Guitar'], [28, 'Muted Electric Guitar'], [29, 'Overdriven Guitar'], [30, 'Distortion Guitar'], [31, 'Guitar Harmonics']]],
  ['Bass', [[32, 'Acoustic Bass'], [33, 'Fingered Bass'], [34, 'Picked Bass'], [35, 'Fretless Bass'], [36, 'Slap Bass 1'], [37, 'Slap Bass 2'], [38, 'Synth Bass 1'], [39, 'Synth Bass 2']]],
  ['Strings', [[40, 'Violin'], [41, 'Viola'], [42, 'Cello'], [43, 'Contrabass'], [44, 'Tremolo Strings'], [45, 'Pizzicato Strings'], [46, 'Orchestral Harp'], [47, 'Timpani']]],
  ['Ensemble', [[48, 'String Ensemble 1'], [49, 'String Ensemble 2'], [50, 'Synth Strings 1'], [51, 'Synth Strings 2'], [52, 'Choir Aahs'], [53, 'Voice Oohs'], [54, 'Synth Voice'], [55, 'Orchestra Hit']]],
  ['Brass', [[56, 'Trumpet'], [57, 'Trombone'], [58, 'Tuba'], [59, 'Muted Trumpet'], [60, 'French Horn'], [61, 'Brass Section'], [62, 'Synth Brass 1'], [63, 'Synth Brass 2']]],
  ['Reed', [[64, 'Soprano Sax'], [65, 'Alto Sax'], [66, 'Tenor Sax'], [67, 'Baritone Sax'], [68, 'Oboe'], [69, 'English Horn'], [70, 'Bassoon'], [71, 'Clarinet']]],
  ['Pipe', [[72, 'Piccolo'], [73, 'Flute'], [74, 'Recorder'], [75, 'Pan Flute'], [76, 'Blown Bottle'], [77, 'Shakuhachi'], [78, 'Whistle'], [79, 'Ocarina']]],
  ['Synth lead', [[80, 'Square Lead'], [81, 'Sawtooth Lead'], [82, 'Calliope Lead'], [83, 'Chiff Lead'], [84, 'Charang Lead'], [85, 'Voice Lead'], [86, 'Fifths Lead'], [87, 'Bass and Lead']]],
  ['Synth pad', [[88, 'New Age Pad'], [89, 'Warm Pad'], [90, 'Polysynth Pad'], [91, 'Choir Pad'], [92, 'Bowed Pad'], [93, 'Metallic Pad'], [94, 'Halo Pad'], [95, 'Sweep Pad']]],
  ['Ethnic', [[104, 'Sitar'], [105, 'Banjo'], [106, 'Shamisen'], [107, 'Koto'], [108, 'Kalimba'], [109, 'Bagpipe'], [110, 'Fiddle'], [111, 'Shanai']]],
];
/**
 * Sounds played from a soundfont of their own instead of SONiVOX's (issue #124; built by
 * `scripts/build-soundfonts.py`, `docs/specs/2026-10-27-tab-instruments-design.md`). Each is fetched the first
 * time its sound is picked and wins over SONiVOX's preset for that program. `level` brings it to about
 * SONiVOX's loudness, measured by rendering one passage with each.
 */
export const OWN_FONTS: readonly { program: number; url: string; level: number }[] = [
  // The Salamander Grand Piano: three velocity layers, 3.9 MB.
  { program: 0, url: '/soundfont/piano-salamander.sf3', level: 1.65 },
  // An acoustic guitar from the University of Iowa's instrument samples: a note per semitone, 1.5 MB.
  { program: 25, url: '/soundfont/guitar-iowa.sf3', level: 0.74 },
  // A clean electric guitar from Karoryfer Samples: a note every minor third or so, 0.55 MB.
  { program: 27, url: '/soundfont/guitar-electric-karoryfer.sf3', level: 0.79 },
];

export type Sound = number;
export const DEFAULT_SOUND: Sound = 25;
const SOUND_PROGRAMS = new Set(SOUND_FAMILIES.flatMap(([, sounds]) => sounds.map(([program]) => program)));

export function isSound(value: unknown): value is Sound {
  return typeof value === 'number' && SOUND_PROGRAMS.has(value);
}

/* — the clip as alphaTab's score and MIDI (no browser needed) — */

/** How long the last notes ring after the clip ends, in alphaTab's ticks: two quarter notes. */
const RING_OUT_TICKS = 2 * 960;

export interface Performance {
  score: Score;
  midi: AlphaTabModule.midi.MidiFile;
  lookup: TickLookup;
  /**
   * How far the MIDI is shifted from the score: grace notes before the clip's first beat start
   * before tick 0, so alphaTab moves the whole MIDI later by that much, but not its lookup. Every
   * tick here and in the player is the MIDI's (the synthesizer's); `lookup` alone takes the score's.
   */
  shift: number;
  /** The tick the clip ends on, repeats played. */
  endTick: number;
}

/** The clip as alphaTab's score and MIDI in a sound, with the lookup from a tick to the beat sounding then. */
export function perform(at: AlphaTab, clip: Clip, sound: Sound = DEFAULT_SOUND): Performance {
  const settings = new at.Settings();
  const importer = new at.importer.AlphaTexImporter();
  importer.logErrors = false;
  importer.initFromString(writeAlphaTex(clip), settings);
  const score = importer.readScore();
  // The chosen sound, whatever instrument the clip's alphaTex names: the track's own program, and
  // the instrument change alphaTab's reader puts on the first beat.
  for (const track of score.tracks) {
    track.playbackInfo.program = sound;
    for (const staff of track.staves) for (const bar of staff.bars) for (const voice of bar.voices) for (const beat of voice.beats) {
      for (const automation of beat.automations) {
        if (automation.type === at.model.AutomationType.Instrument) automation.value = sound;
      }
    }
  }
  const midi = new at.midi.MidiFile();
  const generator = new at.midi.MidiFileGenerator(score, settings, new at.midi.AlphaSynthMidiFileHandler(midi, true));
  generator.generate();
  const masterBars = generator.tickLookup.masterBars;
  const shift = midi.tickShift;
  const endTick = (masterBars.length > 0 ? masterBars[masterBars.length - 1].end : 0) + shift;
  // The synthesizer stops dead at the MIDI's last event, cutting the last note off with a click
  // (Jeremy, 2026-10-26: "a glitch at the end of playback"). An event a little later lets it ring.
  midi.addEvent(new at.midi.EndOfTrackEvent(0, endTick + RING_OUT_TICKS));
  const performance = { score, midi, lookup: generator.tickLookup, shift, endTick };
  keepSlidPitch(at, clip, performance);
  return performance;
}

/**
 * The clip's MIDI stopping at a tick, as it stops at its own end: nothing starts from that tick
 * on, and the notes already sounding ring out as the last ones do (Jeremy, 2026-10-28: stopping at
 * a region's end cut its last note off). The synthesizer stops dead at a playback range's end, so
 * the stop is in the MIDI instead.
 */
export function midiUntil(at: AlphaTab, performance: Performance, end: number): AlphaTabModule.midi.MidiFile {
  const midi = new at.midi.MidiFile();
  midi.format = performance.midi.format;
  midi.division = performance.midi.division;
  midi.tickShift = performance.midi.tickShift;
  for (const event of performance.midi.events) {
    if (event instanceof at.midi.EndOfTrackEvent) continue;
    // Note-offs of the notes sounding at the end still end them while they ring.
    if (event.tick < end || (event instanceof at.midi.NoteOffEvent && event.tick <= end + RING_OUT_TICKS)) midi.addEvent(event);
  }
  midi.addEvent(new at.midi.EndOfTrackEvent(0, end + RING_OUT_TICKS));
  return midi;
}

/** alphaTab's pitch-bend range: 16 semitones either way of 8192 (the RPN it sends at the start). */
const BEND_PER_SEMITONE = 8192 / 16;

/**
 * A legato slide reaches its note by bending the note it left, and alphaTab's vibrato on the note
 * reached (and the notes tied to it) then wobbles round the unbent pitch: the slide's 12 sounded as
 * its 14 (Jeremy, 2026-10-28). Those pitch bends are moved by the slide, so the note keeps its pitch.
 */
function keepSlidPitch(at: AlphaTab, clip: Clip, performance: Performance) {
  const spans: { start: number; end: number; by: number }[] = [];
  const last: (Note | null)[] = Array(STRING_COUNT).fill(null);
  // Each string's slide still sounding: the span it covers so far.
  const open: ({ start: number; end: number; by: number } | null)[] = Array(STRING_COUNT).fill(null);
  let index = 0;
  for (const bar of clip.bars) {
    for (const column of bar.columns) {
      const start = tickOf(clip, performance, index);
      const beat = beatOf(performance, clip, index);
      const end = start + (beat?.playbackDuration ?? 0);
      column.notes.forEach((note, s) => {
        if (!note) return;
        const before = last[s];
        last[s] = note;
        if (note.tie && open[s]) {
          open[s]!.end = end;
          return;
        }
        open[s] = null;
        if (note.slide !== 'legato' || before?.fret == null || note.fret === null || note.fret === before.fret) return;
        const span = { start, end, by: (note.fret - before.fret) * BEND_PER_SEMITONE };
        spans.push(span);
        open[s] = span;
      });
      index++;
    }
  }
  if (spans.length === 0) return;
  for (const event of performance.midi.events) {
    if (event.type !== at.midi.MidiEventType.PitchBend) continue;
    const bend = event as AlphaTabModule.midi.PitchBendEvent;
    const span = spans.find(sp => bend.tick >= sp.start && bend.tick < sp.end);
    // The slide's own last step already stands at the note reached.
    if (!span || bend.value === 8192 + span.by) continue;
    bend.value = Math.max(0, Math.min(16383, bend.value + span.by));
  }
}

/** How long a column heard on its own sounds: a quarter note at 120 bpm, before it rings out. */
const HEARD_BPM = 120;

/**
 * A clip of one note, to hear it alone (Jeremy, 2026-10-27: "just play the note added"): the note on a
 * string of a column as a plain picked note (no tie, slide or bend, which need the notes round it),
 * with the clip's tuning and capo. Null where there is no note.
 */
export function noteAlone(clip: Clip, bar: number, column: number, string: number): Clip | null {
  const placed = clip.bars[bar]?.columns[column];
  if (!placed?.notes[string]) return null;
  const note = placed.notes[string]!;
  const notes = placed.notes.map((_, s) => s !== string ? null : {
    fret: note.fret,
    ...(note.harmonic && { harmonic: note.harmonic }),
    ...(note.palmMute && { palmMute: true }),
    ...(note.ghost && { ghost: true }),
  });
  return {
    ...clip,
    // A bar of one beat, so the MIDI ends with the note rather than after a bar's silence.
    time: { beats: 1, value: 4 },
    bars: [{ columns: [{ duration: { value: 4, dots: 0 }, notes }], tempo: { bpm: HEARD_BPM } }],
  };
}

/** The clip's column a beat of the score is, by its place in the whole clip; null for a beat Frets has no column for (an empty bar's). */
export function columnOfBeat(clip: Clip, beat: Beat): number | null {
  const bar = beat.voice.bar.index;
  if (bar >= clip.bars.length || beat.index >= clip.bars[bar].columns.length) return null;
  return indexOf(clip, bar, beat.index);
}

/** The column sounding at a tick, or null. */
export function columnAtTick(clip: Clip, performance: Performance, tick: number): number | null {
  const found = performance.lookup.findBeat(new Set([0]), tick - performance.shift);
  return found ? columnOfBeat(clip, found.beat) : null;
}

/** The score's beat for a column of the clip. */
function beatOf(performance: Performance, clip: Clip, index: number): Beat | null {
  const { bar, column } = placeOf(clip, index);
  return performance.score.tracks[0]?.staves[0]?.bars[bar]?.voices[0]?.beats[column] ?? null;
}

/** The ticks from the start of one column to the end of another, the first time each is played. */
export function ticksOf(clip: Clip, performance: Performance, [from, to]: [number, number]): { startTick: number; endTick: number } | null {
  const first = beatOf(performance, clip, from);
  const last = beatOf(performance, clip, to);
  if (!first || !last) return null;
  const startTick = performance.lookup.getBeatStart(first) + performance.shift;
  const endTick = performance.lookup.getBeatStart(last) + last.playbackDuration + performance.shift;
  return endTick > startTick ? { startTick, endTick } : null;
}

/** The tick a column first starts on. */
export function tickOf(clip: Clip, performance: Performance, index: number): number {
  const beat = beatOf(performance, clip, index);
  return (beat ? performance.lookup.getBeatStart(beat) : 0) + performance.shift;
}

/* — sound: a Web Audio output for the synthesizer — */

/** A list of listeners, as alphaTab's outputs report events. */
class Emitter<T = void> {
  private listeners: ((arg: T) => void)[] = [];
  on(listener: (arg: T) => void) {
    this.listeners.push(listener);
    return () => this.off(listener);
  }
  off(listener: (arg: T) => void) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }
  trigger(arg: T) {
    for (const listener of this.listeners) listener(arg);
  }
}

/** Samples per channel the audio node asks for at a time. */
const NODE_SIZE = 4096;
/** About how many samples (both channels) one answer from the synthesizer holds. */
const ANSWER_SIZE = 4096;
/** How long the end of playback fades, so it doesn't click. */
const FADE_SECONDS = 0.03;
/** How long Stop fades the sound out (Jeremy, 2026-10-27: "the notes stop with a glitch"). */
const STOP_FADE_SECONDS = 0.06;

/** Interleaved stereo samples waiting to be played. */
class SampleQueue {
  chunks: Float32Array[] = [];
  /** How many samples (both channels) are queued. */
  size = 0;
  push(samples: Float32Array) {
    this.chunks.push(samples);
    this.size += samples.length;
  }
  /** Moves queued samples into the two channels from their start; returns how many frames it filled. */
  drainInto(left: Float32Array, right: Float32Array): number {
    let i = 0;
    while (i < left.length && this.chunks.length > 0) {
      const chunk = this.chunks[0];
      let s = 0;
      while (i < left.length && s + 1 < chunk.length) {
        left[i] = chunk[s];
        right[i] = chunk[s + 1];
        i++;
        s += 2;
      }
      this.size -= s;
      if (s >= chunk.length - 1) this.chunks.shift();
      else this.chunks[0] = chunk.subarray(s);
    }
    left.fill(0, i);
    right.fill(0, i);
    return i;
  }
}

/**
 * The synthesizer's samples played through a ScriptProcessorNode (alphaTab's own fallback; an
 * AudioWorklet would need a script of its own served beside the page). The synthesizer fills a
 * queue of interleaved stereo samples; the node drains it and asks for more when it runs low.
 */
class WebAudioOutput implements AlphaTabModule.synth.ISynthOutput {
  readonly ready = new Emitter();
  readonly samplesPlayed = new Emitter<number>();
  readonly sampleRequest = new Emitter();
  private context: AudioContext | null = null;
  private node: ScriptProcessorNode | null = null;
  /** Between the node and the speakers, so Stop can fade the sound out. */
  private gain: GainNode | null = null;
  private samples = new SampleQueue();
  /** Requests made and not yet answered by `addSamples`. */
  private pending = 0;
  /** How many samples (both channels) to keep ready. */
  private target = 0;
  /** Whether the last answer held no samples: the clip has ended. */
  private answeredEmpty = false;

  get sampleRate() {
    return this.context?.sampleRate ?? 44100;
  }
  open(bufferTimeInMilliseconds: number) {
    this.context = new AudioContext();
    this.target = Math.max(NODE_SIZE * 2, Math.floor((bufferTimeInMilliseconds * this.sampleRate) / 1000)) * 2;
    this.ready.trigger();
  }
  activate() {
    if (this.context?.state === 'suspended') void this.context.resume();
  }
  play() {
    const context = this.context;
    if (!context) return;
    this.activate();
    this.resetSamples();
    const node = context.createScriptProcessor(NODE_SIZE, 0, 2);
    const gain = context.createGain();
    node.onaudioprocess = e => this.fill(e.outputBuffer);
    node.connect(gain).connect(context.destination);
    this.node = node;
    this.gain = gain;
    this.request();
  }
  /**
   * Stops asking for samples. Cut off at once the sound would click, so the node plays on a moment
   * from what was queued, alone, while its gain fades to nothing; then it is disconnected.
   */
  pause() {
    const { context, node, gain } = this;
    this.node = null;
    this.gain = null;
    if (!node || !gain) return;
    if (!context || context.state !== 'running') {
      node.onaudioprocess = null;
      node.disconnect();
      return;
    }
    const tail = this.samples;
    this.samples = new SampleQueue();
    node.onaudioprocess = e => tail.drainInto(e.outputBuffer.getChannelData(0), e.outputBuffer.getChannelData(1));
    const now = context.currentTime;
    gain.gain.setValueAtTime(1, now);
    gain.gain.linearRampToValueAtTime(0, now + STOP_FADE_SECONDS);
    // Long enough for the fade to reach the speakers through the node's own buffer.
    setTimeout(() => {
      node.onaudioprocess = null;
      node.disconnect();
      gain.disconnect();
    }, (STOP_FADE_SECONDS + (2 * NODE_SIZE) / context.sampleRate) * 1000);
  }
  destroy() {
    this.pause();
    void this.context?.close();
    this.context = null;
  }
  addSamples(samples: Float32Array) {
    this.pending = Math.max(0, this.pending - 1);
    // The synthesizer has stopped: fade what is left to nothing, so it ends without a click.
    if (samples.length === 0 && !this.answeredEmpty) this.fadeQueueOut();
    this.answeredEmpty = samples.length === 0;
    if (samples.length > 0) this.samples.push(samples);
  }
  resetSamples() {
    this.samples = new SampleQueue();
    this.pending = 0;
  }
  enumerateOutputDevices() {
    return Promise.resolve([]);
  }
  setOutputDevice() {
    return Promise.resolve();
  }
  getOutputDevice() {
    return Promise.resolve(null);
  }

  /**
   * Asks the synthesizer for samples until enough are queued or asked for. It answers at once, on
   * this thread, and with nothing once the clip has ended; then asking stops until the next fill.
   */
  private request() {
    while (this.samples.size + this.pending * ANSWER_SIZE < this.target) {
      this.pending++;
      this.answeredEmpty = false;
      this.sampleRequest.trigger();
      if (this.answeredEmpty) return;
    }
  }

  /** Fades the last few milliseconds queued down to silence. */
  private fadeQueueOut() {
    let left = Math.floor(FADE_SECONDS * this.sampleRate) * 2;
    const total = left;
    const chunks = this.samples.chunks;
    for (let c = chunks.length - 1; c >= 0 && left > 0; c--) {
      // Copied: the synthesizer may reuse the array it handed over.
      const chunk = chunks[c].slice();
      for (let i = chunk.length - 1; i >= 0 && left > 0; i--, left--) {
        // Interleaved stereo: both samples of a frame get the same gain.
        const frameFromEnd = Math.floor((total - left) / 2);
        chunk[i] *= frameFromEnd / (total / 2);
      }
      chunks[c] = chunk;
    }
  }

  private fill(buffer: AudioBuffer) {
    const frames = this.samples.drainInto(buffer.getChannelData(0), buffer.getChannelData(1));
    this.samplesPlayed.trigger(frames);
    this.request();
  }
}

/* — the player — */

/** General MIDI's percussion channel, which a transposition leaves alone. */
const DRUM_CHANNEL = 9;

export type PlayerState = 'idle' | 'loading' | 'playing' | 'error';

/** What the page shows while a clip plays. */
export interface PlayerView {
  state: PlayerState;
  /** The column sounding, by its place in the clip; null when nothing is. */
  column: number | null;
}

/**
 * Sets the synthesizer's loop points without moving the playhead. alphaTab's own `playbackRange`
 * setter jumps to the range's start, so a Play from before the loop could never reach it; its
 * sequencer (not in alphaTab's types; checked against the pinned 1.8.4) takes the range as is, and
 * the synthesizer goes back to the start when the playhead passes the end.
 */
function rangeWithoutSeek(synth: AlphaTabModule.synth.AlphaSynth, range: AlphaTabModule.synth.PlaybackRange | null) {
  (synth as unknown as { sequencer: { mainPlaybackRange: AlphaTabModule.synth.PlaybackRange | null } }).sequencer.mainPlaybackRange = range;
}

/**
 * alphaTab's synthesizer with the soundfont loaded and one clip's MIDI. Created on the first Play,
 * since an AudioContext may only start after a press.
 */
export class TabPlayer {
  private performance: Performance | null = null;
  private clip: Clip | null = null;
  private sound: Sound = DEFAULT_SOUND;
  private volume = 1;
  /** The sounds' own soundfonts loaded so far, by URL. */
  private readonly fonts = new Set<string>();
  private loop: [number, number] | 'whole' | null = null;
  /**
   * The last column to play when no loop holds the playhead: "Stop playback at region end" with a
   * region selected (Jeremy, 2026-10-28). Null plays on to the clip's end.
   */
  private until: number | null = null;
  /** The MIDI in the synthesizer: the clip's (`end` null), or the clip's stopping at `end` (see `midiUntil`). */
  private loaded: { end: number | null } | null = null;
  /**
   * Whether the clip has stopped (Stop, an edit or the end) since the last Play. The
   * synthesizer still reports positions for a moment after; they must not bring the playhead back.
   */
  private ended = true;
  /** Whether the loop points are ahead of the playhead, so playing past the end one goes back to the start one. */
  private looping = false;
  /** The loop's ticks while `looping`. */
  private range: { startTick: number; endTick: number } | null = null;
  /**
   * The rest between the loop's end and its start again, in seconds (Jeremy, 2026-10-27); 0 loops
   * straight round, as alphaTab's own looping does. With a rest, the clip plays to the loop's end and
   * stops (its notes dying away as at the clip's end), and starts again from the loop's start after it.
   */
  private loopPause = 0;
  /** When the playhead reached the loop's end, so the rest counts from there; and the rest's timer. */
  private loopEndAt: number | null = null;
  private resting: ReturnType<typeof setTimeout> | null = null;

  private constructor(
    private readonly at: AlphaTab,
    private readonly synth: AlphaTabModule.synth.AlphaSynth,
    private readonly onView: (view: Partial<PlayerView>) => void,
  ) {
    synth.positionChanged.on(e => {
      if (!this.clip || !this.performance || this.ended) return;
      if (this.looping && this.range && e.currentTick >= this.range.endTick) this.loopEndAt ??= performance.now();
      // While the last notes ring out, the playhead stays on the last column.
      if (e.currentTick >= (this.loaded?.end ?? this.performance.endTick)) return;
      onView({ column: columnAtTick(this.clip, this.performance, e.currentTick) });
    });
    synth.finished.on(() => {
      if (synth.isLooping) return;
      if (this.looping && !this.ended) {
        this.rest();
        return;
      }
      this.ended = true;
      onView({ state: 'idle', column: null });
    });
  }

  /** Loads alphaTab and the soundfont; the view hears every change. */
  static async create(onView: (view: Partial<PlayerView>) => void): Promise<TabPlayer> {
    const at = await loadAlphaTab();
    const response = await fetch(SOUNDFONT_URL);
    if (!response.ok) throw new Error(`the soundfont didn't load (${response.status})`);
    const soundfont = new Uint8Array(await response.arrayBuffer());
    const synth = new at.synth.AlphaSynth(new WebAudioOutput(), 500);
    synth.loadSoundFont(soundfont, false);
    return new TabPlayer(at, synth, onView);
  }

  /**
   * Plays the clip from a column.
   * With loop points, playing past the end one goes back to the start one; a start before them
   * plays up to them first, and a start after them plays on to the end. `whole` loops the whole clip.
   * With no loop ahead, `until` (a column) is where playback stops: at the end of that column's note.
   */
  async play(clip: Clip, from: number, loop: [number, number] | 'whole' | null, speed: number, sound: Sound, until: number | null = null) {
    await this.loadFont(sound);
    this.endRest();
    if (clip !== this.clip || sound !== this.sound || !this.performance) {
      this.clip = clip;
      this.sound = sound;
      this.setVolume(this.volume);
      this.performance = perform(this.at, clip, sound);
      this.load(this.performance.midi, null);
    }
    this.setSpeed(speed);
    this.moveTo(tickOf(clip, this.performance, from));
    this.until = until;
    this.setLoop(loop);
    this.ended = false;
    this.synth.play();
    this.onView({ state: 'playing', column: from });
  }

  /** Stops, keeping the clip ready for the next Play; the view hears the state go idle and the playhead go. */
  halt() {
    this.ended = true;
    this.endRest();
    this.synth.pause();
    this.onView({ state: 'idle', column: null });
  }

  /** Stops and forgets the clip, as after an edit. */
  stop() {
    this.ended = true;
    this.endRest();
    this.synth.stop();
    this.clip = null;
    this.performance = null;
    this.onView({ state: 'idle', column: null });
  }

  /**
   * Sets the loop points: these columns, or the whole clip; null plays once. Only a loop still
   * ahead of the playhead (or round it) takes effect, so the playhead never jumps back to it.
   */
  setLoop(loop: [number, number] | 'whole' | null) {
    this.loop = loop;
    // The whole clip loops without its ring-out, so the downbeat comes round on time.
    const range = !this.clip || !this.performance || loop === null ? null
      : loop === 'whole' ? { startTick: 0, endTick: this.performance.endTick }
      : ticksOf(this.clip, this.performance, loop);
    let ahead = range !== null && this.synth.tickPosition < range.endTick;
    // Loop points dragged back behind the playhead while it loops: it goes round to their start.
    if (range !== null && !ahead && this.looping && !this.ended) {
      this.moveTo(range.startTick);
      ahead = true;
    }
    this.looping = ahead;
    this.range = ahead ? range : null;
    this.synth.isLooping = ahead && this.loopPause === 0;
    if (ahead && range) {
      this.useMidi(null);
      const playbackRange = new this.at.synth.PlaybackRange();
      playbackRange.startTick = range.startTick;
      playbackRange.endTick = range.endTick;
      rangeWithoutSeek(this.synth, playbackRange);
    } else {
      // With no loop, the region's end (when the playhead is before it) stops playback there, as the
      // clip's end does.
      const end = this.until === null || !this.clip || !this.performance ? null
        : ticksOf(this.clip, this.performance, [this.until, this.until])?.endTick ?? null;
      this.useMidi(end !== null && this.synth.tickPosition < end ? end : null);
      rangeWithoutSeek(this.synth, null);
    }
  }

  /** Puts a MIDI file in the synthesizer: the clip's, or the clip's stopping at `end`. */
  private load(midi: AlphaTabModule.midi.MidiFile, end: number | null) {
    this.synth.loadMidiFile(midi);
    this.loaded = { end };
  }

  /**
   * Swaps in the clip's MIDI stopping at a tick, or the whole clip's for null, unless it is in already.
   * The playhead stays where it is, and a clip playing plays on.
   */
  private useMidi(end: number | null) {
    if (!this.performance || this.loaded?.end === end) return;
    const playing = !this.ended && this.resting === null;
    const tick = this.synth.tickPosition;
    this.load(end === null ? this.performance.midi : midiUntil(this.at, this.performance, end), end);
    this.moveTo(tick);
    if (playing) this.synth.play();
  }

  /** The rest between loops, in seconds; 0 loops straight round. */
  setLoopPause(seconds: number) {
    this.loopPause = seconds;
    this.synth.isLooping = this.looping && seconds === 0;
  }

  /**
   * The playhead reached the loop's end and the notes have died away: the clip waits out what is left
   * of the rest, counted from the loop's end, then plays from the loop's start again. The view stays
   * playing meanwhile, so Stop ends the rest.
   */
  private rest() {
    const since = this.loopEndAt === null ? 0 : performance.now() - this.loopEndAt;
    this.endRest();
    this.resting = setTimeout(() => {
      this.resting = null;
      this.loopEndAt = null;
      if (this.ended || !this.range) return;
      this.moveTo(this.range.startTick);
      this.setLoop(this.loop);
      this.synth.play();
    }, Math.max(0, this.loopPause * 1000 - since));
  }

  private endRest() {
    if (this.resting !== null) clearTimeout(this.resting);
    this.resting = null;
    this.loopEndAt = null;
  }

  /** Puts the playhead on a tick, with no loop points to hold it in. */
  private moveTo(tick: number) {
    rangeWithoutSeek(this.synth, null);
    this.synth.tickPosition = tick;
  }

  setSpeed(speed: number) {
    this.synth.playbackSpeed = speed;
  }

  /**
   * Moves everything heard by some semitones (Jeremy, 2026-10-27), notes already sounding too: the
   * synthesizer's own transposition, on every channel but General MIDI's drums.
   */
  setTranspose(semitones: number) {
    const pitches = new Map<number, number>();
    if (semitones !== 0) for (let channel = 0; channel < 16; channel++) if (channel !== DRUM_CHANNEL) pitches.set(channel, semitones);
    this.synth.applyTranspositionPitches(pitches);
  }

  /** The loudness, 0 (silent) to 1 (the soundfont's own level). */
  setVolume(volume: number) {
    this.volume = volume;
    this.synth.masterVolume = volume * (OWN_FONTS.find(f => f.program === this.sound)?.level ?? 1);
  }

  /**
   * Fetches and loads a sound's own soundfont the first time it is wanted, alongside SONiVOX's. The
   * view shows Loading meanwhile; loading pauses the synthesizer.
   */
  private async loadFont(sound: Sound): Promise<boolean> {
    const font = OWN_FONTS.find(f => f.program === sound);
    if (!font || this.fonts.has(font.url)) return false;
    this.onView({ state: 'loading' });
    const response = await fetch(font.url);
    if (!response.ok) {
      this.onView({ state: 'error' });
      throw new Error(`the sound didn't load (${response.status})`);
    }
    this.synth.loadSoundFont(new Uint8Array(await response.arrayBuffer()), true);
    this.fonts.add(font.url);
    return true;
  }

  /** Changes the sound; a clip playing goes on from where it is, in the new sound. */
  async setSound(sound: Sound) {
    if (sound === this.sound) return;
    // Resting between loops counts as stopped here: the rest starts the loop again itself.
    const playing = !this.ended && this.resting === null;
    const tick = this.synth.tickPosition;
    const loaded = await this.loadFont(sound);
    this.sound = sound;
    this.setVolume(this.volume);
    if (!this.clip || !this.performance) {
      if (loaded) this.onView({ state: 'idle' });
      return;
    }
    this.performance = perform(this.at, this.clip, sound);
    this.load(this.performance.midi, null);
    this.moveTo(tick);
    this.setLoop(this.loop);
    if (playing) this.synth.play();
    if (loaded) this.onView({ state: playing ? 'playing' : 'idle' });
  }

  /**
   * Sounds one note of a clip on its own, as it is entered (Jeremy, 2026-10-27): for a quarter note at
   * 120 bpm, then ringing out. Not while the clip plays. The note is loaded as the
   * synthesizer's MIDI in place of the clip's (alphaTab's one-time MIDI files play no notes here), so
   * the next Play loads the clip again.
   */
  async hear(clip: Clip, bar: number, column: number, string: number, sound: Sound) {
    if (!this.ended) return;
    const alone = noteAlone(clip, bar, column, string);
    if (!alone) return;
    // A sound's own soundfont shows Loading on Play while it loads; heard, it goes back to Play.
    if (await this.loadFont(sound)) this.onView({ state: 'idle' });
    if (!this.ended) return;
    // A note still sounding fades out (the output's own fade) before this one starts.
    this.synth.stop();
    this.sound = sound;
    this.clip = null;
    this.performance = null;
    this.setVolume(this.volume);
    this.load(perform(this.at, alone, sound).midi, null);
    this.synth.playbackSpeed = 1;
    this.synth.isLooping = false;
    this.moveTo(0);
    this.synth.play();
  }

  /** Moves the playing clip to a column (its first time through); the loop points hold as from a Play there. */
  seek(index: number) {
    if (!this.clip || !this.performance) return;
    const resting = this.resting !== null;
    this.endRest();
    this.moveTo(tickOf(this.clip, this.performance, index));
    this.setLoop(this.loop);
    if (resting) this.synth.play();
  }

  destroy() {
    this.endRest();
    this.synth.destroy();
  }
}
