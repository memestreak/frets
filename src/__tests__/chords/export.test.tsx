import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import ChordLab from '@/features/chords/lab/ChordLab';
import ChordLibrary from '@/features/chords/library/ChordLibrary';
import { diagramSvg, exportFileName } from '@/features/chords/export/exportImage';
import {
  DEFAULT_EXPORT_STYLE, EXPORT_STORAGE_KEY, parseExportStyle, THEME_PALETTES,
  type ExportStyle,
} from '@/features/chords/export/exportStyle';
import { chordOf } from '@/lib/chords/chordTypes';
import type { Voicing } from '@/lib/chords/voicings';

const nav = vi.hoisted(() => ({ search: '', push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ push: nav.push }),
}));

/** jsdom draws no images, so the clipboard copy is stubbed; the SVG is real. */
const copied = vi.hoisted(() => ({ png: vi.fn() }));
vi.mock('@/features/chords/export/exportImage', async importOriginal => ({
  ...await importOriginal<typeof import('@/features/chords/export/exportImage')>(),
  copyPng: copied.png,
}));

const am7 = chordOf('A', 'm7');
/** Open Am7: x-0-2-0-1-0. */
const OPEN_AM7: Voicing = [null, 0, 2, 0, 1, 0];
/** Barre Am7 at the fifth fret. */
const BARRE_AM7: Voicing = [5, 7, 5, 5, 8, 5];
/** The library's first moveable Am7. */
const BARRE_AM7_FIRST: Voicing = [5, 7, 5, 5, 5, 5];

/** How the browser writes a colour set in a style: #a8462a is rgb(168, 70, 42). */
const fill = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  return `fill: rgb(${r}, ${g}, ${b})`;
};

const svgOf = (style: Partial<ExportStyle> = {}, voicing = BARRE_AM7, name = 'Am7') =>
  diagramSvg({ chord: am7, voicing, name }, { ...DEFAULT_EXPORT_STYLE, ...style });

describe('export style', () => {
  it('defaults to black and white with the name and no intervals', () => {
    expect(DEFAULT_EXPORT_STYLE).toEqual({
      colours: 'mono', background: 'light', intervals: false, name: true,
    });
  });

  it('keeps valid saved fields and defaults the rest', () => {
    expect(parseExportStyle(null)).toEqual(DEFAULT_EXPORT_STYLE);
    expect(parseExportStyle({ colours: 'degrees', background: 'blue', intervals: 'yes', name: false }))
      .toEqual({ ...DEFAULT_EXPORT_STYLE, colours: 'degrees', name: false });
  });

  it('copies its palettes from fretwood.css', () => {
    const css = readFileSync(join(process.cwd(), 'src/styles/fretwood.css'), 'utf8');
    const block = (selector: string) => {
      const start = css.indexOf(selector);
      return css.slice(start, css.indexOf('}', start));
    };
    const token = (text: string, name: string) =>
      new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`).exec(text)?.[1];
    for (const [theme, text] of [['light', block(':root {')], ['dark', block(":root[data-theme='dark']")]] as const) {
      const p = THEME_PALETTES[theme];
      expect(p.line).toBe(token(text, 'line-strong'));
      expect(p.ink).toBe(token(text, 'ink'));
      expect(p.muted).toBe(token(text, 'ink-muted'));
      for (const [degree, { fill, fg }] of Object.entries(p.degree)) {
        expect(fill, `${theme} ${degree}`).toBe(token(text, `degree-${degree}`));
        expect(fg, `${theme} on ${degree}`).toBe(token(text, `on-degree-${degree}`));
      }
    }
  });
});

describe('diagramSvg', () => {
  it('is a standalone SVG with concrete colours and no classes', () => {
    const svg = svgOf();
    expect(svg.match(/xmlns="http:\/\/www.w3.org\/2000\/svg"/g)).toHaveLength(1);
    expect(svg).toMatch(/width="148" height="154"/);
    expect(svg).not.toContain('var(');
    expect(svg).not.toContain('class=');
    expect(svg).not.toContain('aria-hidden');
  });

  it('draws black and white with the chord name and no intervals by default', () => {
    const svg = svgOf();
    expect(svg).toContain('>Am7</text>');
    expect(svg).toContain(fill('#000000'));
    expect(svg).not.toContain(fill('#a8462a'));
    expect(svg).not.toContain('♭3');
  });

  it('labels the dots and uses the degree colours when asked', () => {
    const light = svgOf({ colours: 'degrees', intervals: true });
    expect(light).toContain(fill('#a8462a')); // the root
    expect(light).toContain('>♭3</text>');
    const dark = svgOf({ colours: 'degrees', background: 'dark' });
    expect(dark).toContain(fill('#e0805c'));
    expect(svgOf({ background: 'dark' })).toContain(fill('#ffffff'));
  });

  it('leaves the name out when asked or empty, and the band it sits in', () => {
    const without = svgOf({ name: false });
    expect(without).not.toContain('Am7');
    expect(without).toMatch(/height="128"/);
    expect(svgOf({}, BARRE_AM7, '  ')).toMatch(/height="128"/);
  });

  it('prints the name it is given', () => {
    expect(svgOf({}, BARRE_AM7, 'A minor 7')).toContain('>A minor 7</text>');
  });

  it('widens for a shape that reaches past five frets', () => {
    // Played on the lab's neck: frets 5 to 10.
    const wide = diagramSvg(
      { chord: am7, voicing: [5, null, 5, 5, 5, 8], name: 'Am7' }, DEFAULT_EXPORT_STYLE,
    );
    expect(wide).toMatch(/width="148"/);
    const wider = diagramSvg(
      { chord: chordOf('A', 'm'), voicing: [5, 7, 7, null, null, 12], name: 'Am' }, DEFAULT_EXPORT_STYLE,
    );
    expect(wider).toMatch(/width="220"/); // eight frets from 5
  });

  it('names the file after the name and the shape', () => {
    expect(exportFileName({ chord: am7, voicing: OPEN_AM7, name: 'Am7' })).toBe('Am7 x-0-2-0-1-0');
    expect(exportFileName({ chord: am7, voicing: OPEN_AM7, name: '' })).toBe('Chord x-0-2-0-1-0');
    expect(exportFileName({ chord: chordOf('C', 'M'), voicing: [null, null, 2, 0, 1, 0], name: 'C/E' }))
      .toBe('C_E x-x-2-0-1-0');
  });
});

describe('the shapes export menu', () => {
  beforeEach(() => {
    nav.search = '';
    localStorage.clear();
    copied.png.mockReset().mockResolvedValue('Copied as PNG');
  });

  const moveable = () =>
    within(screen.getByRole('region', { name: 'Moveable shapes' })).getAllByRole('button');
  const openShape = () =>
    within(screen.getByRole('region', { name: 'Open shapes' })).getAllByRole('button')[0];

  it('opens on right-click with two items, and selects nothing', () => {
    render(<ChordLibrary />);
    const shape = moveable()[0];
    fireEvent.contextMenu(shape);
    const menu = screen.getByRole('menu', { name: 'Export shape' });
    expect(within(menu).getAllByRole('menuitem').map(i => i.textContent))
      .toEqual(['Copy as PNG', 'Export options…']);
    expect(shape).toHaveAttribute('aria-pressed', 'false');
    expect(openShape()).toHaveAttribute('aria-pressed', 'true');
  });

  it('copies with the saved choices and says so', async () => {
    render(<ChordLibrary />);
    fireEvent.contextMenu(moveable()[0]);
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Copy as PNG' }));
    });
    expect(copied.png).toHaveBeenCalledWith(
      { chord: am7, voicing: BARRE_AM7_FIRST, name: 'Am7' }, DEFAULT_EXPORT_STYLE,
    );
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByText('Copied as PNG')).toBeInTheDocument();
  });

  it('closes on Esc, and ← → inside it step no shape', () => {
    render(<ChordLibrary />);
    fireEvent.contextMenu(moveable()[1]);
    const item = screen.getByRole('menuitem', { name: 'Copy as PNG' });
    fireEvent.keyDown(item, { key: 'ArrowRight' });
    expect(openShape()).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(item, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(moveable()[1]).toHaveFocus();
  });

  it('opens on a long press, and the press selects nothing', () => {
    vi.useFakeTimers();
    try {
      render(<ChordLibrary />);
      const shape = moveable()[2];
      fireEvent.pointerDown(shape, { pointerType: 'touch', clientX: 5, clientY: 5 });
      act(() => vi.advanceTimersByTime(500));
      expect(screen.getByRole('menu')).toBeInTheDocument();
      fireEvent.pointerUp(shape, { pointerType: 'touch' });
      fireEvent.click(shape);
      expect(shape).toHaveAttribute('aria-pressed', 'false');
    } finally {
      vi.useRealTimers();
    }
  });

  it('a short tap still selects the shape', () => {
    vi.useFakeTimers();
    try {
      render(<ChordLibrary />);
      const shape = moveable()[2];
      fireEvent.pointerDown(shape, { pointerType: 'touch' });
      act(() => vi.advanceTimersByTime(200));
      fireEvent.pointerUp(shape, { pointerType: 'touch' });
      fireEvent.click(shape);
      act(() => vi.advanceTimersByTime(500));
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(shape).toHaveAttribute('aria-pressed', 'true');
    } finally {
      vi.useRealTimers();
    }
  });

  it('opens the Export dialog on the defaults, and saves a change', () => {
    render(<ChordLibrary />);
    fireEvent.contextMenu(moveable()[0]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export options…' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('open');
    expect(within(dialog).getByRole('heading')).toHaveTextContent(/^Export Am7, root on E/);
    const pressed = (group: string) =>
      within(within(dialog).getByRole('group', { name: group }))
        .getByRole('button', { pressed: true }).textContent;
    expect(pressed('Colours')).toBe('Black & white');
    expect(pressed('Background')).toBe('Light');
    expect(pressed('Intervals')).toBe('Hide');
    expect(pressed('Chord name')).toBe('Show');

    fireEvent.click(within(within(dialog).getByRole('group', { name: 'Colours' }))
      .getByRole('button', { name: 'Degree colours' }));
    expect(JSON.parse(localStorage.getItem(EXPORT_STORAGE_KEY)!))
      .toEqual({ ...DEFAULT_EXPORT_STYLE, colours: 'degrees' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(dialog).not.toHaveAttribute('open');
  });

  it('starts the name field on the chord name, prints what is typed, and resets on reopening', () => {
    render(<ChordLibrary />);
    fireEvent.contextMenu(moveable()[0]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export options…' }));
    const dialog = screen.getByRole('dialog');
    const field = within(dialog).getByRole('textbox', { name: 'Name' });
    expect(field).toHaveValue('Am7');
    fireEvent.change(field, { target: { value: 'A minor 7' } });
    expect(within(screen.getByTestId('export-preview')).getByText('A minor 7')).toBeInTheDocument();

    // Hidden, the field can't be edited.
    fireEvent.click(within(within(dialog).getByRole('group', { name: 'Chord name' }))
      .getByRole('button', { name: 'Hide' }));
    expect(field).toBeDisabled();
    expect(within(screen.getByTestId('export-preview')).queryByText('A minor 7')).toBeNull();
    fireEvent.click(within(within(dialog).getByRole('group', { name: 'Chord name' }))
      .getByRole('button', { name: 'Show' }));

    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    fireEvent.contextMenu(moveable()[1]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export options…' }));
    expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveValue('Am7');
  });
});

describe('the Chord lab neck export', () => {
  beforeEach(() => {
    localStorage.clear();
    copied.png.mockReset().mockResolvedValue('Copied as PNG');
  });

  const neck = () => screen.getByRole('region', { name: 'On the neck' }).querySelector('.board-scroll')!;
  const heading = () => screen.getByRole('heading', { level: 1 });

  it('copies the shape played, under the name chosen, without tapping a note', async () => {
    render(<ChordLab />);
    // x-3-2-0-1-0, the open C it opens on, isn't tapped by the right-click.
    fireEvent.contextMenu(screen.getByTestId('cell-1-5'));
    expect(heading()).toHaveTextContent(/^C /);
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Copy as PNG' }));
    });
    expect(copied.png).toHaveBeenCalledWith(
      expect.objectContaining({ voicing: [null, 3, 2, 0, 1, 0], name: 'C' }), DEFAULT_EXPORT_STYLE,
    );
  });

  it('exports a shape that is not among the shapes, named as the list names it', () => {
    render(<ChordLab />);
    fireEvent.click(screen.getByTestId('cell-5-0')); // mute the high E
    fireEvent.click(screen.getByTestId('cell-5-5')); // x-3-2-0-1-5
    fireEvent.contextMenu(neck());
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export options…' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveValue('C6');
    expect(within(dialog).getByRole('heading')).toHaveTextContent('Export C6, root on A · frets 1–5');
  });

  it('offers nothing with every string muted', () => {
    render(<ChordLab />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    fireEvent.contextMenu(neck());
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
