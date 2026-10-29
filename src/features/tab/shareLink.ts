import { isSound, type Sound } from './playback';

/**
 * Links to a clip (issue #206). Copy link writes the clip's alphaTex compressed (deflate, then
 * base64url) into `/tab#tabz=…`, about a seventh the length of the plain text percent-encoded,
 * followed by the sound it plays in: `&sound=27`. The FX are in the text, its `// frets:fx` line.
 * `#tab=<percent-encoded text>` is still read, for links typed by hand or by an agent, and takes
 * the same sound field.
 */

/** A link holding the plain text, percent-encoded. */
export const PLAIN_HASH = '#tab=';
/** A link holding the text compressed. */
export const COMPRESSED_HASH = '#tabz=';

/** What a link opens: the tab, and the sound when the link names one. */
export interface LinkContent {
  text: string;
  sound?: Sound;
}

/** The link that opens `text` on the Tab page at `origin` (e.g. https://frets.eminor.net), played with `sound`. */
export async function shareLink(origin: string, text: string, sound?: Sound): Promise<string> {
  const fields = sound === undefined ? '' : `&${new URLSearchParams({ sound: String(sound) })}`;
  return `${origin}/tab${COMPRESSED_HASH}${await compress(text)}${fields}`;
}

/** Whether `hash` is a link to a tab, plain or compressed. */
export const isTabLink = (hash: string) => hash.startsWith(PLAIN_HASH) || hash.startsWith(COMPRESSED_HASH);

/**
 * What a `#tab=` or `#tabz=` hash opens; null when the hash is neither, an Error with a sentence
 * for the page when its tab can't be read. A sound Frets doesn't have is left out.
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
  const fields = new URLSearchParams(rest.join('&'));
  // Number(null) is 0, the piano: a link without the field names no sound.
  const sound = fields.has('sound') ? Number(fields.get('sound')) : undefined;
  return isSound(sound) ? { text, sound } : { text };
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
