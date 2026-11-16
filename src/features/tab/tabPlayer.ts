/**
 * `TabPlayer`: alphaTab's synthesizer with the soundfont loaded and one clip's MIDI, played through a
 * small Web Audio output (`audioOutput.ts`), with the playhead's timing. The MIDI itself is made in
 * `playback.ts`. See docs/specs/2026-10-26-tab-playback-design.md.
 */
import type * as AlphaTabModule from '@coderline/alphatab';
import { loadAlphaTab } from './alphatexRead';
import type { Part } from './clip';
import { WebAudioOutput } from './audioOutput';
import { clickSoundFont } from './click';
import { DEFAULT_PATTERN, samePattern, type ClickPattern } from './metronomeClicks';
import { keepDry } from './dryChannels';
import { loopSeamlessly } from './seamlessLoop';
import { DEFAULT_ROLLS, sameRolls, type Rolls } from './rolls';
import type { EffectSettings } from './effects';
import { decodeOnMainThread, lastFont, useDecoded } from './soundDecode';
import { SoundDecoder } from './soundDecoder';
import { MidiTap, tapSynth, type MidiPort } from './midiOut';
import {
  COUNT_IN_CHANNEL, columnAtTick, countInBefore, DEFAULT_SOUND, fontBytes, heardAt, MAX_COUNT_IN_BARS, METRONOME_CHANNEL, midiUntil,
  noteAlone, ownFont, perform, QUARTER_TICKS, shapeAlone, SOUNDFONT_URL, tickOf, ticksOf, usesBuiltInFonts, withCountIn,
  type CountIn, type HeardPosition, type Performance, type Sound,
} from './playback';

type AlphaTab = typeof AlphaTabModule;

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
 * alphaTab's synthesizer with the soundfont loaded and one clip's MIDI. Made when the page opens,
 * to load the sound in the background; its AudioContext starts on the first Play.
 */
export class TabPlayer {
  private performance: Performance | null = null;
  private clip: Part | null = null;
  private sound: Sound = DEFAULT_SOUND;
  private volume = 1;
  /** How much each kind of chord mark rolls its chord (Tab › Playback). */
  private rolls: Rolls = DEFAULT_ROLLS;
  /** The sounds' own soundfonts loaded so far, by URL. */
  private readonly fonts = new Set<string>();
  /** The sounds' own soundfonts loading, by URL: whoever wants one meanwhile waits for the same load. */
  private readonly loading = new Map<string, Promise<void>>();
  /** Decodes the sounds' samples off the main thread (`soundDecode.ts`). */
  private readonly decoder = new SoundDecoder();
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
  /** What the clicks sound like and which fall (Tab › Metronome): in the MIDI, so a change makes it again. */
  private pattern: ClickPattern = DEFAULT_PATTERN;
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
  /** Whether the synthesizer sounds a note on its own (`hear`), until it ends or a Play. */
  private hearing = false;
  /** Whether the loop points are ahead of the playhead, so playing past the end one goes back to the start one. */
  private looping = false;
  /** The loop's ticks while `looping`. */
  private range: { startTick: number; endTick: number } | null = null;
  /**
   * The rest between the loop's end and its start again, in seconds (Jeremy, 2026-10-27); 0 loops
   * straight round, with no gap (`seamlessLoop.ts`). With a rest, the clip plays to the loop's end and
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
  /** Playback out over MIDI (`midiOut.ts`): the port, if any, and whether the built-in notes play too. */
  private readonly midi: MidiTap;
  private midiPort: MidiPort | null = null;
  private builtIn = true;

  private constructor(
    private readonly at: AlphaTab,
    private readonly synth: AlphaTabModule.synth.AlphaSynth,
    private readonly output: WebAudioOutput,
    private readonly onView: (view: Partial<PlayerView>) => void,
  ) {
    this.midi = new MidiTap(output, new Set([METRONOME_CHANNEL, COUNT_IN_CHANNEL]));
    tapSynth(synth, this.midi);
    synth.positionChanged.on(e => {
      if (!this.clip || !this.performance || this.ended) return;
      const rate = (e.modifiedTempo * QUARTER_TICKS) / 60000;
      // Gone back round the loop: the playhead starts again from the loop's start.
      const floor = e.currentTick < this.reported && this.range ? this.range.startTick : this.heard.floor;
      this.reported = e.currentTick;
      this.heard = { tick: e.currentTick - this.output.aheadMs() * rate, at: performance.now(), rate, floor };
      // At the loop's end the playhead waits there: for the rest, or for the position to go round,
      // which comes a block of samples after the end is heard (`seamlessLoop.ts`).
      if (this.looping && this.range && e.currentTick >= this.range.endTick) {
        this.loopEndAt ??= performance.now();
        return;
      }
      // While the last notes ring out, the playhead stays on the last column.
      if (e.currentTick >= (this.loaded?.end ?? this.performance.endTick)) return;
      // During the count-in it waits where Play started.
      const counting = this.counted && e.currentTick < this.counted.end;
      onView({ column: counting ? this.counted!.column : columnAtTick(this.clip, this.performance, e.currentTick) });
    });
    // Round the loop with no gap (issue #346); as it goes round, the clip's own MIDI takes over.
    loopSeamlessly(synth, () => this.dropCountIn());
    synth.finished.on(() => {
      // Round the loop without the seamless way (Loop pressed after the end was made): alphaTab goes
      // back to its start right after this.
      if (synth.isLooping) {
        this.dropCountIn();
        return;
      }
      if (this.looping && !this.ended) {
        this.rest();
        return;
      }
      this.ended = true;
      this.hearing = false;
      // What is queued (the last notes' ends) still goes; nothing new is taken.
      this.midi.on = false;
      onView({ state: 'idle', column: null });
    });
  }

  /** Loads alphaTab and the soundfont; the view hears every change. */
  static async create(onView: (view: Partial<PlayerView>) => void): Promise<TabPlayer> {
    const at = await loadAlphaTab();
    // Built-in sounds play without SONiVOX.
    const soundfont = usesBuiltInFonts() ? null : await fontBytes(SOUNDFONT_URL);
    const output = new WebAudioOutput();
    const synth = new at.synth.AlphaSynth(output, 500);
    // The clicks are heard past the effects, never distorted or in the reverb.
    keepDry(synth, [METRONOME_CHANNEL, COUNT_IN_CHANNEL], output.dry);
    if (soundfont) synth.loadSoundFont(soundfont, false);
    synth.loadSoundFont(clickSoundFont(), soundfont !== null);
    return new TabPlayer(at, synth, output, onView);
  }

  /**
   * Plays the clip from a column.
   * With loop points, playing past the end one goes back to the start one; a start before them
   * plays up to them first, and a start after them plays on to the end. `whole` loops the whole clip.
   * With no loop ahead, `until` (a column) is where playback stops: at the end of that column's note.
   */
  async play(clip: Part, from: number, loop: [number, number] | 'whole' | null, speed: number, sound: Sound, until: number | null = null) {
    await this.loadFont(sound);
    this.endRest();
    this.quietNotesHeard();
    if (clip !== this.clip || sound !== this.sound || !this.performance) {
      this.clip = clip;
      this.sound = sound;
      this.setVolume(this.volume);
      this.performance = perform(this.at, clip, sound, { rolls: this.rolls, pattern: this.pattern });
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
    this.startMidi();
    this.synth.play();
    this.onView({ state: 'playing', column: from });
  }

  /**
   * Where playback goes out over MIDI: a port (none for only the built-in sound), the track's channel
   * (1 to 16), and whether the built-in notes play too. A clip playing goes on, out of the new port.
   */
  setMidi(port: MidiPort | null, channel: number, builtIn: boolean, bendRange: number) {
    const playing = !this.ended && !this.hearing;
    if (port !== this.midiPort || this.midi.channel !== channel - 1 || this.midi.bendRange !== bendRange) this.midi.release({ centre: true });
    this.midi.bendRange = bendRange;
    this.midiPort = port;
    this.builtIn = builtIn;
    this.midi.port = port;
    this.midi.channel = channel - 1;
    if (playing) {
      this.muteNotes(port !== null && !builtIn);
      this.midi.on = port !== null;
      this.midi.start();
    }
  }

  /** At Play: MIDI out takes what plays, and the built-in notes go quiet unless asked to play too. */
  private startMidi() {
    this.muteNotes(this.midiPort !== null && !this.builtIn);
    this.midi.on = this.midiPort !== null;
    this.midi.start();
  }

  /** The built-in sound's notes muted, or heard; the clicks are always heard. */
  private muteNotes(muted: boolean) {
    for (let channel = 0; channel < 16; channel++) {
      if (channel !== METRONOME_CHANNEL && channel !== COUNT_IN_CHANNEL) this.synth.setChannelMute(channel, muted);
    }
  }

  /** Stops, keeping the clip ready for the next Play; the view hears the state go idle and the playhead go. */
  halt() {
    this.ended = true;
    this.endRest();
    this.quietNotesHeard();
    this.endMidi();
    this.synth.pause();
    this.onView({ state: 'idle', column: null });
  }

  /** Stops and forgets the clip, as after an edit; a note heard on its own (`hear`) rings on. */
  stop() {
    this.ended = true;
    this.endRest();
    this.endMidi();
    if (!this.hearing) this.synth.stop();
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
    return this.counted ? withCountIn(this.at, midi, this.counted, this.pattern) : midi;
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
   * one with the count-in, without stopping (the sequencer goes on to the loop's start in it). Its
   * ticks are the same, so the loop points hold.
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

  /** How much each kind of chord mark rolls its chord; a clip playing goes on from where it is with the new rolls. */
  setRolls(rolls: Rolls) {
    if (sameRolls(rolls, this.rolls)) return;
    this.rolls = rolls;
    this.remake();
  }

  /** Makes the clip's MIDI again (new rolls or clicks); a clip playing goes on from where it is. */
  private remake() {
    if (!this.clip || !this.performance) return;
    const playing = !this.ended && this.resting === null;
    const tick = this.synth.tickPosition;
    this.performance = perform(this.at, this.clip, this.sound, { rolls: this.rolls, pattern: this.pattern });
    this.load(this.performance, null);
    this.moveTo(tick);
    this.setLoop(this.loop);
    if (playing) this.synth.play();
  }

  /**
   * The clicks' sound, subdivisions, which beats click and their levels (issue #477); a clip playing
   * goes on from where it is with the new clicks, as with new rolls.
   */
  setClickPattern(pattern: ClickPattern) {
    if (samePattern(pattern, this.pattern)) return;
    this.pattern = pattern;
    this.remake();
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

  /** Stop, or an edit: MIDI out takes nothing more, and every note it sent ends. */
  private endMidi() {
    this.midi.on = false;
    this.midi.release({ centre: true });
  }

  /** Puts the playhead on a tick, with no loop points to hold it in. */
  private moveTo(tick: number) {
    // The sound made ahead is thrown away, so are the MIDI messages not yet sent; what sounds ends.
    this.midi.release();
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
    return heardAt(clip, perf, now);
  }

  setSpeed(speed: number) {
    this.synth.playbackSpeed = speed;
  }

  /**
   * Moves everything heard by some semitones (Jeremy, 2026-10-27), notes already sounding too: the
   * synthesizer's own transposition, on every channel but General MIDI's drums.
   */
  setTranspose(semitones: number) {
    this.midi.transpose = semitones;
    const pitches = new Map<number, number>();
    const unpitched = [DRUM_CHANNEL, METRONOME_CHANNEL, COUNT_IN_CHANNEL];
    if (semitones !== 0) for (let channel = 0; channel < 16; channel++) if (!unpitched.includes(channel)) pitches.set(channel, semitones);
    this.synth.applyTranspositionPitches(pitches);
  }

  /**
   * The loudness, 0 (silent) to 1 (the soundfont's own level). The sound's level is set in the
   * synthesizer, so every sound drives the effects alike; the volume at the output, after them.
   */
  setVolume(volume: number) {
    this.volume = volume;
    this.output.setVolume(volume);
    this.synth.masterVolume = this.level();
    this.applyClicks();
  }

  /** Sets the distortion and reverb (`effects.ts`) of the track playing, heard at once; the clicks stay dry. */
  setEffects(settings: EffectSettings) {
    this.output.setEffects(settings);
  }

  /** The sound's own level, which the volume is scaled by (`OWN_FONTS`). */
  private level(): number {
    return ownFont(this.sound)?.level ?? 1;
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
    const font = ownFont(sound);
    if (font && !this.fonts.has(font.url)) this.fetchFont(font.url).catch(() => undefined);
  }

  /**
   * Waits for a sound's own soundfont, loading it the first time it is wanted, alongside SONiVOX's.
   * Any other soundfont still loading in the background is waited for too, since one landing pauses
   * the synthesizer. The view shows Loading meanwhile. Whether it had to wait.
   */
  private async loadFont(sound: Sound): Promise<boolean> {
    const font = ownFont(sound);
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
        this.decoder.start();
        const bytes = await fontBytes(url);
        this.synth.loadSoundFont(bytes, true);
        // The synthesizer keeps its own copy of the samples' bytes, so these can go to the worker.
        const font = lastFont(this.synth);
        try {
          useDecoded(font, await this.decoder.decode(bytes));
        } catch {
          await decodeOnMainThread(font);
        }
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
    this.performance = perform(this.at, this.clip, sound, { rolls: this.rolls, pattern: this.pattern });
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
  async hear(clip: Part, bar: number, column: number, string: number, sound: Sound) {
    const alone = noteAlone(clip, bar, column, string);
    if (alone) await this.hearAlone(alone, sound);
  }

  /** Sounds a chord shape (`shapeAlone`) as `hear` sounds a note: when a chord is picked in the Chords panel. */
  async hearShape(clip: Part, frets: readonly (number | null)[], sound: Sound) {
    const alone = shapeAlone(clip, frets);
    if (alone) await this.hearAlone(alone, sound);
  }

  /** Sounds a clip of one column on its own, then lets it ring; not while the clip plays. */
  private async hearAlone(alone: Part, sound: Sound) {
    if (!this.ended) return;
    // A sound's own soundfont shows Loading on Play while it loads; heard, it goes back to Play.
    if (await this.loadFont(sound)) this.onView({ state: 'idle' });
    if (!this.ended) return;
    // The note heard before rings on to its end (issue #258), even on the same string (Jeremy,
    // 2026-10-30: "They should ring the same. The ring is for the preview").
    if (this.hearing) this.output.ringOn();
    this.synth.stop();
    this.hearing = true;
    // Heard on its own, a note plays in the built-in sound and doesn't go out (Jeremy, 2026-11-09: playback only).
    this.midi.on = false;
    this.muteNotes(false);
    this.sound = sound;
    this.clip = null;
    this.performance = null;
    this.counted = null;
    this.setVolume(this.volume);
    this.load(perform(this.at, alone, sound, { clicks: false, rolls: this.rolls }), null);
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

  /** Fades out every note heard on its own (`hear`) still sounding, for a Play or a Stop. */
  private quietNotesHeard() {
    this.hearing = false;
    this.output.chokeAll();
  }

  destroy() {
    this.endRest();
    this.midi.destroy();
    this.decoder.destroy();
    this.synth.destroy();
  }
}
