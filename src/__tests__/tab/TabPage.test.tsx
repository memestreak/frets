import { vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import TabPage from '@/features/tab/TabPage';
import { readAscii } from '@/features/tab/ascii';
import { STORAGE_KEY } from '@/features/tab/clipState';
import { TAB_EXPORT_KEY } from '@/features/tab/exportTab';
import { PLAYBACK_KEY } from '@/features/tab/PlaybackFooter';
import * as alphaTab from '@coderline/alphatab';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { exampleById } from '@/features/tab/examples';
import { layoutClip } from '@/features/tab/layout';
import { markBoxes, type MarkHit } from '@/features/tab/marks';

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

  it('renames the clip from its title, which the export Name starts on', () => {
    renderAt();
    fireEvent.click(within(heading()).getByRole('button', { name: 'Untitled clip' }));
    const field = screen.getByRole('textbox', { name: 'Clip title' });
    expect(field).toHaveValue('');
    fireEvent.change(field, { target: { value: '  Riff  ' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(heading()).toHaveTextContent('Riff');
    expect(screen.queryByRole('textbox', { name: 'Clip title' })).toBeNull();
    // Esc keeps the old title.
    fireEvent.click(within(heading()).getByRole('button', { name: 'Riff' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Clip title' }), { target: { value: 'Other' } });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Clip title' }), { key: 'Escape' });
    expect(heading()).toHaveTextContent('Riff');
    fireEvent.click(screen.getByRole('button', { name: 'Export options' }));
    expect(within(screen.getByRole('dialog')).getByRole('textbox', { name: 'Name' })).toHaveValue('Riff');
    expect(JSON.parse(JSON.stringify(localStorage.getItem('frets.tab.clip')))).toContain('Riff');
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
      keys('ArrowDown', 'ArrowDown', '1', '2', 'ArrowRight', '1', '4', 'ArrowDown', '0');
      // → fills the bar with a dotted half rest; 14 splits it, a quarter like the note before.
      expect(alphaTex()).toBe('12.3.4 (14.3 0.4).4 r.2 |');
      expect(screen.getByTestId('tab-cursor')).toBeInTheDocument();
    });

    it('marks notes and columns from the keys and from the palette', () => {
      renderAt();
      act(() => editor().focus());
      keys('5', 'ArrowRight', '7', 'h', '-');
      fireEvent.click(vibrato());
      expect(alphaTex()).toBe('5.1{h}.4 7.1{v}.8 r.2 |');
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
      fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
      expect(alphaTexText()).toContain('\\capo 3\n5.1.4{ch "Am7"} |');
      fireEvent.click(screen.getByRole('button', { name: 'Notation' }));
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
      // One unbroken band over the two selected columns.
      expect(screen.getByTestId('tab-selection').children).toHaveLength(1);
      const data = new Map<string, string>();
      const copy = new Event('copy', { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown };
      copy.clipboardData = { setData: (type: string, text: string) => data.set(type, text) };
      act(() => { editor().dispatchEvent(copy); });
      expect(data.get('text/plain')).toBe('\\ts (4 4)\n7.1.4 9.1.4 |\n');
      keys('Backspace');
      expect(alphaTex()).toBe('5.1.4 r.4 |');
    });

    it('Delete off the notes of a column makes it a rest, then a second Delete removes the rest', () => {
      renderAt();
      act(() => editor().focus());
      keys('5', 'ArrowDown', '7', 'ArrowRight', '3', 'ArrowDown', 'ArrowDown');
      // On string 3, under a column whose notes are on strings 1 and 2.
      keys('ArrowLeft', 'Delete');
      expect(alphaTex()).toBe('r.4 3.2.4 r.2 |');
      keys('Delete');
      expect(alphaTex()).toBe('3.2.4 r.2 |');
    });

    it('sets the time signature from the palette, each change one undo step', () => {
      renderAt();
      act(() => editor().focus());
      // Three quarters: the rest → filled the bar with is deleted.
      keys('5', 'ArrowRight', '5', 'ArrowRight', '5', 'ArrowRight', 'Delete');
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
      expect(notice()).toHaveTextContent('Bar 1 doesn\'t add up to 4/4.');
    });
  });
});

describe('TabPage playback', () => {
  const footer = () => screen.queryByRole('group', { name: 'Playback' });
  const toggle = () => screen.getByRole('button', { name: 'Playback controls' });

  it('hides the playback footer at first, shows it on the small button under the tab, and remembers the choice', () => {
    renderAt();
    expect(footer()).toBeNull();
    expect(toggle()).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(toggle());
    expect(footer()).not.toBeNull();
    expect(toggle()).toHaveAttribute('aria-pressed', 'true');
    expect(JSON.parse(localStorage.getItem(PLAYBACK_KEY)!)).toMatchObject({ shown: true, sound: 25, volume: 1 });
    cleanup();
    renderAt();
    expect(footer()).not.toBeNull();
    fireEvent.click(toggle());
    expect(footer()).toBeNull();
    expect(JSON.parse(localStorage.getItem(PLAYBACK_KEY)!)).toMatchObject({ shown: false, sound: 25, volume: 1 });
  });

  it('shows neither the toggle nor the controls in the text views', () => {
    renderAt();
    fireEvent.click(toggle());
    fireEvent.click(screen.getByRole('button', { name: 'ASCII Tab' }));
    expect(screen.queryByRole('button', { name: 'Playback controls' })).toBeNull();
    expect(footer()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Notation' }));
    expect(footer()).not.toBeNull();
  });

  it('picks the sound at the end of the controls, and remembers it', () => {
    renderAt();
    fireEvent.click(toggle());
    const sound = screen.getByRole('combobox', { name: 'Sound' });
    expect(sound).toHaveValue('25');
    fireEvent.change(sound, { target: { value: '0' } });
    expect(JSON.parse(localStorage.getItem(PLAYBACK_KEY)!)).toMatchObject({ shown: true, sound: 0, volume: 1 });
    cleanup();
    renderAt();
    expect(screen.getByRole('combobox', { name: 'Sound' })).toHaveValue('0');
  });

  it('turns the volume knob with the arrow keys, and remembers it', () => {
    renderAt();
    fireEvent.click(toggle());
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
    fireEvent.click(toggle());
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Play' }), { clientX: 40, clientY: 40 });
    const stop = screen.getByRole('menuitemcheckbox', { name: 'Stop leaves the cursor where it stopped' });
    const pause = screen.getByRole('menuitemcheckbox', { name: 'Pause between loops' });
    expect(stop).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(stop);
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
    expect(JSON.parse(localStorage.getItem(PLAYBACK_KEY)!)).toMatchObject({ stopAtPlayhead: true, loopPause: true, loopPauseSeconds: 2.3 });
    // Transpose: the buttons, a typed number with its sign, and a double-click back to 0.
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
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu', { name: 'Playback options' })).toBeNull();
  });

  it('sets the speed with its buttons, the arrow keys and a typed number, kept within 25 to 150%', () => {
    renderAt();
    fireEvent.click(toggle());
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
    fireEvent.click(toggle());
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
    fireEvent.click(toggle());
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

  it('takes a press just above or below the drawing as one on its column', () => {
    renderAt();
    const editor = screen.getByRole('textbox', { name: /Tab editor/ });
    act(() => editor.focus());
    for (const key of ['5', 'ArrowRight', '7']) fireEvent.keyDown(editor, { key });
    act(() => editor.blur());
    expect(screen.queryByTestId('tab-cursor')).toBeNull();
    // jsdom puts the drawing at 0, 0: 10 px above it, over the first bar.
    fireEvent.pointerDown(screen.getByTestId('column-reach'), { clientX: 80, clientY: -10 });
    expect(screen.getByTestId('tab-cursor')).toBeInTheDocument();
  });

  it('sets loop points from the selection, round the whole clip with none, and clears them', () => {
    renderAt();
    fireEvent.click(toggle());
    expect(screen.queryByRole('slider', { name: 'Position' })).toBeNull();
    const loop = () => screen.getByRole('button', { name: 'Loop' });
    const editor = screen.getByRole('textbox', { name: /Tab editor/ });
    act(() => editor.focus());
    for (const key of ['5', 'ArrowRight', '7', 'ArrowRight', '9']) fireEvent.keyDown(editor, { key });
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
    fireEvent.click(toggle());
    act(() => screen.getByRole('spinbutton', { name: 'Speed (percent)' }).focus());
    fireEvent.keyDown(screen.getByRole('spinbutton', { name: 'Speed (percent)' }), { key: ' ' });
    expect(screen.queryByRole('button', { name: /Loading the sound|Stop/ })).toBeNull();
    act(() => (document.activeElement as HTMLElement).blur());
    fireEvent.keyDown(document.body, { key: ' ' });
    expect(screen.getByRole('button', { name: /Loading the sound|Stop/ })).toBeInTheDocument();
  });

  it("doesn't play on Space while the footer is hidden", () => {
    renderAt(`#tab=${encodeURIComponent(OTHER)}`);
    const editor = screen.getByRole('textbox', { name: /Tab editor/ });
    act(() => editor.focus());
    fireEvent.keyDown(editor, { key: ' ' });
    // Nothing plays, so no spinner and no Stop.
    expect(screen.queryByRole('button', { name: /Loading the sound|Stop/ })).toBeNull();
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

  it('saves from a button at the clip\'s bottom right: a list of formats in Standard, the text in the text views', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify((readAscii(RIFF) as { clip: unknown }).clip));
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Save as…' }));
    const menu = screen.getByRole('menu', { name: 'Save as' });
    expect(within(menu).getAllByRole('menuitem').map(i => i.textContent)).toEqual(['PNG image…', 'SVG image…', 'ASCII tab…', 'alphaTex…']);
    fireEvent.keyDown(menu, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'ASCII Tab' }));
    expect(screen.getByRole('button', { name: 'Save as text file' })).not.toHaveAttribute('aria-haspopup');
    fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
    expect(screen.getByRole('button', { name: 'Save as alphaTex file' })).toBeInTheDocument();
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify((readAscii(RIFF) as { clip: unknown }).clip));
    renderAt();
    expect(screen.getByRole('button', { name: 'Copy as PNG' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ASCII Tab' }));
    expect(screen.getByRole('button', { name: 'Copy as text' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy as PNG' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
    expect(screen.getByRole('button', { name: 'Copy as text' })).toBeInTheDocument();
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
    const { box } = markBoxes(layoutClip(read.clip, 800)).find(m => m.hit.mark === mark)!;
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
