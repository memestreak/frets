import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Mocks are for picking on a branch; the pick ships, the mock doesn't
 * (`docs/specs/2026-11-01-mock-switcher-design.md`). This fails while any page still declares one,
 * so a branch with mocks can't merge until they're removed.
 */
const SRC = join(__dirname, '..');
const ALLOWED = ['components/mocks/', '__tests__/'];

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe('mocks', () => {
  it('are all removed before merging: no page calls useMock', () => {
    const left = files(SRC)
      .map(path => relative(SRC, path))
      .filter(path => !ALLOWED.some(dir => path.startsWith(dir)))
      .filter(path => /\buseMock\s*\(/.test(readFileSync(join(SRC, path), 'utf8')));
    expect(left).toEqual([]);
  });
});
