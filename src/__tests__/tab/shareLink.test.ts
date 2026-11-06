import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { compress, decompress, isTabLink, readLink, readShowParam, shareLink } from '@/features/tab/shareLink';

const TEX = '\\title "Riff — ♯ and ♭ & more"\n\\ts (4 4)\n(5.6 7.5).4 3.4.4 r.2 |';
const ORIGIN = 'https://frets.eminor.net';

describe('share links', () => {
  it('compresses to base64url and back, keeping any character', async () => {
    const code = await compress(TEX);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await decompress(code)).toBe(TEX);
  });

  it('makes a /tab#tabz= link at the origin that reads back as the text', async () => {
    const link = await shareLink(ORIGIN, TEX);
    expect(link.startsWith(`${ORIGIN}/tab#tabz=`)).toBe(true);
    const hash = new URL(link).hash;
    expect(isTabLink(hash)).toBe(true);
    expect(await readLink(hash)).toBe(TEX);
  });

  it('reads a link made by the Node.js recipe in tab-alphatex.txt', async () => {
    const doc = readFileSync(join(__dirname, '../../../public/tab-alphatex.txt'), 'utf8');
    expect(doc).toContain(
      "const link = 'https://frets.eminor.net/tab#tabz=' + zlib.deflateRawSync(text).toString('base64url');",
    );
    const link = `${ORIGIN}/tab#tabz=${deflateRawSync(TEX).toString('base64url')}`;
    expect(await readLink(new URL(link).hash)).toBe(TEX);
  });

  it('still reads plain #tab= links', async () => {
    expect(await readLink(`#tab=${encodeURIComponent(TEX)}`)).toBe(TEX);
  });

  it('ignores other hashes', async () => {
    expect(isTabLink('#example=bends')).toBe(false);
    expect(await readLink('#example=bends')).toBeNull();
    expect(await readLink('')).toBeNull();
  });

  it('says when a link is damaged or cut short', async () => {
    const code = await compress(TEX.repeat(20));
    expect(await readLink(`#tabz=${code.slice(0, code.length / 2)}`)).toBeInstanceOf(Error);
    expect(await readLink('#tabz=not*base64')).toBeInstanceOf(Error);
    expect(await readLink('#tab=%E0%A4%A')).toBeInstanceOf(Error);
  });

  it('keeps a long arrangement short', async () => {
    const song = readFileSync('src/features/tab/builtin_arrangements/rhythm/tuplets.atex', 'utf8').repeat(40);
    const link = await shareLink(ORIGIN, song);
    expect(link.length).toBeLessThan(encodeURIComponent(song).length / 5);
    expect(await readLink(new URL(link).hash)).toBe(song);
  });

  it('puts ?show= before the hash when asked, and never otherwise (spec 2026-11-06)', async () => {
    const link = await shareLink(ORIGIN, TEX, 'staff');
    expect(link.startsWith(`${ORIGIN}/tab?show=staff#tabz=`)).toBe(true);
    expect(readShowParam(new URL(link).search)).toBe('staff');
    expect(await readLink(new URL(link).hash)).toBe(TEX);
    expect(new URL(await shareLink(ORIGIN, TEX)).search).toBe('');
  });
});

describe('?show= (spec 2026-11-06)', () => {
  it('reads staff, tab and both, among other parameters', () => {
    expect(readShowParam('?show=staff')).toBe('staff');
    expect(readShowParam('?show=tab')).toBe('tab');
    expect(readShowParam('?theme=light&show=both')).toBe('both');
  });

  it('reads nothing when it is missing, empty, capitalised or names no view', () => {
    for (const search of ['', '?theme=light', '?show=', '?show=Staff', '?show=notation', '?show=staff%20']) {
      expect(readShowParam(search)).toBeNull();
    }
  });
});
