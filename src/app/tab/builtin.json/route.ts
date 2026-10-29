import { readBuiltinFiles } from '@/features/tab/builtinFiles';

/**
 * The Tab page's built-in arrangements, every `.atex` or `.txt` file in a folder of
 * `src/features/tab/builtin_arrangements/`, as `[{ folder, file, text }]`. Written once by
 * `next build` (`out/tab/builtin.json`); the dev server reads the folders afresh on each request, so
 * a file dropped in shows up the next time Arrangements… opens.
 */
export const dynamic = 'force-static';

export async function GET() {
  return Response.json(await readBuiltinFiles());
}
