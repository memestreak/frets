import { readFileSync } from 'node:fs';
import { compress, decompress, isTabLink, linkText, shareLink } from '@/features/tab/shareLink';

const TEX = '\\title "Riff — ♯ and ♭"\n\\ts (4 4)\n(5.6 7.5).4 3.4.4 r.2 |';

describe('share links', () => {
  it('compresses to base64url and back, keeping any character', async () => {
    const code = await compress(TEX);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await decompress(code)).toBe(TEX);
  });

  it('makes a /tab#tabz= link at the origin that reads back as the text', async () => {
    const link = await shareLink('https://frets.eminor.net', TEX);
    expect(link.startsWith('https://frets.eminor.net/tab#tabz=')).toBe(true);
    const hash = new URL(link).hash;
    expect(isTabLink(hash)).toBe(true);
    expect(await linkText(hash)).toBe(TEX);
  });

  it('still reads plain #tab= links', async () => {
    expect(await linkText(`#tab=${encodeURIComponent(TEX)}`)).toBe(TEX);
  });

  it('ignores other hashes', async () => {
    expect(isTabLink('#example=bends')).toBe(false);
    expect(await linkText('#example=bends')).toBeNull();
    expect(await linkText('')).toBeNull();
  });

  it('says when a link is damaged or cut short', async () => {
    const code = await compress(TEX.repeat(20));
    expect(await linkText(`#tabz=${code.slice(0, code.length / 2)}`)).toBeInstanceOf(Error);
    expect(await linkText('#tabz=not*base64')).toBeInstanceOf(Error);
    expect(await linkText('#tab=%E0%A4%A')).toBeInstanceOf(Error);
  });

  it('keeps a long arrangement short', async () => {
    const song = readFileSync('src/features/tab/builtin_arrangements/rhythm/tuplets.atex', 'utf8').repeat(40);
    const link = await shareLink('https://frets.eminor.net', song);
    expect(link.length).toBeLessThan(encodeURIComponent(song).length / 5);
    expect(await linkText(new URL(link).hash)).toBe(song);
  });
});
