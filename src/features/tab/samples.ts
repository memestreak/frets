/**
 * Sample clips for testing (Jeremy, 2026-10-28): every `.atex` (alphaTex) or `.txt` (ASCII tab)
 * file dropped into `samples/` shows up in the Examples dialog under "Samples", with no list to keep.
 * Unlike the examples, they are not tests: a sample may read with warnings, or not read at all.
 * The route `src/app/tab/samples.json/route.ts` lists the folder.
 */
import type { TabExample } from './examples';

/** The folder, from the project's root. */
export const SAMPLES_DIR = 'src/features/tab/samples';
/** Where the page fetches the samples. */
export const SAMPLES_URL = '/tab/samples.json';
/** A sample's id starts with this, so it never clashes with an example's: /tab#example=sample-riff. */
export const SAMPLE_PREFIX = 'sample-';

export interface SampleFile {
  file: string;
  text: string;
}

/** The samples as examples: titled by their `\title` (or ASCII `Title:`), else the file name. */
export function samplesFrom(files: SampleFile[]): TabExample[] {
  return files.map(({ file, text }) => {
    const name = file.replace(/\.(atex|txt)$/, '');
    const title = /\\title\s+"([^"]*)"/.exec(text)?.[1] || /^Title:\s*(.+)$/m.exec(text)?.[1]?.trim() || name;
    return { id: `${SAMPLE_PREFIX}${name}`, title, shows: file, text };
  });
}

/** The samples now in the folder; none when they can't be fetched. */
export async function loadSamples(): Promise<TabExample[]> {
  try {
    const response = await fetch(SAMPLES_URL, { cache: 'no-store' });
    if (!response.ok) return [];
    const files: unknown = await response.json();
    return Array.isArray(files) ? samplesFrom(files.filter(isSampleFile)) : [];
  } catch {
    return [];
  }
}

function isSampleFile(f: unknown): f is SampleFile {
  return typeof f === 'object' && f !== null && typeof (f as SampleFile).file === 'string' && typeof (f as SampleFile).text === 'string';
}
