/**
 * Golden files for the ASCII reader: every `fixtures/<name>.in.txt` is tab
 * as people write it, and `<name>.out.txt` is what the import must give,
 * the warnings ("! ") or errors ("x ") first, then a blank line and the
 * canonical ASCII. See `fixtures/README.md`.
 *
 * To add a case, add its `.in.txt` and run
 * `UPDATE_FIXTURES=1 npx vitest run src/__tests__/tab/fixtures.test.ts`,
 * then read the new `.out.txt` before committing it.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readAscii, writeAscii } from '@/features/tab/ascii';
import { partOf } from '@/features/tab/clip';

const DIR = join(__dirname, 'fixtures');
const UPDATE = process.env.UPDATE_FIXTURES === '1';
const names = readdirSync(DIR).filter(f => f.endsWith('.in.txt')).map(f => f.slice(0, -'.in.txt'.length)).sort();

/** What an import gives, written the way `.out.txt` holds it. */
function outcome(input: string): string {
  const result = readAscii(input);
  if (!result.ok) return `${result.errors.map(e => `x ${e}`).join('\n')}\n`;
  const notes = result.warnings.map(w => `! ${w}`).join('\n');
  return `${notes}\n\n${writeAscii(partOf(result.clip))}\n`;
}

describe('ASCII fixtures', () => {
  it('has some', () => {
    expect(names.length).toBeGreaterThan(0);
  });

  it.each(names)('%s', name => {
    const got = outcome(readFileSync(join(DIR, `${name}.in.txt`), 'utf8'));
    const outPath = join(DIR, `${name}.out.txt`);
    if (UPDATE) writeFileSync(outPath, got);
    expect(existsSync(outPath), `${name}.out.txt is missing: run with UPDATE_FIXTURES=1`).toBe(true);
    expect(got).toBe(readFileSync(outPath, 'utf8'));

    // The canonical ASCII is stable: it reads back with nothing guessed or
    // ignored (a bar that didn't add up still doesn't) and writes the same.
    const ascii = got.split('\n\n').slice(1).join('\n\n');
    if (ascii) {
      const again = readAscii(ascii);
      expect(again.ok && again.warnings.filter(w => !/add up to/.test(w))).toEqual([]);
      if (again.ok) expect(`${writeAscii(partOf(again.clip))}\n`).toBe(ascii);
    }
  });
});
