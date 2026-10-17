import { PLUCK_SECONDS, renderPluck } from './pluck';
import { sampleFor, sampleUrls, type RefSound } from './sounds';

/** After a reference note, the room's echo dies away for this long. */
const ECHO_MS = 150;

let output: AudioContext | null = null;
let playing: AudioBufferSourceNode | null = null;
let soundingUntil = 0;
/** Counts presses, so a recording that loads after a later press stays quiet. */
let presses = 0;
const decoded = new Map<string, Promise<AudioBuffer>>();

/** Is a reference note (or its echo) sounding, for a mic to ignore? */
export const referenceSounding = (): boolean => performance.now() < soundingUntil;

const context = (): AudioContext => (output ??= new AudioContext());

/** A recording, fetched and decoded once. */
function load(url: string): Promise<AudioBuffer> {
  let buffer = decoded.get(url);
  if (!buffer) {
    buffer = fetch(url)
      .then(r => r.arrayBuffer())
      .then(data => context().decodeAudioData(data));
    // A failed fetch may succeed later.
    buffer.catch(() => decoded.delete(url));
    decoded.set(url, buffer);
  }
  return buffer;
}

/** Fetches a sound's recordings ahead of the first press. */
export function preloadReference(sound: RefSound) {
  if (sound !== 'synth') sampleUrls(sound).forEach(url => void load(url).catch(() => {}));
}

/**
 * Plays open string `midi` in `sound` through the speakers, cutting off
 * any note before it. The mic is deaf to it from the press, while the
 * recording is still loading too.
 */
export async function playReference(midi: number, sound: RefSound) {
  const press = ++presses;
  const ctx = context();
  void ctx.resume();
  playing?.stop();
  playing = null;
  soundingUntil = performance.now() + PLUCK_SECONDS * 1000 + ECHO_MS;
  let buffer: AudioBuffer;
  let rate = 1;
  if (sound === 'synth') {
    const samples = renderPluck(midi, ctx.sampleRate);
    buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    buffer.copyToChannel(samples, 0);
  } else {
    const sample = sampleFor(sound, midi);
    rate = sample.rate;
    try {
      buffer = await load(sample.url);
    } catch {
      if (press === presses) soundingUntil = 0;
      return;
    }
    if (press !== presses) return;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = rate;
  source.connect(ctx.destination);
  source.start();
  playing = source;
  soundingUntil = performance.now() + (buffer.duration / rate) * 1000 + ECHO_MS;
}
