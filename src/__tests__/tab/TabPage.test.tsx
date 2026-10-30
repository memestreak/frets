import { vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import TabPage from '@/features/tab/TabPage';
import { LetGoAfterUse } from '@/components/LetGoAfterUse';
import { readAscii } from '@/features/tab/ascii';
import { arrangementKey, LIBRARY_KEY, loadLibrary } from '@/features/tab/arrangements';
import { DOUBLE_TAP_MS, DRAG_TYPE } from '@/features/tab/ArrangementsDialog';
import { TAB_EXPORT_KEY } from '@/features/tab/exportTab';
import { PLAYBACK_KEY } from '@/features/tab/PlaybackFooter';
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { BUILTIN_URL, builtinsFrom } from '@/features/tab/builtins';
import { readBuiltinFiles } from '@/features/tab/builtinFiles';
import { EDITING_KEY } from '@/features/tab/editingPrefs';
import { layoutClip } from '@/features/tab/layout';
import { markBoxes, type MarkHit } from '@/features/tab/marks';
import { type Clip, partOf } from '@/features/tab/clip';

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

// The built-in arrangements, served as the route serves them; nothing else is fetched.
const BUILTIN_FILES = await readBuiltinFiles();
const exampleById = (id: string) => builtinsFrom(BUILTIN_FILES).find(b => b.id === id);
vi.stubGlobal('fetch', vi.fn(async (url: unknown) => {
  if (String(url) !== BUILTIN_URL) throw new Error(`Not fetched in tests: ${String(url)}`);
  return new Response(JSON.stringify(BUILTIN_FILES));
}));

/** Renders the page at /tab plus `hash`. */
function renderAt(hash = '') {
  window.history.replaceState(null, '', `/tab${hash}`);
  // As in the app, where `AppShell` mounts it on every page.
  return render(<><LetGoAfterUse /><TabPage /></>);
}

const heading = () => screen.getByRole('heading', { level: 1 });
/** The AlphaTex view's text box, and the text in it. */
const alphaTexBox = () => screen.getByRole('textbox', { name: 'alphaTex' }) as HTMLTextAreaElement;
const alphaTexText = () => alphaTexBox().value;
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
const FX_LINE = '// frets:fx on; distortion on drive=0.9 tone=0.2; reverb on amount=0.6 decay=3';
const undo = (shift = false) => fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true, shiftKey: shift });

/** Keeps `clip` as the open arrangement, as if it had been written on an earlier visit. */
function keepOpen(clip: unknown) {
  localStorage.setItem(arrangementKey('kept'), JSON.stringify(clip));
  localStorage.setItem(LIBRARY_KEY, JSON.stringify({ open: 'kept', items: [{ id: 'kept', name: (clip as { name: string }).name, changed: 1 }] }));
}
/** The open arrangement's clip as saved. */
const savedClip = () => JSON.parse(localStorage.getItem(arrangementKey(loadLibrary().open!))!) as { name: string };
/** A double click, as a browser sends it: two clicks, the second counted as the second. */
const doubleClick = (el: Element) => {
  fireEvent.click(el, { detail: 1 });
  fireEvent.click(el, { detail: 2 });
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** A press on the time signature drawn in front of the first line (jsdom places the drawing at 0, 0). */
function pressFirstTimeSignature() {
  const svg = screen.getByRole('img', { name: /drawn as tab/ });
  // The numbers are centred 13 units in, round the middle of a staff that starts 30 down.
  fireEvent.pointerDown(svg, { clientX: 13, clientY: 65 });
}

describe('TabPage', () => {
  it("draws the title, credits and tuning as the score's head, in the clip's card, and shows bar numbers as the View options say", async () => {
    renderAt('#example=tuned-down');
    await waitFor(() => expect(heading()).toHaveTextContent("Sweet Child O' Mine (intro)"), SLOW);
    const credits = screen.getByTestId('score-head');
    // Over the drawing, inside the clip's card, as a printed score's first page has it.
    expect(credits.closest('section')).toBe(screen.getByRole('region', { name: 'Clip' }));
    expect(credits).toContainElement(heading());
    // The text views carry the same in their text, so the head is not drawn over them.
    fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
    expect(screen.queryByTestId('score-head')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Notation' }));
    expect(credits).toHaveTextContent("Guns N' Roses");
    expect(credits).toHaveTextContent('Words & Music by Axl Rose, Slash, Izzy Stradlin, Duff McKagan & Steven Adler');
    expect(within(credits).getByLabelText('Tuning')).toHaveTextContent('Tune down 1/2 step');
    const numbers = () => screen.queryAllByTestId('bar-number').map(n => n.textContent);
    expect(numbers()).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);

    fireEvent.click(screen.getByRole('button', { name: 'View options' }));
    const panel = screen.getByRole('dialog', { name: 'View options' });
    fireEvent.click(within(panel).getByRole('button', { name: 'None' }));
    expect(numbers()).toEqual([]);
    expect(JSON.parse(localStorage.getItem('frets.tab.notation')!)).toMatchObject({ barNumbers: 'none', size: 100 });
    expect(JSON.parse(localStorage.getItem('frets.tab.colours')!)).toMatchObject({ scheme: 'theme' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Each line' }));
    expect(numbers().length).toBeGreaterThan(0);
    expect(numbers()[0]).toBe('1');
    // Size: the drawing is laid out narrower and zoomed, so it fits more to a line; it steps by 10% and stops at 50%.
    const drawing = () => screen.getByRole('img', { name: /drawn as/ });
    const fullWidth = Number(drawing().getAttribute('width'));
    fireEvent.click(within(panel).getByRole('button', { name: 'Smaller' }));
    expect(within(panel).getByRole('spinbutton', { name: 'Size (percent)' })).toHaveAttribute('aria-valuenow', '90');
    expect(Number(drawing().getAttribute('width'))).toBeCloseTo(fullWidth / 0.9, 3);
    for (let i = 0; i < 6; i++) fireEvent.click(within(panel).getByRole('button', { name: 'Smaller' }));
    expect(within(panel).getByRole('spinbutton', { name: 'Size (percent)' })).toHaveAttribute('aria-valuenow', '50');
    expect(JSON.parse(localStorage.getItem('frets.tab.notation')!).size).toBe(50);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'View options' })).toBeNull();
  });

  it('starts empty, saying how to bring tab in', () => {
    renderAt();
    expect(heading()).toHaveTextContent('Untitled clip');
    expect(notice()).toHaveTextContent('Click the tab and type frets, or import or paste alphaTex or ASCII tab.');
  });

  it('renames the clip from its title, which the export Name starts on', () => {
    renderAt();
    fireEvent.click(within(heading()).getByRole('button', { name: 'Untitled clip' }));
    const panel = screen.getByRole('dialog', { name: 'Title and credits' });
    const field = within(panel).getByLabelText('Title (optional)');
    expect(field).toHaveValue('');
    expect(field).toHaveFocus();
    fireEvent.change(field, { target: { value: '  Riff  ' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(heading()).toHaveTextContent('Riff');
    expect(screen.queryByRole('dialog', { name: 'Title and credits' })).toBeNull();
    // Esc keeps the old title.
    fireEvent.click(within(heading()).getByRole('button', { name: 'Riff' }));
    const again = screen.getByLabelText('Title (optional)');
    expect(again).toHaveValue('Riff');
    fireEvent.change(again, { target: { value: 'Other' } });
    expect(heading()).toHaveTextContent('Other');
    fireEvent.keyDown(again, { key: 'Escape' });
    expect(heading()).toHaveTextContent('Riff');
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(within(screen.getByRole('dialog')).getByRole('textbox', { name: 'Name' })).toHaveValue('Riff');
    expect(savedClip().name).toBe('Riff');
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
    keepOpen((readAscii(RIFF) as { clip: unknown }).clip);
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

  it('imports an alphaTex file opened from the dialog', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Import…' }));
    const dialog = screen.getByRole('dialog');
    const file = new File(['\\title "From file"\n5.3.4 7.3.4 5.3.2 |'], 'riff.atex', { type: '' });
    fireEvent.change(within(dialog).getByLabelText('Tab file'), { target: { files: [file] } });
    await screen.findByRole('heading', { name: 'From file' }, SLOW);
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

  it('offers every view its options in one panel: the ASCII rhythm line and the alphaTex line numbers', async () => {
    renderAt(`#tab=${encodeURIComponent(RIFF)}`);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'ASCII Tab' }));
    const ascii = () => screen.getByTestId('tab-ascii').textContent!;
    expect(ascii()).toMatch(/^ +e/m);
    fireEvent.click(screen.getByRole('button', { name: 'View options' }));
    const panel = screen.getByRole('dialog', { name: 'View options' });
    // Every view's options are there, whichever view shows.
    expect(within(panel).getByRole('button', { name: 'None' })).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('switch', { name: 'Rhythm' }));
    expect(ascii()).not.toMatch(/^ +e/m);
    fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
    const numbers = () => screen.getByTestId('alphatex-mirror').querySelectorAll('.tab-text-number').length;
    expect(numbers()).toBeGreaterThan(0);
    fireEvent.click(within(panel).getByRole('switch', { name: 'Line numbers' }));
    expect(numbers()).toBe(0);
    expect(JSON.parse(localStorage.getItem('frets.tab.ascii')!)).toEqual({ rhythm: false });
    expect(JSON.parse(localStorage.getItem('frets.tab.alphatex')!)).toEqual({ lineNumbers: false });
  });

  it('shows every view in the colours chosen, on a sheet of the background, and Custom with its two swatches', async () => {
    renderAt(`#tab=${encodeURIComponent(RIFF)}`);
    await settle();
    const paper = () => screen.getByTestId('tab-paper');
    expect(paper().getAttribute('style') ?? '').toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'View options' }));
    const panel = screen.getByRole('dialog', { name: 'View options' });
    const colours = within(panel).getByRole('group', { name: 'Colours' });
    fireEvent.click(within(colours).getByRole('button', { name: 'Night' }));
    expect(paper().style.getPropertyValue('--ink')).toBe('#e8e2d6');
    expect(paper().style.getPropertyValue('--surface-raised')).toBe('#1c1a17');
    expect(within(panel).queryByLabelText('Text')).toBeNull();
    // Custom starts from the scheme shown, then keeps its own.
    fireEvent.click(within(colours).getByRole('button', { name: 'Custom' }));
    const text = within(panel).getByLabelText('Text') as HTMLInputElement;
    expect(text.value).toBe('#e8e2d6');
    fireEvent.change(text, { target: { value: '#7a1f1f' } });
    expect(paper().style.getPropertyValue('--ink')).toBe('#7a1f1f');
    // The text views take the same sheet.
    fireEvent.click(screen.getByRole('button', { name: 'ASCII Tab' }));
    expect(paper()).toContainElement(screen.getByTestId('tab-ascii'));
    expect(JSON.parse(localStorage.getItem('frets.tab.colours')!)).toEqual({ scheme: 'custom', text: '#7a1f1f', background: '#1c1a17' });
  });

  it('shows the clip as alphaTex and as ASCII', async () => {
    renderAt(`#tab=${encodeURIComponent(RIFF)}`);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
    expect(alphaTexText()).toContain('\\title "Riff"');
    fireEvent.click(screen.getByRole('button', { name: 'ASCII Tab' }));
    expect(screen.getByTestId('tab-ascii').textContent).toContain('Title: Riff');
    expect(screen.queryByTestId('tab-column')).toBeNull();
  });

  it('copies the text from a button in the text views', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderAt(`#tab=${encodeURIComponent(RIFF)}`);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'ASCII Tab' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy as text' })); });
    expect(writeText).toHaveBeenCalledWith(screen.getByTestId('tab-ascii').textContent);
    expect(notice()).toHaveTextContent('Copied as text.');
  });

  it('copies a link that opens the same arrangement as a new one, its instrument and FX in its text', async () => {
    const writeText = vi.fn((text: string) => { void text; return Promise.resolve(); });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderAt(`#tab=${encodeURIComponent(`${FX_LINE}\n\\instrument electricguitarclean\n${TEX}`)}`);
    await settle();
    fireEvent.click(await screen.findByRole('button', { name: 'AlphaTex' }, SLOW));
    const before = alphaTexText();
    expect(before.split('\n')[0]).toBe(FX_LINE);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy link' })); });
    await waitFor(() => expect(writeText).toHaveBeenCalled(), SLOW);
    const link = new URL(writeText.mock.calls[0][0]);
    expect(link.pathname).toBe('/tab');
    expect(link.hash.startsWith('#tabz=')).toBe(true);
    expect(notice()).toHaveTextContent('Copied a link to this arrangement.');
    // Followed in a fresh browser: nothing saved, the link alone brings the arrangement.
    cleanup();
    localStorage.clear();
    renderAt(link.hash);
    await screen.findByRole('heading', { name: 'Tex riff' }, SLOW);
    expect(window.location.hash).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
    expect(alphaTexText()).toBe(before);
    expect(loadLibrary().items).toHaveLength(1);
    // The sound and FX came with the text.
    fireEvent.click(screen.getByRole('button', { name: 'Notation' }));
    expect(screen.getByRole('combobox', { name: 'Sound' })).toHaveValue('27');
    expect(screen.getByRole('switch', { name: 'All effects' })).toHaveAttribute('aria-checked', 'true');
  });

  it('boxes the Sound and FX together under the shown track\'s name, cut to ten characters', async () => {
    const two = '\\title "Duo"\n\\track "Lead Guitar (solo)"\n0.6.1 |\n\\track "Rhythm"\n3.6.1 |\n';
    renderAt(`#tab=${encodeURIComponent(two)}`);
    await screen.findByRole('heading', { name: 'Duo' }, SLOW);
    const box = screen.getByRole('group', { name: 'Track: Lead Guitar (solo)' });
    expect(within(box).getByText('Lead Guit…')).toHaveAttribute('data-tip', 'Lead Guitar (solo)');
    expect(within(box).getByRole('combobox', { name: 'Sound' })).toBeInTheDocument();
    expect(within(box).getByRole('button', { name: 'FX' })).toBeInTheDocument();
    expect(within(box).getByRole('switch', { name: 'All effects' })).toBeInTheDocument();
    expect(screen.queryByText('Sound')).toBeNull();
  });

  it('names an unnamed track by its place over its Sound and FX, with no tip', async () => {
    renderAt(`#tab=${encodeURIComponent(TEX)}`);
    await screen.findByRole('heading', { name: 'Tex riff' }, SLOW);
    const box = screen.getByRole('group', { name: 'Track: Track 1' });
    expect(within(box).getByText('Track 1')).not.toHaveAttribute('data-tip');
  });

  it('keeps the FX in the track: the dialog writes its line, a run of changes is one undo step', async () => {
    renderAt(`#tab=${encodeURIComponent(TEX)}`);
    await screen.findByRole('heading', { name: 'Tex riff' }, SLOW);
    const firstLine = () => {
      fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
      const line = alphaTexText().split('\n')[0];
      fireEvent.click(screen.getByRole('button', { name: 'Notation' }));
      return line;
    };
    expect(firstLine()).toBe('\\title "Tex riff"');
    const light = () => screen.getByRole('switch', { name: 'All effects' });
    fireEvent.click(light());
    expect(light()).toHaveAttribute('aria-checked', 'true');
    expect(firstLine()).toBe('// frets:fx on; distortion on drive=0.5 tone=0.5; reverb on amount=0.3 decay=1.5');
    fireEvent.click(screen.getByRole('button', { name: 'FX' }));
    const dialog = screen.getByRole('dialog', { name: 'Effects' });
    fireEvent.click(within(dialog).getByRole('switch', { name: 'Reverb' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Longer decay' }));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(firstLine()).toBe('// frets:fx on; distortion on drive=0.5 tone=0.5; reverb off amount=0.3 decay=1.6');
    // Saved with the arrangement, not with the viewer's playback settings.
    expect(savedClip()).toMatchObject({ tracks: [{ fx: { on: true, reverbOn: false, decay: 1.6 } }] });
    expect(localStorage.getItem(PLAYBACK_KEY) ?? '').not.toContain('reverb');
    undo();
    expect(light()).toHaveAttribute('aria-checked', 'false');
    expect(firstLine()).toBe('\\title "Tex riff"');
    undo(true);
    expect(firstLine()).toContain('reverb off amount=0.3 decay=1.6');
  });

  it('says why a damaged #tabz= link could not be read', async () => {
    renderAt('#tabz=not*base64');
    await waitFor(() => expect(notice()).toHaveTextContent('The link\'s tab is cut short or damaged.'), SLOW);
    expect(window.location.hash).toBe('');
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
    const keys = (...list: (string | { key: string; shiftKey?: boolean; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; code?: string })[]) => {
      for (const k of list) fireEvent.keyDown(editor(), typeof k === 'string' ? { key: k } : k);
    };
    const alphaTex = () => {
      fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
      const text = alphaTexText();
      fireEvent.click(screen.getByRole('button', { name: 'Notation' }));
      // The editor went away with the Tab view; back on it, the keys go to the tab again, the cursor where it was.
      act(() => editor().focus());
      // One bar per line, as the writer wraps several to a line: the header lines go, then each "|" ends a bar.
      const body = text.split('\n').filter(l => l.includes('|') || !/^\\(title|ts|tuning|capo) /.test(l)).join(' ');
      return (body.match(/[^|]*\|/g) ?? []).map(b => b.trim().replace(/\s+/g, ' ')).join('\n');
    };

    it('types frets, two digits making one, and moves on with the arrows', () => {
      renderAt();
      act(() => editor().focus());
      // Typing is note input's (issue #238).
      keys('n');
      keys('ArrowDown', 'ArrowDown', '1', '2', 'ArrowRight', '1', '4', 'ArrowDown', '0');
      // → adds one rest as long as the note before, to type on; the bar stays short.
      expect(alphaTex()).toBe('12.3.4 (14.3 0.4).4 |');
      expect(screen.getByTestId('tab-cursor')).toBeInTheDocument();
    });

    it('fills a short bar with rests when Settings says to', () => {
      localStorage.setItem(EDITING_KEY, JSON.stringify({ fillBars: true }));
      renderAt();
      act(() => editor().focus());
      // Typing is note input's (issue #238).
      keys('n');
      keys('ArrowDown', 'ArrowDown', '1', '2', 'ArrowRight', '1', '4', 'ArrowDown', '0');
      // → fills the bar with a dotted half rest; 14 splits it, a quarter like the note before.
      expect(alphaTex()).toBe('12.3.4 (14.3 0.4).4 r.2 |');
    });

    it('fills the bar it leaves when Settings says to', () => {
      localStorage.setItem(EDITING_KEY, JSON.stringify({ fillBars: true }));
      renderAt();
      act(() => editor().focus());
      // Typing is note input's (issue #238).
      keys('n');
      // jsdom's window never has the focus; the blur only fills while it does.
      vi.spyOn(document, 'hasFocus').mockReturnValue(true);
      // → fills at once; Delete takes the rest away again, and leaving the tab puts it back.
      keys('5', 'ArrowRight', '7', 'ArrowRight', 'Delete');
      expect(alphaTex()).toBe('5.1.4 7.1.4 |');
      // The first Esc leaves note input, the second the tab.
      keys('Escape', 'Escape');
      expect(alphaTex()).toBe('5.1.4 7.1.4 r.2 |');
    });

    it('draws a band only behind a Shift selection, never behind the cursor alone', () => {
      renderAt();
      act(() => editor().focus());
      // Typing is note input's (issue #238).
      keys('n');
      keys('5', 'ArrowRight', '7');
      const band = () => screen.queryByTestId('tab-cursor')?.querySelector('rect[fill="var(--primary-soft)"]') ?? null;
      expect(band()).toBeNull();
      expect(screen.queryByTestId('tab-selection')).toBeNull();
      keys({ key: 'ArrowLeft', shiftKey: true });
      expect(screen.getByTestId('tab-selection')).toBeInTheDocument();
      // Starting it let the note go: no box follows the cursor through it, and none is picked after.
      expect(screen.getByTestId('tab-cursor').querySelector('rect')).toBeNull();
      keys('ArrowRight');
      expect(screen.queryByTestId('tab-selection')).toBeNull();
      expect(screen.getByTestId('column-cursor')).toBeInTheDocument();
      // Moving the cursor, any way, lets the selection go.
      keys({ key: 'ArrowLeft', shiftKey: true }, 'ArrowUp');
      expect(screen.queryByTestId('tab-selection')).toBeNull();
      keys({ key: 'ArrowRight', shiftKey: true }, 'ArrowDown');
      expect(screen.queryByTestId('tab-selection')).toBeNull();
      keys({ key: 'ArrowLeft', shiftKey: true }, 'ArrowRight');
      expect(screen.queryByTestId('tab-selection')).toBeNull();
    });

    it('marks notes and columns from the keys and from the palette', () => {
      renderAt();
      act(() => editor().focus());
      // Typing is note input's (issue #238).
      keys('n');
      // − shortens the note in normal mode; in note input it is the next note's length (issue #238).
      keys('5', 'ArrowRight', '7', 'h', 'Escape', '-', 'n');
      fireEvent.click(vibrato());
      expect(alphaTex()).toBe('5.1{h}.4 7.1{v}.8 |');
      expect(vibrato()).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Eighth note' })).toHaveAttribute('aria-pressed', 'true');
      // Off the tab, no button is lit but note input's pencil, which says the mode, not the note.
      act(() => editor().blur());
      expect(screen.getAllByRole('button', { pressed: true }).filter(b => b.closest('.tab-palette')).map(b => b.getAttribute('aria-label'))).toEqual(['Note input']);
    });

    it('acts on nothing from the palette once the cursor has left the tab, by Esc or a press elsewhere', () => {
      renderAt();
      act(() => editor().focus());
      // Typing is note input's (issue #238).
      keys('n');
      keys('5', 'ArrowRight', '7');
      const pressAll = () => {
        fireEvent.click(screen.getByRole('button', { name: 'Eighth note' }));
        fireEvent.click(vibrato());
        fireEvent.click(screen.getByRole('button', { name: 'Insert a bar of rests after this bar' }));
        fireEvent.click(screen.getByRole('button', { name: 'Bend' }));
        fireEvent.click(screen.getByRole('button', { name: 'full' }));
      };
      // The first Esc leaves note input, the second the tab.
      keys('Escape', 'Escape');
      expect(editor()).not.toHaveFocus();
      pressAll();
      expect(alphaTex()).toBe('5.1.4 7.1.4 |');
      // alphaTex() gave the keys back to the tab; a press off it takes them away again.
      act(() => editor().blur());
      pressAll();
      expect(alphaTex()).toBe('5.1.4 7.1.4 |');
      // Back on the tab, the same buttons change the cursor's note.
      fireEvent.click(screen.getByRole('button', { name: 'Eighth note' }));
      expect(alphaTex()).toBe('5.1.4 7.1.8 |');
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

    it('steps V, Shift+N, A and \\ through their kinds, and toggles L, G and S', () => {
      renderAt();
      act(() => editor().focus());
      // Typing is note input's (issue #238).
      keys('n');
      keys('5', 'v', 'v', 'N', 'N', 'a', 'a', '\\', 'l', 'g', 's');
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
      expect(screen.getByTestId('bar-warning').getAttribute('data-tip')).toBe("Bar 1 doesn't add up to 4/4: 3 beats and an 8th short.");
      // A lone triplet eighth: nor is the triplet whole.
      act(() => { fireEvent.keyDown(editor(), { key: '3', code: 'Digit3', altKey: true }); });
      const warning = screen.getByTestId('bar-warning');
      expect(warning.getAttribute('data-tip')).toBe("Bar 1 doesn't add up to 4/4: 3 beats and a quarter triplet short. The tuplet of 3 in bar 1 has 1 note; it needs 3.");
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
      fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
      expect(alphaTexText()).toContain('\\capo 3\n5.1.4{ch "Am7"} |');
      fireEvent.click(screen.getByRole('button', { name: 'Notation' }));
      // An empty field, or 0, takes the capo off; the palette acts only while the tab has the keys.
      act(() => editor().focus());
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
      // Typing is note input's (issue #238).
      keys('n');
      keys('5', 'ArrowRight', '7', 'ArrowRight', '9', { key: 'ArrowLeft', shiftKey: true });
      // One unbroken band over the two selected columns.
      expect(screen.getByTestId('tab-selection').children).toHaveLength(1);
      const data = new Map<string, string>();
      const copy = new Event('copy', { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown };
      copy.clipboardData = { setData: (type: string, text: string) => data.set(type, text) };
      act(() => { editor().dispatchEvent(copy); });
      expect(data.get('text/plain')).toBe('\\ts (4 4)\n7.1.4 9.1.4 |\n');
      keys('Backspace');
      expect(alphaTex()).toBe('5.1.4 |');
    });

    describe('normal mode and note input (issue #238)', () => {
      const pencil = () => screen.getByRole('button', { name: 'Note input' });

      it('starts in normal mode; N and the pencil go in and out of note input, Esc out', () => {
        renderAt();
        act(() => editor().focus());
        expect(pencil()).toHaveAttribute('aria-pressed', 'false');
        keys('n');
        expect(pencil()).toHaveAttribute('aria-pressed', 'true');
        expect(editor()).toHaveAccessibleName(/note input/);
        // Esc leaves note input and keeps the tab.
        keys('Escape');
        expect(pencil()).toHaveAttribute('aria-pressed', 'false');
        expect(editor()).toHaveFocus();
        fireEvent.click(pencil());
        expect(pencil()).toHaveAttribute('aria-pressed', 'true');
        keys('n');
        expect(pencil()).toHaveAttribute('aria-pressed', 'false');
      });

      it('draws the cursor outlined in note input and the selected note filled in normal mode', () => {
        renderAt();
        act(() => editor().focus());
        keys('5');
        expect(screen.getByTestId('selected-note')).toBeInTheDocument();
        keys('n');
        expect(screen.getByTestId('input-cursor')).toBeInTheDocument();
        expect(screen.queryByTestId('selected-note')).toBeNull();
      });

      it('in normal mode a digit types the selected tab note’s fret, ↑ ↓ change it by one, Ctrl/⌘+↑ ↓ move it a string', () => {
        renderAt();
        act(() => editor().focus());
        keys('5', 'ArrowUp');
        expect(alphaTex()).toBe('6.1.4 |');
        keys('ArrowDown', 'ArrowDown');
        expect(alphaTex()).toBe('4.1.4 |');
        // The open string is as low as it goes.
        keys('0', 'ArrowDown');
        expect(alphaTex()).toBe('0.1.4 |');
        keys('4', { key: 'ArrowDown', ctrlKey: true });
        expect(alphaTex()).toBe('9.2.4 |');
        keys({ key: 'ArrowUp', metaKey: true });
        expect(alphaTex()).toBe('4.1.4 |');
      });

      it('in normal mode ← → select the next column and add no rests; in note input → adds one to type on', () => {
        renderAt();
        act(() => editor().focus());
        keys('5', 'ArrowRight', 'ArrowRight');
        expect(alphaTex()).toBe('5.1.4 |');
        keys('n', 'ArrowRight', '7');
        expect(alphaTex()).toBe('5.1.4 7.1.4 |');
        // Back in normal mode, ← on a column with no note on the string selects the column.
        keys('Escape', 'ArrowDown');
        expect(alphaTex()).toBe('5.1.4 6.1.4 |');
      });

      it('Alt+↑ ↓ select the next note up or down in the chord', () => {
        renderAt();
        act(() => editor().focus());
        // A chord typed in note input: 5 on the high e, 7 on the B.
        keys('n', '5', 'ArrowDown', '7', 'Escape');
        // The B's 7 is selected; Alt+↑ selects the e's 5, which ↑ then raises.
        keys({ key: 'ArrowUp', altKey: true }, 'ArrowUp');
        expect(alphaTex()).toBe('(6.1 7.2).4 |');
        keys({ key: 'ArrowDown', altKey: true }, 'ArrowDown');
        expect(alphaTex()).toBe('(6.1 6.2).4 |');
      });

      it('Shift with a digit’s key sets the selected note’s length in normal mode, the next note’s in note input', () => {
        renderAt();
        act(() => editor().focus());
        keys('5', { key: '^', shiftKey: true, code: 'Digit6' });
        expect(alphaTex()).toBe('5.1.2 |');
        // In note input the note already there keeps its length; the next one takes the new one.
        keys('n', { key: '$', shiftKey: true, code: 'Digit4' });
        expect(alphaTex()).toBe('5.1.2 |');
        keys('ArrowRight', '7');
        expect(alphaTex()).toMatch(/^5\.1\.2 7\.1\.8 /);
      });

      it('in note input W Q, + − and the Duration buttons set the next note’s length and light it', () => {
        renderAt();
        act(() => editor().focus());
        keys('n', '5', 'ArrowRight');
        const button = (name: string) => screen.getByRole('button', { name });
        // Going in, the length is the note's there (a quarter); Q halves it.
        keys('q');
        expect(button('Eighth note')).toHaveAttribute('aria-pressed', 'true');
        expect(button('Quarter note')).toHaveAttribute('aria-pressed', 'false');
        fireEvent.click(button('Sixteenth note'));
        expect(button('Sixteenth note')).toHaveAttribute('aria-pressed', 'true');
        // The note already entered keeps its quarter.
        expect(alphaTex()).toMatch(/^5\.1\.4 /);
        keys('7', 'ArrowRight', 'w', '+', '3');
        expect(alphaTex()).toMatch(/^5\.1\.4 7\.1\.16 3\.1\.4 /);
        // . dots the next note, not the one entered.
        keys('ArrowRight', '.');
        expect(button('Dotted, then double dotted')).toHaveAttribute('aria-pressed', 'true');
        keys('2');
        expect(alphaTex()).toMatch(/^5\.1\.4 7\.1\.16 3\.1\.4 2\.1\.4\{d\} /);
      });

      it('a note of note input’s length takes its time from the rests after it', async () => {
        renderAt(`#tab=${encodeURIComponent('\\ts (4 4)\n5.1.4 r.4 r.4 r.4 |')}`);
        await waitFor(() => expect(alphaTex()).toBe('5.1.4 r.4 r.4 r.4 |'), SLOW);
        act(() => editor().focus());
        keys('n', 'ArrowRight', { key: '^', shiftKey: true, code: 'Digit6' }, '7');
        expect(alphaTex()).toBe('5.1.4 7.1.2 r.4 |');
      });

      it('N anywhere on the page goes into note input, but not in a text field', () => {
        renderAt();
        const pencil = () => screen.getByRole('button', { name: 'Note input' });
        fireEvent.keyDown(document.body, { key: 'n' });
        expect(pencil()).toHaveAttribute('aria-pressed', 'true');
        expect(editor()).toHaveFocus();
        keys('n');
        expect(pencil()).toHaveAttribute('aria-pressed', 'false');
        act(() => editor().blur());
        fireEvent.keyDown(document.body, { key: 'n' });
        fireEvent.keyDown(document.body, { key: 'n' });
        expect(pencil()).toHaveAttribute('aria-pressed', 'false');
        const field = document.createElement('input');
        document.body.append(field);
        fireEvent.keyDown(field, { key: 'n' });
        expect(pencil()).toHaveAttribute('aria-pressed', 'false');
        field.remove();
      });

      it('Shift+N steps the harmonic, as N did', () => {
        renderAt();
        act(() => editor().focus());
        keys('5', 'N');
        expect(alphaTex()).toBe('5.1{nh}.4 |');
        expect(pencil()).toHaveAttribute('aria-pressed', 'false');
      });
    });

    describe('MuseScore’s jumps and keys (issue #238)', () => {
      const THREE_BARS = '\\title "Bars"\n:2 5.1 7.1 | 8.1 9.1 | 3.2 5.2 |';
      const copied = () => {
        const data = new Map<string, string>();
        const copy = new Event('copy', { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown };
        copy.clipboardData = { setData: (type: string, text: string) => data.set(type, text) };
        act(() => { editor().dispatchEvent(copy); });
        // The bars after the header, one per line, however many the writer put on a line.
        const [, ...body] = data.get('text/plain')!.split('\n');
        return (body.join(' ').match(/[^|]*\|/g) ?? []).map(b => b.trim()).join('\n');
      };
      const open = async () => {
        renderAt(`#tab=${encodeURIComponent(THREE_BARS)}`);
        await screen.findByRole('heading', { name: 'Bars' }, SLOW);
        act(() => editor().focus());
      };

      it('Ctrl/⌘+← → move a bar at a time, Ctrl/⌘+Home / End to the clip’s ends', async () => {
        await open();
        keys({ key: 'ArrowRight', ctrlKey: true }, '1');
        expect(alphaTex().split('\n')[1]).toBe('1.1.2 9.1.2 |');
        keys({ key: 'ArrowRight', metaKey: true }, { key: 'ArrowRight', ctrlKey: true }, '2');
        expect(alphaTex().split('\n')[2]).toBe('(2.1 3.2).2 5.2.2 |');
        // Back from the start of a bar goes to the start of the bar before.
        keys({ key: 'ArrowLeft', ctrlKey: true }, '3');
        expect(alphaTex().split('\n')[1]).toBe('3.1.2 9.1.2 |');
        keys({ key: 'End', ctrlKey: true }, '4');
        expect(alphaTex().split('\n')[2]).toBe('(2.1 3.2).2 (4.1 5.2).2 |');
        keys({ key: 'Home', ctrlKey: true }, '6');
        expect(alphaTex().split('\n')[0]).toBe('6.1.2 7.1.2 |');
      });

      it('Ctrl/⌘+Shift+← → grow a selection by bars, Ctrl/⌘+Shift+Home / End to the clip’s ends', async () => {
        await open();
        keys({ key: 'ArrowRight', ctrlKey: true, shiftKey: true });
        expect(screen.getByTestId('tab-selection')).toBeInTheDocument();
        expect(copied()).toBe('5.1.2 7.1.2 |');
        keys({ key: 'ArrowRight', ctrlKey: true, shiftKey: true });
        expect(copied()).toBe('5.1.2 7.1.2 |\n8.1.2 9.1.2 |');
        keys({ key: 'ArrowLeft', ctrlKey: true, shiftKey: true });
        expect(copied()).toBe('5.1.2 7.1.2 |\n8.1.2 |');
        keys({ key: 'End', ctrlKey: true, shiftKey: true });
        expect(copied()).toBe('5.1.2 7.1.2 |\n8.1.2 9.1.2 |\n3.2.2 5.2.2 |');
        // Moving lets the selection go.
        keys({ key: 'ArrowLeft', ctrlKey: true });
        expect(screen.queryByTestId('tab-selection')).toBeNull();
      });

      it('Shift+Home / End grow a selection to the ends of the line of tab', async () => {
        await open();
        keys('ArrowRight', 'ArrowRight', { key: 'End', shiftKey: true });
        // The three short bars sit on one line, so the selection runs to the clip's last column.
        expect(copied()).toBe('8.1.2 9.1.2 |\n3.2.2 5.2.2 |');
        keys({ key: 'Home', shiftKey: true });
        expect(copied()).toBe('5.1.2 7.1.2 |\n8.1.2 |');
      });

      it('W and Q make a note longer and shorter, as + and − do', () => {
        renderAt();
        act(() => editor().focus());
        keys('5', 'q');
        expect(alphaTex()).toBe('5.1.8 |');
        keys('w', 'w');
        expect(alphaTex()).toBe('5.1.2 |');
      });

      it('Ctrl+Y redoes, as Ctrl+Shift+Z does', () => {
        renderAt();
        act(() => editor().focus());
        keys('5');
        undo();
        expect(alphaTex()).toBe('|');
        fireEvent.keyDown(document.body, { key: 'y', ctrlKey: true });
        expect(alphaTex()).toBe('5.1.4 |');
      });
    });

    it('Esc drops a selection and leaves the tab, with nothing drawn', () => {
      renderAt();
      act(() => editor().focus());
      keys('5', 'ArrowRight', '7', 'ArrowRight', '9', { key: 'ArrowLeft', shiftKey: true }, { key: 'ArrowLeft', shiftKey: true });
      keys('Escape');
      expect(screen.queryByTestId('tab-selection')).toBeNull();
      expect(screen.queryByTestId('tab-cursor')).toBeNull();
      expect(editor()).not.toHaveFocus();
    });

    it('Esc on a note leaves the tab at once, with no box left round its column', () => {
      vi.spyOn(document, 'hasFocus').mockReturnValue(true);
      renderAt();
      act(() => editor().focus());
      // Typing is note input's (issue #238).
      keys('n');
      keys('5', 'ArrowRight', '7');
      expect(screen.getByTestId('tab-cursor')).toBeInTheDocument();
      // The first Esc leaves note input, the second the tab.
      keys('Escape', 'Escape');
      expect(screen.queryByTestId('tab-cursor')).toBeNull();
      expect(screen.queryByTestId('column-cursor')).toBeNull();
      expect(editor()).not.toHaveFocus();
      // Leaving the tab leaves the short bar short (Settings' "Fill short bars with rests" is off).
      expect(alphaTex()).toBe('5.1.4 7.1.4 |');
    });

    it('Delete off the notes of a column makes it a rest, then a second Delete removes the rest', () => {
      renderAt();
      act(() => editor().focus());
      // Typing is note input's (issue #238).
      keys('n');
      keys('5', 'ArrowDown', '7', 'ArrowRight', '3', 'ArrowDown', 'ArrowDown');
      // On string 3, under a column whose notes are on strings 1 and 2.
      keys('ArrowLeft', 'Delete');
      expect(alphaTex()).toBe('r.4 3.2.4 |');
      keys('Delete');
      expect(alphaTex()).toBe('3.2.4 |');
    });

    it('sets the time signature from the palette, each change one undo step', () => {
      renderAt();
      act(() => editor().focus());
      // Typing is note input's (issue #238).
      keys('n');
      // Three quarters: the rest → filled the bar with is deleted.
      keys('5', 'ArrowRight', '5', 'ArrowRight', '5', 'ArrowRight', 'Delete');
      const drawn = () => screen.getAllByTestId('time-signature')[0].textContent;
      expect(notice()).toHaveTextContent('Bar 1 doesn\'t add up to 4/4: 1 beat short.');
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
      expect(notice()).toHaveTextContent('Bar 1 doesn\'t add up to 5/8: 1 beat over.');
      undo();
      expect(drawn()).toBe('54');
      undo();
      expect(beats).toHaveValue('4');
      // Esc closes the panel.
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('dialog', { name: 'Time signature' })).toBeNull();
    });

    it('sets the key signature on the piano keys, Major or Minor keeping its signs', () => {
      renderAt();
      act(() => editor().focus());
      keys('5');
      fireEvent.click(screen.getByRole('button', { name: 'Key signature from this bar' }));
      const panel = screen.getByRole('dialog', { name: 'Key signature' });
      expect(panel).toHaveTextContent('Key signature: C major');
      // D♯ is a key no signature writes; the tile picks E♭, as it names it.
      fireEvent.click(within(panel).getByRole('radio', { name: 'E♭' }));
      expect(panel).toHaveTextContent('Key signature: E♭ major');
      fireEvent.click(within(panel).getByRole('button', { name: 'Minor' }));
      expect(panel).toHaveTextContent('Key signature: C minor');
      expect(alphaTex()).toBe('\\ks Cminor 5.1.4 |');
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
      expect(notice()).toHaveTextContent('Bar 1 doesn\'t add up to 4/4: 3 beats short.');
    });
  });
});

describe('TabPage playback', () => {
  const footer = () => screen.queryByRole('group', { name: 'Playback' });
  const toggle = () => screen.getByRole('button', { name: 'Playback controls' });

  it('shows the playback footer at first, hides it on the small button under the tab, and remembers the choice', () => {
    renderAt();
    expect(footer()).not.toBeNull();
    expect(toggle()).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(toggle());
    expect(footer()).toBeNull();
    expect(toggle()).toHaveAttribute('aria-pressed', 'false');
    expect(JSON.parse(localStorage.getItem(PLAYBACK_KEY)!)).toMatchObject({ shown: false, volume: 1 });
    cleanup();
    renderAt();
    expect(footer()).toBeNull();
    fireEvent.click(toggle());
    expect(footer()).not.toBeNull();
    expect(JSON.parse(localStorage.getItem(PLAYBACK_KEY)!)).toMatchObject({ shown: true, volume: 1 });
  });

  it('shows neither the toggle nor the controls in the text views', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'ASCII Tab' }));
    expect(screen.queryByRole('button', { name: 'Playback controls' })).toBeNull();
    expect(footer()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Notation' }));
    expect(footer()).not.toBeNull();
  });

  it('picks the sound at the end of the controls, as the clip\'s \\instrument, one undo step', async () => {
    renderAt(`#tab=${encodeURIComponent(TEX)}`);
    await screen.findByRole('heading', { name: 'Tex riff' }, SLOW);
    const sound = () => screen.getByRole('combobox', { name: 'Sound' });
    expect(sound()).toHaveValue('25');
    fireEvent.change(sound(), { target: { value: '0' } });
    expect(partOf(savedClip() as unknown as Clip)).toMatchObject({ instrument: { program: 0, tag: '\\instrument acousticgrandpiano' } });
    expect(localStorage.getItem(PLAYBACK_KEY) ?? '').not.toContain('sound');
    fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
    // A piano brings no strings of its own, so the tuning is written too.
    expect(alphaTexText()).toContain('\\instrument acousticgrandpiano\n\\ts (4 4)\n\\tuning (E4 B3 G3 D3 A2 E2)\n');
    fireEvent.click(screen.getByRole('button', { name: 'Notation' }));
    undo();
    expect(sound()).toHaveValue('25');
    cleanup();
    renderAt();
    await waitFor(() => expect(sound()).toHaveValue('25'));
  });

  it('plays an instrument Frets doesn\'t have as the nearest sound, says so, and keeps it as written', async () => {
    renderAt(`#tab=${encodeURIComponent(`\\instrument distortionguitar\n${TEX}`)}`);
    await screen.findByRole('heading', { name: 'Tex riff' }, SLOW);
    expect(screen.getByRole('combobox', { name: 'Sound' })).toHaveValue('27');
    expect(screen.getByRole('img', { name: 'This arrangement asks for Distortion Guitar; Frets plays Clean Electric Guitar.' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
    expect(alphaTexText()).toContain('\\instrument distortionguitar\n');
    fireEvent.click(screen.getByRole('button', { name: 'Notation' }));
    // Picking a sound replaces it, and the ⚠ goes.
    fireEvent.change(screen.getByRole('combobox', { name: 'Sound' }), { target: { value: '25' } });
    expect(screen.queryByRole('img', { name: /asks for/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
    expect(alphaTexText()).toContain('\\instrument acousticguitarsteel\n');
  });

  it('turns the volume knob with the arrow keys, and remembers it', () => {
    renderAt();
    const knob = screen.getByRole('slider', { name: 'Volume' });
    expect(knob).toHaveAttribute('aria-valuenow', '100');
    fireEvent.keyDown(knob, { key: 'ArrowDown' });
    fireEvent.keyDown(knob, { key: 'ArrowDown' });
    expect(knob).toHaveAttribute('aria-valuenow', '90');
    fireEvent.keyDown(knob, { key: 'Home' });
    expect(knob).toHaveAttribute('aria-valuenow', '0');
    fireEvent.keyDown(knob, { key: 'ArrowUp' });
    expect(JSON.parse(localStorage.getItem(PLAYBACK_KEY)!).volume).toBe(0.05);
  });

  it('opens the playback options on a right-click on Play, and remembers them', () => {
    renderAt();
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Play' }), { clientX: 40, clientY: 40 });
    const stop = screen.getByRole('menuitemcheckbox', { name: 'Stop leaves the cursor where it stopped' });
    const pause = screen.getByRole('menuitemcheckbox', { name: 'Pause between loops' });
    const regionEnd = screen.getByRole('menuitemcheckbox', { name: 'Stop playback at region end' });
    expect(stop).toHaveAttribute('aria-checked', 'false');
    expect(regionEnd).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(stop);
    fireEvent.click(regionEnd);
    expect(regionEnd).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(pause);
    // The menu stays open while its options change.
    expect(stop).toHaveAttribute('aria-checked', 'true');
    expect(pause).toHaveAttribute('aria-checked', 'true');
    const seconds = screen.getByRole('spinbutton', { name: 'Pause between loops (seconds)' });
    expect(seconds).toHaveValue('1.0');
    fireEvent.click(screen.getByRole('button', { name: 'Longer pause' }));
    expect(seconds).toHaveValue('1.5');
    fireEvent.change(seconds, { target: { value: '2.25' } });
    fireEvent.keyDown(seconds, { key: 'Enter' });
    expect(seconds).toHaveValue('2.3');
    expect(JSON.parse(localStorage.getItem(PLAYBACK_KEY)!)).toMatchObject({ stopAtPlayhead: true, stopAtRegionEnd: true, loopPause: true, loopPauseSeconds: 2.3 });
    expect(within(screen.getByRole('menu', { name: 'Playback options' })).queryByRole('spinbutton', { name: 'Transpose (semitones)' })).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu', { name: 'Playback options' })).toBeNull();
  });

  it('transposes playback from the field after Speed, and a double-click puts it back to 0', () => {
    renderAt();
    const transpose = screen.getByRole('spinbutton', { name: 'Transpose (semitones)' });
    expect(transpose).toHaveValue('0');
    fireEvent.click(screen.getByRole('button', { name: 'Transpose up' }));
    expect(transpose).toHaveValue('+1');
    fireEvent.change(transpose, { target: { value: '-5' } });
    fireEvent.keyDown(transpose, { key: 'Enter' });
    expect(transpose).toHaveValue('-5');
    fireEvent.change(transpose, { target: { value: '-40' } });
    fireEvent.keyDown(transpose, { key: 'Enter' });
    expect(transpose).toHaveValue('-12');
    expect(JSON.parse(localStorage.getItem(PLAYBACK_KEY)!)).toMatchObject({ transpose: -12 });
    fireEvent.doubleClick(screen.getByText('Transpose'));
    expect(transpose).toHaveValue('0');
  });

  it('sets the speed with its buttons, the arrow keys and a typed number, kept within 25 to 150%', () => {
    renderAt();
    const field = screen.getByRole('spinbutton', { name: 'Speed (percent)' });
    expect(field).toHaveValue('100');
    fireEvent.click(screen.getByRole('button', { name: 'Faster' }));
    expect(field).toHaveValue('105');
    fireEvent.click(screen.getByRole('button', { name: 'Slower' }));
    fireEvent.keyDown(field, { key: 'ArrowDown' });
    expect(field).toHaveValue('95');
    fireEvent.change(field, { target: { value: '80' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(field).toHaveValue('80');
    fireEvent.change(field, { target: { value: '10' } });
    fireEvent.blur(field);
    expect(field).toHaveValue('25');
    fireEvent.change(field, { target: { value: '999' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(field).toHaveValue('150');
    fireEvent.change(field, { target: { value: '70' } });
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(field).toHaveValue('150');
  });

  it('turns "Hear notes as you enter them" on and off, and remembers it', () => {
    renderAt();
    const ear = screen.getByRole('button', { name: 'Hear notes as you enter them' });
    expect(ear).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(ear);
    expect(ear).toHaveAttribute('aria-pressed', 'true');
    expect(JSON.parse(localStorage.getItem(PLAYBACK_KEY)!)).toMatchObject({ hearNotes: true });
    fireEvent.click(ear);
    expect(JSON.parse(localStorage.getItem(PLAYBACK_KEY)!)).toMatchObject({ hearNotes: false });
  });

  it('resets the speed to 100% on a double-click on its label, number or bpm, not its step buttons', () => {
    renderAt();
    const field = screen.getByRole('spinbutton', { name: 'Speed (percent)' });
    const faster = screen.getByRole('button', { name: 'Faster' });
    fireEvent.click(faster);
    fireEvent.click(faster);
    fireEvent.doubleClick(faster);
    expect(field).toHaveValue('110');
    fireEvent.doubleClick(screen.getByText('Speed'));
    expect(field).toHaveValue('100');
    fireEvent.click(faster);
    fireEvent.doubleClick(screen.getByText(/bpm$/));
    expect(field).toHaveValue('100');
    fireEvent.click(faster);
    act(() => field.focus());
    fireEvent.change(field, { target: { value: '60' } });
    fireEvent.doubleClick(field);
    expect(field).toHaveValue('100');
  });

  it('puts the line between columns at a press just above or below the drawing, with the controls hidden', () => {
    renderAt();
    const editor = screen.getByRole('textbox', { name: /Tab editor/ });
    act(() => editor.focus());
    for (const key of ['5', 'ArrowRight', '7']) fireEvent.keyDown(editor, { key });
    act(() => editor.blur());
    expect(screen.queryByTestId('tab-cursor')).toBeNull();
    // jsdom puts the drawing at 0, 0: 10 px above it, over the first bar.
    fireEvent.pointerDown(screen.getByTestId('column-reach'), { clientX: 80, clientY: -10 });
    // The line between columns, as with the playback controls showing; no column is highlighted.
    expect(screen.getByTestId('play-mark')).toBeInTheDocument();
    expect(screen.queryByTestId('tab-cursor')).toBeNull();
    // → moves it, Esc drops it.
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(screen.getByTestId('play-mark')).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByTestId('play-mark')).toBeNull();
  });

  it('lets the tab cursor go when the line is placed, filling its bar', () => {
    renderAt();
    const editor = screen.getByRole('textbox', { name: /Tab editor/ });
    act(() => editor.focus());
    for (const key of ['5', 'ArrowRight', '7']) fireEvent.keyDown(editor, { key });
    expect(screen.getByTestId('tab-cursor')).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByTestId('column-reach'), { clientX: 80, clientY: -10 });
    expect(screen.queryByTestId('tab-cursor')).toBeNull();
    expect(screen.getByTestId('play-mark')).toBeInTheDocument();
    expect(editor).not.toHaveFocus();
    // The keys now move the line, and Esc drops it.
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(screen.getByTestId('play-mark')).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByTestId('play-mark')).toBeNull();
  });

  it('takes the rest just before the line on Delete or Backspace, off the tab', () => {
    localStorage.setItem(EDITING_KEY, JSON.stringify({ fillBars: true }));
    renderAt();
    const editor = screen.getByRole('textbox', { name: /Tab editor/ });
    act(() => editor.focus());
    // Typed in note input (issue #238).
    for (const key of ['n', '5', 'ArrowRight', '7']) fireEvent.keyDown(editor, { key });
    // Placing the line fills the bar with a rest after the 5 and the 7.
    fireEvent.pointerDown(screen.getByTestId('column-reach'), { clientX: 80, clientY: -10 });
    const firstBar = () => partOf(savedClip() as unknown as Clip).bars[0].columns.map(c => (c.notes.some(Boolean) ? 'note' : 'rest'));
    expect(firstBar()).toEqual(['note', 'note', 'rest']);
    // The line to the bar's end: Delete takes the rest, then Backspace turns the 7 into a rest.
    for (let i = 0; i < 3; i++) fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    fireEvent.keyDown(document.body, { key: 'Delete' });
    expect(firstBar()).toEqual(['note', 'note']);
    expect(screen.getByTestId('play-mark')).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: 'Backspace' });
    expect(firstBar()).toEqual(['note', 'rest']);
    expect(screen.getByTestId('play-mark')).toBeInTheDocument();
    // Each is one undo step.
    undo();
    expect(firstBar()).toEqual(['note', 'note']);
  });

  it('sets loop points from the selection, round the whole clip with none, and clears them', () => {
    renderAt();
    expect(screen.queryByRole('slider', { name: 'Position' })).toBeNull();
    const loop = () => screen.getByRole('button', { name: 'Loop' });
    const editor = screen.getByRole('textbox', { name: /Tab editor/ });
    act(() => editor.focus());
    // Typed in note input (issue #238).
    for (const key of ['n', '5', 'ArrowRight', '7', 'ArrowRight', '9']) fireEvent.keyDown(editor, { key });
    // No selection: the whole clip; pressed again, cleared.
    fireEvent.click(loop());
    expect(loop()).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(loop());
    expect(loop()).toHaveAttribute('aria-pressed', 'false');
    // A selection: its notes; the same selection again clears them, another moves them.
    fireEvent.keyDown(editor, { key: 'ArrowLeft', shiftKey: true });
    fireEvent.click(loop());
    expect(loop()).toHaveAttribute('aria-pressed', 'true');
    expect(loop()).toHaveAttribute('data-tip', 'Clear the loop points');
    fireEvent.click(loop());
    expect(loop()).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(loop());
    fireEvent.keyDown(editor, { key: 'ArrowLeft', shiftKey: true });
    expect(loop()).toHaveAttribute('data-tip', 'Loop the selected notes');
    fireEvent.click(loop());
    expect(loop()).toHaveAttribute('aria-pressed', 'true');
  });

  it('plays on Space anywhere on the page while the footer shows, but not in a field', () => {
    renderAt(`#tab=${encodeURIComponent(OTHER)}`);
    act(() => screen.getByRole('spinbutton', { name: 'Speed (percent)' }).focus());
    fireEvent.keyDown(screen.getByRole('spinbutton', { name: 'Speed (percent)' }), { key: ' ' });
    expect(screen.queryByRole('button', { name: /Loading the sound|Stop/ })).toBeNull();
    act(() => (document.activeElement as HTMLElement).blur());
    fireEvent.keyDown(document.body, { key: ' ' });
    expect(screen.getByRole('button', { name: /Loading the sound|Stop/ })).toBeInTheDocument();
  });

  it('lets go of the focus after a sound is picked, after Enter in a field, and on a press on the tab', () => {
    renderAt(`#tab=${encodeURIComponent(OTHER)}`);
    const sound = screen.getByRole('combobox', { name: 'Sound' });
    fireEvent.pointerDown(sound);
    act(() => sound.focus());
    fireEvent.change(sound, { target: { value: '0' } });
    expect(sound).not.toHaveFocus();

    const speed = screen.getByRole('spinbutton', { name: 'Speed (percent)' });
    act(() => speed.focus());
    fireEvent.change(speed, { target: { value: '80' } });
    fireEvent.keyDown(speed, { key: 'Enter' });
    expect(speed).not.toHaveFocus();
    expect(speed).toHaveValue('80');

    // The tab keeps a press above the staff from taking the focus; the list still lets go of it.
    act(() => sound.focus());
    fireEvent.pointerDown(screen.getByRole('textbox', { name: /Tab editor/ }));
    expect(sound).not.toHaveFocus();
    fireEvent.keyDown(document.body, { key: ' ' });
    expect(screen.getByRole('button', { name: /Loading the sound|Stop/ })).toBeInTheDocument();
  });

  it("doesn't play on Space while the footer is hidden", () => {
    renderAt(`#tab=${encodeURIComponent(OTHER)}`);
    fireEvent.click(toggle());
    const editor = screen.getByRole('textbox', { name: /Tab editor/ });
    act(() => editor.focus());
    fireEvent.keyDown(editor, { key: ' ' });
    // Nothing plays, so no spinner and no Stop.
    expect(screen.queryByRole('button', { name: /Loading the sound|Stop/ })).toBeNull();
  });
});

describe('TabPage examples', () => {
  const saved = () => savedClip().name;
  const editor = () => screen.getByRole('textbox', { name: /Tab editor/ });

  it('shows an example in place of the clip, never saves its edits, and goes back to the clip', async () => {
    renderAt(`#tab=${encodeURIComponent(TEX)}`);
    await screen.findByRole('heading', { name: 'Tex riff' }, SLOW);
    fireEvent.click(screen.getByRole('button', { name: 'Arrangements…' }));
    const dialog = screen.getByRole('dialog', { name: 'Arrangements' });
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Articulations' }));
    doubleClick(within(dialog).getByRole('button', { name: 'Bends and vibrato' }));
    await screen.findByRole('heading', { name: 'Bends and vibrato' }, SLOW);
    expect(screen.getByTestId('example-note')).toHaveTextContent("Example: edits aren't saved");
    expect(window.location.hash).toBe('#example=bends');
    // An edit changes the example on the page, not the saved clip.
    act(() => editor().focus());
    fireEvent.keyDown(editor(), { key: '9' });
    await settle();
    expect(saved()).toBe('Tex riff');
    fireEvent.click(screen.getByRole('button', { name: 'Back to my clip' }));
    expect(heading()).toHaveTextContent('Tex riff');
    expect(screen.queryByTestId('example-note')).toBeNull();
    expect(window.location.hash).toBe('');
    // The clip's own history is back: the 9 typed into the example is not in it.
    undo();
    expect(heading()).toHaveTextContent('Tex riff');
    expect(saved()).toBe('Tex riff');
  });

  it('lists the built-ins at once and opens one without fetching again, closing the dialog at the press', async () => {
    renderAt();
    const fetched = vi.mocked(fetch);
    // Read when the page opens, so the first opening already lists them.
    await waitFor(() => expect(fetched).toHaveBeenCalledWith(BUILTIN_URL, expect.anything()));
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Arrangements…' }));
    const dialog = screen.getByRole('dialog', { name: 'Arrangements' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Samples' }));
    await settle();
    const calls = fetched.mock.calls.length;
    doubleClick(within(dialog).getByRole('button', { name: 'Oceanic Speedy Down Run' }));
    expect(screen.queryByRole('dialog', { name: 'Arrangements' })).toBeNull();
    await screen.findByRole('heading', { name: 'Oceanic Speedy Down Run' }, SLOW);
    // The text came with the dialog's list: nothing more was fetched, and closing it read nothing again.
    expect(fetched.mock.calls.length).toBe(calls);
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
    expect(screen.queryByTestId('example-note')).toBeNull();
    expect(window.location.hash).toBe('');
    await waitFor(() => expect(saved()).toBe('Tex riff'));
  });
});

describe('TabPage arrangements', () => {
  const editor = () => screen.getByRole('textbox', { name: /Tab editor/ });
  const openDialog = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Arrangements…' }));
    return screen.getByRole('dialog', { name: 'Arrangements' });
  };
  const mine = (dialog: HTMLElement) => within(within(dialog).getByRole('list', { name: 'My arrangements' }));
  const names = (dialog: HTMLElement) => mine(dialog).getAllByRole('button', { name: /^(?!Rename|Delete)/ }).map(b => b.firstChild?.textContent);
  /** A drag's data, as the browser carries it. */
  const dataTransfer = (data: Record<string, string>) => ({
    get types() { return Object.keys(data); },
    getData: (type: string) => data[type] ?? '', setData: (type: string, value: string) => { data[type] = value; },
    effectAllowed: 'all', dropEffect: 'none',
  });
  /** Drags `from` (an arrangement's line) and drops it on `to`. */
  const drag = (from: Element, to: Element) => {
    const carried = dataTransfer({});
    fireEvent.dragStart(from, { dataTransfer: carried });
    fireEvent.dragOver(to, { dataTransfer: carried });
    fireEvent.drop(to, { dataTransfer: carried });
    fireEvent.dragEnd(from, { dataTransfer: carried });
  };
  const importTab = async (text: string, title: string) => {
    fireEvent.click(screen.getByRole('button', { name: 'Import…' }));
    fireEvent.change(screen.getByRole('textbox', { name: /Tab, as alphaTex or ASCII/ }), { target: { value: text } });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    await screen.findByRole('heading', { name: title }, SLOW);
  };

  it('saves the open arrangement as it is edited, and opens it again on the next visit', async () => {
    keepOpen((readAscii(RIFF) as { clip: unknown }).clip);
    renderAt();
    act(() => editor().focus());
    fireEvent.keyDown(editor(), { key: '9' });
    const columns = screen.getAllByTestId('tab-column').length;
    await settle();
    cleanup();
    renderAt();
    expect(heading()).toHaveTextContent('Riff');
    expect(screen.getAllByTestId('tab-column')).toHaveLength(columns);
    expect(loadLibrary().items.map(i => i.name)).toEqual(['Riff']);
  });

  it('lists nothing for a new, empty clip, and lists it once something is in it', async () => {
    renderAt();
    expect(within(openDialog()).getByText(/Nothing kept yet/)).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await paste(RIFF);
    await settle();
    expect(names(openDialog())).toEqual(['Riff']);
  });

  it('opens an import as a new arrangement, keeping the open one in the list', async () => {
    keepOpen((readAscii(RIFF) as { clip: unknown }).clip);
    renderAt();
    await importTab(TEX, 'Tex riff');
    const dialog = openDialog();
    expect(names(dialog)).toEqual(['Riff', 'Tex riff']);
    expect(mine(dialog).getByRole('button', { name: /^Tex riff/ })).toHaveAttribute('aria-current', 'true');
    doubleClick(mine(dialog).getByRole('button', { name: /^Riff/ }));
    expect(heading()).toHaveTextContent('Riff');
    expect(dialog).not.toHaveAttribute('open');
    // Opening one is no change: the list keeps its order.
    expect(loadLibrary().items.map(i => i.name)).toEqual(['Tex riff', 'Riff']);
    expect(loadLibrary().open).toBe('kept');
  });

  it('starts a new arrangement and copies the open one', async () => {
    keepOpen((readAscii(RIFF) as { clip: unknown }).clip);
    renderAt();
    fireEvent.click(within(openDialog()).getByRole('button', { name: 'Duplicate' }));
    await settle();
    expect(heading()).toHaveTextContent('Riff');
    expect(loadLibrary().items).toHaveLength(2);
    fireEvent.click(within(openDialog()).getByRole('button', { name: 'New arrangement' }));
    expect(heading()).toHaveTextContent('Untitled clip');
    expect(notice()).toHaveTextContent(/Click the tab and type frets/);
    // A new one has nothing to duplicate yet.
    expect(within(openDialog()).queryByRole('button', { name: 'Duplicate' })).toBeNull();
  });

  it('renames from the list: the open one as an undo step, another in place', async () => {
    keepOpen((readAscii(RIFF) as { clip: unknown }).clip);
    renderAt();
    await importTab(TEX, 'Tex riff');
    let dialog = openDialog();
    fireEvent.click(mine(dialog).getByRole('button', { name: 'Rename Tex riff' }));
    const field = within(dialog).getByRole('textbox', { name: 'Arrangement name' });
    fireEvent.change(field, { target: { value: 'Lick' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(heading()).toHaveTextContent('Lick');
    fireEvent.click(mine(dialog).getByRole('button', { name: 'Rename Riff' }));
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Arrangement name' }), { target: { value: 'Old riff' } });
    // Esc gives up the rename and leaves the dialog open.
    fireEvent.keyDown(within(dialog).getByRole('textbox', { name: 'Arrangement name' }), { key: 'Escape' });
    expect(mine(dialog).getByRole('button', { name: /^Riff/ })).toBeInTheDocument();
    fireEvent.click(mine(dialog).getByRole('button', { name: 'Rename Riff' }));
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Arrangement name' }), { target: { value: 'Old riff' } });
    fireEvent.blur(within(dialog).getByRole('textbox', { name: 'Arrangement name' }));
    await settle();
    dialog = screen.getByRole('dialog');
    expect(names(dialog).sort()).toEqual(['Lick', 'Old riff']);
    expect(heading()).toHaveTextContent('Lick');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    undo();
    expect(heading()).toHaveTextContent('Tex riff');
  });

  it('deletes with an undo; deleting the open one opens the next', async () => {
    keepOpen((readAscii(RIFF) as { clip: unknown }).clip);
    renderAt();
    await importTab(TEX, 'Tex riff');
    const dialog = openDialog();
    fireEvent.click(mine(dialog).getByRole('button', { name: 'Delete Riff' }));
    expect(names(dialog)).toEqual(['Tex riff']);
    expect(localStorage.getItem(arrangementKey('kept'))).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Undo' }));
    expect(names(dialog)).toEqual(['Riff', 'Tex riff']);
    fireEvent.click(mine(dialog).getByRole('button', { name: 'Delete Tex riff' }));
    await settle();
    expect(heading()).toHaveTextContent('Riff');
    expect(dialog).toHaveAttribute('open');
    fireEvent.click(mine(dialog).getByRole('button', { name: 'Delete Riff' }));
    await settle();
    expect(heading()).toHaveTextContent('Untitled clip');
    expect(loadLibrary().items).toEqual([]);
  });

  it('says when each kept arrangement last changed, so two of one name can be told apart', async () => {
    const riff = (readAscii(RIFF) as { clip: { name: string } }).clip;
    localStorage.setItem(arrangementKey('old'), JSON.stringify(riff));
    localStorage.setItem(arrangementKey('new'), JSON.stringify(riff));
    const today = new Date();
    today.setHours(9, 5);
    localStorage.setItem(LIBRARY_KEY, JSON.stringify({ open: 'new', folders: [], items: [
      { id: 'new', name: 'Riff', changed: today.getTime() },
      { id: 'old', name: 'Riff', changed: new Date(2025, 2, 14, 18, 30).getTime() },
    ] }));
    renderAt();
    const dialog = openDialog();
    expect(mine(dialog).getAllByTestId('changed').map(c => c.textContent)).toEqual([
      today.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
      `${new Date(2025, 2, 14).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}, ${new Date(2025, 2, 14, 18, 30).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`,
    ]);
    // The built-in ones say nothing of the kind.
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Rhythm' }));
    expect(within(within(dialog).getByRole('list', { name: 'Rhythm' })).queryAllByTestId('changed')).toEqual([]);
  });

  it('keeps arrangements in folders, one level deep, and deletes a folder with what is in it', async () => {
    keepOpen((readAscii(RIFF) as { clip: unknown }).clip);
    renderAt();
    await importTab(TEX, 'Tex riff');
    const dialog = openDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'New folder' }));
    const field = within(dialog).getByRole('textbox', { name: 'Folder name' });
    expect(field).toHaveValue('New folder');
    fireEvent.change(field, { target: { value: 'Riffs' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    const folder = mine(dialog).getByRole('button', { name: 'Riffs' });
    expect(folder).toHaveAttribute('aria-expanded', 'true');
    expect(within(within(dialog).getByRole('list', { name: 'Riffs' })).getByText('Empty')).toBeInTheDocument();
    // Dragged onto the folder's line, Riff goes in.
    const row = (name: RegExp) => mine(dialog).getByRole('button', { name }).closest('li')!;
    drag(row(/^Riff /), folder);
    const inFolder = within(within(dialog).getByRole('list', { name: 'Riffs' }));
    expect(inFolder.getByRole('button', { name: /^Riff / })).toBeInTheDocument();
    expect(loadLibrary().items.find(i => i.name === 'Riff')?.folder).toBe(loadLibrary().folders[0].id);
    // Dragged onto the list outside any folder, it comes back out to the top level.
    drag(row(/^Riff /), within(dialog).getByRole('list', { name: 'My arrangements' }));
    expect(loadLibrary().items.find(i => i.name === 'Riff')?.folder).toBeUndefined();
    // A drag that carries no arrangement (text from elsewhere) lights no folder.
    fireEvent.dragOver(folder, { dataTransfer: dataTransfer({ 'text/plain': 'e|-5-|' }) });
    expect(folder.closest('li')).not.toHaveClass('tab-drop');
    fireEvent.dragOver(folder, { dataTransfer: dataTransfer({ [DRAG_TYPE]: 'x' }) });
    expect(folder.closest('li')).toHaveClass('tab-drop');
    fireEvent.dragLeave(folder.closest('li')!, { relatedTarget: document.body });
    expect(folder.closest('li')).not.toHaveClass('tab-drop');
    // A folder closes and opens with a press.
    fireEvent.click(folder);
    expect(within(dialog).queryByRole('list', { name: 'Riffs' })).toBeNull();
    fireEvent.click(folder);
    // Moving the open one in, then deleting the folder, opens the other.
    drag(row(/^Tex riff /), folder);
    drag(row(/^Riff /), folder);
    fireEvent.click(mine(dialog).getByRole('button', { name: 'Delete Riffs' }));
    await settle();
    expect(loadLibrary().folders).toEqual([]);
    expect(loadLibrary().items).toEqual([]);
    expect(heading()).toHaveTextContent('Untitled clip');
    expect(within(dialog).getByRole('status')).toHaveTextContent('Deleted the folder Riffs.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Undo' }));
    expect(loadLibrary().folders.map(f => f.name)).toEqual(['Riffs']);
    expect(loadLibrary().items.map(i => i.name).sort()).toEqual(['Riff', 'Tex riff']);
    expect(within(within(dialog).getByRole('list', { name: 'Riffs' })).getAllByRole('button', { name: /^(Riff|Tex riff) / })).toHaveLength(2);
  });

  it('lists the built-in arrangements in their folders, the samples among them, one line each by name', async () => {
    renderAt();
    const dialog = openDialog();
    const builtIn = within(await within(dialog).findByRole('list', { name: 'Built-in' }));
    const folders = builtIn.getAllByRole('button', { expanded: false }).map(b => b.textContent);
    expect(folders).toEqual(expect.arrayContaining(['Articulations', 'Rhythm', 'Samples', 'Song structure']));
    fireEvent.click(builtIn.getByRole('button', { name: 'Samples' }));
    doubleClick(within(builtIn.getByRole('list', { name: 'Samples' })).getByRole('button', { name: 'Oceanic Speedy Down Run' }));
    await screen.findByRole('heading', { name: 'Oceanic Speedy Down Run' }, SLOW);
    expect(window.location.hash).toBe('#example=oceanic-speedy-down-run');
    // Opened again, the dialog shows the folder of what is shown.
    const again = openDialog();
    expect(within(within(again).getByRole('list', { name: 'Built-in' })).getByRole('button', { name: 'Oceanic Speedy Down Run' })).toHaveAttribute('aria-current', 'true');
  });

  it('keeps a copy of an example, with its edits, as a new arrangement', async () => {
    renderAt('#example=drop-d');
    await screen.findByRole('heading', { name: 'Drop D' }, SLOW);
    fireEvent.click(screen.getByRole('button', { name: 'Keep a copy' }));
    await settle();
    expect(screen.queryByTestId('example-note')).toBeNull();
    expect(window.location.hash).toBe('');
    expect(loadLibrary().items.map(i => i.name)).toEqual(['Drop D']);
    expect(savedClip().name).toBe('Drop D');
  });

  /** Kept arrangements named `names` (ids a, b, c…), the first open, in `folder` where given. */
  const keepMany = (names: string[], folders: { id: string; name: string; holds: string[] }[] = []) => {
    const riff = (readAscii(RIFF) as { clip: { name: string } }).clip;
    const ids = names.map((_, i) => String.fromCharCode(97 + i));
    names.forEach((name, i) => localStorage.setItem(arrangementKey(ids[i]), JSON.stringify({ ...riff, name })));
    const folderOf = (name: string) => folders.find(f => f.holds.includes(name))?.id;
    localStorage.setItem(LIBRARY_KEY, JSON.stringify({
      open: ids[0], folders: folders.map(({ id, name }) => ({ id, name })),
      items: names.map((name, i) => ({ id: ids[i], name, changed: 100 - i, ...(folderOf(name) ? { folder: folderOf(name) } : {}) })),
    }));
  };
  const line = (dialog: HTMLElement, name: string) => mine(dialog).getByRole('button', { name: new RegExp(`^${name} `) });
  const pickedNames = (dialog: HTMLElement) =>
    mine(dialog).queryAllByRole('button', { pressed: true }).map(b => b.firstChild?.textContent);

  it('picks a line with a click and opens it only with a double click, a double tap or the keyboard', async () => {
    keepMany(['One', 'Two']);
    renderAt();
    let dialog = openDialog();
    // A click picks Two and leaves One open.
    fireEvent.click(line(dialog, 'Two'), { detail: 1 });
    expect(dialog).toHaveAttribute('open');
    expect(heading()).toHaveTextContent('One');
    expect(pickedNames(dialog)).toEqual(['Two']);
    expect(line(dialog, 'One')).toHaveAttribute('aria-current', 'true');
    // A click on another picks it instead: no double click across two lines.
    fireEvent.click(line(dialog, 'One'), { detail: 1 });
    expect(pickedNames(dialog)).toEqual(['One']);
    expect(dialog).toHaveAttribute('open');
    // A double click opens.
    doubleClick(line(dialog, 'Two'));
    expect(heading()).toHaveTextContent('Two');
    expect(dialog).not.toHaveAttribute('open');
    // Two taps the browser counts as one each, close together, open too.
    dialog = openDialog();
    expect(pickedNames(dialog)).toEqual([]);
    fireEvent.click(line(dialog, 'One'), { detail: 1 });
    fireEvent.click(line(dialog, 'One'), { detail: 1 });
    expect(heading()).toHaveTextContent('One');
    // Enter or Space on a line (a click with no count) opens it.
    dialog = openDialog();
    fireEvent.click(line(dialog, 'Two'), { detail: 0 });
    expect(heading()).toHaveTextContent('Two');
  });

  it('does not open on two taps far apart', () => {
    keepMany(['One', 'Two']);
    renderAt();
    const dialog = openDialog();
    const stamp = vi.spyOn(Event.prototype, 'timeStamp', 'get').mockReturnValue(1000);
    fireEvent.click(line(dialog, 'Two'), { detail: 1 });
    stamp.mockReturnValue(1000 + DOUBLE_TAP_MS);
    fireEvent.click(line(dialog, 'Two'), { detail: 1 });
    stamp.mockRestore();
    expect(heading()).toHaveTextContent('One');
    expect(dialog).toHaveAttribute('open');
  });

  it('picks a range with Shift and one more with Cmd or Ctrl, and deletes them all with one Undo', async () => {
    keepMany(['A1', 'A2', 'A3', 'A4', 'A5']);
    renderAt();
    const dialog = openDialog();
    fireEvent.click(line(dialog, 'A2'), { detail: 1 });
    fireEvent.click(line(dialog, 'A4'), { detail: 1, shiftKey: true });
    expect(pickedNames(dialog)).toEqual(['A2', 'A3', 'A4']);
    // Shift again ranges from the same start, upward too.
    fireEvent.click(line(dialog, 'A1'), { detail: 1, shiftKey: true });
    expect(pickedNames(dialog)).toEqual(['A1', 'A2']);
    // Cmd adds one, and takes it away again; Ctrl does the same.
    fireEvent.click(line(dialog, 'A5'), { detail: 1, metaKey: true });
    expect(pickedNames(dialog)).toEqual(['A1', 'A2', 'A5']);
    fireEvent.click(line(dialog, 'A5'), { detail: 2, metaKey: true });
    expect(pickedNames(dialog)).toEqual(['A1', 'A2']);
    expect(dialog).toHaveAttribute('open');
    fireEvent.click(line(dialog, 'A4'), { detail: 1, ctrlKey: true });
    expect(pickedNames(dialog)).toEqual(['A1', 'A2', 'A4']);
    // A picked line's Delete (each picked line has one) deletes every picked one, the open one among them.
    const deletes = mine(dialog).getAllByRole('button', { name: 'Delete 3 arrangements' });
    expect(deletes).toHaveLength(3);
    fireEvent.click(deletes[1]);
    await settle();
    expect(names(dialog)).toEqual(['A3', 'A5']);
    expect(pickedNames(dialog)).toEqual([]);
    expect(heading()).toHaveTextContent('A3');
    expect(dialog).toHaveAttribute('open');
    expect(within(dialog).getByRole('status')).toHaveTextContent('Deleted 3 arrangements.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Undo' }));
    expect(names(dialog)).toEqual(['A1', 'A2', 'A3', 'A4', 'A5']);
    expect(['a', 'b', 'd'].every(id => localStorage.getItem(arrangementKey(id)) !== null)).toBe(true);
  });

  it('deletes only its own line from a line that is not picked, and the picked ones with the Delete key', async () => {
    keepMany(['A1', 'A2', 'A3', 'A4']);
    renderAt();
    const dialog = openDialog();
    fireEvent.click(line(dialog, 'A2'), { detail: 1 });
    fireEvent.click(line(dialog, 'A3'), { detail: 1, shiftKey: true });
    expect(mine(dialog).getByRole('button', { name: 'Delete A4' })).toBeInTheDocument();
    fireEvent.click(mine(dialog).getByRole('button', { name: 'Delete A4' }));
    expect(names(dialog)).toEqual(['A1', 'A2', 'A3']);
    expect(pickedNames(dialog)).toEqual([]);
    fireEvent.click(line(dialog, 'A1'), { detail: 1 });
    fireEvent.click(line(dialog, 'A2'), { detail: 1, metaKey: true });
    fireEvent.keyDown(line(dialog, 'A2'), { key: 'Backspace' });
    await settle();
    expect(names(dialog)).toEqual(['A3']);
    expect(within(dialog).getByRole('status')).toHaveTextContent('Deleted 2 arrangements.');
    // With nothing picked, Delete does nothing.
    fireEvent.keyDown(line(dialog, 'A3'), { key: 'Delete' });
    expect(names(dialog)).toEqual(['A3']);
  });

  it('ranges over the lines shown, leaving out a closed folder, and drags the picked ones together', () => {
    keepMany(['Top 1', 'Top 2', 'Inside'], [{ id: 'f', name: 'Riffs', holds: ['Inside'] }]);
    renderAt();
    const dialog = openDialog();
    const folder = mine(dialog).getByRole('button', { name: 'Riffs' });
    expect(folder).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(line(dialog, 'Top 2'), { detail: 1 });
    fireEvent.click(line(dialog, 'Top 1'), { detail: 1, shiftKey: true });
    expect(pickedNames(dialog)).toEqual(['Top 1', 'Top 2']);
    // Opened, the folder's lines come first, so a range from inside it takes in Top 1.
    fireEvent.click(folder);
    fireEvent.click(line(dialog, 'Inside'), { detail: 1 });
    fireEvent.click(line(dialog, 'Top 1'), { detail: 1, shiftKey: true });
    expect(pickedNames(dialog)).toEqual(['Inside', 'Top 1']);
    // Closing the folder lets go of what is in it.
    fireEvent.click(folder);
    expect(pickedNames(dialog)).toEqual(['Top 1']);
    fireEvent.click(line(dialog, 'Top 2'), { detail: 1, metaKey: true });
    // Dragging one picked line carries both into the folder.
    drag(line(dialog, 'Top 1').closest('li')!, folder);
    expect(loadLibrary().items.filter(i => i.folder === 'f').map(i => i.name).sort()).toEqual(['Inside', 'Top 1', 'Top 2']);
  });

  it('picks one built-in line at a time, and opens it with a double click', async () => {
    keepMany(['One']);
    renderAt();
    const dialog = openDialog();
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Samples' }));
    const sample = within(within(dialog).getByRole('list', { name: 'Samples' })).getByRole('button', { name: 'Oceanic Speedy Down Run' });
    fireEvent.click(line(dialog, 'One'), { detail: 1 });
    // Shift on a built-in picks only it, and lets go of the kept ones: they are never deleted together.
    fireEvent.click(sample, { detail: 1, shiftKey: true });
    expect(sample).toHaveAttribute('aria-pressed', 'true');
    expect(pickedNames(dialog)).toEqual([]);
    expect(dialog).toHaveAttribute('open');
    doubleClick(sample);
    await screen.findByRole('heading', { name: 'Oceanic Speedy Down Run' }, SLOW);
  });
});

describe('TabPage export', () => {
  it('offers only bar insertion on a right-click on the tab', () => {
    keepOpen((readAscii(RIFF) as { clip: unknown }).clip);
    renderAt();
    fireEvent.contextMenu(screen.getByRole('textbox', { name: /Tab editor/ }));
    const menu = screen.getByRole('menu', { name: 'Tab' });
    expect(within(menu).getAllByRole('menuitem').map(i => i.textContent)).toEqual(['Insert bar before', 'Insert bar after']);
  });

  it('opens only the bar menu on a right-click on a drawn signature, not its panel too', () => {
    keepOpen((readAscii(RIFF) as { clip: unknown }).clip);
    renderAt();
    const svg = screen.getByRole('img', { name: /drawn as tab/ });
    fireEvent.pointerDown(svg, { clientX: 13, clientY: 65, button: 2 });
    fireEvent.contextMenu(screen.getByRole('textbox', { name: /Tab editor/ }), { clientX: 13, clientY: 65 });
    expect(screen.getByRole('menu', { name: 'Tab' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Time signature' })).toBeNull();
  });

  it('closes the panel a long press opened when the bar menu opens', () => {
    vi.useFakeTimers();
    try {
      keepOpen((readAscii(RIFF) as { clip: unknown }).clip);
      renderAt();
      const svg = screen.getByRole('img', { name: /drawn as tab/ });
      fireEvent.pointerDown(svg, { clientX: 13, clientY: 65, pointerType: 'touch' });
      expect(screen.getByRole('dialog', { name: 'Time signature' })).toBeInTheDocument();
      act(() => { vi.advanceTimersByTime(600); });
      expect(screen.getByRole('menu', { name: 'Tab' })).toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: 'Time signature' })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('saves from a button at the clip\'s bottom right: a list of formats in Standard, the text in the text views', () => {
    keepOpen((readAscii(RIFF) as { clip: unknown }).clip);
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Save as…' }));
    const menu = screen.getByRole('menu', { name: 'Save as' });
    expect(within(menu).getAllByRole('menuitem').map(i => i.textContent)).toEqual(['PNG image…', 'SVG image…', 'ASCII tab…', 'alphaTex…', 'MusicXML…']);
    fireEvent.keyDown(menu, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'ASCII Tab' }));
    expect(screen.getByRole('button', { name: 'Save as text file' })).not.toHaveAttribute('aria-haspopup');
    fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
    expect(screen.getByRole('button', { name: 'Save as alphaTex file' })).toBeInTheDocument();
  });

  it('opens Export from the header, and remembers its choices', async () => {
    keepOpen((readAscii(RIFF) as { clip: unknown }).clip);
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
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

    it('clears the text and the clip from the × at the top left, as one undo step', async () => {
      renderAt(`#tab=${encodeURIComponent(TEX)}`);
      await waitFor(() => expect(heading()).toHaveTextContent('Tex riff'), SLOW);
      expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
      fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
      expect(alphaTexText()).toBe('');
      expect(heading()).toHaveTextContent('Untitled clip');
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

  it('opens the Export dialog from the Export button, which also downloads the clip as text', () => {
    keepOpen((readAscii(RIFF) as { clip: unknown }).clip);
    renderAt();
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const dialog = screen.getByRole('dialog', { name: 'Export Riff' });
    const saved: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      saved.push(this.download);
    });
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Download alphaTex' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Download ASCII' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Download MusicXML' }));
    expect(saved).toEqual(['Riff.alphatex.txt', 'Riff.txt', 'Riff.musicxml']);
    expect(within(dialog).getByRole('status')).toHaveTextContent('Downloaded Riff.musicxml');
    // The file holds all of this clip, so no ⚠ says otherwise.
    expect(within(dialog).queryByRole('img', { name: /MusicXML file leaves out/ })).toBeNull();
    click.mockRestore();
  });

  it('marks Download MusicXML with a ⚠ when the file can\'t hold all of the clip', async () => {
    renderAt('#example=oceanic-speedy-down-run');
    await screen.findByRole('heading', { name: 'Oceanic Speedy Down Run' }, SLOW);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const dialog = screen.getByRole('dialog', { name: /^Export/ });
    expect(within(dialog).getByRole('img', { name: 'The MusicXML file leaves out the FX.' })).toHaveTextContent('⚠');
  });
});

describe('picking a technique mark (issue #128)', () => {
  const editor = () => screen.getByRole('textbox', { name: /Tab editor/ });
  const tool = (name: string) => screen.getByRole('button', { name });

  /** Opens an example and presses the middle of its first drawn `mark` (jsdom draws the tab 800 wide at 0, 0). */
  async function pressMark(example: string, mark: MarkHit['mark']) {
    const { title, text } = exampleById(example)!;
    renderAt(`#example=${example}`);
    await screen.findByRole('heading', { name: title }, SLOW);
    const read = readAlphaTexWith(alphaTab, text);
    if (!read.ok) throw new Error(read.errors.join('\n'));
    const { box } = markBoxes(layoutClip(partOf(read.clip), 800)).find(m => m.hit.mark === mark)!;
    const svg = screen.getByRole('img', { name: /drawn as tab/ });
    fireEvent.pointerDown(svg, { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 });
  }

  it('outlines the mark, lights only its tool and offers Delete, which keeps the note', async () => {
    await pressMark('bends', 'bend');
    expect(screen.getByTestId('picked-mark')).toBeInTheDocument();
    expect(screen.queryByTestId('tab-cursor')).toBeNull();
    expect(tool('Bend')).toHaveAttribute('aria-pressed', 'true');
    expect(tool('Quarter note')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.getAllByTestId('bend')).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getAllByTestId('bend')).toHaveLength(5);
    // Nothing is left selected: no outline, no cursor, and the tab lets the keys go.
    expect(screen.queryByTestId('picked-mark')).toBeNull();
    await settle();
    expect(screen.queryByTestId('tab-cursor')).toBeNull();
    expect(editor()).not.toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
    expect(alphaTexText()).toContain('\n7.3.4 7.3{b (0 4 0)}.4');
  });

  it('takes the mark away with the Delete key, and lets it go with Esc or an arrow', async () => {
    await pressMark('accents', 'staccato');
    const dots = screen.getAllByTestId('staccato').length;
    expect(tool('Staccato')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(editor(), { key: 'Escape' });
    expect(screen.queryByTestId('picked-mark')).toBeNull();
    expect(screen.getByTestId('tab-cursor')).toBeInTheDocument();
    expect(screen.getAllByTestId('staccato')).toHaveLength(dots);
    cleanup();
    await pressMark('accents', 'staccato');
    fireEvent.keyDown(editor(), { key: 'Delete' });
    expect(screen.getAllByTestId('staccato')).toHaveLength(dots - 1);
    await settle();
    expect(screen.queryByTestId('tab-cursor')).toBeNull();
    expect(screen.queryByTestId('tab-selection')).toBeNull();
    undo();
    expect(screen.getAllByTestId('staccato')).toHaveLength(dots);
  });

  it('keeps a bend picked while the palette changes it', async () => {
    await pressMark('bends', 'bend');
    fireEvent.click(tool('Bend'));
    fireEvent.click(screen.getByRole('button', { name: '½' }));
    expect(screen.getByTestId('picked-mark')).toBeInTheDocument();
    expect(screen.getAllByTestId('bend')[0]).toHaveTextContent('½');
  });
});

describe('the notation staff (issue #122)', () => {
  it('shows the staff, the tab or both, the two joined by a bracket', async () => {
    renderAt('#example=key-signatures');
    await screen.findAllByTestId('tab-system');
    const count = (id: string) => screen.queryAllByTestId(id).length;
    expect(count('staff')).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Both' }));
    expect(count('staff')).toBeGreaterThan(0);
    expect(count('staff-join')).toBe(count('tab-system'));
    // With the staff shown, the time signature is on it and not on the tab.
    expect(count('staff-time-signature')).toBe(1);
    expect(count('time-signature')).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Staff' }));
    expect(count('staff-join')).toBe(0);
    // The staff alone is edited too (issue #136), so its palette stays on.
    expect(screen.getByRole('button', { name: 'Key signature from this bar' })).toBeEnabled();
  });
});

describe('dragging notes on the staff (issue #174)', () => {
  /** Where a staff head is drawn (jsdom places the drawing at 0, 0): a little inside its left edge, on its line or space. */
  const headAt = (k: number) => {
    const path = screen.getAllByTestId('staff-head')[k].querySelector('path')!;
    const [, x, y] = /translate\(([\d.-]+) ([\d.-]+)\)/.exec(path.getAttribute('transform')!)!;
    return { clientX: Number(x) + 4, clientY: Number(y) };
  };
  const frets = () => alphaTexText().split('\n').find(line => line.includes('|'));

  it.each(['both', 'staff'])('Esc on a note pressed on the staff (%s) leaves nothing drawn', async parts => {
    localStorage.setItem('frets.tab.notation', JSON.stringify({ show: parts }));
    renderAt(`#tab=${encodeURIComponent('\\ts (4 4)\n(5.6 7.5).4 3.4.4 r.2 |')}`);
    await waitFor(() => expect(screen.getAllByTestId('staff-head')).toHaveLength(3), SLOW);
    const editor = () => screen.getByRole('textbox', { name: /Tab editor/ });
    const svg = screen.getByRole('img', { name: /drawn as/ });
    act(() => editor().focus());
    fireEvent.pointerDown(svg, { ...headAt(2), button: 0 });
    fireEvent.pointerUp(svg, { ...headAt(2), button: 0 });
    // In normal mode the note pressed is selected (issue #238).
    expect(screen.getByTestId('staff-selected')).toBeInTheDocument();
    fireEvent.keyDown(editor(), { key: 'Escape' });
    expect(screen.queryByTestId('staff-selected')).toBeNull();
    expect(screen.queryByTestId('staff-cursor')).toBeNull();
    expect(screen.queryByTestId('tab-cursor')).toBeNull();
    expect(screen.queryByTestId('column-cursor')).toBeNull();
    expect(editor()).not.toHaveFocus();
  });

  describe('normal mode and note input on the staff (issue #238)', () => {
    const open = async () => {
      localStorage.setItem('frets.tab.notation', JSON.stringify({ show: 'both' }));
      renderAt(`#tab=${encodeURIComponent('\\ts (4 4)\n(5.6 7.5).4 3.4.4 r.2 |')}`);
      await waitFor(() => expect(screen.getAllByTestId('staff-head')).toHaveLength(3), SLOW);
      act(() => screen.getByRole('textbox', { name: /Tab editor/ }).focus());
    };
    const editor = () => screen.getByRole('textbox', { name: /Tab editor/ });
    const svg = () => screen.getByRole('img', { name: /drawn as/ });
    const press = (at: { clientX: number; clientY: number }) => {
      fireEvent.pointerDown(svg(), { ...at, button: 0 });
      fireEvent.pointerUp(svg(), { ...at, button: 0 });
    };

    it('in normal mode a digit sets the selected note’s length, ↑ ↓ a semitone, Ctrl/⌘ an octave', async () => {
      await open();
      press(headAt(2));
      const shown = () => {
        fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
        const line = frets();
        fireEvent.click(screen.getByRole('button', { name: 'Notation' }));
        act(() => editor().focus());
        return line;
      };
      fireEvent.keyDown(editor(), { key: '6' });
      expect(shown()).toBe('(7.5 5.6).4 3.4.2 r.2 |');
      fireEvent.keyDown(editor(), { key: 'ArrowUp' });
      expect(shown()).toBe('(7.5 5.6).4 4.4.2 r.2 |');
      fireEvent.keyDown(editor(), { key: 'ArrowDown', ctrlKey: true });
      // An octave under the D string's 4th fret (F♯) is the low E string's 2nd.
      expect(shown()).toBe('(7.5 5.6).4 2.6.2 r.2 |');
    });

    it('shows a shadow note under the pointer only in note input, and a press there enters it', async () => {
      await open();
      // Over the first column, a few lines above its heads.
      const over = { clientX: headAt(0).clientX, clientY: headAt(2).clientY - 20 };
      fireEvent.pointerMove(svg(), over);
      expect(screen.queryByTestId('shadow-note')).toBeNull();
      fireEvent.keyDown(editor(), { key: 'n' });
      fireEvent.pointerMove(svg(), over);
      expect(screen.getByTestId('shadow-note')).toBeInTheDocument();
      press(over);
      expect(screen.getAllByTestId('staff-head')).toHaveLength(4);
      fireEvent.pointerLeave(svg());
      expect(screen.queryByTestId('shadow-note')).toBeNull();
    });

    it('in note input a digit is the next note’s length, never a fret, and the shadow note shows it', async () => {
      await open();
      const shown = () => {
        fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
        const line = frets();
        fireEvent.click(screen.getByRole('button', { name: 'Notation' }));
        act(() => editor().focus());
        return line;
      };
      fireEvent.keyDown(editor(), { key: 'n' });
      press(headAt(2));
      fireEvent.keyDown(editor(), { key: 'ArrowRight' });
      fireEvent.keyDown(editor(), { key: '3' });
      expect(shown()).toBe('(7.5 5.6).4 3.4.4 r.2 |');
      fireEvent.pointerMove(svg(), { clientX: headAt(0).clientX, clientY: headAt(2).clientY - 20 });
      expect(screen.getByTestId('shadow-note')).toHaveAttribute('data-value', '16');
      fireEvent.keyDown(editor(), { key: 'Enter' });
      expect(shown()).toMatch(/^\(7\.5 5\.6\)\.4 3\.4\.4 3\.4\.16 /);
    });

    it('in normal mode a press beside the heads selects the column and enters nothing', async () => {
      await open();
      press({ clientX: headAt(0).clientX, clientY: headAt(2).clientY - 20 });
      expect(screen.getAllByTestId('staff-head')).toHaveLength(3);
      expect(screen.getByTestId('column-cursor')).toBeInTheDocument();
    });
  });

  it('moves the note a line or space at a time, a semitone with Shift, and the chord with Ctrl, each one undo step', async () => {
    localStorage.setItem('frets.tab.notation', JSON.stringify({ show: 'both' }));
    renderAt(`#tab=${encodeURIComponent('\\ts (4 4)\n(5.6 7.5).4 3.4.4 r.2 |')}`);
    await waitFor(() => expect(screen.getAllByTestId('staff-head')).toHaveLength(3), SLOW);
    const drag = (k: number, dy: number, keys: { shiftKey?: boolean; ctrlKey?: boolean } = {}) => {
      const svg = screen.getByRole('img', { name: /drawn as/ });
      const from = headAt(k);
      fireEvent.pointerDown(svg, { ...from, button: 0, ...keys });
      fireEvent.pointerMove(svg, { clientX: from.clientX, clientY: from.clientY + dy, ...keys });
      fireEvent.pointerUp(svg, { clientX: from.clientX, clientY: from.clientY + dy, ...keys });
    };
    const shown = () => {
      fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
      const line = frets();
      fireEvent.click(screen.getByRole('button', { name: 'Notation' }));
      return line;
    };
    // Up two lines and spaces: F to A, the D string's 3rd fret to its 7th.
    drag(2, -9);
    expect(shown()).toContain('7.4');
    undo();
    expect(shown()).toContain('3.4');
    drag(2, -9, { shiftKey: true });
    expect(shown()).toContain('5.4');
    undo();
    drag(0, -9, { ctrlKey: true });
    expect(shown()).toMatch(/\(8\.6 10\.5\)|\(10\.5 8\.6\)/);
  });
});

describe('TabPage with several tracks (issues #237, #243)', () => {
  const TWO = '\\title "Two"\n\\track "Gtr I"\n\\ts (4 4)\n5.3.1 |\n\\track "Gtr II"\n0.6.1 2.6.1 |\n';
  const trackList = () => screen.getByRole('combobox', { name: 'Track' }) as HTMLSelectElement;

  it('shows, edits and plays the track picked from the list, keeping the others', async () => {
    renderAt(`#tab=${encodeURIComponent(TWO)}`);
    await screen.findByRole('heading', { name: 'Two' }, SLOW);
    expect([...trackList().options].map(o => o.text)).toEqual(['Gtr I', 'Gtr II']);
    expect(trackList().value).toBe('0');
    expect(screen.getAllByTestId('tab-column')).toHaveLength(1);
    fireEvent.change(trackList(), { target: { value: '1' } });
    expect(screen.getAllByTestId('tab-column')).toHaveLength(2);
    const editor = screen.getByRole('textbox', { name: /Tab editor/ });
    act(() => editor.focus());
    fireEvent.keyDown(editor, { key: '7' });
    const saved = savedClip() as unknown as Clip;
    expect(saved.tracks[0].bars[0].columns).toHaveLength(1);
    expect(saved.tracks[0].bars[0].columns[0].notes[2]).toEqual({ fret: 5 });
    expect(saved.tracks[1].bars[0].columns[0].notes[0]).toEqual({ fret: 7 });
    // The ASCII view is of the track picked; the AlphaTex view has every track, so no list there.
    fireEvent.click(screen.getByRole('button', { name: 'ASCII Tab' }));
    expect(screen.getByTestId('tab-ascii').textContent).toMatch(/^E\|-*0-+2/m);
    expect(trackList().value).toBe('1');
    fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
    expect(alphaTexText()).toContain('\\track "Gtr II"');
    expect(screen.queryByRole('combobox', { name: 'Track' })).toBeNull();
  });

  it('lets go of the focus once a track is picked from the list, so the page keys work again', async () => {
    renderAt(`#tab=${encodeURIComponent(TWO)}`);
    await screen.findByRole('heading', { name: 'Two' }, SLOW);
    fireEvent.pointerDown(trackList());
    act(() => trackList().focus());
    fireEvent.change(trackList(), { target: { value: '1' } });
    expect(trackList()).not.toHaveFocus();
    expect(trackList().value).toBe('1');
    fireEvent.keyDown(document.body, { key: ' ' });
    expect(screen.getByRole('button', { name: /Loading the sound|Stop/ })).toBeInTheDocument();
  });

  it('goes back to the first track when another arrangement opens', async () => {
    renderAt(`#tab=${encodeURIComponent(TWO)}`);
    await screen.findByRole('heading', { name: 'Two' }, SLOW);
    fireEvent.change(trackList(), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Arrangements…' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Arrangements' })).getByRole('button', { name: 'Duplicate' }));
    await settle();
    expect(trackList().value).toBe('0');
    expect(screen.getAllByTestId('tab-column')).toHaveLength(1);
  });

  it('shows no track list for one track', async () => {
    renderAt(`#tab=${encodeURIComponent(TEX)}`);
    await screen.findByRole('heading', { name: 'Tex riff' }, SLOW);
    expect(screen.queryByRole('combobox', { name: 'Track' })).toBeNull();
  });
});
