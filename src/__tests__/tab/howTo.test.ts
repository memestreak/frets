/**
 * The How to lessons (`builtin_arrangements/how_to/`, issue #443) teach keys in their steps. Their
 * README lists each lesson's keys; these must still be the Tab page's shortcuts, so a key that
 * changes shows up here and its lessons get rewritten in the same PR.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { EVERYWHERE } from '@/lib/shortcuts';
import { BUILTIN_DIR, readBuiltinFiles } from '@/features/tab/builtinFiles';
import { TAB_SHORTCUTS } from '@/features/tab/shortcuts';

const FOLDER = 'how_to';

/** Every key the page lists, a range such as `Shift+1–7` or `A–G` spelt out one key at a time. */
function pageKeys(): Set<string> {
  const keys = new Set<string>();
  for (const group of [...TAB_SHORTCUTS, EVERYWHERE]) {
    for (const shortcut of group.shortcuts) {
      for (const key of shortcut.keys) {
        keys.add(key);
        const range = /^(.*?)(\w)–(\w)$/.exec(key);
        if (!range) continue;
        const [, prefix, from, to] = range;
        for (let c = from.charCodeAt(0); c <= to.charCodeAt(0); c++) keys.add(prefix + String.fromCharCode(c));
      }
    }
  }
  return keys;
}

/** The README's table: file name and its Keys column, split at the commas. */
function lessonRows(): { file: string; keys: string[] }[] {
  const readme = readFileSync(path.join(BUILTIN_DIR, FOLDER, 'README.md'), 'utf8');
  return readme.split('\n')
    .map(line => /^\| `([^`]+)` \|[^|]*\| (.+) \|$/.exec(line))
    .filter((m): m is RegExpExecArray => m !== null)
    .map(([, file, keys]) => ({ file, keys: keys.split(', ') }));
}

describe('the How to lessons', () => {
  const rows = lessonRows();

  it('each has a row in the README, and each row a lesson', async () => {
    const files = (await readBuiltinFiles()).filter(f => f.folder === FOLDER).map(f => f.file);
    expect(files.length).toBeGreaterThan(0);
    expect(rows.map(r => r.file).sort()).toEqual([...files].sort());
  });

  it('teach only keys the Tab page still has', () => {
    const keys = pageKeys();
    for (const row of rows) {
      for (const key of row.keys) expect(keys.has(key), `${row.file} teaches ${key}`).toBe(true);
    }
  });

  it('read a range of keys as each key in it', () => {
    const keys = pageKeys();
    expect(keys.has('Shift+4')).toBe(true);
    expect(keys.has('Alt+2')).toBe(true);
    expect(keys.has('F')).toBe(true);
    expect(keys.has('Shift+8')).toBe(false);
  });
});
