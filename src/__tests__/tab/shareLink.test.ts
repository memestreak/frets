import { readFileSync } from 'node:fs';
import { DEFAULT_FX, type FxSettings } from '@/features/tab/effects';
import { compress, decompress, isTabLink, readLink, shareLink } from '@/features/tab/shareLink';

const TEX = '\\title "Riff — ♯ and ♭ & more"\n\\ts (4 4)\n(5.6 7.5).4 3.4.4 r.2 |';
const FX: FxSettings = { on: true, distortionOn: true, drive: 0.8, tone: 0.25, reverbOn: false, reverb: 0.4, decay: 2.5 };
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
    expect(await readLink(hash)).toEqual({ text: TEX });
  });

  it('carries the sound and FX, in readable fields after the tab', async () => {
    const link = await shareLink(ORIGIN, TEX, { sound: 27, effects: FX });
    expect(link).toMatch(/&sound=27&fx=on&distortion=on&drive=0\.8&tone=0\.25&reverb=off&amount=0\.4&decay=2\.5$/);
    expect(await readLink(new URL(link).hash)).toEqual({ text: TEX, sound: 27, effects: FX });
  });

  it('reads sound and FX fields on a plain #tab= link too', async () => {
    expect(await readLink(`#tab=${encodeURIComponent(TEX)}&sound=0`)).toEqual({ text: TEX, sound: 0 });
  });

  it('leaves out a sound Frets doesn\'t have, and defaults FX fields that are missing or wrong', async () => {
    const link = await readLink(`#tab=${encodeURIComponent(TEX)}&sound=99&fx=on&drive=7&decay=2`);
    expect(link).toEqual({ text: TEX, effects: { ...DEFAULT_FX, on: true, decay: 2 } });
  });

  it('still reads plain #tab= links', async () => {
    expect(await readLink(`#tab=${encodeURIComponent(TEX)}`)).toEqual({ text: TEX });
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
    expect(await readLink(new URL(link).hash)).toEqual({ text: song });
  });
});
