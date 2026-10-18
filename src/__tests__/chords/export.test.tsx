import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import ChordsPage from '@/features/chords/ChordsPage';
import {
  diagramSvg, exportFileName, exportPixels, fillDragData,
} from '@/components/chords/export/exportImage';
import {
  BACKDROP, DEFAULT_EXPORT_STYLE, EXPORT_STORAGE_KEY, LIGHT_PALETTE, parseExportStyle,
  type ExportStyle,
} from '@/components/chords/export/exportStyle';
import { chordOf } from '@/lib/chords/chordTypes';
import type { Voicing } from '@/lib/chords/voicings';

/** Renders the page at /chords plus `search`. */
function renderAt(search = '') {
  window.history.replaceState(null, '', `/chords${search}`);
  return render(<ChordsPage />);
}

/** jsdom draws no images, so the clipboard copy is stubbed; the SVG is real. */
const copied = vi.hoisted(() => ({ png: vi.fn() }));
vi.mock('@/components/chords/export/exportImage', async importOriginal => ({
  ...await importOriginal<typeof import('@/components/chords/export/exportImage')>(),
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
  it('defaults to black and white with the name and no intervals, 300 px wide and transparent', () => {
    expect(DEFAULT_EXPORT_STYLE).toEqual({
      colours: 'mono', intervals: false, name: true,
      size: 300, transparent: true,
    });
  });

  it('keeps valid saved fields and defaults the rest', () => {
    expect(parseExportStyle(null)).toEqual(DEFAULT_EXPORT_STYLE);
    expect(parseExportStyle({ colours: 'degrees', intervals: 'yes', name: false }))
      .toEqual({ ...DEFAULT_EXPORT_STYLE, colours: 'degrees', name: false });
    expect(parseExportStyle({ size: 150, transparent: false }))
      .toEqual({ ...DEFAULT_EXPORT_STYLE, size: 150, transparent: false });
    expect(parseExportStyle({ size: 1000, transparent: 'no' })).toEqual(DEFAULT_EXPORT_STYLE);
  });

  it('fills an image with the colour the preview shows', () => {
    const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
    const preview = css.slice(css.indexOf('.export-preview {'));
    expect(preview.slice(0, preview.indexOf('}'))).toContain(`background: ${BACKDROP};`);
  });

  it('copies its palette from the light theme in fretwood.css', () => {
    const css = readFileSync(join(process.cwd(), 'src/styles/fretwood.css'), 'utf8');
    const block = (selector: string) => {
      const start = css.indexOf(selector);
      return css.slice(start, css.indexOf('}', start));
    };
    const token = (text: string, name: string) =>
      new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`).exec(text)?.[1];
    const text = block(':root {');
    const p = LIGHT_PALETTE;
    expect(p.line).toBe(token(text, 'line-strong'));
    expect(p.ink).toBe(token(text, 'ink'));
    expect(p.muted).toBe(token(text, 'ink-muted'));
    for (const [degree, { fill, fg }] of Object.entries(p.degree)) {
      expect(fill, degree).toBe(token(text, `degree-${degree}`));
      expect(fg, `on ${degree}`).toBe(token(text, `on-degree-${degree}`));
    }
  });
});

describe('diagramSvg', () => {
  it('is a standalone SVG with concrete colours and no classes', () => {
    const svg = svgOf();
    expect(svg.match(/xmlns="http:\/\/www.w3.org\/2000\/svg"/g)).toHaveLength(1);
    expect(svg).toMatch(/viewBox="0 0 148 154" width="300" height="312"/);
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
  });

  it('leaves the name out when asked or empty, and the band it sits in', () => {
    const without = svgOf({ name: false });
    expect(without).not.toContain('Am7');
    expect(without).toMatch(/viewBox="0 0 148 128" width="300" height="259"/);
    expect(svgOf({}, BARRE_AM7, '  ')).toMatch(/height="259"/);
  });

  it('prints the name it is given', () => {
    expect(svgOf({}, BARRE_AM7, 'A minor 7')).toContain('>A minor 7</text>');
  });

  it('widens for a shape that reaches past five frets', () => {
    // Played on the lab's neck: frets 5 to 10.
    const wide = diagramSvg(
      { chord: am7, voicing: [5, null, 5, 5, 5, 8], name: 'Am7' }, DEFAULT_EXPORT_STYLE,
    );
    expect(wide).toMatch(/viewBox="0 0 148 154" width="300"/);
    const wider = diagramSvg(
      { chord: chordOf('A', 'm'), voicing: [5, 7, 7, null, null, 12], name: 'Am' }, DEFAULT_EXPORT_STYLE,
    );
    expect(wider).toMatch(/viewBox="0 0 220 154" width="446"/); // eight frets from 5
  });

  it('draws five frets as wide as the size chosen', () => {
    const shape = { chord: am7, voicing: BARRE_AM7, name: 'Am7' };
    const at = (size: ExportStyle['size']) => exportPixels(shape, { ...DEFAULT_EXPORT_STYLE, size });
    expect(at(150)).toEqual({ width: 150, height: 156 });
    expect(at(225)).toEqual({ width: 225, height: 234 });
    expect(at(450)).toEqual({ width: 450, height: 468 });
    expect(at(600)).toEqual({ width: 600, height: 624 });
    expect(svgOf({ size: 150 })).toMatch(/width="150" height="156"/);
  });

  it('is transparent unless asked, then filled with white', () => {
    expect(svgOf()).not.toContain('<rect width="148"');
    expect(svgOf({ transparent: false })).toMatch(/^<svg[^>]*><rect width="148" height="154" fill="#ffffff"/);
  });

  it('names the file after the name and the shape', () => {
    expect(exportFileName({ chord: am7, voicing: OPEN_AM7, name: 'Am7' })).toBe('Am7_x-0-2-0-1-0');
    expect(exportFileName({ chord: am7, voicing: OPEN_AM7, name: '' })).toBe('Chord_x-0-2-0-1-0');
    expect(exportFileName({ chord: chordOf('C', 'M'), voicing: [null, null, 2, 0, 1, 0], name: 'C/E' }))
      .toBe('C_E_x-x-2-0-1-0');
    expect(exportFileName({ chord: am7, voicing: OPEN_AM7, name: ' A minor 7 ' })).toBe('A_minor_7_x-0-2-0-1-0');
  });
});

describe('the shapes export menu', () => {
  beforeEach(() => {
    localStorage.clear();
    copied.png.mockReset().mockResolvedValue('Copied as PNG');
  });

  const moveable = () =>
    within(screen.getByRole('region', { name: 'Moveable shapes' })).getAllByRole('button');
  const openShape = () =>
    within(screen.getByRole('region', { name: 'Open shapes' })).getAllByRole('button')[0];

  it('opens on right-click with two items, and selects nothing', () => {
    renderAt();
    const shape = moveable()[0];
    fireEvent.contextMenu(shape);
    const menu = screen.getByRole('menu', { name: 'Shape' });
    expect(within(menu).getAllByRole('menuitem').map(i => i.textContent))
      .toEqual(['Copy as PNG', 'Export options…']);
    expect(shape).toHaveAttribute('aria-pressed', 'false');
    expect(openShape()).toHaveAttribute('aria-pressed', 'true');
  });

  it('copies with the saved choices and says so', async () => {
    renderAt();
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
    renderAt();
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
      renderAt();
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
      renderAt();
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
    renderAt();
    fireEvent.contextMenu(moveable()[0]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export options…' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('open');
    expect(within(dialog).getByRole('heading')).toHaveTextContent(/^Export Am7, root on E/);
    const pressed = (group: string) =>
      within(within(dialog).getByRole('group', { name: group }))
        .getByRole('button', { pressed: true }).textContent;
    expect(pressed('Colours')).toBe('Black & white');
    expect(within(dialog).queryByRole('group', { name: 'Background' })).toBeNull();
    expect(pressed('Intervals')).toBe('Hide');
    expect(pressed('Chord name')).toBe('Show');
    expect(pressed('Size')).toBe('300');
    expect(pressed('Transparent')).toBe('On');
    expect(screen.getByTestId('export-size')).toHaveTextContent('300 × 312 px, transparent');

    fireEvent.click(within(within(dialog).getByRole('group', { name: 'Colours' }))
      .getByRole('button', { name: 'Degree colours' }));
    expect(JSON.parse(localStorage.getItem(EXPORT_STORAGE_KEY)!))
      .toEqual({ ...DEFAULT_EXPORT_STYLE, colours: 'degrees' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(dialog).not.toHaveAttribute('open');
  });

  it('chooses the size and the fill, and says what comes out', () => {
    renderAt();
    fireEvent.contextMenu(moveable()[0]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export options…' }));
    const dialog = screen.getByRole('dialog');
    const choose = (group: string, option: string) => fireEvent.click(
      within(within(dialog).getByRole('group', { name: group })).getByRole('button', { name: option }),
    );
    choose('Size', '150');
    choose('Transparent', 'Off');
    expect(screen.getByTestId('export-size')).toHaveTextContent('150 × 156 px, on white');
    expect(JSON.parse(localStorage.getItem(EXPORT_STORAGE_KEY)!)).toEqual(
      { ...DEFAULT_EXPORT_STYLE, size: 150, transparent: false },
    );
  });

  it('starts the name field on the chord name, prints what is typed, and resets on reopening', () => {
    renderAt();
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

describe('the neck export', () => {
  beforeEach(() => {
    localStorage.clear();
    copied.png.mockReset().mockResolvedValue('Copied as PNG');
  });

  const neck = () => screen.getByRole('region', { name: 'On the neck' }).querySelector('.board-scroll')!;
  const heading = () => screen.getByRole('heading', { level: 1 });

  it('copies the shape played, under the name chosen, without tapping a note', async () => {
    renderAt('?chord=c');
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
    renderAt('?chord=c');
    fireEvent.click(screen.getByTestId('cell-5-0')); // mute the high E
    fireEvent.click(screen.getByTestId('cell-5-5')); // x-3-2-0-1-5
    fireEvent.contextMenu(neck());
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export options…' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveValue('C6');
    expect(within(dialog).getByRole('heading')).toHaveTextContent('Export C6, root on A · frets 1–5');
  });

  it('offers nothing with every string muted', () => {
    renderAt('?chord=c');
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    fireEvent.contextMenu(neck());
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

/** Just what a drag fills in; jsdom has no DataTransfer. */
function fakeDataTransfer() {
  const data: Record<string, string> = {};
  return {
    data,
    files: [] as File[],
    effectAllowed: 'uninitialized',
    setData(type: string, value: string) { data[type] = value; },
    items: { add(file: File) { this.owner.files.push(file); }, owner: null as unknown as { files: File[] } },
  };
}

describe('dragging a shape out', () => {
  /** A mouse drives the page, or a touchscreen. */
  const pointer = (fine: boolean) => vi.stubGlobal('matchMedia', (query: string) => ({
    matches: fine, media: query, addEventListener: () => {}, removeEventListener: () => {},
  }));

  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  const shapes = () =>
    within(screen.getByRole('region', { name: 'Open shapes' })).getAllByRole('button');
  const neck = () => screen.getByRole('region', { name: 'On the neck' }).querySelector('.board-scroll')!;

  it('lets a shape be dragged with a mouse, but not the neck', () => {
    pointer(true);
    renderAt('?chord=am7');
    expect(shapes()[0]).toHaveAttribute('draggable', 'true');
    expect(neck()).not.toHaveAttribute('draggable');
  });

  it('leaves dragging to the long press on a touchscreen', () => {
    pointer(false);
    renderAt('?chord=am7');
    expect(shapes()[0]).not.toHaveAttribute('draggable');
  });

  it('carries the shape with the saved choices, and selects nothing', () => {
    pointer(true);
    localStorage.setItem(EXPORT_STORAGE_KEY, JSON.stringify({ intervals: true }));
    renderAt('?chord=am7');
    const dt = fakeDataTransfer();
    dt.items.owner = dt;
    const moveable = within(screen.getByRole('region', { name: 'Moveable shapes' })).getAllByRole('button');
    fireEvent.dragStart(moveable[0], { dataTransfer: dt });
    expect(dt.effectAllowed).toBe('copy');
    expect(dt.data['text/plain']).toBe('Am7_5-7-5-5-5-5');
    // jsdom draws no PNG, so it falls back to the SVG, with the intervals.
    const html = dt.data['text/html'];
    expect(html).toMatch(/^<img src="data:image\/svg\+xml;charset=utf-8,.+" alt="Am7">$/);
    expect(decodeURIComponent(html)).toContain('>♭3<');
    expect(dt.data.DownloadURL).toMatch(/^image\/svg\+xml:Am7_5-7-5-5-5-5\.svg:data:image\/svg\+xml/);
    expect(moveable[0]).toHaveAttribute('aria-pressed', 'false');
  });

  it('names the image and escapes the name it is given', () => {
    const dt = fakeDataTransfer();
    dt.items.owner = dt;
    fillDragData(
      dt as unknown as DataTransfer,
      { chord: am7, voicing: OPEN_AM7, name: 'A<"m7">' }, DEFAULT_EXPORT_STYLE,
    );
    expect(dt.data['text/html']).toContain('alt="A&#60;&#34;m7&#34;&#62;"');
    expect(dt.data['text/plain']).toBe('A__m7___x-0-2-0-1-0');
  });
});
