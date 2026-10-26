import { vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import TabPage from '@/features/tab/TabPage';
import { readAscii } from '@/features/tab/ascii';
import { STORAGE_KEY } from '@/features/tab/clipState';
import { TAB_EXPORT_KEY } from '@/features/tab/exportTab';

const RIFF = [
  'Title: Riff',
  'Time: 4/4',
  '',
  '  e   e   e   e   q       q       h               |',
  'e|----------------------------------------------|',
  'B|----------------------------------------------|',
  'G|----------------------------------------------|',
  'D|--------5h7-----------------------------------|',
  'A|--5h7-------7---5-------------------------------|',
  'E|----------------------------------------------|',
].join('\n');

const OTHER = [
  'e|--3---3---|',
  'B|--3---3---|',
  'G|--0---0---|',
  'D|--0---0---|',
  'A|--2---2---|',
  'E|--3---3---|',
].join('\n');

/** Renders the page at /tab plus `hash`. */
function renderAt(hash = '') {
  window.history.replaceState(null, '', `/tab${hash}`);
  return render(<TabPage />);
}

const heading = () => screen.getByRole('heading', { level: 1 });
const notice = () => screen.getByTestId('tab-notice');
const paste = async (text: string) => {
  const event = new Event('paste', { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown };
  event.clipboardData = { getData: () => text };
  await act(async () => { document.body.dispatchEvent(event); });
};
/** How long an import may take; alphaTab's first load is slow on a busy test machine. */
const SLOW = { timeout: 5000 };
/** Lets an import finish: reading is async, and alphaTex loads alphaTab first. */
const settle = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });
const TEX = '\\title "Tex riff"\n:8 5.5{h} 7.5 5.4{h} 7.4 |';
const undo = (shift = false) => fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true, shiftKey: shift });

beforeEach(() => {
  localStorage.clear();
});

afterEach(cleanup);

/** A press on the time signature drawn in front of the first line (jsdom places the drawing at 0, 0). */
function pressFirstTimeSignature() {
  const svg = screen.getByRole('img', { name: /drawn as tab/ });
  // The numbers are centred 13 units in, round the middle of a staff that starts 30 down.
  fireEvent.pointerDown(svg, { clientX: 13, clientY: 65 });
}

describe('TabPage', () => {
  it('starts empty, saying how to bring tab in', () => {
    renderAt();
    expect(heading()).toHaveTextContent('Untitled clip');
    expect(notice()).toHaveTextContent('Click the tab and type frets, or import or paste alphaTex or ASCII tab.');
  });

  it('imports the tab in a #tab= link, then clears the link', async () => {
    renderAt(`#tab=${encodeURIComponent(OTHER)}`);
    await settle();
    expect(screen.getAllByTestId('tab-column')).toHaveLength(2);
    expect(window.location.hash).toBe('');
  });

  it('reads alphaTex as well as ASCII', async () => {
    renderAt(`#tab=${encodeURIComponent(TEX)}`);
    await screen.findByRole('heading', { name: 'Tex riff' }, SLOW);
    expect(screen.getAllByTestId('tab-column')).toHaveLength(4);
  });

  it('imports a #tab= link followed while the page is open', async () => {
    renderAt();
    await act(async () => {
      window.history.replaceState(null, '', `/tab#tab=${encodeURIComponent(RIFF)}`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    await settle();
    expect(heading()).toHaveTextContent('Riff');
    expect(window.location.hash).toBe('');
  });

  it('says why a link\'s tab could not be read and keeps the saved clip', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify((readAscii(RIFF) as { clip: unknown }).clip));
    renderAt(`#tab=${encodeURIComponent('no tab here')}`);
    await screen.findByText(/./, { selector: '[data-testid="tab-notice"].text-\\(--danger\\)' }, SLOW);
    expect(heading()).toHaveTextContent('Riff');
  });

  it('imports from the dialog, and shows errors there without closing', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Import…' }));
    const dialog = screen.getByRole('dialog');
    const text = within(dialog).getByRole('textbox', { name: 'Tab, as alphaTex or ASCII' });
    fireEvent.change(text, { target: { value: 'e|-5-|\nB|-5-|' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Import' }));
    expect(await within(dialog).findByTestId('import-errors', {}, SLOW)).toBeInTheDocument();
    fireEvent.change(text, { target: { value: RIFF } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Import' }));
    await screen.findByRole('heading', { name: 'Riff' }, SLOW);
    // The dialog closes once the import's promise settles, which can be a render after the heading.
    await waitFor(() => expect(dialog).not.toHaveAttribute('open'), SLOW);
  });

  it('takes a paste whole into an empty clip, then pastes at the cursor; undo and redo step back and forth', async () => {
    renderAt();
    await paste(RIFF);
    expect(heading()).toHaveTextContent('Riff');
    const columns = screen.getAllByTestId('tab-column').length;
    await paste(OTHER);
    expect(heading()).toHaveTextContent('Riff');
    expect(screen.getAllByTestId('tab-column')).toHaveLength(columns + 2);
    undo();
    expect(screen.getAllByTestId('tab-column')).toHaveLength(columns);
    undo(true);
    expect(screen.getAllByTestId('tab-column')).toHaveLength(columns + 2);
  });

  it('says what a paste that is not tab got wrong, and keeps the clip', async () => {
    renderAt();
    await paste(RIFF);
    await paste('just some words');
    await screen.findByText(/./, { selector: '[data-testid="tab-notice"].text-\\(--danger\\)' }, SLOW);
    expect(heading()).toHaveTextContent('Riff');
  });

  it('shows the clip as alphaTex and as ASCII', async () => {
    renderAt(`#tab=${encodeURIComponent(RIFF)}`);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'alphaTex' }));
    expect(screen.getByTestId('tab-ascii').textContent).toContain('\\title "Riff"');
    fireEvent.click(screen.getByRole('button', { name: 'ASCII' }));
    expect(screen.getByTestId('tab-ascii').textContent).toContain('Title: Riff');
    expect(screen.queryByTestId('tab-column')).toBeNull();
  });

  it('copies the text from a button in the text views', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderAt(`#tab=${encodeURIComponent(RIFF)}`);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'ASCII' }));
    const view = screen.getByTestId('tab-ascii').parentElement!;
    await act(async () => { fireEvent.click(within(view).getByRole('button', { name: 'Copy ASCII' })); });
    expect(writeText).toHaveBeenCalledWith(screen.getByTestId('tab-ascii').textContent);
    expect(notice()).toHaveTextContent('ASCII copied.');
  });

  it('saves the clip and opens on it next time', async () => {
    renderAt();
    await paste(RIFF);
    cleanup();
    renderAt();
    expect(heading()).toHaveTextContent('Riff');
  });

  describe('editing', () => {
    const editor = () => screen.getByRole('textbox', { name: /Tab editor/ });
  const vibrato = () => screen.getByRole('button', { name: /^Vibrato/ });
    const keys = (...list: (string | { key: string; shiftKey?: boolean; altKey?: boolean; code?: string })[]) => {
      for (const k of list) fireEvent.keyDown(editor(), typeof k === 'string' ? { key: k } : k);
    };
    const alphaTex = () => {
      fireEvent.click(screen.getByRole('button', { name: 'alphaTex' }));
      const text = screen.getByTestId('tab-ascii').textContent ?? '';
      fireEvent.click(screen.getByRole('button', { name: 'Tab' }));
      return text.split('\n').filter(l => l.endsWith('|')).join('\n');
    };

    it('types frets, two digits making one, and moves on with the arrows', () => {
      renderAt();
      act(() => editor().focus());
      keys('ArrowDown', 'ArrowDown', '1', '2', 'ArrowRight', '1', '4', 'ArrowDown', '0');
      expect(alphaTex()).toBe('12.3.4 (14.3 0.4).4 |');
      expect(screen.getByTestId('tab-cursor')).toBeInTheDocument();
    });

    it('marks notes and columns from the keys and from the palette', () => {
      renderAt();
      act(() => editor().focus());
      keys('5', 'ArrowRight', '7', 'h', '-');
      fireEvent.click(vibrato());
      expect(alphaTex()).toBe('5.1{h}.4 7.1{v}.8 |');
      expect(vibrato()).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Eighth note' })).toHaveAttribute('aria-pressed', 'true');
      // Off the tab, no button is lit.
      act(() => editor().blur());
      expect(screen.getAllByRole('button', { pressed: true }).filter(b => b.closest('.tab-palette'))).toEqual([]);
    });

    it('picks a bend amount from the Bend button\'s panel, and takes it away with None', () => {
      renderAt();
      act(() => editor().focus());
      keys('7');
      const bend = () => screen.getByRole('button', { name: 'Bend' });
      fireEvent.click(bend());
      expect(bend()).toHaveAttribute('aria-expanded', 'true');
      fireEvent.click(screen.getByRole('button', { name: 'full' }));
      expect(alphaTex()).toBe('7.1{b (0 4)}.4 |');
      expect(screen.queryByRole('dialog', { name: 'Bend' })).toBeNull();
      expect(bend()).toHaveAttribute('aria-pressed', 'true');
      fireEvent.click(bend());
      expect(screen.getByRole('button', { name: 'full' })).toHaveAttribute('aria-pressed', 'true');
      fireEvent.click(screen.getByRole('button', { name: '½' }));
      expect(alphaTex()).toBe('7.1{b (0 2)}.4 |');
      fireEvent.click(bend());
      fireEvent.click(screen.getByRole('button', { name: 'None' }));
      expect(alphaTex()).toBe('7.1.4 |');
      fireEvent.click(bend());
      expect(screen.getByRole('button', { name: 'None' })).toHaveAttribute('aria-pressed', 'true');
      fireEvent.click(bend());
      // Esc closes the panel and leaves the cursor on the tab.
      fireEvent.click(bend());
      fireEvent.keyDown(editor(), { key: 'Escape' });
      expect(screen.queryByRole('dialog', { name: 'Bend' })).toBeNull();
      expect(screen.getByTestId('tab-cursor')).toBeInTheDocument();
    });

    it('steps V, N, A and \\ through their kinds, and toggles L, G and S', () => {
      renderAt();
      act(() => editor().focus());
      keys('5', 'v', 'v', 'n', 'n', 'a', 'a', '\\', 'l', 'g', 's');
      expect(alphaTex()).toBe('5.1{sod vw ph lr g hac st}.4 |');
      expect(vibrato()).toHaveAttribute('aria-pressed', 'true');
      keys('v', 'g');
      expect(alphaTex()).toBe('5.1{sod ph lr hac st}.4 |');
    });

    it('marks a bar with something wrong under its start, the words as the tip', () => {
      renderAt();
      act(() => editor().focus());
      keys('5', '-');
      // One eighth: the bar doesn't add up.
      expect(screen.getByTestId('bar-warning').getAttribute('data-tip')).toBe("Bar 1 doesn't add up to 4/4.");
      // A lone triplet eighth: nor is the triplet whole.
      act(() => { fireEvent.keyDown(editor(), { key: '3', code: 'Digit3', altKey: true }); });
      const warning = screen.getByTestId('bar-warning');
      expect(warning.getAttribute('data-tip')).toBe("Bar 1 doesn't add up to 4/4. The tuplet of 3 in bar 1 has 1 note; it needs 3.");
    });

    it('writes free text over a column from the palette, and edits it from a press on it', () => {
      renderAt();
      act(() => editor().focus());
      keys('5');
      fireEvent.click(screen.getByRole('button', { name: 'Text over this column' }));
      const field = screen.getByRole('textbox', { name: 'Text over the column' });
      fireEvent.change(field, { target: { value: 'let "it" ring' } });
      fireEvent.keyDown(field, { key: 'Enter' });
      expect(screen.getByTestId('beat-text')).toHaveTextContent('let "it" ring');
      expect(screen.getByRole('button', { name: 'Text over this column' })).toHaveAttribute('aria-pressed', 'true');
      expect(alphaTex()).toBe('5.1.4{txt "let \\"it\\" ring"} |');
      // Empty clears it.
      fireEvent.click(screen.getByRole('button', { name: 'Text over this column' }));
      const again = screen.getByRole('textbox', { name: 'Text over the column' });
      expect(again).toHaveValue('let "it" ring');
      fireEvent.change(again, { target: { value: '' } });
      fireEvent.keyDown(again, { key: 'Enter' });
      expect(screen.queryByTestId('beat-text')).toBeNull();
    });

    it('names a chord from C and a field over the tab, and sets the capo from the palette', () => {
      renderAt();
      act(() => editor().focus());
      keys('5', 'c');
      const field = screen.getByRole('textbox', { name: 'Chord name' });
      fireEvent.change(field, { target: { value: 'Am7' } });
      fireEvent.keyDown(field, { key: 'Enter' });
      expect(screen.queryByRole('textbox', { name: 'Chord name' })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Capo' }));
      const capo = screen.getByRole('textbox', { name: 'Capo on fret, 1 to 12' });
      fireEvent.change(capo, { target: { value: '3' } });
      fireEvent.keyDown(capo, { key: 'Enter' });
      expect(screen.getByTestId('capo')).toHaveTextContent('Capo 3');
      expect(screen.getByRole('button', { name: 'Capo' })).toHaveAttribute('aria-pressed', 'true');
      fireEvent.click(screen.getByRole('button', { name: 'alphaTex' }));
      expect(screen.getByTestId('tab-ascii').textContent).toContain('\\capo 3\n5.1.4{ch "Am7"} |');
      fireEvent.click(screen.getByRole('button', { name: 'Tab' }));
      // An empty field, or 0, takes the capo off.
      fireEvent.click(screen.getByRole('button', { name: 'Capo' }));
      const again = screen.getByRole('textbox', { name: 'Capo on fret, 1 to 12' });
      expect(again).toHaveValue('3');
      fireEvent.change(again, { target: { value: '0' } });
      fireEvent.keyDown(again, { key: 'Enter' });
      expect(screen.queryByTestId('capo')).toBeNull();
    });

    it('selects with Shift+arrows, copies the selection as alphaTex and deletes it', () => {
      renderAt();
      act(() => editor().focus());
      keys('5', 'ArrowRight', '7', 'ArrowRight', '9', { key: 'ArrowLeft', shiftKey: true });
      expect(screen.getByTestId('tab-selection').children).toHaveLength(2);
      const data = new Map<string, string>();
      const copy = new Event('copy', { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown };
      copy.clipboardData = { setData: (type: string, text: string) => data.set(type, text) };
      act(() => { editor().dispatchEvent(copy); });
      expect(data.get('text/plain')).toBe('\\ts (4 4)\n7.1.4 9.1.4 |\n');
      keys('Backspace');
      expect(alphaTex()).toBe('5.1.4 |');
    });

    it('sets the time signature from the palette, each change one undo step', () => {
      renderAt();
      act(() => editor().focus());
      keys('5', 'ArrowRight', '5', 'ArrowRight', '5');
      const drawn = () => screen.getAllByTestId('time-signature')[0].textContent;
      expect(notice()).toHaveTextContent('Bar 1 doesn\'t add up to 4/4.');
      // In the first bar the palette button opens the clip's own time signature, as a press on the drawn 4/4 does.
      fireEvent.click(screen.getByRole('button', { name: 'Time signature from this bar' }));
      const panel = screen.getByRole('dialog', { name: 'Time signature' });
      const beats = within(panel).getByRole('textbox', { name: 'Beats in a bar' });
      expect(beats).toHaveValue('4');
      // A typed count takes effect on Enter.
      fireEvent.change(beats, { target: { value: '3' } });
      expect(notice()).toHaveTextContent('4/4');
      fireEvent.keyDown(beats, { key: 'Enter' });
      expect(notice()).not.toHaveTextContent('add up');
      expect(drawn()).toBe('34');
      // ↑ and + step at once; the beat is one of 2, 4, 8, 16, 32.
      fireEvent.keyDown(beats, { key: 'ArrowUp' });
      fireEvent.click(within(panel).getByRole('button', { name: 'More beats' }));
      expect(beats).toHaveValue('5');
      fireEvent.click(within(panel).getByRole('button', { name: '8' }));
      expect(within(panel).getByRole('button', { name: '8' })).toHaveAttribute('aria-pressed', 'true');
      expect(notice()).toHaveTextContent('Bar 1 doesn\'t add up to 5/8.');
      undo();
      expect(drawn()).toBe('54');
      undo();
      expect(beats).toHaveValue('4');
      // Esc closes the panel.
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('dialog', { name: 'Time signature' })).toBeNull();
    });

    it('keeps the count when what is typed isn\'t 1 to 32', () => {
      renderAt();
      pressFirstTimeSignature();
      const beats = screen.getByRole('textbox', { name: 'Beats in a bar' });
      for (const typed of ['0', '33', '']) {
        fireEvent.change(beats, { target: { value: typed } });
        fireEvent.blur(beats);
        expect(beats).toHaveValue('4');
      }
      fireEvent.change(beats, { target: { value: '32' } });
      fireEvent.blur(beats);
      expect(beats).toHaveValue('32');
      fireEvent.keyDown(beats, { key: 'ArrowUp' });
      expect(beats).toHaveValue('32');
      fireEvent.change(beats, { target: { value: '1' } });
      fireEvent.blur(beats);
      fireEvent.click(screen.getByRole('button', { name: 'Fewer beats' }));
      expect(beats).toHaveValue('1');
    });

    it('says when a bar doesn\'t add up', () => {
      renderAt();
      act(() => editor().focus());
      keys('5');
      expect(notice()).toHaveTextContent('Bar 1 doesn\'t add up to 4/4.');
    });
  });
});

describe('TabPage examples', () => {
  const saved = () => JSON.parse(localStorage.getItem(STORAGE_KEY)!).name as string;
  const editor = () => screen.getByRole('textbox', { name: /Tab editor/ });

  it('shows an example in place of the clip, never saves its edits, and goes back to the clip', async () => {
    renderAt(`#tab=${encodeURIComponent(TEX)}`);
    await screen.findByRole('heading', { name: 'Tex riff' }, SLOW);
    fireEvent.click(screen.getByRole('button', { name: 'Examples…' }));
    const dialog = screen.getByRole('dialog', { name: 'Examples' });
    fireEvent.click(within(dialog).getByRole('button', { name: /Bends and vibrato/ }));
    await screen.findByRole('heading', { name: 'Bends and vibrato' }, SLOW);
    expect(screen.getByTestId('clip-facts')).toHaveTextContent("Example: edits aren't saved");
    expect(window.location.hash).toBe('#example=bends');
    // An edit changes the example on the page, not the saved clip.
    act(() => editor().focus());
    fireEvent.keyDown(editor(), { key: '9' });
    await settle();
    expect(saved()).toBe('Tex riff');
    fireEvent.click(screen.getByRole('button', { name: 'Back to my clip' }));
    expect(heading()).toHaveTextContent('Tex riff');
    expect(screen.getByTestId('clip-facts')).toBeEmptyDOMElement();
    expect(window.location.hash).toBe('');
    // Undo still has the clip's own history: before the import, the clip was empty.
    undo();
    expect(heading()).toHaveTextContent('Untitled clip');
  });

  it('opens the example in an #example= link and keeps the link while it is shown', async () => {
    renderAt('#example=repeats');
    await screen.findByRole('heading', { name: 'Repeats and endings' }, SLOW);
    expect(window.location.hash).toBe('#example=repeats');
    expect(screen.getAllByTestId('repeat-start').length).toBeGreaterThan(0);
  });

  it('says so when a link names no example', async () => {
    renderAt('#example=nope');
    await waitFor(() => expect(notice()).toHaveTextContent('There is no example called "nope".'), SLOW);
  });

  it('makes an import over an example the saved clip', async () => {
    renderAt('#example=drop-d');
    await screen.findByRole('heading', { name: 'Drop D' }, SLOW);
    fireEvent.click(screen.getByRole('button', { name: 'Import…' }));
    fireEvent.change(screen.getByRole('textbox', { name: /Tab, as alphaTex or ASCII/ }), { target: { value: TEX } });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    await screen.findByRole('heading', { name: 'Tex riff' }, SLOW);
    expect(screen.getByTestId('clip-facts')).toBeEmptyDOMElement();
    expect(window.location.hash).toBe('');
    await waitFor(() => expect(saved()).toBe('Tex riff'));
  });
});

describe('TabPage export', () => {
  it('offers only bar insertion on a right-click on the tab', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify((readAscii(RIFF) as { clip: unknown }).clip));
    renderAt();
    fireEvent.contextMenu(screen.getByRole('textbox', { name: /Tab editor/ }));
    const menu = screen.getByRole('menu', { name: 'Tab' });
    expect(within(menu).getAllByRole('menuitem').map(i => i.textContent)).toEqual(['Insert bar before', 'Insert bar after']);
  });

  it('opens Export options from the header, and remembers its choices', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify((readAscii(RIFF) as { clip: unknown }).clip));
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Export options' }));
    const dialog = screen.getByRole('dialog', { name: 'Export Riff' });
    expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveValue('Riff');
    expect(within(dialog).getByTestId('export-size')).toHaveTextContent(/^800 × \d+ px, on white$/);
    // A choice changes the preview's size line and is remembered.
    fireEvent.click(within(within(dialog).getByRole('group', { name: 'Size' })).getByRole('button', { name: '480' }));
    fireEvent.click(within(within(dialog).getByRole('group', { name: 'Transparent' })).getByRole('button', { name: 'On' }));
    expect(within(dialog).getByTestId('export-size')).toHaveTextContent(/^480 × \d+ px, transparent$/);
    await waitFor(() => expect(JSON.parse(localStorage.getItem(TAB_EXPORT_KEY)!)).toMatchObject({ width: 480, transparent: true }));
    // Hiding the name greys out its field.
    fireEvent.click(within(within(dialog).getByRole('group', { name: 'Clip name' })).getByRole('button', { name: 'Hide' }));
    expect(within(dialog).getByRole('textbox', { name: 'Name' })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(dialog).not.toHaveAttribute('open');
  });

  it('has a copy button in every view: the picture in Tab, the text in ASCII and alphaTex', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify((readAscii(RIFF) as { clip: unknown }).clip));
    renderAt();
    expect(screen.getByRole('button', { name: 'Copy as PNG' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ASCII' }));
    expect(screen.getByRole('button', { name: 'Copy ASCII' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy as PNG' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'alphaTex' }));
    expect(screen.getByRole('button', { name: 'Copy alphaTex' })).toBeInTheDocument();
  });

  it('opens Export options from the Export options button, which also downloads the clip as text', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify((readAscii(RIFF) as { clip: unknown }).clip));
    renderAt();
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Export options' }));
    const dialog = screen.getByRole('dialog', { name: 'Export Riff' });
    const saved: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      saved.push(this.download);
    });
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Download alphaTex' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Download ASCII' }));
    expect(saved).toEqual(['Riff.alphatex.txt', 'Riff.txt']);
    expect(within(dialog).getByRole('status')).toHaveTextContent('Downloaded Riff.txt');
    click.mockRestore();
  });
});
