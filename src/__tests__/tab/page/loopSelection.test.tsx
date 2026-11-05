import { act, fireEvent, screen } from '@testing-library/react';
import { setUpPage, renderAt, SLOW, TEX, editor, keys, litFrets } from './helpers';

// Every Play the page asks for, by the column it starts from; nothing is played.
const played = vi.hoisted(() => ({ from: [] as number[] }));
vi.mock('@/features/tab/PlaybackFooter', async importOriginal => {
  const actual = await importOriginal<typeof import('@/features/tab/PlaybackFooter')>();
  return {
    ...actual,
    usePlayback: (...args: Parameters<typeof actual.usePlayback>) => {
      const playback = actual.usePlayback(...args);
      return { ...playback, toggle: (from: number) => { played.from.push(from); } };
    },
  };
});

setUpPage();

const loop = () => screen.getByRole('button', { name: 'Loop' });
const play = () => fireEvent.click(screen.getByRole('button', { name: 'Play' }));
/** Where the next Play starts. */
const playsFrom = () => {
  play();
  return played.from.at(-1);
};

/** Opens the four-note riff, the editor focused, the cursor on its second note and the third selected with it. */
async function selectSecondAndThird() {
  renderAt(`#tab=${encodeURIComponent(TEX)}`);
  await screen.findByRole('heading', { name: 'Tex riff' }, SLOW);
  act(() => editor().focus());
  keys('ArrowRight', { key: 'ArrowRight', shiftKey: true });
  expect(litFrets().map(t => t.textContent)).toEqual(['7', '5']);
}

// Loop with a selection lets the selection go once the loop points take it (Jeremy, 2026-11-05).
describe('TabPage Loop and the selection', () => {
  beforeEach(() => {
    played.from = [];
  });

  it('the Loop button with notes selected loops them, then lets the selection and the tab go; Play starts at the loop', async () => {
    await selectSecondAndThird();
    fireEvent.click(loop());
    expect(loop()).toHaveAttribute('aria-pressed', 'true');
    expect(litFrets()).toEqual([]);
    expect(editor()).not.toHaveFocus();
    expect(loop()).toHaveAttribute('data-tip', 'Clear the loop points (L)');
    expect(playsFrom()).toBe(1);
  });

  it('L with notes selected loops them, then lets the selection and the tab go; Play starts at the loop', async () => {
    await selectSecondAndThird();
    keys('l');
    expect(loop()).toHaveAttribute('aria-pressed', 'true');
    expect(litFrets()).toEqual([]);
    expect(playsFrom()).toBe(1);
    // The tab let the keys go: L comes to the page, and clears the loop points.
    expect(editor()).not.toHaveFocus();
    fireEvent.keyDown(document.body, { key: 'l' });
    expect(loop()).toHaveAttribute('aria-pressed', 'false');
    // With notes selected and the focus off the tab, L loops them and lets them go too.
    act(() => editor().focus());
    keys({ key: 'ArrowLeft', shiftKey: true });
    expect(litFrets()).toHaveLength(2);
    act(() => editor().blur());
    fireEvent.keyDown(document.body, { key: 'l' });
    expect(loop()).toHaveAttribute('aria-pressed', 'true');
    expect(litFrets()).toEqual([]);
  });

  it('the Loop button and L with nothing selected loop the whole clip, keep the cursor, and Play starts at it', async () => {
    renderAt(`#tab=${encodeURIComponent(TEX)}`);
    await screen.findByRole('heading', { name: 'Tex riff' }, SLOW);
    act(() => editor().focus());
    keys('ArrowRight', 'ArrowRight');
    fireEvent.click(loop());
    expect(loop()).toHaveAttribute('aria-pressed', 'true');
    expect(editor()).toHaveFocus();
    expect(playsFrom()).toBe(2);
    keys('l');
    expect(loop()).toHaveAttribute('aria-pressed', 'false');
    keys('l');
    expect(loop()).toHaveAttribute('aria-pressed', 'true');
    expect(editor()).toHaveFocus();
    expect(playsFrom()).toBe(2);
  });

  it('the same notes selected again clear the loop points, and stay selected', async () => {
    await selectSecondAndThird();
    keys('l');
    act(() => editor().focus());
    keys('ArrowLeft', { key: 'ArrowRight', shiftKey: true });
    expect(litFrets().map(t => t.textContent)).toEqual(['7', '5']);
    fireEvent.click(loop());
    expect(loop()).toHaveAttribute('aria-pressed', 'false');
    expect(litFrets().map(t => t.textContent)).toEqual(['7', '5']);
    keys('l');
    expect(loop()).toHaveAttribute('aria-pressed', 'true');
    expect(litFrets()).toEqual([]);
  });
});
