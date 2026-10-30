import { describe, expect, it } from 'vitest';
import { readAscii } from '@/features/tab/ascii';
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import {
  DEFAULT_TAB_EXPORT, parseTabExportStyle, tabFileName, tabImageSize, tabSvg,
} from '@/features/tab/exportTab';
import { DEFAULT_VIEW } from '@/features/tab/viewOptions';
import { type Clip, partOf } from '@/features/tab/clip';

const clip = partOf((readAscii([
  'Title: Riff',
  'e|--5-7-5-7--|5-7-5-7--|5-7-5-7--|5-7-5-7--|',
  'B|-----------|---------|---------|---------|',
  'G|-----------|---------|---------|---------|',
  'D|-----------|---------|---------|---------|',
  'A|-----------|---------|---------|---------|',
  'E|-----------|---------|---------|---------|',
].join('\n')) as { clip: Clip }).clip);

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

  it('takes the View options\' colours, and black on white with the theme\'s', () => {
    const style = { width: 800, transparent: false, name: true } as const;
    const night = tabSvg(clip, style, 'My riff', 'tab', { ...DEFAULT_VIEW, colours: 'night' });
    expect(night).toContain('fill="#1c1a17"');
    expect(night).toContain('fill="#e8e2d6"');
    expect(night).not.toContain('fill="#000000"');
    const custom = tabSvg(clip, style, 'My riff', 'tab', { ...DEFAULT_VIEW, colours: 'custom', custom: { text: '#123456', background: '#fedcba' } });
    expect(custom).toContain('fill="#fedcba"');
    expect(custom).toContain('fill="#123456"');
    expect(tabSvg(clip, style, 'My riff', 'tab', DEFAULT_VIEW)).toContain('fill="#000000"');
  });

  it('draws a let ring or P.M. shorter than its label as the label alone, with nothing through the word', () => {
    const read = readAlphaTexWith(alphaTab, '0.6{lr}.16 0.6.16 0.6.8 0.6.4 0.6{pm}.4 0.6{pm}.4 0.6{pm}.4 |');
    if (!read.ok) throw new Error(read.errors.join('\n'));
    const svg = tabSvg(partOf(read.clip), { width: 800, transparent: true, name: false }, '');
    const group = (id: string) => svg.match(new RegExp(`<g data-testid="${id}">(.*?)</g>`))![1];
    expect(group('let-ring')).not.toContain('<line');
    expect(group('palm-mute').match(/<line/g)).toHaveLength(2);
  });

  it('draws a legato slide with a slur over both notes and a shift slide as the line alone', () => {
    const draw = (tex: string) => {
      const read = readAlphaTexWith(alphaTab, tex);
      if (!read.ok) throw new Error(read.errors.join('\n'));
      return tabSvg(partOf(read.clip), { width: 800, transparent: true, name: false }, '');
    };
    expect(draw('5.3{sl}.4 7.3.4 r.2 |').match(/data-testid="legato"/g)).toHaveLength(1);
    expect(draw('5.3{ss}.4 7.3.4 r.2 |')).not.toContain('data-testid="legato"');
  });

  it('names its file safely', () => {
    expect(tabFileName('My riff: take 2')).toBe('My_riff__take_2');
    expect(tabFileName('')).toBe('Tab');
  });
});
