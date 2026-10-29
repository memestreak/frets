import { parseEffects, type FxSettings } from './effects';
import { isSound, type Sound } from './playback';

/**
 * Links to a clip (issue #206). Copy link writes the clip's alphaTex compressed (deflate, then
 * base64url) into `/tab#tabz=…`, about a seventh the length of the plain text percent-encoded,
 * followed by the sound and FX it plays with: `&sound=27&fx=on&distortion=on&drive=0.5…`.
 * `#tab=<percent-encoded text>` is still read, for links typed by hand or by an agent, and takes
 * the same sound and FX fields.
 */

/** A link holding the plain text, percent-encoded. */
export const PLAIN_HASH = '#tab=';
/** A link holding the text compressed. */
export const COMPRESSED_HASH = '#tabz=';

/** What a link plays the clip with (Jeremy, 2026-10-29): the Sound and the FX dialog's settings. */
export interface LinkSound {
  sound: Sound;
  effects: FxSettings;
}

/** What a link opens: the tab, and the sound and FX when the link names them. */
export interface LinkContent {
  text: string;
  sound?: Sound;
  effects?: FxSettings;
}

/** The link that opens `text` on the Tab page at `origin` (e.g. https://frets.eminor.net), played with `sound`. */
export async function shareLink(origin: string, text: string, sound?: LinkSound): Promise<string> {
  const fields = sound ? `&${soundFields(sound)}` : '';
  return `${origin}/tab${COMPRESSED_HASH}${await compress(text)}${fields}`;
}

/** Whether `hash` is a link to a tab, plain or compressed. */
export const isTabLink = (hash: string) => hash.startsWith(PLAIN_HASH) || hash.startsWith(COMPRESSED_HASH);

/**
 * What a `#tab=` or `#tabz=` hash opens; null when the hash is neither, an Error with a sentence
 * for the page when its tab can't be read. Sound and FX fields that can't be read are left out.
 */
export async function readLink(hash: string): Promise<LinkContent | Error | null> {
  const compressed = hash.startsWith(COMPRESSED_HASH);
  if (!compressed && !hash.startsWith(PLAIN_HASH)) return null;
  // The tab comes first; `&` can't be in it, as base64url has none and percent-encoding writes %26.
  const [tab, ...rest] = hash.slice(compressed ? COMPRESSED_HASH.length : PLAIN_HASH.length).split('&');
  let text: string;
  try {
    text = compressed ? await decompress(tab) : decodeURIComponent(tab);
  } catch {
    return new Error(compressed
      ? 'The link\'s tab is cut short or damaged.'
      : 'The link\'s tab is not percent-encoded correctly.');
  }
  return { text, ...readSoundFields(new URLSearchParams(rest.join('&'))) };
}

/** The sound and FX as the link's fields, in the FX dialog's order. */
function soundFields({ sound, effects: fx }: LinkSound): string {
  const onOff = (on: boolean) => (on ? 'on' : 'off');
  return new URLSearchParams({
    sound: String(sound),
    fx: onOff(fx.on),
    distortion: onOff(fx.distortionOn),
    drive: String(fx.drive),
    tone: String(fx.tone),
    reverb: onOff(fx.reverbOn),
    amount: String(fx.reverb),
    decay: String(fx.decay),
  }).toString();
}

/** The sound, when the link names one Frets has, and the FX, when it has `fx` (each other field defaulted). */
function readSoundFields(fields: URLSearchParams): { sound?: Sound; effects?: FxSettings } {
  // Number(null) is 0, the piano: a link without the field names no sound.
  const sound = fields.has('sound') ? Number(fields.get('sound')) : undefined;
  const onOff = (name: string) => ({ on: true, off: false })[fields.get(name) ?? ''];
  const number = (name: string) => (fields.has(name) ? Number(fields.get(name)) : undefined);
  const effects = fields.has('fx')
    ? parseEffects({
      on: onOff('fx'),
      distortionOn: onOff('distortion'),
      drive: number('drive'),
      tone: number('tone'),
      reverbOn: onOff('reverb'),
      reverb: number('amount'),
      decay: number('decay'),
    })
    : undefined;
  return { ...(isSound(sound) ? { sound } : {}), ...(effects ? { effects } : {}) };
}

/** `text` as UTF-8, deflated (raw, no header) and written in base64url without padding. */
export async function compress(text: string): Promise<string> {
  const bytes = await pipe(new TextEncoder().encode(text), new CompressionStream('deflate-raw'));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The text `compress` made; throws when `code` isn't base64url or doesn't inflate. */
export async function decompress(code: string): Promise<string> {
  const binary = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(await pipe(bytes, new DecompressionStream('deflate-raw')));
}

/** Runs `bytes` through a compression stream and collects what comes out. */
async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  // Not awaited: the output is read as the input goes in. A bad input fails the read below instead.
  writer.write(bytes as Uint8Array<ArrayBuffer>).catch(() => {});
  writer.close().catch(() => {});
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}
