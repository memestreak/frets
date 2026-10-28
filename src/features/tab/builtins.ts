/**
 * The built-in arrangements (Jeremy, 2026-10-28): one file each in `builtin_arrangements/<folder>/`,
 * listed in the Arrangements dialog under their folder, opened in place of the open arrangement and
 * never saved, by `/tab#example=<file name without extension>`. Every folder but `samples` holds
 * tests too: each file must read with no warnings and write back exactly
 * (`src/__tests__/tab/examples.test.ts`). The route `src/app/tab/builtin.json/` serves them.
 */

/** A file as the route sends it. */
export interface BuiltinFile {
  /** The folder's directory name, `song_structure`. */
  folder: string;
  file: string;
  text: string;
}

export interface Builtin {
  /** In the link: /tab#example=<id>, the file name without its extension. */
  id: string;
  folder: string;
  /** The `\title` (or ASCII `Title:` line), else the file name. */
  title: string;
  text: string;
}

/** Where the page fetches them. */
export const BUILTIN_URL = '/tab/builtin.json';
/** The folder of samples for trying things out: not tests, and they may read with warnings. */
export const SAMPLES_FOLDER = 'samples';

/** A folder's name as the dialog shows it: `song_structure` is "Song structure". */
export function folderTitle(folder: string): string {
  const words = folder.replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function builtinsFrom(files: BuiltinFile[]): Builtin[] {
  return files.map(({ folder, file, text }) => {
    const id = file.replace(/\.(atex|txt)$/, '');
    const title = /\\title\s+"([^"]*)"/.exec(text)?.[1] || /^Title:\s*(.+)$/m.exec(text)?.[1]?.trim() || id;
    return { id, folder, title, text };
  });
}

/** The built-in arrangements; none when they can't be fetched. */
export async function loadBuiltins(): Promise<Builtin[]> {
  try {
    const response = await fetch(BUILTIN_URL, { cache: 'no-store' });
    if (!response.ok) return [];
    const files: unknown = await response.json();
    return Array.isArray(files) ? builtinsFrom(files.filter(isBuiltinFile)) : [];
  } catch {
    return [];
  }
}

function isBuiltinFile(f: unknown): f is BuiltinFile {
  if (typeof f !== 'object' || f === null) return false;
  const { folder, file, text } = f as Record<string, unknown>;
  return typeof folder === 'string' && typeof file === 'string' && typeof text === 'string';
}
