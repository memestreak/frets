/**
 * Tab › Import, saved as `frets.tab.import` (`docs/specs/2026-11-14-tab-rebar-import-design.md`):
 * `reBar`, Re-bar by time signature, on by default. The Import dialog's checkbox changes the same value,
 * and a file or text dropped on the page follows it; links and built-in arrangements never re-bar.
 */
export const IMPORT_KEY = 'frets.tab.import';

export interface ImportPrefs {
  /** Notes flow into bars by the time signatures, tied over bar lines (`reBarImport.ts`). */
  reBar: boolean;
}

export const DEFAULT_IMPORT: ImportPrefs = { reBar: true };

export function parseImportPrefs(raw: unknown): ImportPrefs {
  const fields = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return { reBar: typeof fields.reBar === 'boolean' ? fields.reBar : DEFAULT_IMPORT.reBar };
}
