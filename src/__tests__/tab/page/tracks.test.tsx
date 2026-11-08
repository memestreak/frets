import { act, fireEvent, screen } from '@testing-library/react';
import { type Clip } from '@/features/tab/clip';
import { setUpPage, TEX, renderAt, alphaTexText, SLOW, settle, pageClip } from './helpers';

setUpPage();

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
    // Frets are typed in note input mode (Jeremy, 2026-11-07): ↓ picks the top string.
    for (const key of ['n', '7']) fireEvent.keyDown(editor, { key });
    const saved = pageClip() as unknown as Clip;
    expect(saved.tracks[0].bars[0].voices[0]).toHaveLength(1);
    expect(saved.tracks[0].bars[0].voices[0][0].notes[2]).toEqual({ fret: 5 });
    expect(saved.tracks[1].bars[0].voices[0][0].notes[0]).toEqual({ fret: 7 });
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
    // Picking a track is the viewer's, not a change: New opens without asking.
    fireEvent.click(screen.getByRole('button', { name: 'New' }));
    await settle();
    expect(screen.queryByRole('combobox', { name: 'Track' })).toBeNull();
    // Opened again, the clip shows its first track.
    await act(async () => {
      window.history.replaceState(null, '', `/tab#tab=${encodeURIComponent(TWO)}`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    await screen.findByRole('heading', { name: 'Two' }, SLOW);
    expect(trackList().value).toBe('0');
  });

  it('shows no track list for one track', async () => {
    renderAt(`#tab=${encodeURIComponent(TEX)}`);
    await screen.findByRole('heading', { name: 'Tex riff' }, SLOW);
    expect(screen.queryByRole('combobox', { name: 'Track' })).toBeNull();
  });
});
