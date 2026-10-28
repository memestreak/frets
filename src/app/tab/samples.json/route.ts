import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { SAMPLES_DIR, type SampleFile } from '@/features/tab/samples';

/**
 * The Tab page's sample clips, every `.atex` or `.txt` file in `src/features/tab/samples/`, as
 * `[{ file, text }]`. Written once by `next build` (`out/tab/samples.json`); the dev server reads the
 * folder afresh on each request, so a file dropped in shows up the next time Arrangements… opens.
 */
export const dynamic = 'force-static';

export async function GET() {
  const dir = path.join(process.cwd(), SAMPLES_DIR);
  const names = (await readdir(dir).catch(() => [] as string[])).filter(n => /\.(atex|txt)$/.test(n)).sort();
  const files: SampleFile[] = await Promise.all(names.map(async file => ({ file, text: await readFile(path.join(dir, file), 'utf8') })));
  return Response.json(files);
}
