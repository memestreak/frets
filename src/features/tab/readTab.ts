/**
 * Reads tab in either format the page takes: ASCII tab (`ascii.ts`) or
 * alphaTex (`alphatexRead.ts`). Which one is decided by the text alone, so
 * an import never gets the other format's errors.
 */
import { readAscii, type ReadResult } from './ascii';
import { readAlphaTex } from './alphatexRead';
import { missReport, reBarImport } from './reBarImport';

/**
 * Whether the text is ASCII tab: it has two dashes in a row anywhere, or a
 * line that starts as a string line does ("e|-5", "|:-"). alphaTex has
 * neither outside its quoted text: its only dash is a tie's "-.3".
 */
export function looksLikeAscii(text: string): boolean {
  const unquoted = text.replace(/"[^"]*"/g, '""');
  return /-{2,}/.test(unquoted) || /^[ \t]*[A-Ga-g1-6]?[#b♯♭]?[ \t]*\|:?-/m.test(unquoted);
}

/** A reader's warning that a bar doesn't add up (`unevenMessage`): a re-barred clip has none. */
export const UNEVEN_WARNING = /doesn't add up to/;

export interface ReadOptions {
  /**
   * Re-bar by time signature (`docs/specs/2026-11-14-tab-rebar-import-design.md`): the notes laid into
   * bars by the time signatures, and the Source bar lines that miss a downbeat listed in the warnings.
   */
  reBar?: boolean;
  /** Being pasted into an empty clip: a short first bar is a copy, placed to end on a bar line. */
  pasted?: boolean;
}

export async function readTab(text: string, { reBar = false, pasted = false }: ReadOptions = {}): Promise<ReadResult> {
  const result = looksLikeAscii(text) ? readAscii(text) : await readAlphaTex(text);
  if (!reBar || !result.ok) return result;
  const laid = reBarImport(result.clip, { pasted });
  if (!laid.ok) return { ok: false, errors: [laid.error] };
  if (laid.clip === result.clip) return result;
  const report = missReport(result.clip, laid.misses, laid.pickupHint);
  const warnings = result.warnings.filter(line => !UNEVEN_WARNING.test(line));
  return { ok: true, clip: laid.clip, warnings: report ? [...warnings, report] : warnings };
}

/**
 * The files Import's Open file… offers, and a drop takes: text, and alphaTex's own extensions
 * (our download is `.alphatex.txt`; alphaTab's tools write `.atex` and `.alphatex`).
 */
export const TAB_FILE_TYPES = '.txt,.atex,.alphatex,.tex,text/plain';
export const isTabFile = (f: File) => f.type.startsWith('text/') || /\.(txt|atex|alphatex|tex)$/i.test(f.name);
