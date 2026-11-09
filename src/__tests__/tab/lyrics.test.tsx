/**
 * Lyrics (issue #408, `docs/specs/2026-11-09-tab-lyrics-design.md`): read and written in alphaTex, set note by
 * note, laid out in each view, drawn with their hyphens, and carried by MusicXML and ASCII tab.
 * The page's Shift+L field is in `page/lyrics.test.tsx`.
 */
import * as alphaTab from '@coderline/alphatab';
import { render } from '@testing-library/react';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { writeAlphaTex } from '@/features/tab/alphatex';
import { readAscii, writeAscii } from '@/features/tab/ascii';
import { parseClip, partOf, type Clip, type Part } from '@/features/tab/clip';
import { layoutClip } from '@/features/tab/layout';
import { lyricBox } from '@/features/tab/layoutText';
import { lyricNote, lyricValue, setLyric, syllableOf } from '@/features/tab/lyrics';
import { writeMusicXml } from '@/features/tab/musicxml';
import { rowsFor } from '@/features/tab/rows';
import { minColumnWidth } from '@/features/tab/widths';
import { TabClip } from '@/features/tab/TabClip';
import { DEFAULT_TAB_EXPORT, tabImageSize, tabSvg } from '@/features/tab/exportTab';

function read(tex: string): { clip: Clip; warnings: string[] } {
  const result = readAlphaTexWith(alphaTab, tex);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return { clip: result.clip, warnings: result.warnings };
}
const part = (tex: string): Part => partOf(read(tex).clip);
/** Each column's lyrics in bar order, `-` for none. */
const sung = (p: Part) => p.bars.map(b => b.columns.map(c => (c.lyrics ? c.lyrics.join('|') : '-')).join(' ')).join(' / ');

describe('reading and writing alphaTex', () => {
  it('reads a syllable on a beat and a second Lyric line, with no warning, and writes them back exactly', () => {
    const tex = '\\ts (4 4)\n0.6.4{lyrics "Hel-"} 2.5.4{lyrics 1 "lo"} 3.5.4{lyrics 0 "a" lyrics 1 "b"} r.4 |';
    const { clip, warnings } = read(tex);
    expect(warnings).toEqual([]);
    expect(sung(partOf(clip))).toBe('Hel- |lo a|b -');
    expect(writeAlphaTex(clip)).toBe(`${tex}\n`);
  });

  it('reads a \\lyrics block one syllable a note, rests skipped and two spaces skipping a note, and writes it on the notes', () => {
    const { clip, warnings } = read('\\lyrics "Hel-lo my  friend"\n.\n0.6.4 2.5.4 r.4 3.5.4 | 0.6.4 0.6.4 0.6.2');
    expect(warnings).toEqual([]);
    expect(sung(partOf(clip))).toBe('Hel- lo - my / - friend -');
    expect(writeAlphaTex(clip)).toContain('0.6.4{lyrics "Hel-"} 2.5.4{lyrics "lo"} r.4 3.5.4{lyrics "my"} |');
    expect(writeAlphaTex(clip)).not.toContain('\\lyrics');
  });

  it('escapes a quote in a syllable, and keeps no lines that are all empty', () => {
    const { clip } = read('\\ts (4 4)\n0.6.4{lyrics "say \\"hi\\""} 0.6.4{lyrics 1 ""} 0.6.2 |');
    expect(partOf(clip).bars[0].columns[1].lyrics).toBeUndefined();
    expect(writeAlphaTex(clip)).toBe('\\ts (4 4)\n0.6.4{lyrics "say \\"hi\\""} 0.6.4 0.6.2 |\n');
  });

  it('parseClip takes lyrics as stored and refuses a trailing empty line or a number', () => {
    const { clip } = read('\\ts (4 4)\n0.6.1{lyrics "la"} |');
    const json = JSON.parse(JSON.stringify(clip));
    expect(parseClip(json)).not.toBeNull();
    json.tracks[0].bars[0].voices[0][0].lyrics = ['la', ''];
    expect(parseClip(json)).toBeNull();
    json.tracks[0].bars[0].voices[0][0].lyrics = [3];
    expect(parseClip(json)).toBeNull();
  });
});

describe('setting a syllable', () => {
  const p = part('\\ts (4 4)\n0.6.4 2.5.4 r.2 |');
  it('pads lines before it, trims empty lines after, and clears with blank', () => {
    const two = setLyric(p, { bar: 0, column: 0 }, 1, ' two ');
    expect(two.bars[0].columns[0].lyrics).toEqual(['', 'two']);
    const both = setLyric(two, { bar: 0, column: 0 }, 0, 'one');
    expect(both.bars[0].columns[0].lyrics).toEqual(['one', 'two']);
    const cleared = setLyric(setLyric(both, { bar: 0, column: 0 }, 1, ''), { bar: 0, column: 0 }, 0, '  ');
    expect(cleared.bars[0].columns[0].lyrics).toBeUndefined();
  });
  it('refuses a rest, and an unchanged syllable leaves the same clip', () => {
    expect(setLyric(p, { bar: 0, column: 2 }, 0, 'la')).toBe(p);
    const one = setLyric(p, { bar: 0, column: 0 }, 0, 'la');
    expect(setLyric(one, { bar: 0, column: 0 }, 0, 'la')).toBe(one);
  });
});

describe('the field moving note to note', () => {
  // A note, a rest, a grace note, a note, a tie on it, then a note in the next bar.
  const p = part('\\ts (4 4)\n0.6.4 r.4 3.5.8{gr} 3.5.4 -.5.4 |\n5.5.1 |');
  it('skips rests, grace notes and tied-on notes, and crosses the bar line', () => {
    expect(lyricNote(p, { bar: 0, column: 0 }, 1)).toEqual({ bar: 0, column: 3 });
    expect(lyricNote(p, { bar: 0, column: 3 }, 1)).toEqual({ bar: 1, column: 0 });
    expect(lyricNote(p, { bar: 1, column: 0 }, -1)).toEqual({ bar: 0, column: 3 });
  });
  it('is null past either end; with step 0 a rest gives the next note', () => {
    expect(lyricNote(p, { bar: 1, column: 0 }, 1)).toBeNull();
    expect(lyricNote(p, { bar: 0, column: 0 }, -1)).toBeNull();
    expect(lyricNote(p, { bar: 0, column: 1 }, 0)).toEqual({ bar: 0, column: 3 });
    expect(lyricNote(p, { bar: 0, column: 0 }, 0)).toEqual({ bar: 0, column: 0 });
  });
  it('a hyphen joins a syllable once, an empty one stays empty; Space keeps it as typed', () => {
    expect(lyricValue('Hel', 'hyphen')).toBe('Hel-');
    expect(lyricValue('Hel--', 'hyphen')).toBe('Hel-');
    expect(lyricValue('', 'hyphen')).toBe('');
    expect(lyricValue(' lo ', 'next')).toBe('lo');
    expect(syllableOf('Hel-')).toEqual({ shown: 'Hel', joined: true });
    expect(syllableOf('-')).toEqual({ shown: '-', joined: false });
  });
});

describe('where they are drawn', () => {
  const tex = '\\ts (4 4)\n0.6.4{lyrics 0 "a" lyrics 1 "b"} 2.5.4 3.5.2 |';
  const plain = part('\\ts (4 4)\n0.6.4 2.5.4 3.5.2 |');
  it('Tab: under the stems; two lines 15 apart; none without lyrics', () => {
    const rows = rowsFor(part(tex), 'tab');
    expect(rows.lyrics).toBeGreaterThan(rows.tuplet);
    expect(rows.lyricCount).toBe(2);
    expect(rows.height).toBeGreaterThan(rows.lyrics! + 15);
    expect(rowsFor(plain, 'tab').lyrics).toBeNull();
  });
  it('Both: between the staff and the tab, which moves down for them', () => {
    const rows = rowsFor(part(tex), 'both');
    expect(rows.lyrics).toBeGreaterThan(rows.score!.bottom);
    expect(rows.lyrics! + 15).toBeLessThan(rows.staffTop);
    expect(rows.staffTop).toBeGreaterThan(rowsFor(plain, 'both').staffTop);
  });
  it('Staff: under the staff', () => {
    const rows = rowsFor(part(tex), 'staff');
    expect(rows.lyrics).toBeGreaterThan(rows.score!.bottom);
    expect(rows.height).toBeGreaterThan(rows.lyrics! + 15);
  });
  it('a long syllable widens its column', () => {
    const p = part('\\ts (4 4)\n0.6.16{lyrics "everywhere"} 0.6.16 0.6.8 0.6.4 0.6.2 |');
    expect(minColumnWidth(p.bars[0].columns[0])).toBeGreaterThan(minColumnWidth(p.bars[0].columns[1]) + 40);
  });
  it('a syllable is pressed where it is drawn, centred on its note', () => {
    const layout = layoutClip(part(tex), 800, 'tab');
    const system = layout.systems[0];
    const placed = system.bars[0].columns[0];
    const box = lyricBox(placed, system.rows, 1)!;
    expect((box.x0 + box.x1) / 2).toBeCloseTo(placed.x);
    expect((box.y0 + box.y1) / 2).toBe(system.rows.lyrics! + 15);
    expect(lyricBox(system.bars[0].columns[1], system.rows, 0)).toBeNull();
  });
});

describe('the drawing', () => {
  it('draws each syllable, and a hyphen between joined ones and after one ending a line', () => {
    const p = part('\\ts (4 4)\n0.6.4{lyrics "Hel-"} 2.5.4{lyrics "lo"} 3.5.4{lyrics "wa-"} 3.5.4 |');
    const { container } = render(<TabClip clip={p} width={800} title="t" />);
    const words = [...container.querySelectorAll('[data-testid="lyric"]')].map(e => e.textContent);
    expect(words).toEqual(['Hel', 'lo', 'wa']);
    const hyphens = [...container.querySelectorAll('[data-testid="lyric-hyphen"]')].map(e => Number(e.getAttribute('x')));
    const xs = [...container.querySelectorAll('[data-testid="lyric"]')].map(e => Number(e.getAttribute('x')));
    expect(hyphens).toHaveLength(2);
    expect(hyphens[0]).toBeGreaterThan(xs[0]);
    expect(hyphens[0]).toBeLessThan(xs[1]);
    expect(hyphens[1]).toBeGreaterThan(xs[2]);
  });
});

describe('exports', () => {
  it('MusicXML writes each syllable with its place in the word, on the staff, and a second line by number', () => {
    const { clip } = read('\\ts (4 4)\n0.6.4{lyrics 0 "Hel-" lyrics 1 "Hi"} 2.5.4{lyrics "lo"} 3.5.4{lyrics "you"} r.4 |');
    const doc = new DOMParser().parseFromString(writeMusicXml(clip), 'application/xml');
    const lyrics = [...doc.querySelectorAll('lyric')].map(l => `${l.getAttribute('number')}:${l.querySelector('syllabic')?.textContent}:${l.querySelector('text')?.textContent}`);
    expect(lyrics).toEqual(['1:begin:Hel', '2:single:Hi', '1:end:lo', '1:single:you']);
    expect([...doc.querySelectorAll('lyric')].every(l => l.parentElement?.querySelector('staff')?.textContent === '1')).toBe(true);
  });
  it('ASCII tab writes a words line under the strings, and reads back with no error', () => {
    const p = part('\\ts (4 4)\n0.6.4{lyrics "Hel-"} 2.5.4{lyrics "lo"} 3.5.4{lyrics "every-"} 3.5.4{lyrics "one"} |');
    const text = writeAscii(p);
    const lines = text.split('\n');
    const words = lines[lines.findIndex(l => l.startsWith('E|')) + 1];
    expect(words.trim().split(/\s+/)).toEqual(['Hel-', 'lo', 'every-', 'one']);
    const back = readAscii(text);
    expect(back.ok).toBe(true);
  });
});

describe('the image', () => {
  it('PNG and SVG export draw the Lyrics, taller than without', () => {
    const p = part('\\ts (4 4)\n0.6.4{lyrics "Hel-"} 2.5.4{lyrics "lo"} 3.5.2 |');
    const plain = part('\\ts (4 4)\n0.6.4 2.5.4 3.5.2 |');
    const svg = tabSvg(p, DEFAULT_TAB_EXPORT, 'Song', 'both');
    expect(svg).toContain('>Hel<');
    expect(svg).toContain('>lo<');
    expect(tabImageSize(p, DEFAULT_TAB_EXPORT, 'Song', 'both').height).toBeGreaterThan(tabImageSize(plain, DEFAULT_TAB_EXPORT, 'Song', 'both').height);
  });
});
