
/**
 * Links to a clip (issue #206). Copy link writes the clip's alphaTex compressed (deflate, then
 * base64url) into `/tab#tabz=…`, two to seven times shorter than the plain text percent-encoded
 * (more for longer clips).
 * The text carries everything the clip plays with: each track's `\instrument` and `// frets:fx` line.
 * `#tab=<percent-encoded text>` is still read, for links typed by hand or by an agent.
 * A link can also say what the page shows for that visit, `/tab?show=staff|tab|both#…`
 * (`docs/specs/2026-11-06-tab-show-link-design.md`).
 */

import { PARTS, type Parts } from './layout';

/** A link holding the plain text, percent-encoded. */
export const PLAIN_HASH = '#tab=';
/** A link holding the text compressed. */
export const COMPRESSED_HASH = '#tabz=';

/** The link parameter that picks the staff view, the tab or both for one visit, e.g. `/tab?show=both#tabz=…`. */
export const SHOW_PARAM = 'show';

/**
 * The link that opens `text` on the Tab page at `origin` (e.g. https://frets.eminor.net); with
 * `show`, drawn as the staff, the tab or both for that visit.
 */
export async function shareLink(origin: string, text: string, show?: Parts): Promise<string> {
  const query = show ? `?${SHOW_PARAM}=${show}` : '';
  return `${origin}/tab${query}${COMPRESSED_HASH}${await compress(text)}`;
}

/** What a link's `?show=` asks the page to show (a URL's search part); null when it is missing or names none. */
export function readShowParam(search: string): Parts | null {
  const show = new URLSearchParams(search).get(SHOW_PARAM);
  return PARTS.find(p => p === show) ?? null;
}

/** Takes `?show=` out of the address once read, keeping the rest, so a reload shows the saved choice. */
export function dropShowParam(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(SHOW_PARAM)) return;
  url.searchParams.delete(SHOW_PARAM);
  window.history.replaceState(window.history.state, '', url.href);
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
