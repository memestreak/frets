import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { PLAYBACK_KEY } from '@/features/tab/PlaybackFooter';
import { EDITING_KEY } from '@/features/tab/editingPrefs';
import { type Clip, partOf } from '@/features/tab/clip';
import { setUpPage, OTHER, renderAt, alphaTexText, SLOW, TEX, undo, pageClip, openWith } from './helpers';

setUpPage();

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
    expect(partOf(pageClip() as unknown as Clip)).toMatchObject({ instrument: { program: 0, tag: '\\instrument acousticgrandpiano' } });
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

  it('sets the speed in bpm with its buttons, the arrow keys and a typed number, kept within 20 to 400 bpm at 120, the percentage under it', () => {
    renderAt();
    const field = screen.getByRole('spinbutton', { name: 'Speed (bpm)' });
    const caption = () => screen.getByText(/^Speed ·/);
    expect(field).toHaveValue('120');
    expect(caption()).toHaveTextContent('Speed · 100%');
    // No percentage field any more.
    expect(screen.queryByRole('spinbutton', { name: 'Speed (percent)' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Faster' }));
    expect(field).toHaveValue('125');
    fireEvent.click(screen.getByRole('button', { name: 'Slower' }));
    fireEvent.keyDown(field, { key: 'ArrowDown' });
    expect(field).toHaveValue('115');
    fireEvent.change(field, { target: { value: '60' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(field).toHaveValue('60');
    expect(caption()).toHaveTextContent('Speed · 50%');
    fireEvent.change(field, { target: { value: '10' } });
    fireEvent.blur(field);
    expect(field).toHaveValue('20');
    expect(caption()).toHaveTextContent('Speed · 17%');
    fireEvent.change(field, { target: { value: '999' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(field).toHaveValue('400');
    expect(caption()).toHaveTextContent('Speed · 333%');
    fireEvent.change(field, { target: { value: '70' } });
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(field).toHaveValue('400');
  });

  it('keeps its width whatever the bpm and percentage: three digits always, the percentage the room of 800%', async () => {
    // A clip from 20 to 200 bpm: at its start the field reaches only 20 to 40, two digits.
    renderAt(`#tab=${encodeURIComponent('\\tempo 20 0.6.4 | \\tempo 200 0.6.4 |')}`);
    const field = screen.getByRole('spinbutton', { name: 'Speed (bpm)' });
    await waitFor(() => expect(field).toHaveAttribute('aria-valuemax', '40'));
    expect(field.style.width).toBe('3ch');
    // The percentage sits in a box that keeps the widest one's room (its ::before, "800%").
    expect(screen.getByText(/^Speed ·/).querySelector('.tab-speed-percent')).toHaveTextContent(/^100%$/);
  });

  it("changes only the playback's speed, never the clip's own tempo", () => {
    renderAt();
    const field = screen.getByRole('spinbutton', { name: 'Speed (bpm)' });
    fireEvent.change(field, { target: { value: '90' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(field).toHaveValue('90');
    expect(within(screen.getByTestId('score-head')).getByRole('button', { name: /^Tempo:/ })).toHaveAccessibleName(/120/);
  });

  it('plays a speed the new tempo puts past 400 bpm at the fastest it allows', () => {
    renderAt();
    const field = screen.getByRole('spinbutton', { name: 'Speed (bpm)' });
    fireEvent.change(field, { target: { value: '360' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(screen.getByText('300%')).toBeInTheDocument();
    fireEvent.click(within(screen.getByTestId('score-head')).getByRole('button', { name: /^Tempo:/ }));
    const bpm = within(screen.getByRole('dialog', { name: 'Tempo' })).getByRole('spinbutton', { name: 'Tempo (bpm)' });
    fireEvent.change(bpm, { target: { value: '200' } });
    fireEvent.keyDown(bpm, { key: 'Enter' });
    expect(field).toHaveValue('400');
    expect(screen.getByText('200%')).toBeInTheDocument();
  });

  describe('its "bpm", a Tap button', () => {
    let now = 0;
    beforeEach(() => {
      now = 1000;
      vi.spyOn(performance, 'now').mockImplementation(() => now);
    });
    afterEach(() => vi.restoreAllMocks());
    const tapAt = (ms: number) => {
      now = ms;
      fireEvent.pointerDown(screen.getByRole('button', { name: 'Tap tempo' }), { button: 0 });
    };

    it('reads "bpm", and "Tap" on hover, in the same place', () => {
      renderAt();
      const tap = screen.getByRole('button', { name: 'Tap tempo' });
      expect(tap).toHaveTextContent('bpmTap');
      expect(tap.querySelector('.tab-bpm-hover')).toHaveTextContent('Tap');
      expect(tap).toHaveAttribute('data-tip', 'Tap twice or more in time to set the bpm');
      // Named apart from the Tap tool (the technique) in the rail.
      expect(screen.queryByRole('button', { name: 'Tap' })?.closest('.tab-bpm') ?? null).toBeNull();
    });

    it('sets the speed from two taps or more in time, leaving the clip at its tempo; one tap changes nothing', () => {
      renderAt();
      const field = screen.getByRole('spinbutton', { name: 'Speed (bpm)' });
      tapAt(1000);
      expect(field).toHaveValue('120');
      tapAt(1600);
      expect(field).toHaveValue('100');
      expect(screen.getByText(/^Speed ·/)).toHaveTextContent('Speed · 83%');
      tapAt(2200);
      expect(field).toHaveValue('100');
      expect(within(screen.getByTestId('score-head')).getByRole('button', { name: /^Tempo:/ })).toHaveAccessibleName(/120/);
    });

    it('taps within 20 to 400 bpm, flashes on each press, and Enter taps too', () => {
      renderAt();
      const field = screen.getByRole('spinbutton', { name: 'Speed (bpm)' });
      tapAt(1000);
      tapAt(1100);
      expect(field).toHaveValue('400');
      const tap = screen.getByRole('button', { name: 'Tap tempo' });
      const first = tap.querySelector('.tap-pulse');
      expect(first).not.toBeNull();
      tapAt(1250);
      expect(tap.querySelector('.tap-pulse')).not.toBe(first);
      now = 1400;
      fireEvent.keyDown(tap, { key: 'Enter' });
      expect(field).toHaveValue('400');
      now = 1550;
      fireEvent.keyDown(tap, { key: 'Enter' });
      // 150 ms apart: 400 bpm, the most.
      expect(field).toHaveValue('400');
    });

    it('keeps the focus where it was: a press on it takes none', () => {
      renderAt();
      const tap = screen.getByRole('button', { name: 'Tap tempo' });
      const press = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      tap.dispatchEvent(press);
      expect(press.defaultPrevented).toBe(true);
    });

    it('does not reset the speed on a double-click', () => {
      renderAt();
      const field = screen.getByRole('spinbutton', { name: 'Speed (bpm)' });
      fireEvent.click(screen.getByRole('button', { name: 'Faster' }));
      fireEvent.doubleClick(screen.getByRole('button', { name: 'Tap tempo' }));
      expect(field).toHaveValue('125');
    });
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

  it("resets the speed to the clip's tempo (100%) on a double-click on its caption or the percentage in it, or its number, not its step buttons", () => {
    renderAt();
    const field = screen.getByRole('spinbutton', { name: 'Speed (bpm)' });
    const faster = screen.getByRole('button', { name: 'Faster' });
    fireEvent.click(faster);
    fireEvent.click(faster);
    fireEvent.doubleClick(faster);
    expect(field).toHaveValue('130');
    fireEvent.doubleClick(screen.getByText(/^Speed ·/));
    expect(field).toHaveValue('120');
    fireEvent.click(faster);
    fireEvent.doubleClick(screen.getByText(/^Speed ·/).querySelector('.tab-caption-value')!);
    expect(field).toHaveValue('120');
    fireEvent.click(faster);
    act(() => field.focus());
    fireEvent.change(field, { target: { value: '60' } });
    fireEvent.doubleClick(field);
    expect(field).toHaveValue('120');
  });

  it('puts the line between columns at a press just above or below the drawing, with the controls hidden', async () => {
    await openWith('5.1.1 |\n7.1.1 |');
    const editor = screen.getByRole('textbox', { name: /Tab editor/ });
    fireEvent.keyDown(editor, { key: 'ArrowRight', ctrlKey: true });
    act(() => editor.blur());
    expect(screen.queryByTestId('tab-cursor')).toBeNull();
    // jsdom puts the drawing at 0, 0: 10 px above it, over the first bar.
    fireEvent.pointerDown(screen.getByTestId('column-reach'), { clientX: 80, clientY: -10 });
    // The line between columns, as with the playback controls showing; no column is highlighted.
    expect(screen.getByTestId('play-mark')).toBeInTheDocument();
    // In the playback line's muted green, not red (issue #291).
    expect(screen.getByTestId('play-mark')).toHaveAttribute('stroke', 'var(--playhead)');
    expect(screen.queryByTestId('tab-cursor')).toBeNull();
    // → moves it, Esc drops it.
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(screen.getByTestId('play-mark')).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByTestId('play-mark')).toBeNull();
  });

  it('drops the line on a press off the drawing, as any selection goes, and keeps it for the controls', async () => {
    await openWith('5.1.1 |\n7.1.1 |');
    const editor = screen.getByRole('textbox', { name: /Tab editor/ });
    fireEvent.keyDown(editor, { key: 'ArrowRight', ctrlKey: true });
    fireEvent.pointerDown(screen.getByTestId('column-reach'), { clientX: 80, clientY: -10 });
    expect(screen.getByTestId('play-mark')).toBeInTheDocument();
    // Play and the other controls keep it, so they start from it (Jeremy, 2026-11-01: any selection).
    fireEvent.pointerDown(screen.getByRole('button', { name: /^Dotted/ }));
    expect(screen.getByTestId('play-mark')).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByTestId('play-mark')).toBeNull();
  });

  it('lets the tab cursor go when the line is placed, filling its bar', async () => {
    await openWith('5.1.1 |\n7.1.1 |');
    const editor = screen.getByRole('textbox', { name: /Tab editor/ });
    fireEvent.keyDown(editor, { key: 'ArrowRight', ctrlKey: true });
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
    for (const key of ['n', 'ArrowDown', '5', 'ArrowRight', '7']) fireEvent.keyDown(editor, { key });
    // Placing the line fills the bar with a rest after the 5 and the 7.
    fireEvent.pointerDown(screen.getByTestId('column-reach'), { clientX: 80, clientY: -10 });
    const firstBar = () => partOf(pageClip() as unknown as Clip).bars[0].columns.map(c => (c.notes.some(Boolean) ? 'note' : 'rest'));
    expect(firstBar()).toEqual(['note', 'note', 'rest']);
    // The line to the bar's end: Delete leaves the rest (bars stay full, issue #238), and so does Ctrl+Delete,
    // the clip's last bar ending in a Gap (step 4).
    for (let i = 0; i < 3; i++) fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    fireEvent.keyDown(document.body, { key: 'Delete' });
    expect(firstBar()).toEqual(['note', 'note', 'rest']);
    fireEvent.keyDown(document.body, { key: 'Delete', ctrlKey: true });
    expect(firstBar()).toEqual(['note', 'note', 'rest']);
    expect(screen.getByTestId('play-mark')).toBeInTheDocument();
    // Just after the 7, Backspace turns it into a rest, joined with the rest after it by the meter.
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    fireEvent.keyDown(document.body, { key: 'Backspace' });
    expect(firstBar()).toEqual(['note', 'rest', 'rest']);
    expect(screen.getByTestId('play-mark')).toBeInTheDocument();
    // It is one undo step.
    undo();
    expect(firstBar()).toEqual(['note', 'note', 'rest']);
  });

  it('sets loop points from the selection, round the whole clip with none, and clears them', () => {
    renderAt();
    expect(screen.queryByRole('slider', { name: 'Position' })).toBeNull();
    const loop = () => screen.getByRole('button', { name: 'Loop' });
    const editor = screen.getByRole('textbox', { name: /Tab editor/ });
    act(() => editor.focus());
    // Typed in note input (issue #238).
    for (const key of ['n', 'ArrowDown', '5', 'ArrowRight', '7', 'ArrowRight', '9']) fireEvent.keyDown(editor, { key });
    // No selection: the whole clip; pressed again, cleared.
    fireEvent.click(loop());
    expect(loop()).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(loop());
    expect(loop()).toHaveAttribute('aria-pressed', 'false');
    // A selection: its notes, and the selection goes (loopSelection.test.tsx); pressed again, cleared.
    fireEvent.keyDown(editor, { key: 'ArrowLeft', shiftKey: true });
    fireEvent.click(loop());
    expect(loop()).toHaveAttribute('aria-pressed', 'true');
    expect(loop()).toHaveAttribute('data-tip', 'Clear the loop points (L)');
    fireEvent.click(loop());
    expect(loop()).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(loop());
    fireEvent.keyDown(editor, { key: 'ArrowLeft', shiftKey: true });
    expect(loop()).toHaveAttribute('data-tip', 'Loop the selected notes (L)');
    fireEvent.click(loop());
    expect(loop()).toHaveAttribute('aria-pressed', 'true');
  });

  it('sets and clears the loop points on L, as the Loop button, on the tab and off it, but not in a field or hidden', () => {
    renderAt(`#tab=${encodeURIComponent(OTHER)}`);
    const loop = () => screen.getByRole('button', { name: 'Loop' });
    const editor = screen.getByRole('textbox', { name: /Tab editor/ });
    // Off the tab: round the whole clip, then cleared.
    fireEvent.keyDown(document.body, { key: 'l' });
    expect(loop()).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(document.body, { key: 'l' });
    expect(loop()).toHaveAttribute('aria-pressed', 'false');
    // On the tab, with notes selected: round them, and no Let ring is written.
    const before = JSON.stringify(pageClip());
    act(() => editor.focus());
    fireEvent.keyDown(editor, { key: 'ArrowRight' });
    fireEvent.keyDown(editor, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(editor, { key: 'l' });
    expect(loop()).toHaveAttribute('aria-pressed', 'true');
    expect(loop()).toHaveAttribute('data-tip', 'Clear the loop points (L)');
    expect(JSON.stringify(pageClip())).toBe(before);
    // Again, with the selection gone: cleared. A held key toggles once.
    fireEvent.keyDown(editor, { key: 'l' });
    fireEvent.keyDown(editor, { key: 'l', repeat: true });
    expect(loop()).toHaveAttribute('aria-pressed', 'false');
    // Not in a field, nor with Shift, Ctrl or Alt.
    const speed = screen.getByRole('spinbutton', { name: 'Speed (bpm)' });
    act(() => speed.focus());
    fireEvent.keyDown(speed, { key: 'l' });
    for (const mod of ['shiftKey', 'ctrlKey', 'altKey', 'metaKey']) fireEvent.keyDown(document.body, { key: mod === 'shiftKey' ? 'L' : 'l', [mod]: true });
    expect(loop()).toHaveAttribute('aria-pressed', 'false');
    // Hidden, L does nothing; shown again, the loop is still off.
    act(() => speed.blur());
    fireEvent.click(toggle());
    fireEvent.keyDown(document.body, { key: 'l' });
    fireEvent.click(toggle());
    expect(loop()).toHaveAttribute('aria-pressed', 'false');
  });

  it('plays on Space anywhere on the page while the footer shows, but not in a field', () => {
    renderAt(`#tab=${encodeURIComponent(OTHER)}`);
    act(() => screen.getByRole('spinbutton', { name: 'Speed (bpm)' }).focus());
    fireEvent.keyDown(screen.getByRole('spinbutton', { name: 'Speed (bpm)' }), { key: ' ' });
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

    const speed = screen.getByRole('spinbutton', { name: 'Speed (bpm)' });
    act(() => speed.focus());
    fireEvent.change(speed, { target: { value: '96' } });
    fireEvent.keyDown(speed, { key: 'Enter' });
    expect(speed).not.toHaveFocus();
    expect(speed).toHaveValue('96');

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
