import { describe, expect, it } from 'vitest';
import { readAscii } from '@/features/tab/ascii';
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import {
  DEFAULT_TAB_EXPORT, exportedClip, exportView, musicShift, parseTabExportStyle, tabFileName, tabImageSize, tabSvg,
} from '@/features/tab/exportTab';
import { DEFAULT_VIEW } from '@/features/tab/viewOptions';
import { layoutClip } from '@/features/tab/layout';
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
    expect(parseTabExportStyle({ timeSignatures: false, tabLetters: false, rhythm: false, chordDiagrams: true, texts: false }))
      .toEqual({ ...DEFAULT_TAB_EXPORT, timeSignatures: false, tabLetters: false, rhythm: false, chordDiagrams: true, texts: false });
    expect(parseTabExportStyle({ timeSignatures: 'no', tabLetters: 0, rhythm: 'off', chordDiagrams: 1, texts: null, barNumbers: 'song' })).toEqual(DEFAULT_TAB_EXPORT);
    expect(DEFAULT_TAB_EXPORT.chordDiagrams).toBe(false);
    expect(parseTabExportStyle({ width: 700, transparent: 'yes' })).toEqual(DEFAULT_TAB_EXPORT);
  });
});

describe('the tab as an image', () => {
  it('is as wide as chosen and the same picture at every Size, its height scaling with its width; taller with the name', () => {
    const wide = tabImageSize(clip, { ...DEFAULT_TAB_EXPORT, width: 1200, transparent: true, name: false }, 'Riff');
    const middle = tabImageSize(clip, { ...DEFAULT_TAB_EXPORT, width: 800, transparent: true, name: false }, 'Riff');
    const narrow = tabImageSize(clip, { ...DEFAULT_TAB_EXPORT, width: 480, transparent: true, name: false }, 'Riff');
    const named = tabImageSize(clip, { ...DEFAULT_TAB_EXPORT, width: 480, transparent: true, name: true }, 'Riff');
    expect(wide.width).toBe(1200);
    expect(narrow.width).toBe(480);
    expect(wide.height).toBe(Math.round(middle.height * 1.5));
    expect(narrow.height).toBe(Math.round(middle.height * 0.6));
    // The same drawing, scaled by the viewBox: only the outer width and height differ.
    const svgAt = (width: 480 | 1200) => tabSvg(clip, { ...DEFAULT_TAB_EXPORT, width, name: false }, 'Riff');
    const viewBox = (svg: string) => svg.match(/viewBox="([^"]*)"/)![1];
    expect(viewBox(svgAt(480))).toBe(viewBox(svgAt(1200)));
    expect(svgAt(480).replace(/^<svg[^>]*>/, '').replace(/_r_[a-z0-9]+_/g, '')).toBe(svgAt(1200).replace(/^<svg[^>]*>/, '').replace(/_r_[a-z0-9]+_/g, ''));
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

  it('leaves out the rhythm under the tab alone (stems, beams, rests, tuplet numbers), and the room for it', () => {
    const rhythmic = read('\\ts (4 4)\n0.6.8 2.6.8 r.4 :8 3.6{tu 3} 5.6{tu 3} 3.6{tu 3} 0.6.4 |');
    const svg = (style: Partial<typeof DEFAULT_TAB_EXPORT>, parts: 'tab' | 'both' = 'tab') => {
      const host = document.createElement('div');
      host.innerHTML = tabSvg(partOf(rhythmic), { ...DEFAULT_TAB_EXPORT, name: false, ...style }, 'Riff', parts);
      return host;
    };
    const height = (host: Element) => Number(host.querySelector('svg')!.getAttribute('height'));
    const drawn = (host: Element) => ['tab-beam', 'rest', 'tuplet'].map(id => host.querySelectorAll(`[data-testid="${id}"]`).length);
    const shown = svg({});
    const bare = svg({ rhythm: false });
    expect(drawn(shown).every(n => n > 0)).toBe(true);
    expect(drawn(bare)).toEqual([0, 0, 0]);
    expect(bare.querySelectorAll('line').length).toBeLessThan(shown.querySelectorAll('line').length);
    expect(height(bare)).toBeLessThan(height(shown));
    // With the staff, the staff carries the rhythm whatever the choice.
    const both = svg({ rhythm: false }, 'both');
    expect(height(both)).toBe(height(svg({}, 'both')));
    expect(both.querySelectorAll('line').length).toBe(svg({}, 'both').querySelectorAll('line').length);
  });

  describe('chord diagrams, and the head of some bars', () => {
    const chorded = read('\\tempo 110\n\\ts (4 4)\n\\chord ("Am7" 5 5 5 5 7 5)\n\\chord ("Dm7" 5 6 5 7 5 x)\n5.6.2{ch "Am7"} 5.5.2{ch "Dm7"} |');
    const view = { ...DEFAULT_VIEW, chordChart: true, chordDiagrams: true };
    const svg = (style: Partial<typeof DEFAULT_TAB_EXPORT>, excerpt = false) => {
      const host = document.createElement('div');
      host.innerHTML = tabSvg(partOf(chorded), { ...DEFAULT_TAB_EXPORT, ...style }, 'Riff', 'tab', exportView(view, { ...DEFAULT_TAB_EXPORT, ...style }), excerpt);
      return host;
    };
    // The dots drawn on the tab's own drawing, not the Chord chart's.
    const tabDots = (host: Element) => [...host.querySelectorAll('svg svg circle')].length;

    it('draws the diagrams over the notes only when the Export choices show them, whatever the page shows', () => {
      expect(tabDots(svg({}))).toBe(0);
      expect(tabDots(svg({ chordDiagrams: true }))).toBeGreaterThan(0);
      expect(svg({}).textContent).toContain('Am7');
      expect(exportView({ ...DEFAULT_VIEW, chordDiagrams: false }, { ...DEFAULT_TAB_EXPORT, chordDiagrams: true }).chordDiagrams).toBe(true);
    });

    it('the whole clip keeps its head and Chord chart; some bars have neither, only the name', () => {
      const whole = svg({});
      expect(whole.querySelector('[data-testid="score-tempo-drawn"]')).not.toBeNull();
      expect(whole.querySelector('[data-testid="chord-chart"]')).not.toBeNull();
      const bars = svg({}, true);
      expect(bars.querySelector('[data-testid="score-tempo-drawn"]')).toBeNull();
      expect(bars.querySelector('[data-testid="chord-chart"]')).toBeNull();
      expect(bars.querySelector('[data-testid="score-head-drawn"]')!.textContent).toBe('Riff');
      expect(svg({ name: false }, true).querySelector('[data-testid="score-head-drawn"]')!.textContent).toBe('');
      expect(Number(bars.querySelector('svg')!.getAttribute('height'))).toBeLessThan(Number(whole.querySelector('svg')!.getAttribute('height')));
    });
  });

  it('draws music that doesn\'t fill a line in the middle, under the name; a full line stays put', () => {
    const one = read('\\ts (4 4)\n0.6.4 2.6.4 3.6.4 5.6.4 |');
    const layoutOne = layoutClip(partOf(one), 768, 'tab');
    const end = layoutOne.systems[0].bars[0].x1;
    expect(end).toBeLessThan(700);
    expect(musicShift(layoutOne, 768)).toBeCloseTo((768 - end) / 2);
    const many = read(`\\ts (4 4)\n${'0.6.4 2.6.4 3.6.4 5.6.4 7.6.4 8.6.4 7.6.4 5.6.4 |'.repeat(12)}`);
    const layoutMany = layoutClip(partOf(many), 768, 'tab');
    expect(layoutMany.systems.length).toBeGreaterThan(1);
    expect(musicShift(layoutMany, 768)).toBe(0);
    // In the image, the bar's middle is the image's middle.
    const host = document.createElement('div');
    host.innerHTML = tabSvg(partOf(one), DEFAULT_TAB_EXPORT, 'Riff', 'tab', DEFAULT_VIEW, true);
    const tab = host.querySelector('svg svg')!;
    const x = Number(tab.getAttribute('x'));
    expect(x + end / 2).toBeCloseTo(DEFAULT_TAB_EXPORT.width / 2, 0);
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
