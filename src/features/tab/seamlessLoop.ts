/**
 * Loops alphaTab's synthesizer with no gap between the loop's end and its start again (issue #346).
 *
 * alphaTab 1.8.4 loops from the sound heard, not the sound made: its sequencer stops making sound at
 * the loop's end and cuts the notes off; only once the speakers have played everything made so far
 * does it go back to the loop's start and begin making sound again. The loop comes round late by the
 * rest of the audio block the end fell in (up to 93 ms at our block size), and the end's notes are cut
 * short as well. Here, instead, the sequencer goes back to the loop's start the moment it makes the
 * loop's end, so the start follows the end in the same stream of samples; and the position reported
 * (the playhead) goes back by the loop's length when that moment is heard.
 *
 * Checked against the pinned 1.8.4: these are its sequencer's and synthesizer's own fields, not in
 * its types.
 */
import type * as AlphaTabModule from '@coderline/alphatab';

/** alphaTab's MIDI event types this module looks at (its `MidiEventType`). */
const NOTE_ON = 128;
const NOTE_OFF = 144;
const PER_NOTE_PITCH_BEND = 96;

/** One event of the sequencer's: its MIDI event (with its tick) and when it sounds, in milliseconds at speed 1. */
interface SynthEvent {
  event: { type: number; tick: number } | null;
  isMetronome: boolean;
  time: number;
}

/** The sequencer's state for the MIDI loaded (alphaTab's `MidiSequencerState`). */
interface SequencerState {
  synthData: SynthEvent[];
  eventIndex: number;
  currentTime: number;
  playbackRangeStartTime: number;
  playbackRangeEndTime: number;
}

/** alphaTab's `MidiFileSequencer`, as far as this module uses it. */
interface Sequencer {
  _mainState: SequencerState;
  isLooping: boolean;
  isPlayingMain: boolean;
  playbackSpeed: number;
  mainPlaybackRange: AlphaTabModule.synth.PlaybackRange | null;
  fillMidiEventQueue(): boolean;
  mainSeek(timePosition: number): void;
  loadMidi(midi: unknown): void;
  stop(): void;
}

/** alphaTab's `AlphaSynth`, as far as this module uses it. */
interface Synth {
  sequencer: Sequencer;
  synthesizer: { noteOffAll(immediate: boolean): void; dispatchEvent(event: SynthEvent): void };
  _timePosition: number;
  _tickPosition: number;
  checkForFinish(): void;
  updateTimePosition(timePosition: number, isSeek: boolean): void;
}

/** A loop's end the sequencer has gone round, not yet heard: its tick, and the loop's length in ms. */
interface Wrap {
  endTick: number;
  lengthMs: number;
}

/**
 * Makes the synthesizer loop with no gap whenever it loops (`isLooping`, with a playback range).
 * `onWrap` runs as the sequencer goes back to the loop's start, before anything of the loop's start
 * is made: the place to swap in other MIDI with the same ticks (the player drops its count-in).
 */
export function loopSeamlessly(synth: AlphaTabModule.synth.AlphaSynth, onWrap: () => void) {
  const s = synth as unknown as Synth;
  const sequencer = s.sequencer;
  /** Loop ends gone round in the sound made, oldest first; a seek or new MIDI throws the sound away. */
  let wraps: Wrap[] = [];

  const loopsNow = () => sequencer.isLooping && sequencer.isPlayingMain && sequencer.mainPlaybackRange !== null;

  const fill = sequencer.fillMidiEventQueue.bind(sequencer);
  sequencer.fillMidiEventQueue = () => {
    const dispatched = fill();
    if (loopsNow() && sequencer._mainState.currentTime >= sequencer._mainState.playbackRangeEndTime) wrap();
    return dispatched;
  };

  /** Sends the sequencer back to the loop's start, carrying over how far it went past the end. */
  function wrap() {
    const past = sequencer._mainState.currentTime - sequencer._mainState.playbackRangeEndTime;
    onWrap();
    const range = sequencer.mainPlaybackRange;
    if (!range) return;
    const state = sequencer._mainState;
    // Notes still sounding die away as they would at their end, rather than being cut off.
    s.synthesizer.noteOffAll(false);
    // Everything but the notes before the start (the sound, volume, a bend left on the strings) is
    // set as it is there; the notes ringing into the start from before it are not played, as alphaTab
    // doesn't when it loops. Before the start by tick, not time: an event's time is summed from the
    // ones before it, so a note on the start's tick can land a hair before the start's time and would
    // be left out (Jeremy, 2026-11-04: a loop of bar 2 lost its first note).
    let index = 0;
    while (index < state.synthData.length && (state.synthData[index].event?.tick ?? 0) < range.startTick) {
      const e = state.synthData[index];
      if (!e.isMetronome && e.event && e.event.type !== NOTE_ON && e.event.type !== NOTE_OFF && e.event.type !== PER_NOTE_PITCH_BEND) {
        s.synthesizer.dispatchEvent(e);
      }
      index++;
    }
    state.eventIndex = index;
    state.currentTime = state.playbackRangeStartTime + past;
    wraps.push({ endTick: range.endTick, lengthMs: (state.playbackRangeEndTime - state.playbackRangeStartTime) / sequencer.playbackSpeed });
  }

  // When the loop's end is heard, the position goes back by the loop's length: to the loop's start,
  // and as far past it as the sound has played on.
  const check = s.checkForFinish.bind(s);
  s.checkForFinish = () => {
    const next = wraps[0];
    if (!next) {
      check();
      return;
    }
    if (s._tickPosition < next.endTick) return;
    wraps.shift();
    s.updateTimePosition(s._timePosition - next.lengthMs, false);
  };

  // A seek, a stop or other MIDI throws away the sound made ahead, and with it the loop ends in it.
  for (const name of ['mainSeek', 'loadMidi', 'stop'] as const) {
    const original = (sequencer[name] as (...args: unknown[]) => void).bind(sequencer);
    (sequencer as unknown as Record<string, (...args: unknown[]) => void>)[name] = (...args: unknown[]) => {
      wraps = [];
      original(...args);
    };
  }
}
