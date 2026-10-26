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
import { ticks, type Clip } from './clip';
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
export type Sound = number;
export const DEFAULT_SOUND: Sound = 25;
const SOUND_PROGRAMS = new Set(SOUND_FAMILIES.flatMap(([, sounds]) => sounds.map(([program]) => program)));

export function isSound(value: unknown): value is Sound {
  return typeof value === 'number' && SOUND_PROGRAMS.has(value);
}

/* — the clip as alphaTab's score and MIDI (no browser needed) — */

export interface Performance {
  score: Score;
  midi: AlphaTabModule.midi.MidiFile;
  lookup: TickLookup;
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
  return { score, midi, lookup: generator.tickLookup, endTick: masterBars.length > 0 ? masterBars[masterBars.length - 1].end : 0 };
}

/** The clip's column a beat of the score is, by its place in the whole clip; null for a beat Frets has no column for (an empty bar's). */
export function columnOfBeat(clip: Clip, beat: Beat): number | null {
  const bar = beat.voice.bar.index;
  if (bar >= clip.bars.length || beat.index >= clip.bars[bar].columns.length) return null;
  return indexOf(clip, bar, beat.index);
}

/** The column sounding at a tick, or null. */
export function columnAtTick(clip: Clip, performance: Performance, tick: number): number | null {
  const found = performance.lookup.findBeat(new Set([0]), tick);
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
  const startTick = performance.lookup.getBeatStart(first);
  const endTick = performance.lookup.getBeatStart(last) + last.playbackDuration;
  return endTick > startTick ? { startTick, endTick } : null;
}

/** The tick a column first starts on. */
export function tickOf(clip: Clip, performance: Performance, index: number): number {
  const beat = beatOf(performance, clip, index);
  return beat ? performance.lookup.getBeatStart(beat) : 0;
}

/**
 * Where each column and bar starts in the clip as written, in ticks, repeats not played twice: the
 * progress line under the tab is the clip, so a repeat goes back along it as the playhead does.
 */
export function timeline(clip: Clip): { columns: number[]; bars: number[]; total: number } {
  const columns: number[] = [];
  const bars: number[] = [];
  let at = 0;
  for (const bar of clip.bars) {
    bars.push(at);
    for (const column of bar.columns) {
      columns.push(at);
      if (!column.grace) at += ticks(column.duration);
    }
  }
  return { columns, bars, total: at };
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
  /** Interleaved stereo samples waiting to be played. */
  private queue: Float32Array[] = [];
  private queued = 0;
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
    node.onaudioprocess = e => this.fill(e.outputBuffer);
    node.connect(context.destination);
    this.node = node;
    this.request();
  }
  pause() {
    if (this.node) {
      this.node.onaudioprocess = null;
      this.node.disconnect();
    }
    this.node = null;
  }
  destroy() {
    this.pause();
    void this.context?.close();
    this.context = null;
  }
  addSamples(samples: Float32Array) {
    this.pending = Math.max(0, this.pending - 1);
    this.answeredEmpty = samples.length === 0;
    if (samples.length > 0) {
      this.queue.push(samples);
      this.queued += samples.length;
    }
  }
  resetSamples() {
    this.queue = [];
    this.queued = 0;
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
    while (this.queued + this.pending * ANSWER_SIZE < this.target) {
      this.pending++;
      this.answeredEmpty = false;
      this.sampleRequest.trigger();
      if (this.answeredEmpty) return;
    }
  }

  private fill(buffer: AudioBuffer) {
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    let i = 0;
    while (i < left.length && this.queue.length > 0) {
      const chunk = this.queue[0];
      let s = 0;
      while (i < left.length && s + 1 < chunk.length) {
        left[i] = chunk[s];
        right[i] = chunk[s + 1];
        i++;
        s += 2;
      }
      this.queued -= s;
      if (s >= chunk.length - 1) this.queue.shift();
      else this.queue[0] = chunk.subarray(s);
    }
    left.fill(0, i);
    right.fill(0, i);
    this.samplesPlayed.trigger(i);
    this.request();
  }
}

/* — the player — */

export type PlayerState = 'idle' | 'loading' | 'playing' | 'error';

/** What the page shows while a clip plays. */
export interface PlayerView {
  state: PlayerState;
  /** The column sounding, by its place in the clip; null when nothing is. */
  column: number | null;
}

/**
 * alphaTab's synthesizer with the soundfont loaded and one clip's MIDI. Created on the first Play,
 * since an AudioContext may only start after a press.
 */
export class TabPlayer {
  private performance: Performance | null = null;
  private clip: Clip | null = null;
  private sound: Sound = DEFAULT_SOUND;
  private loop: [number, number] | 'whole' | null = null;
  /**
   * Whether the clip has stopped (paused, edited or played to its end) since the last Play. The
   * synthesizer still reports positions for a moment after; they must not bring the playhead back.
   */
  private ended = true;

  private constructor(
    private readonly at: AlphaTab,
    private readonly synth: AlphaTabModule.synth.AlphaSynth,
    private readonly onView: (view: Partial<PlayerView>) => void,
  ) {
    synth.positionChanged.on(e => {
      if (!this.clip || !this.performance || this.ended) return;
      onView({ column: columnAtTick(this.clip, this.performance, e.currentTick) });
    });
    synth.finished.on(() => {
      if (synth.isLooping) return;
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
   * Plays the clip from a column (a pause leaves the cursor where it stopped, so Play resumes). With
   * a loop of some columns, from the column when it is in the loop, else from the loop's start.
   * `loop` repeats those columns, or with `whole` the whole clip; null plays once.
   */
  play(clip: Clip, from: number, loop: [number, number] | 'whole' | null, speed: number, sound: Sound) {
    if (clip !== this.clip || sound !== this.sound || !this.performance) {
      this.clip = clip;
      this.sound = sound;
      this.performance = perform(this.at, clip, sound);
      this.synth.loadMidiFile(this.performance.midi);
    }
    this.setLoop(loop);
    this.setSpeed(speed);
    const start = Array.isArray(loop) && (from < loop[0] || from > loop[1]) ? loop[0] : from;
    this.synth.tickPosition = tickOf(clip, this.performance, start);
    this.ended = false;
    this.synth.play();
    this.onView({ state: 'playing', column: start });
  }

  /** Stops where it is; the view hears the state go idle and the playhead go. */
  pause() {
    this.ended = true;
    this.synth.pause();
    this.onView({ state: 'idle', column: null });
  }

  /** Stops and forgets the clip, as after an edit. */
  stop() {
    this.ended = true;
    this.synth.stop();
    this.clip = null;
    this.performance = null;
    this.onView({ state: 'idle', column: null });
  }

  /** Repeats these columns, or the whole clip; null plays once. */
  setLoop(loop: [number, number] | 'whole' | null) {
    this.loop = loop;
    this.synth.isLooping = loop !== null;
    const range = this.clip && this.performance && Array.isArray(loop) ? ticksOf(this.clip, this.performance, loop) : null;
    if (range) {
      const playbackRange = new this.at.synth.PlaybackRange();
      playbackRange.startTick = range.startTick;
      playbackRange.endTick = range.endTick;
      this.synth.playbackRange = playbackRange;
    } else {
      this.synth.playbackRange = null;
    }
  }

  setSpeed(speed: number) {
    this.synth.playbackSpeed = speed;
  }

  /** Changes the sound; a clip playing goes on from where it is, in the new sound. */
  setSound(sound: Sound) {
    if (sound === this.sound) return;
    this.sound = sound;
    if (!this.clip || !this.performance) return;
    const playing = !this.ended;
    const tick = this.synth.tickPosition;
    this.performance = perform(this.at, this.clip, sound);
    this.synth.loadMidiFile(this.performance.midi);
    this.setLoop(this.loop);
    this.synth.tickPosition = tick;
    if (playing) this.synth.play();
  }

  /** Moves the playing clip to a column (its first time through). */
  seek(index: number) {
    if (!this.clip || !this.performance) return;
    this.synth.tickPosition = tickOf(this.clip, this.performance, index);
  }

  destroy() {
    this.synth.destroy();
  }
}
