/**
 * The capo drawn in the score's head, the layout's capo row, ASCII Tab's Capo line and the formats
 * (issue #463, docs/specs/2026-11-13-tab-capo-in-tuning-design.md).
 */
import * as alphaTab from '@coderline/alphatab';
import { vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { readAscii, writeAscii } from '@/features/tab/ascii';
import { writeAlphaTex, writePart } from '@/features/tab/alphatex';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { emptyPart, partOf, type Clip, type Part } from '@/features/tab/clip';
import { capoHeading, capoWords, tuningBlock, withCapo } from '@/features/tab/credits';
import { parseTabExportStyle, tabSvg } from '@/features/tab/exportTab';
import { writeGuitarProWith } from '@/features/tab/guitarPro';
import { layoutClip } from '@/features/tab/layout';
import { writeMusicXml } from '@/features/tab/musicxml';
import { readLink, shareLink } from '@/features/tab/shareLink';
import { TabClip } from '@/features/tab/TabClip';
import { CapoNeck } from '@/features/tab/CapoNeck';
import { STANDARD_TUNING } from '@/features/tab/clip';
import { TOOL_GROUPS } from '@/features/tab/tools';
import { DEFAULT_VIEW } from '@/features/tab/viewOptions';

const DADGAD = '\\tuning (D4 A3 G3 D3 A2 D2)';

function clipOf(tex: string): Clip {
  const result = readAlphaTexWith(alphaTab, tex);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.clip;
}
const partFrom = (tex: string): Part => partOf(clipOf(tex));

describe('the capo in the score head', () => {
  it('names the fret as an ordinal', () => {
    expect([1, 2, 3, 4, 11, 12].map(capoWords)).toEqual([
      'Capo 1st fret', 'Capo 2nd fret', 'Capo 3rd fret', 'Capo 4th fret', 'Capo 11th fret', 'Capo 12th fret',
    ]);
  });

  it('goes after the tuning’s name past a middle dot, alone without one, and not at all without a capo', () => {
    expect(capoHeading('DADGAD tuning', 4)).toBe('DADGAD tuning · Capo 4th fret');
    expect(capoHeading('Standard tuning', 4)).toBe('Standard tuning · Capo 4th fret');
    expect(capoHeading(null, 4)).toBe('Capo 4th fret');
    expect(capoHeading('DADGAD tuning', undefined)).toBe('DADGAD tuning');
    // Standard tuning has no block: the capo makes one of its words alone, as an export prints it.
    expect(withCapo(null, 4)).toEqual({ heading: 'Capo 4th fret', strings: [] });
    expect(withCapo(null, undefined)).toBeNull();
    expect(withCapo(tuningBlock(['D', 'A', 'D', 'G', 'A', 'D']), 4)?.heading).toBe('DADGAD tuning · Capo 4th fret');
  });

  it('prints "Capo 4th fret" alone in an export in standard tuning, beside DADGAD’s name, and kept collapsed', () => {
    const style = parseTabExportStyle(null);
    const standard = tabSvg({ ...emptyPart(), name: 'Riff', capo: 4 }, style, 'Riff');
    expect(standard).toContain('Capo 4th fret');
    expect(standard).not.toContain('Standard tuning');
    const dadgad = partFrom(`${DADGAD}\n\\capo 4\n0.6.4 r.4 r.2 |`);
    expect(tabSvg(dadgad, style, '')).toContain('DADGAD tuning · Capo 4th fret');
    const collapsed = tabSvg(dadgad, style, '', 'tab', { ...DEFAULT_VIEW, tuningDetails: false });
    expect(collapsed).toContain('DADGAD tuning · Capo 4th fret');
    // No capo row over the first line in the picture.
    expect(collapsed).not.toContain('>Capo 4<');
    expect(tabSvg({ ...emptyPart(), name: 'Riff' }, style, 'Riff')).not.toContain('Capo');
  });
});

describe('the capo row over the first line', () => {
  const clip = partFrom('\\capo 2\n' + Array.from({ length: 12 }, () => '0.6.4 0.6.4 0.6.4 0.6.4 |').join(' '));

  it('is not on the Tab page’s layout', () => {
    const layout = layoutClip(clip, 600);
    expect(layout.systems.length).toBeGreaterThan(1);
    expect(layout.systems.map(s => s.rows.capo)).toEqual(layout.systems.map(() => null));
    render(<TabClip clip={clip} layout={layout} width={600} title="Riff" />);
    expect(screen.queryByTestId('capo')).toBeNull();
  });

  it('stays on show_tab’s first line only, drawn "Capo 2"', () => {
    const layout = layoutClip(clip, 600, 'tab', false, true);
    expect(layout.systems[0].rows.capo).not.toBeNull();
    expect(layout.systems.slice(1).map(s => s.rows.capo)).toEqual(layout.systems.slice(1).map(() => null));
    render(<TabClip clip={clip} layout={layout} width={600} title="Riff" />);
    expect(screen.getByTestId('capo')).toHaveTextContent('Capo 2');
  });
});

describe('the Text group', () => {
  it('has no Capo tool', () => {
    const text = TOOL_GROUPS.find(g => g.label === 'Text')!;
    expect(text.tools.map(t => t.label)).not.toContain('Capo');
    expect(TOOL_GROUPS.flatMap(g => g.tools).map(t => t.id as string)).not.toContain('capo');
  });
});

describe('ASCII Tab’s Capo line', () => {
  const read = (text: string) => {
    const result = readAscii(text);
    if (!result.ok) throw new Error(result.errors.join('\n'));
    return { warnings: result.warnings, part: partOf(result.clip) };
  };
  const TAB = 'e|-0---|\nB|-----|\nG|-----|\nD|-----|\nA|-----|\nE|-----|';

  it('is written after Tuning, only with a capo', () => {
    const lines = writeAscii(partFrom(`${DADGAD}\n\\capo 4\n0.6.4 r.4 r.2 |`)).split('\n');
    const tuning = lines.findIndex(l => l.startsWith('Tuning:'));
    expect(lines[tuning + 1]).toBe('Capo: 4');
    expect(writeAscii(partFrom('\\capo 4\n0.6.4 r.4 r.2 |'))).toMatch(/^Time: 4\/4\nCapo: 4\n/);
    expect(writeAscii(partFrom('0.6.4 r.4 r.2 |'))).not.toContain('Capo');
  });

  it('reads Capo: 4 as capo 4, Capo: 0 as none, Capo: 15 as 12 with a message, and leaves Capo: x out with one', () => {
    expect(read(`Capo: 4\n${TAB}`)).toMatchObject({ part: { capo: 4 } });
    const none = read(`Capo: 0\n${TAB}`);
    expect(none.part.capo).toBeUndefined();
    expect(none.warnings.join(' ')).not.toMatch(/capo/i);
    const high = read(`Capo: 15\n${TAB}`);
    expect(high.part.capo).toBe(12);
    expect(high.warnings).toContain('Read capo 15 as 12, the highest Frets offers.');
    const bad = read(`Capo: x\n${TAB}`);
    expect(bad.part.capo).toBeUndefined();
    expect(bad.warnings).toContain('Capo "x" isn\'t a fret number, so it is left out.');
  });

  it('round-trips', () => {
    const part = partFrom(`${DADGAD}\n\\capo 4\n0.6.4 r.4 r.2 |`);
    expect(read(writeAscii(part)).part).toMatchObject({ capo: 4, tuning: part.tuning });
  });
});

describe('the capo through the formats', () => {
  const TEX = `${DADGAD}\n\\capo 4\n0.6.4 r.4 r.2 |`;
  const clip = clipOf(TEX);

  it('round-trips through alphaTex and the share link', async () => {
    expect(writePart(partOf(clip))).toContain('\\capo 4');
    expect(partFrom(writeAlphaTex(clip)).capo).toBe(4);
    const text = await readLink(new URL(await shareLink('https://frets.example', writeAlphaTex(clip))).hash);
    expect(typeof text === 'string' && partFrom(text).capo).toBe(4);
  });

  it('is written to MusicXML as <capo>4</capo> and to Guitar Pro as the track’s capo', () => {
    expect(writeMusicXml(clip)).toContain('<capo>4</capo>');
    const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(writeGuitarProWith(alphaTab, clip), new alphaTab.Settings());
    expect(score.tracks[0].staves[0].capo).toBe(4);
  });
});

describe('the capo’s neck in the Tuning panel', () => {
  it('draws the nut to fret 15, but only frets 1 to 12 take a press', () => {
    render(<CapoNeck tuning={STANDARD_TUNING} capo={4} onCapo={() => {}} />);
    expect(screen.getAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual(Array.from({ length: 12 }, (_, k) => `Capo on fret ${k + 1}`));
    const numbers = [...screen.getByRole('img').querySelectorAll('text')].map(t => t.textContent).filter(t => /^\d+$/.test(t ?? ''));
    expect(numbers).toEqual(Array.from({ length: 15 }, (_, k) => String(k + 1)));
    expect(screen.getAllByTestId('capo-bar')).toHaveLength(1);
  });

  it('shows a faint capo over a fret hovered, none over 13 to 15, which have no button', () => {
    render(<CapoNeck tuning={STANDARD_TUNING} capo={4} onCapo={() => {}} />);
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Capo on fret 9' }));
    expect(screen.getByTestId('capo-hover')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /fret 1[3-5]$/ })).toBeNull();
  });
  it('draws no capo at None, every fret 1 to 12 still pressed and hovered', () => {
    const onCapo = vi.fn();
    render(<CapoNeck tuning={STANDARD_TUNING} capo={0} onCapo={onCapo} />);
    expect(screen.getByRole('img')).toHaveAccessibleName('No capo');
    expect(screen.queryByTestId('capo-bar')).toBeNull();
    expect(screen.getAllByRole('button').every(b => b.getAttribute('aria-pressed') === 'false')).toBe(true);
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Capo on fret 5' }));
    expect(screen.getByTestId('capo-hover')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Capo on fret 5' }));
    expect(onCapo).toHaveBeenCalledWith(5);
  });
});
