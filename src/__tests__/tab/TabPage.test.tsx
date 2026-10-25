import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
const paste = (text: string) => {
  const event = new Event('paste', { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown };
  event.clipboardData = { getData: () => text };
  act(() => { document.body.dispatchEvent(event); });
};
const undo = (shift = false) => fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true, shiftKey: shift });

beforeEach(() => {
  localStorage.clear();
});

afterEach(cleanup);

describe('TabPage', () => {
  it('starts empty, saying how to bring tab in', () => {
    renderAt();
    expect(heading()).toHaveTextContent('Untitled clip');
    expect(notice()).toHaveTextContent('Import ASCII tab, or paste it here.');
  });

  it('imports the tab in an #ascii= link, then clears the link', () => {
    renderAt(`#ascii=${encodeURIComponent(OTHER)}`);
    expect(screen.getAllByTestId('tab-column')).toHaveLength(2);
    expect(window.location.hash).toBe('');
  });

  it('says why a link\'s tab could not be read and keeps the saved clip', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify((readAscii(RIFF) as { clip: unknown }).clip));
    renderAt(`#ascii=${encodeURIComponent('no tab here')}`);
    expect(heading()).toHaveTextContent('Riff');
    expect(notice()).not.toHaveTextContent(/^$/);
  });

  it('imports from the dialog, and shows errors there without closing', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Import…' }));
    const dialog = screen.getByRole('dialog');
    const text = within(dialog).getByRole('textbox', { name: 'ASCII tab' });
    fireEvent.change(text, { target: { value: 'e|-5-|\nB|-5-|' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Import' }));
    expect(within(dialog).getByTestId('import-errors')).toBeInTheDocument();
    fireEvent.change(text, { target: { value: RIFF } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Import' }));
    expect(heading()).toHaveTextContent('Riff');
    expect(dialog).not.toHaveAttribute('open');
  });

  it('imports pasted tab, and undo and redo step between clips', () => {
    renderAt();
    paste(RIFF);
    expect(heading()).toHaveTextContent('Riff');
    paste(OTHER);
    expect(heading()).toHaveTextContent('Untitled clip');
    undo();
    expect(heading()).toHaveTextContent('Riff');
    undo(true);
    expect(heading()).toHaveTextContent('Untitled clip');
  });

  it('says what a paste that is not tab got wrong, and keeps the clip', () => {
    renderAt();
    paste(RIFF);
    paste('just some words');
    expect(heading()).toHaveTextContent('Riff');
    expect(notice()).toHaveClass('text-(--danger)');
  });

  it('switches to the ASCII the writer produces', () => {
    renderAt(`#ascii=${encodeURIComponent(RIFF)}`);
    fireEvent.click(screen.getByRole('button', { name: 'ASCII' }));
    expect(screen.getByTestId('tab-ascii').textContent).toContain('Title: Riff');
    expect(screen.queryByTestId('tab-column')).toBeNull();
  });

  it('saves the clip and opens on it next time', () => {
    renderAt();
    paste(RIFF);
    cleanup();
    renderAt();
    expect(heading()).toHaveTextContent('Riff');
  });
});
