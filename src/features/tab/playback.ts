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
import { writePart } from './alphatex';
import { DEFAULT_BPM, MAX_BPM, MIN_BPM, STRING_COUNT, TREMOLO_VALUES, WHOLE, groupCountsAt, ticks, type Part } from './clip';
import { indexOf, placeOf } from './editing';
import { SOUND_NAMES } from './instrument';
import { CLICK_BANK, CLICK_PROGRAM, clickKeys } from './click';
import { DEFAULT_PATTERN, barClicks, clickVelocity, countOf, type ClickKind, type ClickPattern, type Count } from './metronomeClicks';
import { DEFAULT_ROLLS, rollChords, type Rolls } from './rolls';
import { bendWhileTremoloPicking, keepSlidPitch, oneNoteAString, vibratoOnBends } from './midiFixes';

type AlphaTab = typeof AlphaTabModule;
type Score = AlphaTabModule.model.Score;
type Beat = AlphaTabModule.model.Beat;
type TickLookup = AlphaTabModule.midi.MidiTickLookup;

/** Where the soundfont is served from. */
export const SOUNDFONT_URL = '/soundfont/sonivox.sf3';
/** The slowest and fastest alphaTab's synthesizer plays, as fractions of the written tempo. */
const SYNTH_MIN_SPEED = 0.125;
const SYNTH_MAX_SPEED = 8;

/**
 * The speeds a clip may play at, as fractions of its own tempo: as far as every
 * tempo in it stays within the 20 to 400 bpm a tempo may be set to (Jeremy, 2026-11-05; it had been
 * 25% to 150%, so a 120 bpm clip stopped at 180). alphaTab's synthesizer plays no slower than 12.5%
 * and no faster than 800%, so a clip at 400 bpm slows to 52 and one at 20 speeds up to 160.
 */
export function speedRange(clip: Part): { min: number; max: number } {
  const tempos = [clip.bars[0]?.tempo?.bpm ?? DEFAULT_BPM, ...clip.bars.flatMap(bar => (bar.tempo ? [bar.tempo.bpm] : []))];
  const slowest = Math.min(...tempos);
  const fastest = Math.max(...tempos);
  return {
    min: Math.max(SYNTH_MIN_SPEED, MIN_BPM / slowest),
    max: Math.min(SYNTH_MAX_SPEED, MAX_BPM / fastest),
  };
}

/**
 * The sounds the footer offers, grouped by General MIDI family, by program number: only the sounds
 * with a soundfont of their own (`OWN_FONTS`; Jeremy, 2026-10-28: "remove the non-custom
 * instruments"). It had offered every pitched General MIDI sound SONiVOX has. Steel Guitar is
 * alphaTex's default.
 */
export const SOUND_FAMILIES: readonly (readonly [string, readonly (readonly [number, string])[]])[] = [
  ['Piano', [[0, SOUND_NAMES[0]]]],
  ['Guitar', [[25, SOUND_NAMES[25]], [27, SOUND_NAMES[27]]]],
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
  // The black guitar of Karoryfer Samples' Black And Green Guitars: a note per semitone, 1.1 MB (issue #504).
  { program: 27, url: '/soundfont/guitar-electric-karoryfer-black.sf3', level: 0.76 },
];

/** A sound's own soundfont, if it has one. */
export function ownFont(program: number) {
  return OWN_FONTS.find(f => f.program === program);
}

export type Sound = number;

/**
 * Soundfonts built into the page, by the URL the site serves each from, for a frame that may load
 * nothing from outside (the Tab MCP App, `mcp/apps/tab/main.tsx`). With them set, SONiVOX isn't
 * loaded, so only sounds with a font of their own here can play.
 */
let builtInFonts: ReadonlyMap<string, Uint8Array> | null = null;

/** Plays from these soundfonts only, instead of fetching them and SONiVOX from the site. */
export function setBuiltInFonts(fonts: Readonly<Record<string, Uint8Array>>) {
  builtInFonts = new Map(Object.entries(fonts));
}

/** Whether `setBuiltInFonts` was called, so SONiVOX isn't loaded. */
export function usesBuiltInFonts(): boolean {
  return builtInFonts !== null;
}

/** A soundfont's bytes: a fresh copy of a built-in one (the decoder takes the copy it is given), else fetched. */
export async function fontBytes(url: string): Promise<Uint8Array> {
  const inline = builtInFonts?.get(url);
  if (inline) return inline.slice();
  if (builtInFonts) throw new Error(`no built-in soundfont ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`the sound didn't load (${response.status})`);
  return new Uint8Array(await response.arrayBuffer());
}
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
/** How long a click's note is held, in ticks; the click itself has died away by then. */
const CLICK_TICKS = 120;

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
 * Makes each tremolo picked beat pick at the value its `tp` names, whatever the note's length.
 * alphaTab reads `tp 32` as three slashes and picks at the beat's value halved once per slash, so
 * a whole note with `tp 32` played eighths (Jeremy, 2026-10-29). Frets' `tp N` means N-ths, as
 * eighths, sixteenths or thirty-seconds in a tuplet's time, so the slashes become whatever count
 * gives that: log2(N × dots / value), which alphaTab's generator takes even when it isn't whole.
 * A beat no longer than its picking (a sixteenth with `tp 16`) plays as one note.
 */
function pickAtTremoloValue(score: Score) {
  for (const track of score.tracks) for (const staff of track.staves) for (const bar of staff.bars) {
    for (const voice of bar.voices) for (const beat of voice.beats) {
      const tremolo = beat.tremoloPicking;
      const value = tremolo ? TREMOLO_VALUES[tremolo.marks - 1] : undefined;
      if (!tremolo || !value) continue;
      const dots = beat.dots >= 2 ? 1.75 : beat.dots === 1 ? 1.5 : 1;
      const marks = Math.log2((value * dots) / beat.duration);
      // alphaTab plays nothing at all for a tremolo with no slashes.
      if (marks > 0) tremolo.marks = marks;
      else beat.tremoloPicking = undefined;
    }
  }
}

/**
 * The clip as alphaTab's score and MIDI in a sound, with the lookup from a tick to the beat sounding
 * then. With `clicks`, the metronome's clicks are in the MIDI too, on their own channel, muted while
 * the metronome is off; so they keep time with the notes whatever the speed, the loop or the time
 * signature. `rolls` is how much each kind of chord mark rolls its chord (`rolls.ts`).
 */
export function perform(
  at: AlphaTab, clip: Part, sound: Sound = DEFAULT_SOUND,
  { clicks = true, rolls = DEFAULT_ROLLS, pattern = DEFAULT_PATTERN }: { clicks?: boolean; rolls?: Rolls; pattern?: ClickPattern } = {},
): Performance {
  const settings = new at.Settings();
  // alphaTab's wide vibrato is faster as well as wider (a period of 240 ticks to the slight one's
  // 360); a wide vibrato is only wider (Jeremy, 2026-10-29: "it should just be wider").
  settings.player.vibrato.noteWideLength = settings.player.vibrato.noteSlightLength;
  const importer = new at.importer.AlphaTexImporter();
  importer.logErrors = false;
  importer.initFromString(writePart(clip), settings);
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
  pickAtTremoloValue(score);
  rollChords(at, score, clip, rolls);
  const midi = new at.midi.MidiFile();
  const generator = new at.midi.MidiFileGenerator(score, settings, new at.midi.AlphaSynthMidiFileHandler(midi, true));
  vibratoOnBends(at, generator, settings);
  bendWhileTremoloPicking(at, generator);
  oneNoteAString(generator);
  generator.generate();
  const masterBars = generator.tickLookup.masterBars;
  const bars = masterBars.map(b => ({
    start: b.start + midi.tickShift,
    end: b.end + midi.tickShift,
    count: countOf(b.masterBar.timeSignatureNumerator, b.masterBar.timeSignatureDenominator, groupCountsAt(clip, b.masterBar.index)),
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
      for (const click of barClicks(bar.count, pattern)) {
        const tick = bar.start + click.offset;
        if (tick >= bar.end) break;
        addClick(at, midi, METRONOME_CHANNEL, tick, click.kind, pattern);
      }
    }
  }
  const performance = { score, midi, lookup: generator.tickLookup, shift, endTick, start: preroll, bars };
  keepSlidPitch(at, clip, midi, index => ({ start: tickOf(clip, performance, index), beat: beatOf(performance, clip, index) }));
  return performance;
}

/** Sets a channel to the click's sound at the MIDI's start. */
function clickSound(at: AlphaTab, midi: AlphaTabModule.midi.MidiFile, channel: number) {
  midi.addEvent(new at.midi.ControlChangeEvent(0, 0, channel, at.midi.ControllerType.BankSelectCoarse, CLICK_BANK));
  midi.addEvent(new at.midi.ProgramChangeEvent(0, 0, channel, CLICK_PROGRAM));
}

/** A click in the pattern's sound: beat one's high click, or the low one, as hard as its kind and level say. */
function addClick(at: AlphaTab, midi: AlphaTabModule.midi.MidiFile, channel: number, tick: number, kind: ClickKind, pattern: ClickPattern) {
  const keys = clickKeys(pattern.sound);
  const key = kind === 'one' ? keys.high : keys.low;
  const velocity = clickVelocity(kind, pattern.levels);
  if (velocity === 0) return;
  midi.addEvent(new at.midi.NoteOnEvent(0, tick, channel, key, velocity));
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
 * is (six clicks in 6/8), at the tempo there. Null when the clip has no bars.
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
export function withCountIn(at: AlphaTab, source: AlphaTabModule.midi.MidiFile, countIn: CountIn, pattern: ClickPattern = DEFAULT_PATTERN): AlphaTabModule.midi.MidiFile {
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
  const barTicks = count.ticks * count.clicks;
  for (let b = 0; b < bars; b++) {
    for (const click of barClicks(count, pattern, { countIn: true })) {
      addClick(at, midi, COUNT_IN_CHANNEL, countIn.start + b * barTicks + click.offset, click.kind, pattern);
    }
  }
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

/** How long a column heard on its own sounds: a quarter note at 120 bpm, before it rings out. */
const HEARD_BPM = 120;

/**
 * A clip of one note, to hear it alone (Jeremy, 2026-10-27: "just play the note added"): the note on a
 * string of a column as a plain picked note (no tie, slide or bend, which need the notes round it),
 * with the clip's tuning and capo. Null where there is no note.
 */
export function noteAlone(clip: Part, bar: number, column: number, string: number): Part | null {
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

/**
 * A clip of one strummed chord, to hear a chord shape when it is picked (issue #251): `frets` high e
 * first, null for a string not played, with the clip's tuning and capo. Null for a shape with no notes.
 */
export function shapeAlone(clip: Part, frets: readonly (number | null)[]): Part | null {
  if (frets.every(f => f === null)) return null;
  const notes = Array.from({ length: STRING_COUNT }, (_, s) => (frets[s] == null ? null : { fret: frets[s]! }));
  return {
    ...clip,
    time: { beats: 1, value: 4 },
    bars: [{ columns: [{ duration: { value: 4, dots: 0 }, notes, stroke: 'down' }], tempo: { bpm: HEARD_BPM } }],
  };
}

/** The clip's column a beat of the score is, by its place in the whole clip; null for a beat Frets has no column for (an empty bar's). */
function columnOfBeat(clip: Part, beat: Beat): number | null {
  const bar = beat.voice.bar.index;
  if (bar >= clip.bars.length) return null;
  if (beat.voice.index === (clip.voice ?? 0) && beat.index < clip.bars[bar].columns.length) return indexOf(clip, bar, beat.index);
  // Another Voice's beat (step 9): the part's own Column sounding at its time.
  const own = ownColumnAt(clip, bar, beat.playbackStart * TICKS_PER_SCORE_TICK);
  return own ? indexOf(clip, bar, own.column) : null;
}

/**
 * The part's own Column sounding `t` ticks (Frets') into bar `bar`, with where it starts and how long it
 * lasts; grace notes take no time, so they are never it. The part is one Voice (the Active voice), which
 * the score may not have in that bar (an absent Voice's stand-in rests), so this goes by time.
 */
function ownColumnAt(clip: Part, bar: number, t: number): { column: number; start: number; length: number } | null {
  let found: { column: number; start: number; length: number } | null = null;
  let start = 0;
  (clip.bars[bar]?.columns ?? []).forEach((column, c) => {
    if (column.grace) return;
    const length = ticks(column.duration);
    if (t >= start) found = { column: c, start, length };
    start += length;
  });
  return found;
}

/**
 * Where the music is at MIDI tick `now`: the part's own Column sounding, and how far through it. In a bar
 * with several Voices (step 9) it goes by the part's own Column at that time, so the playhead glides
 * through the Active voice's notes alone, never back or off.
 */
export function heardAt(clip: Part, perf: Performance, now: number): HeardPosition | null {
  const found = perf.lookup.findBeat(new Set([0]), now - perf.shift);
  if (!found) return null;
  const bar = found.beat.voice.bar.index;
  // With other Voices in the bar, the lookup's beats are cut wherever any Voice starts a note, so a
  // beat found may be another Voice's or only part of the own note: it goes by the own Column's time.
  if ((clip.bars[bar]?.otherVoices?.length ?? 0) > 0 || found.beat.voice.index !== (clip.voice ?? 0)) {
    const played = perf.bars.find(b => now >= b.start && now < b.end);
    const into = played ? (now - played.start) * TICKS_PER_SCORE_TICK : 0;
    const own = played ? ownColumnAt(clip, bar, into) : null;
    if (!own) return null;
    const through = own.length > 0 ? (into - own.start) / own.length : 0;
    return { column: indexOf(clip, bar, own.column), through: Math.min(1, Math.max(0, through)) };
  }
  const column = columnOfBeat(clip, found.beat);
  if (column === null) return null;
  const through = found.tickDuration > 0 ? (now - perf.shift - found.start) / found.tickDuration : 0;
  return { column, through: Math.min(1, Math.max(0, through)) };
}

/** The column sounding at a tick, or null. */
export function columnAtTick(clip: Part, performance: Performance, tick: number): number | null {
  const found = performance.lookup.findBeat(new Set([0]), tick - performance.shift);
  return found ? columnOfBeat(clip, found.beat) : null;
}

/**
 * The score's beat for a column of the clip, in the part's own Voice. Where the score has no such beat
 * (an absent Voice's stand-in rests), the first Voice's beat sounding at the column's time, and how many
 * of the score's ticks into it the column starts.
 */
function beatOf(performance: Performance, clip: Part, index: number): Beat | null {
  return placedBeat(performance, clip, index)?.beat ?? null;
}

function placedBeat(performance: Performance, clip: Part, index: number): { beat: Beat; offset: number } | null {
  const { bar, column } = placeOf(clip, index);
  const voices = performance.score.tracks[0]?.staves[0]?.bars[bar]?.voices ?? [];
  const own = voices[clip.voice ?? 0];
  const columns = clip.bars[bar]?.columns ?? [];
  if (own && own.beats.length === columns.length) return own.beats[column] ? { beat: own.beats[column], offset: 0 } : null;
  let t = 0;
  for (let c = 0; c < column && c < columns.length; c++) if (!columns[c].grace) t += ticks(columns[c].duration);
  const at = t / TICKS_PER_SCORE_TICK;
  const beats = voices[0]?.beats ?? [];
  const beat = [...beats].reverse().find(b => b.playbackStart <= at) ?? beats[0];
  return beat ? { beat, offset: at - beat.playbackStart } : null;
}

/** The ticks from the start of one column to the end of another, the first time each is played. */
export function ticksOf(clip: Part, performance: Performance, [from, to]: [number, number]): { startTick: number; endTick: number } | null {
  const first = beatOf(performance, clip, from);
  const last = beatOf(performance, clip, to);
  if (!first || !last) return null;
  const startTick = performance.lookup.getBeatStart(first) + performance.shift;
  const endTick = performance.lookup.getBeatStart(last) + last.playbackDuration + performance.shift;
  return endTick > startTick ? { startTick, endTick } : null;
}

/** The tick a column first starts on. */
export function tickOf(clip: Part, performance: Performance, index: number): number {
  const placed = placedBeat(performance, clip, index);
  return (placed ? performance.lookup.getBeatStart(placed.beat) + placed.offset : 0) + performance.shift;
}

/** Where the music heard now is: a column, and how far through its note (0 at its start, 1 at its end). */
export interface HeardPosition {
  column: number;
  through: number;
}

/** alphaTab's ticks in a quarter note. */
export const QUARTER_TICKS = 960;
/** Frets' ticks (`clip.ts`) in one of the score's (alphaTab's 960 a quarter). */
const TICKS_PER_SCORE_TICK = WHOLE / (4 * QUARTER_TICKS);
