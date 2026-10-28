/**
 * Plays a clip with alphaTab's synthesizer (`@coderline/alphatab`, loaded on first Play, as reading
 * alphaTex loads it) and the SONiVOX soundfont in `public/soundfont/`. The clip is written as
 * alphaTex, read back into alphaTab's score and turned into MIDI, so whatever alphaTab plays
 * (bends, slides, repeats, tempo changes) sounds as written. alphaTab's own player needs its
 * renderer; this file uses the synthesizer alone, on the main thread, with a small Web Audio output
 * (`audioOutput.ts`).
 * See docs/specs/2026-10-26-tab-playback-design.md.
 */
import type * as AlphaTabModule from '@coderline/alphatab';
import { writeAlphaTex } from './alphatex';
import { loadAlphaTab } from './alphatexRead';
import { STRING_COUNT, type Clip, type Note } from './clip';
import { indexOf, placeOf } from './editing';
import { WebAudioOutput } from './audioOutput';
import { ACCENT_KEY, BEAT_KEY, CLICK_BANK, CLICK_PROGRAM, clickSoundFont } from './click';

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
 * The sounds the footer offers, grouped by General MIDI family, by program number: only the sounds
 * with a soundfont of their own (`OWN_FONTS`; Jeremy, 2026-10-28: "remove the non-custom
 * instruments"). It had offered every pitched General MIDI sound SONiVOX has. Steel Guitar is
 * alphaTex's default.
 */
export const SOUND_FAMILIES: readonly (readonly [string, readonly (readonly [number, string])[]])[] = [
  ['Piano', [[0, 'Acoustic Grand Piano']]],
  ['Guitar', [[25, 'Steel Guitar'], [27, 'Clean Electric Guitar']]],
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

/**
 * The channels the metronome's clicks and the count-in's play on (issue #148), each with its own
 * volume and mute. alphaTab plays the clip on channels 0 and 1, and keeps 9 for drums.
 */
export const METRONOME_CHANNEL = 10;
export const COUNT_IN_CHANNEL = 11;
/** How fast a click is struck, out of 127. */
const CLICK_VELOCITY = 110;
/** How long a click's note is held, in ticks; the click itself has died away by then. */
const CLICK_TICKS = 120;

/** How the metronome counts a bar: how far apart its clicks are (ticks) and how many there are. */
export interface Count {
  ticks: number;
  clicks: number;
}

/**
 * How the metronome counts a time signature: a click per beat, the bottom number's note. Compound
 * time (6/8, 9/8, 12/8, or the same over 16) clicks the dotted beat instead: two clicks in 6/8.
 */
export function countOf(beats: number, value: number): Count {
  const note = (4 / value) * 960;
  if (value >= 8 && beats > 3 && beats % 3 === 0) return { ticks: note * 3, clicks: beats / 3 };
  return { ticks: note, clicks: beats };
}

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
  /**
   * The tick the clip starts on: past a bar of silence (`PREROLL`), room for a count-in before
   * the first bar.
   */
  start: number;
  /** Each bar as played (repeats played again), in MIDI ticks, with how the metronome counts it. */
  bars: { start: number; end: number; count: Count }[];
}

/**
 * The clip as alphaTab's score and MIDI in a sound, with the lookup from a tick to the beat sounding
 * then. With `clicks`, the metronome's clicks are in the MIDI too, on their own channel, muted while
 * the metronome is off; so they keep time with the notes whatever the speed, the loop or the time
 * signature.
 */
export function perform(at: AlphaTab, clip: Clip, sound: Sound = DEFAULT_SOUND, { clicks = true }: { clicks?: boolean } = {}): Performance {
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
  const bars = masterBars.map(b => ({
    start: b.start + midi.tickShift,
    end: b.end + midi.tickShift,
    count: countOf(b.masterBar.timeSignatureNumerator, b.masterBar.timeSignatureDenominator),
  }));
  // Room before the first bar for the longest count-in before any bar: a bar's count-in comes before it.
  const preroll = clicks ? Math.max(0, ...bars.map(b => MAX_COUNT_IN_BARS * b.count.ticks * b.count.clicks - b.start)) : 0;
  for (const event of midi.events) event.tick += preroll;
  for (const bar of bars) {
    bar.start += preroll;
    bar.end += preroll;
  }
  const shift = midi.tickShift + preroll;
  const endTick = (bars.length > 0 ? bars[bars.length - 1].end : 0) || shift;
  // The synthesizer stops dead at the MIDI's last event, cutting the last note off with a click
  // (Jeremy, 2026-10-26: "a glitch at the end of playback"). An event a little later lets it ring.
  midi.addEvent(new at.midi.EndOfTrackEvent(0, endTick + RING_OUT_TICKS));
  if (clicks) {
    for (const channel of [METRONOME_CHANNEL, COUNT_IN_CHANNEL]) clickSound(at, midi, channel);
    for (const bar of bars) {
      for (let k = 0; k < bar.count.clicks; k++) {
        const tick = bar.start + k * bar.count.ticks;
        if (tick >= bar.end) break;
        addClick(at, midi, METRONOME_CHANNEL, tick, k === 0);
      }
    }
  }
  const performance = { score, midi, lookup: generator.tickLookup, shift, endTick, start: preroll, bars };
  keepSlidPitch(at, clip, performance);
  return performance;
}

/** Sets a channel to the click's sound at the MIDI's start. */
function clickSound(at: AlphaTab, midi: AlphaTabModule.midi.MidiFile, channel: number) {
  midi.addEvent(new at.midi.ControlChangeEvent(0, 0, channel, at.midi.ControllerType.BankSelectCoarse, CLICK_BANK));
  midi.addEvent(new at.midi.ProgramChangeEvent(0, 0, channel, CLICK_PROGRAM));
}

/** A click: beat one's (`accent`) or another beat's. */
function addClick(at: AlphaTab, midi: AlphaTabModule.midi.MidiFile, channel: number, tick: number, accent: boolean) {
  const key = accent ? ACCENT_KEY : BEAT_KEY;
  midi.addEvent(new at.midi.NoteOnEvent(0, tick, channel, key, CLICK_VELOCITY));
  midi.addEvent(new at.midi.NoteOffEvent(0, tick + CLICK_TICKS, channel, key, 0));
}

/** How many bars a count-in may be (Jeremy, 2026-10-28: "adjustable from 1 to 4"). */
export const MAX_COUNT_IN_BARS = 4;

/** Where a count-in is: `bars` bars of clicks from `start`, ending on the tick Play starts from. */
export interface CountIn {
  start: number;
  end: number;
  count: Count;
  bars: number;
}

/**
 * The count-in before a tick (issue #148): one to four bars, each counted as the bar Play starts in
 * is (two clicks in 6/8), at the tempo there. Null when the clip has no bars.
 */
export function countInBefore(performance: Performance, tick: number, bars = 1): CountIn | null {
  const bar = performance.bars.find(b => tick >= b.start && tick < b.end) ?? performance.bars[performance.bars.length - 1];
  if (!bar) return null;
  return { start: tick - bars * bar.count.ticks * bar.count.clicks, end: tick, count: bar.count, bars };
}

/** A copy of a MIDI event at another tick; the performance's own events are left as they are. */
function cloneAt<E extends AlphaTabModule.midi.MidiEvent>(event: E, tick: number): E {
  const copy = Object.assign(Object.create(Object.getPrototypeOf(event)), event) as E;
  copy.tick = tick;
  return copy;
}

/**
 * A MIDI file with a count-in: the bar before it is cleared of notes (and the metronome's clicks)
 * and holds the count-in's clicks instead, so playing from its start counts in and plays on from its
 * end with every tick where it was. Tempo and other changes in that bar, or where it ends, take
 * effect from its start, so it counts at the tempo Play starts in.
 */
export function withCountIn(at: AlphaTab, source: AlphaTabModule.midi.MidiFile, countIn: CountIn): AlphaTabModule.midi.MidiFile {
  const { count, bars } = countIn;
  const midi = new at.midi.MidiFile();
  midi.format = source.format;
  midi.division = source.division;
  midi.tickShift = source.tickShift;
  for (const event of source.events) {
    if (event.tick >= countIn.start && event.tick <= countIn.end) {
      // Note-offs stay, so a note sounding into the count-in still ends.
      if (event instanceof at.midi.NoteOnEvent) {
        if (event.tick < countIn.end) continue;
      } else if (!(event instanceof at.midi.NoteOffEvent)) {
        midi.addEvent(cloneAt(event, countIn.start));
        continue;
      }
    }
    midi.addEvent(event);
  }
  for (let k = 0; k < bars * count.clicks; k++) addClick(at, midi, COUNT_IN_CHANNEL, countIn.start + k * count.ticks, k % count.clicks === 0);
  return midi;
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

/** A note reached by a legato slide (and the notes tied to it). */
interface Span {
  /** The ticks it sounds. */
  start: number;
  end: number;
  /** The MIDI channel alphaTab writes its pitch bends on, and the one its run's note sounds on. */
  channel: number;
  to: number;
  /** How far its pitch bends are moved: from the fret of the run's MIDI key to its own. */
  by: number;
  /** The slide's last step, which alphaTab writes at the note's start from the fret just left. */
  step: number;
}

/**
 * A legato slide reaches its note by bending the note it left, so a run of legato slides sounds on
 * the MIDI key and channel of its first, picked note. alphaTab writes the pitch bends of a note the
 * run reaches (its own bend or vibrato, and the notes tied to it) as if it had a key of its own:
 * - from its own fret, so its vibrato wobbled round the pitch the slide left (the slide's 12 sounded
 *   as its 14, Jeremy, 2026-10-28);
 * - on the channel it would be picked on, which is alphaTab's second one for a note with a bend or
 *   vibrato, where nothing sounds, so 12 sl 14 sl 12 bent half a step never bent (Jeremy, 2026-10-28).
 * Those pitch bends are moved to the run's key and channel, so the note sounds as written.
 */
function keepSlidPitch(at: AlphaTab, clip: Clip, performance: Performance) {
  const spans: Span[] = [];
  const last: (Note | null)[] = Array(STRING_COUNT).fill(null);
  // Each string's picked note sounding (the start of a run of legato slides): its fret and channel.
  const sounding: ({ fret: number; channel: number } | null)[] = Array(STRING_COUNT).fill(null);
  // Each string's slide still sounding: the span it covers so far.
  const open: (Span | null)[] = Array(STRING_COUNT).fill(null);
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
        // alphaTab numbers strings from the highest, 1 up.
        const played = beat?.notes.find(n => n.string === STRING_COUNT - s);
        if (!played || note.fret === null) return;
        const slid = note.slide === 'legato' && before?.fret != null && note.fret !== before.fret;
        if (!slid) {
          // A tie sounds on what it is tied to; any other note is picked on a key of its own.
          if (!note.tie) sounding[s] = { fret: note.fret, channel: channelOf(at, played) };
          return;
        }
        const run = sounding[s] ?? { fret: before.fret!, channel: channelOf(at, played) };
        const span = {
          start,
          end,
          channel: channelOf(at, played),
          to: run.channel,
          by: (note.fret - run.fret) * BEND_PER_SEMITONE,
          step: (note.fret - before.fret!) * BEND_PER_SEMITONE,
        };
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
    if (!span) continue;
    if (bend.channel === span.to && bend.tick === span.start && bend.value === 8192 + span.step) {
      // The slide's own last step, landing on the note reached.
      bend.value = 8192 + span.by;
    } else if (bend.channel === span.channel) {
      bend.value = Math.max(0, Math.min(16383, bend.value + span.by));
      bend.channel = span.to;
    }
  }
}

/**
 * The MIDI channel alphaTab plays a note on (its MidiFileGenerator's `_determineChannel`): the
 * track's second channel for a note, or a note tied to it, with a bend, whammy bar or vibrato.
 */
function channelOf(at: AlphaTab, note: AlphaTabModule.model.Note): number {
  const { primaryChannel, secondaryChannel } = note.beat.voice.bar.staff.track.playbackInfo;
  const needsSecond = (n: AlphaTabModule.model.Note) =>
    n.hasBend || n.beat.hasWhammyBar || n.beat.vibrato !== at.model.VibratoType.None;
  for (let n: AlphaTabModule.model.Note | null = note; n; n = n.isTieDestination ? n.tieOrigin : null) {
    if (needsSecond(n)) return secondaryChannel;
  }
  for (let n: AlphaTabModule.model.Note | null = note; n; n = n.isTieOrigin ? n.tieDestination : null) {
    if (needsSecond(n)) return secondaryChannel;
  }
  return primaryChannel;
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

/** General MIDI's percussion channel, which a transposition leaves alone. */
const DRUM_CHANNEL = 9;

export type PlayerState = 'idle' | 'loading' | 'playing' | 'error';

/** What the page shows while a clip plays. */
export interface PlayerView {
  state: PlayerState;
  /** The column sounding, by its place in the clip; null when nothing is. */
  column: number | null;
}

/** Where the music heard now is: a column, and how far through its note (0 at its start, 1 at its end). */
export interface HeardPosition {
  column: number;
  through: number;
}

/** alphaTab's ticks in a quarter note. */
const QUARTER_TICKS = 960;
/**
 * How long the playhead goes on moving on its own after the synthesizer last said where it is. It
 * says so about every tenth of a second; past this the sound has stalled, so the playhead waits.
 */
const MAX_GLIDE_MS = 250;
/**
 * How quickly the playhead catches up with where the music is heard: about two thirds of the way
 * in this many milliseconds. Each report of the synthesizer's lands a little early or late, so
 * following them at once makes the playhead stutter; easing toward them keeps its speed steady.
 */
const CATCH_UP_MS = 150;
/** Further than this from the music heard (in milliseconds), the playhead jumps to it instead. */
const SNAP_MS = 300;

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
 * The samples of a soundfont the synthesizer holds, decoded one at a time with a pause between, so
 * the page stays responsive (a sound's samples take seconds to decode in all: the piano's about 4).
 * alphaTab decodes a sound's samples when a clip first uses it and keeps them, so a clip played
 * after this finds them ready. The soundfont is the last one loaded; the synthesizer's list of them
 * and the soundfont's own decoding are not in alphaTab's types (checked against the pinned 1.8.4).
 */
async function decodeLastSoundFont(synth: AlphaTabModule.synth.AlphaSynth) {
  interface Soundfont {
    sHdrs: { start: number; end: number; sampleType: number }[];
    decodeSamples(startByte: number, endByte: number, decompressVorbis: boolean): Float32Array;
  }
  const fonts = (synth as unknown as { _loadedSoundFonts: Soundfont[] })._loadedSoundFonts;
  const font = fonts[fonts.length - 1];
  /** The sample type's bit for an Ogg Vorbis sample (an .sf3's), the only kind slow to decode. */
  const VORBIS = 16;
  for (const sample of font.sHdrs) {
    if ((sample.sampleType & VORBIS) === 0) continue;
    // The same arguments alphaTab decodes with, so it finds the samples under the same key.
    font.decodeSamples(sample.start, sample.end, true);
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

/**
 * alphaTab's synthesizer with the soundfont loaded and one clip's MIDI. Made when the page opens,
 * to load the sound in the background; its AudioContext starts on the first Play.
 */
export class TabPlayer {
  private performance: Performance | null = null;
  private clip: Clip | null = null;
  private sound: Sound = DEFAULT_SOUND;
  private volume = 1;
  /** The sounds' own soundfonts loaded so far, by URL. */
  private readonly fonts = new Set<string>();
  /** The sounds' own soundfonts loading, by URL: whoever wants one meanwhile waits for the same load. */
  private readonly loading = new Map<string, Promise<void>>();
  private loop: [number, number] | 'whole' | null = null;
  /**
   * The last column to play when no loop holds the playhead: "Stop playback at region end" with a
   * region selected (Jeremy, 2026-10-28). Null plays on to the clip's end.
   */
  private until: number | null = null;
  /**
   * The MIDI in the synthesizer: the clip's (`end` null), or the clip's stopping at `end` (see
   * `midiUntil`); with the count-in it was made with, if any.
   */
  private loaded: { end: number | null; counted: CountIn | null } | null = null;
  /** Whether the metronome clicks, a count-in comes before Play, and how loud their clicks are (0 to 1). */
  private metronome = false;
  private countIn = false;
  private countInBars = 1;
  private clickVolume = 1;
  /**
   * The count-in of the Play under way, until it has been heard and the playhead goes back (a loop
   * coming round, or a press on the tab): then the clip's own MIDI takes over, since the count-in
   * took the place of the bar before. `column` is where Play started, where the playhead waits.
   */
  private counted: (CountIn & { column: number }) | null = null;
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
  /**
   * The tick heard at a moment, so the playhead can glide between the synthesizer's reports (issue
   * #167): `rate` ticks a millisecond from `at` (`performance.now()`), never before `floor`, the
   * tick playback last started from.
   */
  private heard: { tick: number; at: number; rate: number; floor: number } = { tick: 0, at: 0, rate: 0, floor: 0 };
  /** The tick the synthesizer last reported, to see it go back round a loop. */
  private reported = 0;
  /** The tick the playhead was last drawn on, and when. */
  private shown: { tick: number; at: number } | null = null;

  private constructor(
    private readonly at: AlphaTab,
    private readonly synth: AlphaTabModule.synth.AlphaSynth,
    private readonly output: WebAudioOutput,
    private readonly onView: (view: Partial<PlayerView>) => void,
  ) {
    synth.positionChanged.on(e => {
      if (!this.clip || !this.performance || this.ended) return;
      const rate = (e.modifiedTempo * QUARTER_TICKS) / 60000;
      // Gone back round the loop: the playhead starts again from the loop's start.
      const floor = e.currentTick < this.reported && this.range ? this.range.startTick : this.heard.floor;
      this.reported = e.currentTick;
      this.heard = { tick: e.currentTick - this.output.aheadMs() * rate, at: performance.now(), rate, floor };
      if (this.looping && this.range && e.currentTick >= this.range.endTick) this.loopEndAt ??= performance.now();
      // While the last notes ring out, the playhead stays on the last column.
      if (e.currentTick >= (this.loaded?.end ?? this.performance.endTick)) return;
      // During the count-in it waits where Play started.
      const counting = this.counted && e.currentTick < this.counted.end;
      onView({ column: counting ? this.counted!.column : columnAtTick(this.clip, this.performance, e.currentTick) });
    });
    synth.finished.on(() => {
      // Round the loop (alphaTab goes back to its start right after this): the clip's own MIDI.
      if (synth.isLooping) {
        this.dropCountIn();
        return;
      }
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
    const output = new WebAudioOutput();
    const synth = new at.synth.AlphaSynth(output, 500);
    synth.loadSoundFont(soundfont, false);
    synth.loadSoundFont(clickSoundFont(), true);
    return new TabPlayer(at, synth, output, onView);
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
      this.loaded = null;
    }
    this.setSpeed(speed);
    const tick = tickOf(clip, this.performance, from);
    const countIn = this.countIn ? countInBefore(this.performance, tick, this.countInBars) : null;
    this.counted = countIn && { ...countIn, column: from };
    this.useMidi(this.loaded?.end ?? null);
    this.moveTo(countIn?.start ?? tick);
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
      : loop === 'whole' ? { startTick: this.performance.start, endTick: this.performance.endTick }
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

  /** The clip's MIDI stopping at a tick (or not, for null), with the count-in under way if any. */
  private midiFor(performance: Performance, end: number | null): AlphaTabModule.midi.MidiFile {
    const midi = end === null ? performance.midi : midiUntil(this.at, performance, end);
    return this.counted ? withCountIn(this.at, midi, this.counted) : midi;
  }

  /** Puts the clip's MIDI in the synthesizer, stopping at `end` or not, with the count-in if any. */
  private load(performance: Performance, end: number | null) {
    this.synth.loadMidiFile(this.midiFor(performance, end));
    this.loaded = { end, counted: this.counted };
    this.applyClicks();
  }

  /**
   * Swaps in the clip's MIDI stopping at a tick, or the whole clip's for null, unless it is in already.
   * The playhead stays where it is, and a clip playing plays on.
   */
  private useMidi(end: number | null) {
    if (!this.performance || (this.loaded?.end === end && this.loaded.counted === this.counted)) return;
    const playing = !this.ended && this.resting === null;
    const tick = this.synth.tickPosition;
    this.load(this.performance, end);
    this.moveTo(tick);
    if (playing) this.synth.play();
  }

  /**
   * The count-in has been heard and the loop comes round: the clip's own MIDI goes in place of the
   * one with the count-in, without stopping (alphaTab goes on to the loop's start in it). Its ticks
   * are the same, so the loop points hold.
   */
  private dropCountIn() {
    if (!this.counted || !this.performance || !this.loaded) return;
    this.counted = null;
    const sequencer = (this.synth as unknown as { sequencer: { loadMidi(midi: AlphaTabModule.midi.MidiFile): void; mainPlaybackRange: AlphaTabModule.synth.PlaybackRange | null } }).sequencer;
    const range = sequencer.mainPlaybackRange;
    sequencer.loadMidi(this.midiFor(this.performance, this.loaded.end));
    this.loaded = { end: this.loaded.end, counted: null };
    rangeWithoutSeek(this.synth, range);
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
      this.counted = null;
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
    this.heard = { tick, at: performance.now(), rate: 0, floor: tick };
    this.reported = tick;
    this.shown = null;
  }

  /**
   * Where the music heard now is, for a playhead that glides with it (issue #167): from the
   * synthesizer's last report, moved on by the time since at the tempo then. Null when nothing plays.
   */
  heardPosition(): HeardPosition | null {
    const { clip, performance: perf } = this;
    if (this.ended || !clip || !perf) return null;
    const { tick, at, rate, floor } = this.heard;
    const end = this.looping && this.range ? this.range.endTick : this.loaded?.end ?? perf.endTick;
    const time = performance.now();
    const heard = Math.max(tick + Math.min(time - at, MAX_GLIDE_MS) * rate, floor);
    // From where it was drawn, the playhead moves on at the tempo and eases toward the music heard.
    let now = heard;
    if (this.shown && rate > 0) {
      const elapsed = time - this.shown.at;
      const moved = this.shown.tick + elapsed * rate;
      const behind = heard - moved;
      if (Math.abs(behind) < SNAP_MS * rate) now = moved + behind * (1 - Math.exp(-elapsed / CATCH_UP_MS));
    }
    now = Math.min(now, end - 1);
    this.shown = { tick: now, at: time };
    // During the count-in the playhead waits where Play started.
    if (this.counted && now < this.counted.end) return { column: this.counted.column, through: 0 };
    const found = perf.lookup.findBeat(new Set([0]), now - perf.shift);
    const column = found ? columnOfBeat(clip, found.beat) : null;
    if (!found || column === null) return null;
    const through = found.tickDuration > 0 ? (now - perf.shift - found.start) / found.tickDuration : 0;
    return { column, through: Math.min(1, Math.max(0, through)) };
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
    const unpitched = [DRUM_CHANNEL, METRONOME_CHANNEL, COUNT_IN_CHANNEL];
    if (semitones !== 0) for (let channel = 0; channel < 16; channel++) if (!unpitched.includes(channel)) pitches.set(channel, semitones);
    this.synth.applyTranspositionPitches(pitches);
  }

  /** The loudness, 0 (silent) to 1 (the soundfont's own level). */
  setVolume(volume: number) {
    this.volume = volume;
    // The volume at the output, heard at once; the sound's level in the synthesizer.
    this.output.setVolume(volume);
    this.synth.masterVolume = this.level();
    this.applyClicks();
  }

  /** The sound's own level, which the volume is scaled by (`OWN_FONTS`). */
  private level(): number {
    return OWN_FONTS.find(f => f.program === this.sound)?.level ?? 1;
  }

  /** The metronome on or off; a clip playing clicks (or stops clicking) at once. */
  setMetronome(on: boolean) {
    this.metronome = on;
    this.applyClicks();
  }

  /** Whether the next Play counts in first, and for how many bars (1 to 4). */
  setCountIn(on: boolean, bars: number) {
    this.countIn = on;
    this.countInBars = Math.max(1, Math.min(MAX_COUNT_IN_BARS, Math.round(bars)));
  }

  /** How loud the clicks are, 0 to 1, under the Volume knob (which turns everything down). */
  setClickVolume(volume: number) {
    this.clickVolume = volume;
    this.applyClicks();
  }

  /**
   * The click channels' volume and the metronome's mute. The sound's own level scales everything
   * heard, so the clicks are set against it, to sound alike in every sound.
   */
  private applyClicks() {
    const volume = this.clickVolume / this.level();
    this.synth.setChannelVolume(METRONOME_CHANNEL, volume);
    this.synth.setChannelVolume(COUNT_IN_CHANNEL, volume);
    this.synth.setChannelMute(METRONOME_CHANNEL, !this.metronome);
  }

  /**
   * Starts loading a sound's own soundfont in the background (Jeremy, 2026-10-28: the page shouldn't
   * make you wait for the instrument), so a Play finds it ready. The view stays as it is.
   */
  preload(sound: Sound) {
    const font = OWN_FONTS.find(f => f.program === sound);
    if (font && !this.fonts.has(font.url)) this.fetchFont(font.url).catch(() => undefined);
  }

  /**
   * Waits for a sound's own soundfont, loading it the first time it is wanted, alongside SONiVOX's.
   * Any other soundfont still loading in the background is waited for too, since one landing pauses
   * the synthesizer. The view shows Loading meanwhile. Whether it had to wait.
   */
  private async loadFont(sound: Sound): Promise<boolean> {
    const font = OWN_FONTS.find(f => f.program === sound);
    const own = font && !this.fonts.has(font.url) ? this.fetchFont(font.url) : null;
    const waiting = [...this.loading.values()];
    if (waiting.length === 0) return false;
    this.onView({ state: 'loading' });
    await Promise.allSettled(waiting);
    if (own) {
      await own.catch(error => {
        this.onView({ state: 'error' });
        throw error;
      });
    }
    return true;
  }

  /** Fetches, loads and decodes a soundfont, unless it is loading already. */
  private fetchFont(url: string): Promise<void> {
    let loading = this.loading.get(url);
    if (!loading) {
      loading = (async () => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`the sound didn't load (${response.status})`);
        this.synth.loadSoundFont(new Uint8Array(await response.arrayBuffer()), true);
        await decodeLastSoundFont(this.synth);
        this.fonts.add(url);
      })().finally(() => this.loading.delete(url));
      this.loading.set(url, loading);
    }
    return loading;
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
    this.load(this.performance, null);
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
    this.counted = null;
    this.setVolume(this.volume);
    this.load(perform(this.at, alone, sound, { clicks: false }), null);
    // Not the clip's MIDI: the next Play loads that.
    this.loaded = null;
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
    this.counted = null;
    this.moveTo(tickOf(this.clip, this.performance, index));
    this.setLoop(this.loop);
    if (resting) this.synth.play();
  }

  destroy() {
    this.endRest();
    this.synth.destroy();
  }
}
