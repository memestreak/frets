import { describe, expect, it } from 'vitest';
import { readAscii } from '@/features/tab/ascii';
import type { Clip } from '@/features/tab/clip';
import {
  DEFAULT_TAB_EXPORT, parseTabExportStyle, tabFileName, tabImageSize, tabSvg,
} from '@/features/tab/exportTab';

const clip = (readAscii([
  'Title: Riff',
  'e|--5-7-5-7--|5-7-5-7--|5-7-5-7--|5-7-5-7--|',
  'B|-----------|---------|---------|---------|',
  'G|-----------|---------|---------|---------|',
  'D|-----------|---------|---------|---------|',
  'A|-----------|---------|---------|---------|',
  'E|-----------|---------|---------|---------|',
].join('\n')) as { clip: Clip }).clip;

describe('parseTabExportStyle', () => {
  it('keeps valid choices and defaults the rest', () => {
    expect(parseTabExportStyle(null)).toEqual(DEFAULT_TAB_EXPORT);
    expect(parseTabExportStyle({ width: 480, transparent: false, name: false }))
      .toEqual({ width: 480, transparent: false, name: false });
    expect(parseTabExportStyle({ width: 700, transparent: 'yes' })).toEqual(DEFAULT_TAB_EXPORT);
  });
});

describe('the tab as an image', () => {
  it('is as wide as chosen, taller when narrower, and taller again with the name', () => {
    const wide = tabImageSize(clip, { width: 1200, transparent: true, name: false }, 'Riff');
    const narrow = tabImageSize(clip, { width: 480, transparent: true, name: false }, 'Riff');
    const named = tabImageSize(clip, { width: 480, transparent: true, name: true }, 'Riff');
    expect(wide.width).toBe(1200);
    expect(narrow.width).toBe(480);
    expect(narrow.height).toBeGreaterThan(wide.height);
    expect(named.height).toBeGreaterThan(narrow.height);
    // An empty name takes no room.
    expect(tabImageSize(clip, { width: 480, transparent: true, name: true }, ' ').height).toBe(narrow.height);
  });

  it('is standalone SVG: the name, black ink, white behind only when not transparent', () => {
    const svg = tabSvg(clip, { width: 800, transparent: false, name: true }, 'My riff');
    expect(svg).toMatch(/^<svg[^>]*xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    expect(svg).toContain('>My riff</text>');
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).not.toContain('var(--');
    const clear = tabSvg(clip, { width: 800, transparent: true, name: false }, 'My riff');
    expect(clear).not.toContain('My riff');
    expect(clear).not.toContain('fill="#ffffff"');
  });

  it('names its file safely', () => {
    expect(tabFileName('My riff: take 2')).toBe('My_riff__take_2');
    expect(tabFileName('')).toBe('Tab');
  });
});
