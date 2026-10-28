/**
 * The built-in arrangements on disk (server and tests only): every `.atex` (alphaTex) or `.txt`
 * (ASCII tab) file one folder down in `builtin_arrangements/`, each folder a folder in the
 * Arrangements dialog. Adding a file is all it takes to list one.
 */
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import type { BuiltinFile } from './builtins';

/** The folder, from the project's root. */
export const BUILTIN_DIR = 'src/features/tab/builtin_arrangements';

const TAB_FILE = /\.(atex|txt)$/;

export async function readBuiltinFiles(root = process.cwd()): Promise<BuiltinFile[]> {
  const dir = path.join(root, BUILTIN_DIR);
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const folders = entries.filter(e => e.isDirectory()).map(e => e.name).sort();
  const perFolder = await Promise.all(folders.map(async folder => {
    const names = (await readdir(path.join(dir, folder))).filter(n => TAB_FILE.test(n)).sort();
    return Promise.all(names.map(async file => ({ folder, file, text: await readFile(path.join(dir, folder, file), 'utf8') })));
  }));
  return perFolder.flat();
}
