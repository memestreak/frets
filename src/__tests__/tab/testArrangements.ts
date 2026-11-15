/**
 * The built-in arrangements, plus the test-only ones in `fixtures/<folder>/`: arrangements the
 * tests still read and write (the Rhythm, Song structure and Sweet Child folders) that the Tab page no longer lists. Tests
 * read these in place of `readBuiltinFiles`, so each is checked as a built-in one is.
 */
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import type { BuiltinFile } from '@/features/tab/builtins';
import { readBuiltinFiles as readListed } from '@/features/tab/builtinFiles';

const FIXTURE_FOLDERS = ['rhythm', 'song_structure', 'sweet_child'];
const FIXTURES = path.join(process.cwd(), 'src/__tests__/tab/fixtures');

export async function readBuiltinFiles(): Promise<BuiltinFile[]> {
  const fixtures = await Promise.all(FIXTURE_FOLDERS.map(async folder => {
    const names = (await readdir(path.join(FIXTURES, folder))).filter(n => n.endsWith('.atex')).sort();
    return Promise.all(names.map(async file => ({ folder, file, text: await readFile(path.join(FIXTURES, folder, file), 'utf8') })));
  }));
  return [...await readListed(), ...fixtures.flat()];
}
