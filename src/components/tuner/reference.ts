import { PLUCK_SECONDS, renderPluck } from './pluck';
import { sampleFor, sampleUrls, type RefSound } from './sounds';

/** After a reference note, the room's echo dies away for this long. */
const ECHO_MS = 150;

let output: AudioContext | null = null;
let soundingUntil = 0;
const decoded = new Map<string, Promise<AudioBuffer>>();

/** Is a reference note (or its echo) sounding, for a mic to ignore? */
export const referenceSounding = (): boolean => performance.now() < soundingUntil;

/** Keeps the mic deaf until `until` at least; overlapping notes extend it. */
const deafUntil = (until: number) => {
  soundingUntil = Math.max(soundingUntil, until);
};

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
 * Plays open string `midi` in `sound` through the speakers. Notes ring on
 * together, as strings do, rather than cutting each other off. The mic is
 * deaf from the press, while a recording is still loading too.
 */
export async function playReference(midi: number, sound: RefSound) {
  const ctx = context();
  void ctx.resume();
  deafUntil(performance.now() + PLUCK_SECONDS * 1000 + ECHO_MS);
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
      return;
    }
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = rate;
  source.connect(ctx.destination);
  source.start();
  deafUntil(performance.now() + (buffer.duration / rate) * 1000 + ECHO_MS);
}
