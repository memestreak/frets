import { vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { readAscii } from '@/features/tab/ascii';
import { TAB_EXPORT_KEY } from '@/features/tab/exportTab';
import * as alphaTab from '@coderline/alphatab';
import { setUpPage, RIFF, TEX, renderAt, heading, alphaTexBox, alphaTexText, SLOW, settle, undo, keepOpen, pageClip } from './helpers';

setUpPage();

describe('TabPage export', () => {
  it('offers only bar insertion and Insert paste on a right-click on the tab', () => {
    keepOpen((readAscii(RIFF) as { clip: unknown }).clip);
    renderAt();
    fireEvent.contextMenu(screen.getByRole('textbox', { name: /Tab editor/ }));
    const menu = screen.getByRole('menu', { name: 'Tab' });
    expect(within(menu).getAllByRole('menuitem').map(i => i.textContent)).toEqual(['Insert bar before', 'Insert bar after', 'Insert paste']);
  });

  it('picks a drawn signature on a right-click and opens its menu, Edit only on bar 1, not its panel', () => {
    keepOpen((readAscii(RIFF) as { clip: unknown }).clip);
    renderAt();
    const svg = screen.getByRole('img', { name: /drawn as tab/ });
    fireEvent.pointerDown(svg, { clientX: 13, clientY: 65, button: 2 });
    fireEvent.contextMenu(screen.getByRole('textbox', { name: /Tab editor/ }), { clientX: 13, clientY: 65 });
    const menu = screen.getByRole('menu', { name: 'Selected' });
    expect(within(menu).getByRole('menuitem', { name: /Edit/ })).toBeInTheDocument();
    expect(within(menu).queryByRole('menuitem', { name: /Delete/ })).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Time signature' })).toBeNull();
  });

  it('a long press on a drawn signature picks it and opens its menu, with no panel', () => {
    vi.useFakeTimers();
    try {
      keepOpen((readAscii(RIFF) as { clip: unknown }).clip);
      renderAt();
      const svg = screen.getByRole('img', { name: /drawn as tab/ });
      fireEvent.pointerDown(svg, { clientX: 13, clientY: 65, pointerType: 'touch' });
      expect(screen.queryByRole('dialog', { name: 'Time signature' })).toBeNull();
      act(() => { vi.advanceTimersByTime(600); });
      expect(screen.getByRole('menu', { name: 'Selected' })).toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: 'Time signature' })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('downloads from a button at the clip\'s top right: a list of formats in Standard, the text in the text views', () => {
    keepOpen((readAscii(RIFF) as { clip: unknown }).clip);
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Download…' }));
    const menu = screen.getByRole('menu', { name: 'Download' });
    expect(within(menu).getAllByRole('menuitem').map(i => i.textContent)).toEqual(['PNG image…', 'SVG image…', 'ASCII tab…', 'alphaTex…', 'MusicXML…', 'Guitar Pro…']);
    fireEvent.keyDown(menu, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'ASCII Tab' }));
    expect(screen.getByRole('button', { name: 'Download text file' })).not.toHaveAttribute('aria-haspopup');
    fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
    expect(screen.getByRole('button', { name: 'Download alphaTex file' })).toBeInTheDocument();
  });

  it('opens Export from the header, and remembers its choices', async () => {
    keepOpen((readAscii(RIFF) as { clip: unknown }).clip);
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const dialog = screen.getByRole('dialog', { name: 'Export Riff' });
    const format = within(dialog).getByRole('combobox', { name: 'Format' });
    expect(format).toHaveValue('png');
    // The Format list comes before the image's choices; the name can be hidden but not edited here.
    const size = within(dialog).getByRole('group', { name: 'Size' });
    expect(format.compareDocumentPosition(size) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(dialog).queryByRole('textbox', { name: 'Name' })).toBeNull();
    expect(within(dialog).getByTestId('export-size')).toHaveTextContent(/^800 × \d+ px, on white$/);
    // A choice changes the preview's size line and is remembered.
    fireEvent.click(within(within(dialog).getByRole('group', { name: 'Size' })).getByRole('button', { name: '480' }));
    fireEvent.click(within(within(dialog).getByRole('group', { name: 'Transparent background' })).getByRole('button', { name: 'On' }));
    expect(within(dialog).getByTestId('export-size')).toHaveTextContent(/^480 × \d+ px, transparent$/);
    await waitFor(() => expect(JSON.parse(localStorage.getItem(TAB_EXPORT_KEY)!)).toMatchObject({ width: 480, transparent: true }));
    fireEvent.click(within(within(dialog).getByRole('group', { name: 'Clip name' })).getByRole('button', { name: 'Hide' }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(TAB_EXPORT_KEY)!)).toMatchObject({ name: false }));
    // One way to close: × (or Esc); no Done.
    expect(within(dialog).queryByRole('button', { name: 'Done' })).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close export' }));
    expect(dialog).not.toHaveAttribute('open');
  });

  it('lists every format in one Format list, with the image choices only for PNG and SVG, and Copy only where it can paste', () => {
    keepOpen((readAscii(RIFF) as { clip: unknown }).clip);
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const dialog = screen.getByRole('dialog', { name: 'Export Riff' });
    const format = within(dialog).getByRole('combobox', { name: 'Format' });
    expect(within(format).getAllByRole('option').map(o => o.textContent)).toEqual(['PNG image', 'SVG image', 'ASCII tab', 'alphaTex', 'MusicXML', 'Guitar Pro']);
    const shows = () => ({
      // Shut, the preview stays drawn (it folds away) but is hidden.
      preview: within(dialog).getByTestId('export-preview-fold').getAttribute('aria-hidden') !== 'true',
      choices: ['Size', 'Transparent background', 'Clip name'].filter(g => within(dialog).queryByRole('group', { name: g })).length,
      copy: within(dialog).queryByRole('button', { name: 'Copy' }) !== null,
      downloads: within(dialog).getAllByRole('button', { name: /Download/ }).length,
    });
    const seen: Record<string, ReturnType<typeof shows>> = {};
    for (const f of ['png', 'svg', 'ascii', 'alphatex', 'musicxml', 'guitarPro']) {
      fireEvent.change(format, { target: { value: f } });
      seen[f] = shows();
    }
    expect(seen).toEqual({
      png: { preview: true, choices: 3, copy: true, downloads: 1 },
      svg: { preview: true, choices: 3, copy: true, downloads: 1 },
      ascii: { preview: false, choices: 0, copy: true, downloads: 1 },
      alphatex: { preview: false, choices: 0, copy: true, downloads: 1 },
      musicxml: { preview: false, choices: 0, copy: false, downloads: 1 },
      guitarPro: { preview: false, choices: 0, copy: false, downloads: 1 },
    });
    // Folded away, the image's parts can't be reached from the keyboard either.
    expect(within(dialog).getByTestId('export-choices-fold')).toHaveAttribute('inert');
    // Closed and opened again, it is still on the format last picked.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close export' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(within(screen.getByRole('dialog', { name: 'Export Riff' })).getByRole('combobox', { name: 'Format' })).toHaveValue('guitarPro');
  });

  it('copies ASCII tab and alphaTex as text', async () => {
    keepOpen((readAscii(RIFF) as { clip: unknown }).clip);
    renderAt();
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const dialog = screen.getByRole('dialog', { name: 'Export Riff' });
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Format' }), { target: { value: 'alphatex' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(within(dialog).getByRole('status')).toHaveTextContent('Copied as text'));
    expect(writeText).toHaveBeenLastCalledWith(expect.stringContaining('\\title "Riff"'));
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Format' }), { target: { value: 'ascii' } });
    expect(within(dialog).getByRole('status')).toHaveTextContent('');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
    expect(writeText).toHaveBeenLastCalledWith(expect.stringMatching(/^e\|/m));
  });

  describe('the AlphaTex view (issue #126)', () => {
    const type = (text: string) => fireEvent.change(alphaTexBox(), { target: { value: text } });

    it('changes the clip from the text once it reads cleanly, as one undo step, and keeps the text as typed', async () => {
      renderAt(`#tab=${encodeURIComponent(TEX)}`);
      await waitFor(() => expect(heading()).toHaveTextContent('Tex riff'), SLOW);
      fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
      const typed = '\\title   "Typed"\n// my riff\n:8 5.5 7.5 |';
      type(typed);
      await waitFor(() => expect(heading()).toHaveTextContent('Typed'), SLOW);
      expect(alphaTexText()).toBe(typed);
      expect(screen.getByTestId('margin-note-2')).toHaveAttribute('data-tip', 'Comments are not kept');
      // An undo from outside the text box takes the clip back, and the text with it.
      undo();
      expect(heading()).toHaveTextContent('Tex riff');
      expect(alphaTexText()).toContain('\\title "Tex riff"');
    });

    it('keeps the title when the text names none: the title is never blank (issue #281)', async () => {
      renderAt(`#tab=${encodeURIComponent(TEX)}`);
      await waitFor(() => expect(heading()).toHaveTextContent('Tex riff'), SLOW);
      fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
      type(':8 5.5 7.5 |');
      await waitFor(() => expect(pageClip().tracks[0].bars[0].voices[0]).toHaveLength(2), SLOW);
      expect(pageClip().name).toBe('Tex riff');
    });

    it('opens a link with no title as Untitled (issue #281)', async () => {
      cleanup();
      renderAt(`#tab=${encodeURIComponent(':8 5.5 7.5 |')}`);
      await waitFor(() => expect(heading()).toHaveTextContent('Untitled'), SLOW);
      expect(pageClip().name).toBe('Untitled');
    });

    it('clears the text and the clip from the × at the top left, as one undo step', async () => {
      renderAt(`#tab=${encodeURIComponent(TEX)}`);
      await waitFor(() => expect(heading()).toHaveTextContent('Tex riff'), SLOW);
      expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
      fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
      expect(alphaTexText()).toBe('');
      expect(heading()).toHaveTextContent('Untitled');
      undo();
      expect(heading()).toHaveTextContent('Tex riff');
      expect(alphaTexText()).toContain('\\title "Tex riff"');
    });

    it('marks errors in the margin and under the text, and leaves the clip as it was', async () => {
      renderAt(`#tab=${encodeURIComponent(TEX)}`);
      await waitFor(() => expect(heading()).toHaveTextContent('Tex riff'), SLOW);
      fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
      type('\\title "Broken"\n:4 5.6 3.q |');
      await waitFor(() => expect(alphaTexBox()).toHaveAttribute('aria-invalid', 'true'), SLOW);
      expect(heading()).toHaveTextContent('Tex riff');
      expect(screen.getByTestId('margin-error-2').getAttribute('data-tip')).toMatch(/Unexpected/);
      expect(screen.getByTestId('alphatex-mirror').querySelector('[data-error]')).toHaveTextContent('q');
      // Fixed, the marks go and the clip follows.
      type('\\title "Fixed"\n:4 5.6 3.6 |');
      await waitFor(() => expect(heading()).toHaveTextContent('Fixed'), SLOW);
      expect(alphaTexBox()).toHaveAttribute('aria-invalid', 'false');
      expect(screen.queryByTestId('margin-error-2')).toBeNull();
    });

    it('marks an error with no place in the text on the first line', async () => {
      renderAt(`#tab=${encodeURIComponent(TEX)}`);
      await waitFor(() => expect(heading()).toHaveTextContent('Tex riff'), SLOW);
      fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
      type('\\tuning (E4 B3 G3 D3 A2 E2 B1)\n5.6 |');
      await waitFor(() => expect(screen.getByTestId('margin-error-1')).toHaveAttribute('data-tip', 'Frets reads six-string tab; this has 7 strings.'), SLOW);
    });

    it('takes the last keys when the view is left before they are read, and keeps the text as typed', async () => {
      renderAt(`#tab=${encodeURIComponent(TEX)}`);
      await waitFor(() => expect(heading()).toHaveTextContent('Tex riff'), SLOW);
      fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
      await settle();
      const typed = '// kept\n\\title "Quick"\n:4 5.6 |';
      type(typed);
      fireEvent.click(screen.getByRole('button', { name: 'Notation' }));
      expect(heading()).toHaveTextContent('Quick');
      fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
      expect(alphaTexText()).toBe(typed);
    });

    it('writes the clip out again only once an edit on the Standard view changes it', async () => {
      renderAt(`#tab=${encodeURIComponent(TEX)}`);
      await waitFor(() => expect(heading()).toHaveTextContent('Tex riff'), SLOW);
      fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
      const typed = '// kept\n\\title "Mine"\n:4 5.6 |';
      type(typed);
      await waitFor(() => expect(heading()).toHaveTextContent('Mine'), SLOW);
      fireEvent.click(screen.getByRole('button', { name: 'Notation' }));
      fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
      expect(alphaTexText()).toBe(typed);
      fireEvent.click(screen.getByRole('button', { name: 'Notation' }));
      const editor = screen.getByRole('textbox', { name: /Tab editor/ });
      act(() => editor.focus());
      fireEvent.keyDown(editor, { key: '7' });
      fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
      expect(alphaTexText()).not.toContain('kept');
      expect(alphaTexText()).toContain('\\title "Mine"');
    });
  });

  it('has a copy button in every view: the picture in Tab, the text in ASCII and alphaTex', () => {
    keepOpen((readAscii(RIFF) as { clip: unknown }).clip);
    renderAt();
    expect(screen.getByRole('button', { name: 'Copy as PNG' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ASCII Tab' }));
    expect(screen.getByRole('button', { name: 'Copy as text' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy as PNG' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
    expect(screen.getByRole('button', { name: 'Copy as text' })).toBeInTheDocument();
  });

  it('downloads the picked format with the one Download button', async () => {
    keepOpen((readAscii(RIFF) as { clip: unknown }).clip);
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const dialog = screen.getByRole('dialog', { name: 'Export Riff' });
    const saved: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      saved.push(this.download);
    });
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    try {
      for (const [f, name] of [['alphatex', 'Riff.alphatex.txt'], ['ascii', 'Riff.txt'], ['musicxml', 'Riff.musicxml'], ['svg', 'Riff.svg']]) {
        fireEvent.change(within(dialog).getByRole('combobox', { name: 'Format' }), { target: { value: f } });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Download' }));
        await waitFor(() => expect(within(dialog).getByRole('status')).toHaveTextContent(`Downloaded ${name}`));
      }
      expect(saved).toEqual(['Riff.alphatex.txt', 'Riff.txt', 'Riff.musicxml', 'Riff.svg']);
      // The file holds all of this clip, so no ⚠ says otherwise.
      fireEvent.change(within(dialog).getByRole('combobox', { name: 'Format' }), { target: { value: 'musicxml' } });
      expect(within(dialog).queryByRole('img', { name: /MusicXML file leaves out/ })).toBeNull();
    } finally {
      click.mockRestore();
    }
  });

  it('marks MusicXML and Guitar Pro with a ⚠ when the file can\'t hold all of the clip, only while that format is picked', async () => {
    renderAt('#example=oceanic-speedy-down-run');
    await screen.findByRole('heading', { name: 'Oceanic Speedy Down Run' }, SLOW);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const dialog = screen.getByRole('dialog', { name: /^Export/ });
    const format = within(dialog).getByRole('combobox', { name: 'Format' });
    expect(within(dialog).queryByRole('img', { name: /leaves out/ })).toBeNull();
    fireEvent.change(format, { target: { value: 'musicxml' } });
    expect(within(dialog).getByRole('img', { name: 'The MusicXML file leaves out the FX.' })).toHaveTextContent('⚠');
    fireEvent.change(format, { target: { value: 'guitarPro' } });
    expect(within(dialog).getByRole('img', { name: 'The Guitar Pro file leaves out the FX.' })).toHaveTextContent('⚠');
    fireEvent.change(format, { target: { value: 'alphatex' } });
    expect(within(dialog).queryByRole('img', { name: /leaves out/ })).toBeNull();
  });

  it('downloads the whole clip as a Guitar Pro file from Export and from Notation\'s Download list', async () => {
    keepOpen((readAscii(RIFF) as { clip: unknown }).clip);
    renderAt();
    const saved: { name: string; blob: Blob }[] = [];
    const blobs = new Map<string, Blob>();
    URL.createObjectURL = vi.fn((blob: Blob) => {
      const url = `blob:${blobs.size}`;
      blobs.set(url, blob);
      return url;
    });
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      saved.push({ name: this.download, blob: blobs.get(this.href)! });
    });
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Export' }));
      const dialog = screen.getByRole('dialog', { name: 'Export Riff' });
      fireEvent.change(within(dialog).getByRole('combobox', { name: 'Format' }), { target: { value: 'guitarPro' } });
      // The riff has no FX, so nothing is left out.
      expect(within(dialog).queryByRole('img', { name: /Guitar Pro file leaves out/ })).toBeNull();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Download' }));
      await waitFor(() => expect(within(dialog).getByRole('status')).toHaveTextContent('Downloaded Riff.gp'), SLOW);
      fireEvent.click(within(dialog).getByRole('button', { name: 'Close export' }));
      fireEvent.click(screen.getByRole('button', { name: 'Download…' }));
      fireEvent.click(within(screen.getByRole('menu', { name: 'Download' })).getByRole('menuitem', { name: 'Guitar Pro…' }));
      await waitFor(() => expect(saved).toHaveLength(2), SLOW);
      expect(saved.map(s => s.name)).toEqual(['Riff.gp', 'Riff.gp']);
      for (const { blob } of saved) {
        const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(await blob.arrayBuffer()), new alphaTab.Settings());
        expect(score.title).toBe('Riff');
        expect(score.tracks[0].staves[0].bars.length).toBeGreaterThan(0);
      }
    } finally {
      click.mockRestore();
    }
  });
});
