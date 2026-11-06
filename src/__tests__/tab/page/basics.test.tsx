import { vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { readAscii } from '@/features/tab/ascii';
import { loadLibrary } from '@/features/tab/arrangements';
import { PLAYBACK_KEY } from '@/features/tab/PlaybackFooter';
import { setUpPage, RIFF, OTHER, renderAt, heading, alphaTexText, notice, paste, SLOW, settle, TEX, FX_LINE, undo, keepOpen, pageClip } from './helpers';

setUpPage();

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
    // Size is not in the panel but over the clip (issue #277).
    expect(within(panel).queryByRole('group', { name: 'Size' })).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'View options' })).toBeNull();
  });

  it('sizes the drawing from the Size field after Staff | Tab | Both, in the Notation view only (issue #277)', async () => {
    renderAt(`#tab=${encodeURIComponent(RIFF)}`);
    await settle();
    const size = screen.getByRole('group', { name: 'Size' });
    const show = screen.getByRole('group', { name: 'Show' });
    expect(show.nextElementSibling).toBe(size);
    // Size: the drawing is laid out narrower and zoomed, so it fits more to a line; it steps by 10% and stops at 50%.
    const drawing = () => screen.getByRole('img', { name: /drawn as/ });
    const fullWidth = Number(drawing().getAttribute('width'));
    fireEvent.click(within(size).getByRole('button', { name: 'Smaller' }));
    expect(within(size).getByRole('spinbutton', { name: 'Size (percent)' })).toHaveAttribute('aria-valuenow', '90');
    expect(Number(drawing().getAttribute('width'))).toBeCloseTo(fullWidth / 0.9, 3);
    for (let i = 0; i < 6; i++) fireEvent.click(within(size).getByRole('button', { name: 'Smaller' }));
    expect(within(size).getByRole('spinbutton', { name: 'Size (percent)' })).toHaveAttribute('aria-valuenow', '50');
    expect(JSON.parse(localStorage.getItem('frets.tab.notation')!).size).toBe(50);
    // A typed size goes to the nearest step; a double-click puts it back to 100%.
    const typed = within(size).getByRole('spinbutton', { name: 'Size (percent)' });
    fireEvent.change(typed, { target: { value: '73' } });
    fireEvent.blur(typed);
    expect(typed).toHaveAttribute('aria-valuenow', '70');
    fireEvent.doubleClick(size);
    expect(within(size).getByRole('spinbutton', { name: 'Size (percent)' })).toHaveAttribute('aria-valuenow', '100');
    // The text views have no Size.
    fireEvent.click(screen.getByRole('button', { name: 'ASCII Tab' }));
    expect(screen.queryByRole('group', { name: 'Size' })).toBeNull();
  });

  it('starts empty, saying how to bring tab in', () => {
    renderAt();
    expect(heading()).toHaveTextContent('Untitled');
    expect(notice()).toHaveTextContent('Click the tab and type frets, or import or paste alphaTex or ASCII tab.');
  });

  it('renames the clip from its title, which the export image prints', () => {
    renderAt();
    fireEvent.click(within(heading()).getByRole('button', { name: 'Untitled' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit title and credits' }));
    const panel = screen.getByRole('dialog', { name: 'Title and credits' });
    const field = within(panel).getByLabelText('Title');
    // A new arrangement is titled Untitled (issue #281).
    expect(field).toHaveValue('Untitled');
    expect(field).toHaveFocus();
    fireEvent.change(field, { target: { value: '  Riff  ' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(heading()).toHaveTextContent('Riff');
    expect(screen.queryByRole('dialog', { name: 'Title and credits' })).toBeNull();
    // Esc keeps the old title.
    // A double-click opens it too (Jeremy, 2026-11-01).
    fireEvent.click(within(heading()).getByRole('button', { name: 'Riff' }));
    fireEvent.doubleClick(within(heading()).getByRole('button', { name: 'Riff' }));
    const again = screen.getByLabelText('Title');
    expect(again).toHaveValue('Riff');
    fireEvent.change(again, { target: { value: 'Other' } });
    expect(heading()).toHaveTextContent('Other');
    fireEvent.keyDown(again, { key: 'Escape' });
    expect(heading()).toHaveTextContent('Riff');
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(within(screen.getByRole('dialog')).getByRole('img', { name: /Riff/ })).toBeInTheDocument();
    expect(pageClip().name).toBe('Riff');
  });

  it('opens the tab in a #tab= link, unsaved, keeping the link in the address until the clip is edited', async () => {
    const hash = `#tab=${encodeURIComponent(OTHER)}`;
    renderAt(hash);
    await settle();
    expect(screen.getAllByTestId('tab-column')).toHaveLength(2);
    expect(window.location.hash).toBe(hash);
    expect(loadLibrary().items).toHaveLength(0);
    expect(screen.queryByTestId('unsaved')).toBeNull();
    await paste(OTHER);
    expect(window.location.hash).toBe('');
    expect(screen.getByTestId('unsaved')).toBeInTheDocument();
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
    expect(window.location.hash).toContain('#tab=');
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

  it('takes a paste whole into an empty clip, then pastes over at the cursor; undo and redo step back and forth', async () => {
    renderAt();
    await paste(RIFF);
    expect(heading()).toHaveTextContent('Riff');
    const frets = () => screen.getAllByTestId('tab-column').map(c => c.textContent).join(' ');
    const before = frets();
    await paste(OTHER);
    expect(heading()).toHaveTextContent('Riff');
    // It writes over the riff's start (issue #238), keeping the name.
    const after = frets();
    expect(after).not.toBe(before);
    undo();
    expect(frets()).toBe(before);
    undo(true);
    expect(frets()).toBe(after);
  });

  it('says what a paste that is not tab got wrong, and keeps the clip', async () => {
    renderAt();
    await paste(RIFF);
    await paste('just some words');
    await screen.findByText(/./, { selector: '[data-testid="tab-notice"].text-\\(--danger\\)' }, SLOW);
    expect(heading()).toHaveTextContent('Riff');
  });

  it("lists the colours and only the shown view's own options in the View options panel (issue #277)", async () => {
    renderAt(`#tab=${encodeURIComponent(RIFF)}`);
    await settle();
    const open = () => {
      fireEvent.click(screen.getByRole('button', { name: 'View options' }));
      return screen.getByRole('dialog', { name: 'View options' });
    };
    const close = () => fireEvent.keyDown(window, { key: 'Escape' });
    /** The panel's headings and options, in order. */
    const contents = (panel: HTMLElement) => [
      ...[...panel.querySelectorAll('h3')].map(h => h.textContent),
      ...within(panel).queryAllByRole('switch').map(s => s.textContent),
      ...(within(panel).queryByRole('button', { name: 'None' }) ? ['Bar numbers'] : []),
    ];
    // Notation: bar numbers, the clip's line breaks, the header and the tuning's details.
    expect(contents(open())).toEqual(['Colours', 'Notation', "Clip's line breaks", 'Arrangement header', 'Tuning details', 'Chord chart', 'Chord diagrams', 'Bar numbers']);
    close();

    fireEvent.click(screen.getByRole('button', { name: 'ASCII Tab' }));
    const ascii = () => screen.getByTestId('tab-ascii').textContent!;
    expect(ascii()).toMatch(/^ +e/m);
    let panel = open();
    expect(contents(panel)).toEqual(['Colours', 'ASCII Tab', 'Rhythm', 'Chord chart']);
    expect(within(panel).getByRole('group', { name: 'Colours' })).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('switch', { name: 'Rhythm' }));
    expect(ascii()).not.toMatch(/^ +e/m);
    close();

    fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
    const numbers = () => screen.getByTestId('alphatex-mirror').querySelectorAll('.tab-text-number').length;
    expect(numbers()).toBeGreaterThan(0);
    panel = open();
    expect(contents(panel)).toEqual(['Colours', 'AlphaTex', 'Line numbers']);
    fireEvent.click(within(panel).getByRole('switch', { name: 'Line numbers' }));
    expect(numbers()).toBe(0);
    // Left open, the panel follows the view switched to.
    fireEvent.click(screen.getByRole('button', { name: 'ASCII Tab' }));
    expect(contents(panel)).toEqual(['Colours', 'ASCII Tab', 'Rhythm', 'Chord chart']);
    expect(JSON.parse(localStorage.getItem('frets.tab.ascii')!)).toEqual({ rhythm: false, chords: true });
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
    expect(window.location.hash).toBe(link.hash);
    fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
    expect(alphaTexText()).toBe(before);
    // Not saved until Save.
    expect(loadLibrary().items).toHaveLength(0);
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

  it('names Speed (with its percentage) and Transpose under their fields; a double-click on a name resets it', async () => {
    renderAt(`#tab=${encodeURIComponent(TEX)}`);
    await screen.findByRole('heading', { name: 'Tex riff' }, SLOW);
    const speed = screen.getByRole('group', { name: 'Speed' });
    fireEvent.click(within(speed).getByRole('button', { name: 'Faster' }));
    expect(within(speed).getByText(/^Speed ·/)).toHaveTextContent(/^Speed · \d+%$/);
    expect(within(speed).getByText(/^Speed ·/)).not.toHaveTextContent('Speed · 100%');
    fireEvent.doubleClick(within(speed).getByText(/^Speed ·/));
    expect(within(speed).getByText(/^Speed ·/)).toHaveTextContent('Speed · 100%');
    const transpose = screen.getByRole('group', { name: 'Transpose' });
    fireEvent.click(within(transpose).getByRole('button', { name: 'Transpose up' }));
    expect(within(transpose).getByRole('spinbutton', { name: 'Transpose (semitones)' })).toHaveValue('+1');
    // Semitones is in the tip, not beside the field.
    expect(transpose).toHaveAttribute('data-tip', 'Transpose, in semitones');
    expect(within(transpose).queryByText(/semitones/)).toBeNull();
    fireEvent.doubleClick(within(transpose).getByText('Transpose'));
    expect(within(transpose).getByRole('spinbutton', { name: 'Transpose (semitones)' })).toHaveValue('0');
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
    expect(pageClip()).toMatchObject({ tracks: [{ fx: { on: true, reverbOn: false, decay: 1.6 } }] });
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
});
