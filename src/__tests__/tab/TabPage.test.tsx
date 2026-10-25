import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import TabPage from '@/features/tab/TabPage';
import { readAscii } from '@/features/tab/ascii';
import { STORAGE_KEY } from '@/features/tab/clipState';

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
      fireEvent.click(screen.getByRole('button', { name: 'Vibrato' }));
      expect(alphaTex()).toBe('5.1{h}.4 7.1{v}.8 |');
      expect(screen.getByRole('button', { name: 'Vibrato' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Eighth note' })).toHaveAttribute('aria-pressed', 'true');
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

    it('sets the time signature from the menu under the name, as one undo step', () => {
      renderAt();
      act(() => editor().focus());
      keys('5', 'ArrowRight', '5', 'ArrowRight', '5');
      const menu = screen.getByRole('combobox', { name: 'Time signature' });
      expect(menu).toHaveValue('4/4');
      expect(notice()).toHaveTextContent('Bar 1 doesn\'t add up to 4/4.');
      fireEvent.change(menu, { target: { value: '3/4' } });
      expect(menu).toHaveValue('3/4');
      expect(notice()).not.toHaveTextContent('add up');
      undo();
      expect(menu).toHaveValue('4/4');
    });

    it('says when a bar doesn\'t add up', () => {
      renderAt();
      act(() => editor().focus());
      keys('5');
      expect(notice()).toHaveTextContent('Bar 1 doesn\'t add up to 4/4.');
    });
  });
});
