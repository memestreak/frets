/**
 * Reads tab in either format the page takes: ASCII tab (`ascii.ts`) or
 * alphaTex (`alphatexRead.ts`). Which one is decided by the text alone, so
 * an import never gets the other format's errors.
 */
import { readAscii, type ReadResult } from './ascii';
import { readAlphaTex } from './alphatexRead';

/**
 * Whether the text is ASCII tab: it has two dashes in a row anywhere, or a
 * line that starts as a string line does ("e|-5", "|:-"). alphaTex has
 * neither outside its quoted text: its only dash is a tie's "-.3".
 */
export function looksLikeAscii(text: string): boolean {
  const unquoted = text.replace(/"[^"]*"/g, '""');
  return /-{2,}/.test(unquoted) || /^[ \t]*[A-Ga-g1-6]?[#b♯♭]?[ \t]*\|:?-/m.test(unquoted);
}

export async function readTab(text: string): Promise<ReadResult> {
  return looksLikeAscii(text) ? readAscii(text) : readAlphaTex(text);
}

/**
 * The files Import's Open file… offers, and a drop takes: text, and alphaTex's own extensions
 * (our download is `.alphatex.txt`; alphaTab's tools write `.atex` and `.alphatex`).
 */
export const TAB_FILE_TYPES = '.txt,.atex,.alphatex,.tex,text/plain';
export const isTabFile = (f: File) => f.type.startsWith('text/') || /\.(txt|atex|alphatex|tex)$/i.test(f.name);
