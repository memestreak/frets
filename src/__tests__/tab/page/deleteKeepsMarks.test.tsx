import { act, waitFor } from '@testing-library/react';
import { setUpPage, renderAt, SLOW, editor, keys, alphaTex } from './helpers';

setUpPage();

/** Delete and cut on the page keep a Column's text and chord name on the rest they leave (issue #393). */
describe('TabPage Delete keeps the marks of the time', () => {
  const start = async () => {
    renderAt(`#tab=${encodeURIComponent('\\ts (4 4)\n1.1.4 2.1.4{txt "slowly" ch "Am"} 3.1.4 4.1.4 |')}`);
    await waitFor(() => expect(alphaTex()).toBe('1.1.4 2.1.4{ch "Am" txt "slowly"} 3.1.4 4.1.4 |'), SLOW);
    act(() => editor().focus());
  };

  it('Delete on the note, then Ctrl+Delete on its rest, which takes the text with the time', async () => {
    await start();
    keys('ArrowRight', 'Delete');
    expect(alphaTex()).toBe('1.1.4 r.4{ch "Am" txt "slowly"} 3.1.4 4.1.4 |');
    keys({ key: 'Delete', ctrlKey: true });
    expect(alphaTex()).not.toContain('slowly');
  }, 20000);

  it('cut on a selection over it', async () => {
    await start();
    keys('ArrowRight', { key: 'ArrowRight', shiftKey: true });
    const cut = new Event('cut', { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown };
    cut.clipboardData = { setData: () => {} };
    act(() => { editor().dispatchEvent(cut); });
    expect(alphaTex()).toBe('1.1.4 r.4{ch "Am" txt "slowly"} r.4 4.1.4 |');
  }, 20000);
});
