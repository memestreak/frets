
/**
 * Links to a clip (issue #206). Copy link writes the clip's alphaTex compressed (deflate, then
 * base64url) into `/tab#tabz=…`, about a seventh the length of the plain text percent-encoded.
 * The text carries everything the clip plays with: its `\instrument` and its `// frets:fx` line.
 * `#tab=<percent-encoded text>` is still read, for links typed by hand or by an agent.
 */

/** A link holding the plain text, percent-encoded. */
export const PLAIN_HASH = '#tab=';
/** A link holding the text compressed. */
export const COMPRESSED_HASH = '#tabz=';

/** The link that opens `text` on the Tab page at `origin` (e.g. https://frets.eminor.net). */
export async function shareLink(origin: string, text: string): Promise<string> {
  return `${origin}/tab${COMPRESSED_HASH}${await compress(text)}`;
}

/** Whether `hash` is a link to a tab, plain or compressed. */
export const isTabLink = (hash: string) => hash.startsWith(PLAIN_HASH) || hash.startsWith(COMPRESSED_HASH);

/**
 * The text a `#tab=` or `#tabz=` hash opens; null when the hash is neither, an Error with a
 * sentence for the page when its tab can't be read.
 */
export async function readLink(hash: string): Promise<string | Error | null> {
  const compressed = hash.startsWith(COMPRESSED_HASH);
  if (!compressed && !hash.startsWith(PLAIN_HASH)) return null;
  const tab = hash.slice(compressed ? COMPRESSED_HASH.length : PLAIN_HASH.length);
  try {
    return compressed ? await decompress(tab) : decodeURIComponent(tab);
  } catch {
    return new Error(compressed
      ? 'The link\'s tab is cut short or damaged.'
      : 'The link\'s tab is not percent-encoded correctly.');
  }
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
