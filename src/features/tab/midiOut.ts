/**
 * Tab's playback out over MIDI (issue #457; `docs/specs/2026-11-09-tab-midi-out-design.md`): the
 * Settings section that picks the port, how an alphaTab MIDI event becomes the bytes sent, and
 * `MidiTap`, which takes each event alphaTab's synthesizer plays and sends it to a Web MIDI output
 * at the moment the built-in sound would play it.
 */

/** Tab › MIDI output, saved. */
export const MIDI_KEY = 'frets.tab.midi';

export interface MidiSettings {
  /** The output's name, as the browser reports it; '' for none. Kept by name: a port's id changes. */
  port: string;
  /** "Also play the built-in sound": its notes keep playing while MIDI goes out. */
  builtIn: boolean;
  /** Tracks 1 to 4's channels, 1 to 16; a track past the list's end takes its default. */
  channels: number[];
  /** The receiver's pitch bend range, in semitones: bends are scaled to it and it is sent as RPN 0. */
  bendRange: number;
}

/** MIDI's own default pitch bend range, which most synths keep. */
export const DEFAULT_BEND_RANGE = 2;
export const MIN_BEND_RANGE = 1;
export const MAX_BEND_RANGE = 24;

export const DEFAULT_MIDI: MidiSettings = { port: '', builtIn: false, channels: [], bendRange: DEFAULT_BEND_RANGE };

export const MIN_CHANNEL = 1;
export const MAX_CHANNEL = 16;

/** How many tracks go out over MIDI: Tracks 1 to 4. A later track plays the built-in sound. */
export const MIDI_TRACKS = 4;

const isChannel = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= MIN_CHANNEL && (v as number) <= MAX_CHANNEL;

/** A track's default channel: Track N on N. `track` counts from 0. */
export const defaultChannel = (track: number) => track + 1;

/** The channel a track (from 0) goes out on, 1 to 16; null for a track past `MIDI_TRACKS`. */
export function channelOf(settings: MidiSettings, track: number): number | null {
  if (track >= MIDI_TRACKS) return null;
  const saved = settings.channels[track];
  return isChannel(saved) ? saved : defaultChannel(track);
}

export function parseMidiSettings(raw: unknown): MidiSettings {
  const fields = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    port: typeof fields.port === 'string' ? fields.port : DEFAULT_MIDI.port,
    builtIn: fields.builtIn === true,
    // A bad entry is its track's default, so the tracks after it keep their place.
    channels: Array.isArray(fields.channels)
      ? fields.channels.slice(0, MIDI_TRACKS).map((c, t) => (isChannel(c) ? c : defaultChannel(t)))
      : [],
    bendRange: Number.isInteger(fields.bendRange) && (fields.bendRange as number) >= MIN_BEND_RANGE && (fields.bendRange as number) <= MAX_BEND_RANGE
      ? (fields.bendRange as number)
      : DEFAULT_BEND_RANGE,
  };
}

/* — events to bytes — */

/** alphaTab's MIDI event types (its `MidiEventType`); its numbers, not MIDI's status bytes. */
const NOTE_ON = 128;
const NOTE_OFF = 144;
const CONTROL_CHANGE = 176;
const PITCH_BEND = 224;

/**
 * Controllers never sent: bank select, coarse and fine (the synth's patch is its own, as with program
 * changes), and RPN select and data entry: alphaTab sets its own pitch bend range with them, and Frets
 * sends the receiver's (`setupMessages`).
 */
const NOT_SENT = new Set([0, 32, 6, 38, 100, 101]);

/** An alphaTab MIDI event, as far as sending it needs. */
export interface PlayedEvent {
  type: number;
  channel?: number;
  noteKey?: number;
  noteVelocity?: number;
  controller?: number;
  value?: number;
}

/** Where an event goes: the output's channel (0 to 15) and the semitones the notes are moved by. */
export interface Routing {
  channel: number;
  transpose: number;
  /** alphaTab's channels that stay in Tab (the clicks). */
  local: ReadonlySet<number>;
  /** The receiver's pitch bend range, in semitones. */
  bendRange: number;
}

/**
 * The bytes to send for an event alphaTab played, or null for one that isn't sent: anything but a
 * note, a controller or a pitch bend; a bank select or RPN; anything on a local channel; a note pushed
 * out of MIDI's range. Every other channel goes out on `channel`. A pitch bend, written by alphaTab for
 * `BEND_RANGE`, is scaled to the receiver's `bendRange`, so it bends as far; past that range it stops there.
 */
export function messageOf(event: PlayedEvent, { channel, transpose, local, bendRange }: Routing): number[] | null {
  if (event.channel === undefined || local.has(event.channel)) return null;
  switch (event.type) {
    case NOTE_ON:
    case NOTE_OFF: {
      const key = (event.noteKey ?? 0) + transpose;
      if (key < 0 || key > 127) return null;
      return [(event.type === NOTE_ON ? 0x90 : 0x80) | channel, key, (event.noteVelocity ?? 0) & 0x7f];
    }
    case CONTROL_CHANGE: {
      const controller = event.controller ?? 0;
      if (NOT_SENT.has(controller)) return null;
      return [0xb0 | channel, controller & 0x7f, (event.value ?? 0) & 0x7f];
    }
    case PITCH_BEND: {
      const scaled = 8192 + ((event.value ?? 8192) - 8192) * (BEND_RANGE / bendRange);
      const value = Math.max(0, Math.min(16383, Math.round(scaled)));
      return [0xe0 | channel, value & 0x7f, (value >> 7) & 0x7f];
    }
    default:
      return null;
  }
}

/** The pitch bend range alphaTab writes its bends for, in semitones (its `MidiFileGenerator`). */
export const BEND_RANGE = 16;

/** Sets a channel's pitch bend range (RPN 0) to `bendRange` semitones and centres its pitch bend. */
export function setupMessages(channel: number, bendRange: number): number[][] {
  const cc = (controller: number, value: number) => [0xb0 | channel, controller, value];
  return [cc(101, 0), cc(100, 0), cc(6, bendRange), cc(38, 0), cc(101, 127), cc(100, 127), centreBend(channel)];
}

const centreBend = (channel: number) => [0xe0 | channel, 0, 64];

/* — the tap — */

/** Where the messages go: a Web MIDI output, as far as the tap uses it. */
export interface MidiPort {
  send(data: number[], timestamp?: number): void;
}

/** When a sample of the synthesizer's sound reaches the speakers, as `performance.now()` time. */
export interface SampleClock {
  /**
   * When the frame (its place in the stream handed to the output since its Play) is heard; null until
   * the speakers have taken the first block, which is when that can be known.
   */
  soundsAt(frame: number): number | null;
  /** Frames handed to the output so far, since its Play. */
  handedOver(): number;
  /** Whether the output is asking the synthesizer for sound right now. */
  requesting(): boolean;
}

/** How long before it is due a message goes to the port: the page shown, and hidden (timers slow). */
const LOOKAHEAD_MS = 40;
const HIDDEN_LOOKAHEAD_MS = 300;
/** How often the queue is looked at while anything waits in it. */
const PUMP_MS = 10;

/** A message, or the moment every note sounding ends, at a frame of the stream. */
type Queued = { frame: number; bytes: number[] } | { frame: number; release: true };

/**
 * Sends what alphaTab's synthesizer plays to a MIDI port, each message timed to sound with the built-in
 * sound. The synthesizer hands it each micro-buffer's events (`rendered`) with the frame they were
 * rendered at; the clock says when that frame is heard. Messages wait here until shortly before they
 * are due, so Stop (`release`) can drop what hasn't gone and end what has.
 */
export class MidiTap {
  /** Where messages go; none sends nothing. */
  port: MidiPort | null = null;
  /** The output channel, 0 to 15. */
  channel = 0;
  transpose = 0;
  /** The receiver's pitch bend range, in semitones. */
  bendRange = DEFAULT_BEND_RANGE;
  /** Whether rendered events are taken: during Play, not for a note heard on its own. */
  on = false;
  private queue: Queued[] = [];
  /** The key each note sounding was sent on, by the channel and key alphaTab played it on. */
  private keys = new Map<string, number[]>();
  /** Notes sent on and not off yet, on the output, as `channel:key`, with how many times each. */
  private sounding = new Map<string, number>();
  /** The last time stamp sent, so a release never lands before what is already on its way. */
  private lastSent = 0;
  /** Whether anything went out since the last release, so a release with nothing to end sends nothing. */
  private dirty = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  /** Frames counted in the request under way, past what had been handed over when it started. */
  private offset = 0;
  private handed = -1;

  constructor(
    private readonly clock: SampleClock,
    private readonly local: ReadonlySet<number>,
    private readonly now: () => number = () => performance.now(),
    private readonly hidden: () => boolean = () => typeof document !== 'undefined' && document.hidden,
  ) {}

  /** The frame the next micro-buffer starts at; a new request starts counting from what is handed over. */
  private frameNow(): number {
    const handed = this.clock.handedOver();
    if (handed !== this.handed) {
      this.handed = handed;
      this.offset = 0;
    }
    return handed + this.offset;
  }

  /** A micro-buffer of `frames` frames was rendered, playing these events at its start. */
  rendered(events: readonly (PlayedEvent | null)[], frames: number) {
    const frame = this.frameNow();
    this.offset += frames;
    if (!this.on || !this.port || events.length === 0) return;
    for (const event of events) {
      if (!event) continue;
      const bytes = this.bytesOf(event);
      if (bytes) this.enqueue({ frame, bytes });
    }
    this.pump();
  }

  /** The synthesizer let every note go while rendering (a loop going round, the end): so do these, then. */
  releasing() {
    if (!this.on || !this.port || !this.clock.requesting()) return;
    this.enqueue({ frame: this.frameNow(), release: true });
    this.keys.clear();
  }

  /** At Play: the channel's pitch bend range and a centred bend, at once. */
  start() {
    if (!this.port) return;
    for (const bytes of setupMessages(this.channel, this.bendRange)) this.send(bytes, this.now());
  }

  /** Stop, a seek, an edit: nothing waiting goes, and every note sounding ends at once. */
  release({ centre = false }: { centre?: boolean } = {}) {
    this.queue = [];
    this.keys.clear();
    if (!this.port || !this.dirty) return;
    this.endSounding(Math.max(this.now(), this.lastSent));
    if (centre) this.send(centreBend(this.channel), Math.max(this.now(), this.lastSent));
    this.dirty = false;
  }

  /** Sends what is due soon; nothing until the clock can say when a frame is heard. */
  pump() {
    const horizon = this.now() + (this.hidden() ? HIDDEN_LOOKAHEAD_MS : LOOKAHEAD_MS);
    while (this.queue.length > 0) {
      const at = this.clock.soundsAt(this.queue[0].frame);
      if (at === null || at > horizon) break;
      const item = this.queue.shift()!;
      if ('release' in item) this.endSounding(at);
      else this.send(item.bytes, at);
    }
    this.keepPumping();
  }

  destroy() {
    this.release();
    this.port = null;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  /**
   * The bytes for an event on this tap's channel. A note off ends on the key its note on was sent on, and
   * isn't sent for a note never sent on, or one a release already ended (a seek, the MIDI swapped mid-play).
   */
  private bytesOf(event: PlayedEvent): number[] | null {
    const routing = { channel: this.channel, transpose: this.transpose, local: this.local, bendRange: this.bendRange };
    if (event.type !== NOTE_ON && event.type !== NOTE_OFF) return messageOf(event, routing);
    const name = `${event.channel}:${event.noteKey}`;
    if (event.type === NOTE_ON) {
      const bytes = messageOf(event, routing);
      if (bytes) this.keys.set(name, [...(this.keys.get(name) ?? []), bytes[1]]);
      return bytes;
    }
    const sent = this.keys.get(name);
    if (!sent || sent.length === 0) return null;
    const key = sent.shift()!;
    if (sent.length === 0) this.keys.delete(name);
    return messageOf({ ...event, noteKey: key }, { ...routing, transpose: 0 });
  }

  /** Keeps the queue in the stream's order: events come in order, a release may come before some. */
  private enqueue(item: Queued) {
    let i = this.queue.length;
    while (i > 0 && this.queue[i - 1].frame > item.frame) i--;
    this.queue.splice(i, 0, item);
  }

  private send(bytes: number[], at: number) {
    const port = this.port;
    if (!port) return;
    const status = bytes[0] & 0xf0;
    const name = `${bytes[0] & 0x0f}:${bytes[1]}`;
    if (status === 0x90 && bytes[2] > 0) this.sounding.set(name, (this.sounding.get(name) ?? 0) + 1);
    else if (status === 0x80 || status === 0x90) {
      const left = (this.sounding.get(name) ?? 0) - 1;
      if (left > 0) this.sounding.set(name, left);
      else this.sounding.delete(name);
    }
    this.lastSent = Math.max(this.lastSent, at);
    this.dirty = true;
    try {
      port.send(bytes, at);
    } catch {
      // A port gone mid-play (unplugged) throws; the built-in sound plays on.
    }
  }

  /** A note off for every note sounding. */
  private endSounding(at: number) {
    for (const [name, count] of [...this.sounding]) {
      const [channel, key] = name.split(':').map(Number);
      for (let i = 0; i < count; i++) this.send([0x80 | channel, key, 0], at);
    }
    this.sounding.clear();
  }

  /** Looks at the queue every few milliseconds while anything waits; the synthesizer's requests look too. */
  private keepPumping() {
    if (this.queue.length > 0 && this.timer === null) this.timer = setInterval(() => this.pump(), PUMP_MS);
    else if (this.queue.length === 0 && this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

/** alphaTab's synthesizer, as far as the tap watches it (its `TinySoundFont`; not in its types). */
interface Synthesizer {
  synthesize(buffer: Float32Array, offset: number, samples: number): { event: PlayedEvent | null }[];
  noteOffAll(immediate: boolean): void;
}

/**
 * Hands the tap every event the synthesizer plays, micro-buffer by micro-buffer, and every time it lets
 * all its notes go. Checked against the pinned alphaTab 1.8.4 (`midiOut.test.ts` plays real MIDI through it).
 */
export function tapSynth(synth: unknown, tap: MidiTap) {
  const synthesizer = (synth as { synthesizer: Synthesizer }).synthesizer;
  const synthesize = synthesizer.synthesize.bind(synthesizer);
  synthesizer.synthesize = (buffer, offset, samples) => {
    const played = synthesize(buffer, offset, samples);
    tap.rendered(played.map(p => p.event), samples);
    return played;
  };
  const noteOffAll = synthesizer.noteOffAll.bind(synthesizer);
  synthesizer.noteOffAll = immediate => {
    tap.releasing();
    noteOffAll(immediate);
  };
}
