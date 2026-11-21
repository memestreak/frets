import { describe, expect, it } from 'vitest';
import { readAscii } from '@/features/tab/ascii';
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import {
  DEFAULT_TAB_EXPORT, exportedClip, parseTabExportStyle, tabFileName, tabImageSize, tabSvg,
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
    expect(parseTabExportStyle({ ...DEFAULT_TAB_EXPORT, width: 480, transparent: false, name: false }))
      .toEqual({ ...DEFAULT_TAB_EXPORT, width: 480, transparent: false, name: false });
    expect(parseTabExportStyle({ barNumbers: 'one', startKey: false, startTime: false, startTempo: false }))
      .toEqual({ ...DEFAULT_TAB_EXPORT, barNumbers: 'one', startKey: false, startTime: false, startTempo: false });
    expect(parseTabExportStyle({ barNumbers: 'every', startKey: 'no' })).toEqual(DEFAULT_TAB_EXPORT);
    expect(parseTabExportStyle({ timeSignatures: false, tabLetters: false, texts: false }))
      .toEqual({ ...DEFAULT_TAB_EXPORT, timeSignatures: false, tabLetters: false, texts: false });
    expect(parseTabExportStyle({ timeSignatures: 'no', tabLetters: 0, texts: null, barNumbers: 'song' })).toEqual(DEFAULT_TAB_EXPORT);
    expect(parseTabExportStyle({ width: 700, transparent: 'yes' })).toEqual(DEFAULT_TAB_EXPORT);
  });
});

describe('the tab as an image', () => {
  it('is as wide as chosen, taller when narrower, and taller again with the name', () => {
    const wide = tabImageSize(clip, { ...DEFAULT_TAB_EXPORT, width: 1200, transparent: true, name: false }, 'Riff');
    const narrow = tabImageSize(clip, { ...DEFAULT_TAB_EXPORT, width: 480, transparent: true, name: false }, 'Riff');
    const named = tabImageSize(clip, { ...DEFAULT_TAB_EXPORT, width: 480, transparent: true, name: true }, 'Riff');
    expect(wide.width).toBe(1200);
    expect(narrow.width).toBe(480);
    expect(narrow.height).toBeGreaterThan(wide.height);
    expect(named.height).toBeGreaterThan(narrow.height);
    // An empty name takes no room.
    expect(tabImageSize(clip, { ...DEFAULT_TAB_EXPORT, width: 480, transparent: true, name: true }, ' ').height).toBe(narrow.height);
  });

  it('is standalone SVG: the name, black ink, white behind only when not transparent', () => {
    const svg = tabSvg(clip, { ...DEFAULT_TAB_EXPORT, width: 800, transparent: false, name: true }, 'My riff');
    expect(svg).toMatch(/^<svg[^>]*xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    expect(svg).toContain('>My riff</text>');
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).not.toContain('var(--');
    const clear = tabSvg(clip, { ...DEFAULT_TAB_EXPORT, width: 800, transparent: true, name: false }, 'My riff');
    expect(clear).not.toContain('My riff');
    expect(clear).not.toContain('fill="#ffffff"');
  });

  it('takes the View options\' colours, and black on white with the theme\'s', () => {
    const style = { ...DEFAULT_TAB_EXPORT, width: 800, transparent: false, name: true } as const;
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
    const svg = tabSvg(partOf(read.clip), { ...DEFAULT_TAB_EXPORT, width: 800, transparent: true, name: false }, '');
    const group = (id: string) => svg.match(new RegExp(`<g data-testid="${id}">(.*?)</g>`))![1];
    expect(group('let-ring')).not.toContain('<line');
    expect(group('palm-mute').match(/<line/g)).toHaveLength(2);
  });

  it('draws a legato slide with a slur over both notes and a shift slide as the line alone', () => {
    const draw = (tex: string) => {
      const read = readAlphaTexWith(alphaTab, tex);
      if (!read.ok) throw new Error(read.errors.join('\n'));
      return tabSvg(partOf(read.clip), { ...DEFAULT_TAB_EXPORT, width: 800, transparent: true, name: false }, '');
    };
    expect(draw('5.3{sl}.4 7.3.4 r.2 |').match(/data-testid="legato"/g)).toHaveLength(1);
    expect(draw('5.3{ss}.4 7.3.4 r.2 |')).not.toContain('data-testid="legato"');
  });

  it('names its file safely', () => {
    expect(tabFileName('My riff: take 2')).toBe('My_riff__take_2');
    expect(tabFileName('')).toBe('Tab');
  });
});

describe('what an export leaves out (issue #532)', () => {
  const read = (text: string) => {
    const result = readAlphaTexWith(alphaTab, text);
    if (!result.ok) throw new Error(result.errors.join('\n'));
    return result.clip;
  };
  const texted = read('\\ts (4 4)\n0.6.2{txt "let ring"} 2.6.2 |\n\\ts (3 4) 3.6.2{d txt "slowly"} |');
  const svgOf = (style: Partial<typeof DEFAULT_TAB_EXPORT>, parts: 'tab' | 'both' = 'tab') => {
    const host = document.createElement('div');
    host.innerHTML = tabSvg(partOf(texted), { ...DEFAULT_TAB_EXPORT, name: false, ...style }, 'Riff', parts);
    return host;
  };
  const letters = (host: Element) => [...host.querySelectorAll('text')].filter(t => ['T', 'A', 'B'].includes(t.textContent ?? '')).length;
  const firstFret = (host: Element) => Math.min(...[...host.querySelectorAll('text')].filter(t => t.textContent === '0').map(t => Number(t.getAttribute('x'))));

  it('leaves out every time signature of the tab alone, and the room for it', () => {
    const shown = svgOf({});
    const bare = svgOf({ timeSignatures: false });
    expect(shown.querySelectorAll('[data-testid="time-signature"]')).toHaveLength(2);
    expect(bare.querySelectorAll('[data-testid="time-signature"]')).toHaveLength(0);
    expect(firstFret(bare)).toBeLessThan(firstFret(shown));
  });

  it('leaves out TAB at the start of each line of the tab alone, and the room for it', () => {
    expect(letters(svgOf({}))).toBe(3);
    const bare = svgOf({ tabLetters: false });
    expect(letters(bare)).toBe(0);
    expect(firstFret(bare)).toBeLessThan(firstFret(svgOf({})));
  });

  it('keeps both with the staff', () => {
    const both = svgOf({ timeSignatures: false, tabLetters: false }, 'both');
    expect(letters(both)).toBe(3);
    expect(both.textContent).toBe(svgOf({}, 'both').textContent);
    expect(firstFret(both)).toBe(firstFret(svgOf({}, 'both')));
  });

  it('leaves out the text annotations from the image and from the files\' clip', () => {
    expect(svgOf({}).textContent).toContain('let ring');
    expect(svgOf({ texts: false }).textContent).not.toContain('let ring');
    expect(svgOf({ texts: false }).textContent).not.toContain('slowly');
    const bare = exportedClip(texted, { texts: false });
    expect(bare.tracks[0].bars.flatMap(b => b.voices.flat()).some(c => c.text !== undefined)).toBe(false);
    expect(exportedClip(texted, { texts: true })).toBe(texted);
    // The clip itself keeps them.
    expect(texted.tracks[0].bars[0].voices[0][0].text).toBe('let ring');
  });
});
