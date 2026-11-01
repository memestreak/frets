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

/** Recordings built into an MCP App (#283), by their site URL, as data: URLs. */
let builtIn: Readonly<Record<string, string>> = {};

/**
 * Plays these recordings instead of fetching them from the site: an MCP App's frame can't reach
 * the site, so it builds them in. Keys are the URLs `sampleUrls` gives.
 */
export function setBuiltInRecordings(recordings: Readonly<Record<string, string>>) {
  builtIn = recordings;
}

/** A data: URL's bytes, without fetch (which a host's CSP may refuse for data:). */
function dataUrlBytes(dataUrl: string): ArrayBuffer {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** A recording, fetched (or taken from the built-in ones) and decoded once. */
function load(url: string): Promise<AudioBuffer> {
  let buffer = decoded.get(url);
  if (!buffer) {
    const inline = builtIn[url];
    buffer = (inline ? Promise.resolve(dataUrlBytes(inline)) : fetch(url).then(r => r.arrayBuffer()))
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
