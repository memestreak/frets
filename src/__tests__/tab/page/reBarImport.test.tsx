/**
 * Re-bar by time signature on the page (`docs/specs/2026-11-14-tab-rebar-import-design.md`): the Import
 * dialog's checkbox (Tab › Import, on by default), a drop following it, and a paste into an empty clip.
 */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { writeBars } from '@/features/tab/alphatex';
import { partOf } from '@/features/tab/clip';
import { IMPORT_KEY, parseImportPrefs } from '@/features/tab/importPrefs';
import { setUpPage, renderAt, notice, paste, SLOW, pageClip } from './helpers';

setUpPage();

const SHORT = '\\title "Short"\n\\ts (4 4)\n5.1.4 5.1.4 5.1.4 | 7.1.4 7.1.4 7.1.4 7.1.4 |';
const bars = () => writeBars(partOf(pageClip())).join(' ');

function importText(text: string, reBar?: boolean) {
  fireEvent.click(screen.getByRole('button', { name: 'Import…' }));
  const dialog = screen.getByRole('dialog');
  const box = within(dialog).getByRole('checkbox', { name: 'Re-bar by time signature' });
  if (reBar !== undefined && (box.getAttribute('aria-checked') === 'true') !== reBar) fireEvent.click(box);
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Tab, as alphaTex or ASCII' }), { target: { value: text } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Import' }));
  return dialog;
}

describe('Re-bar by time signature', () => {
  it('is a Preference, on when nothing is saved', () => {
    expect(parseImportPrefs(null)).toEqual({ reBar: true });
    expect(parseImportPrefs({ reBar: 'yes' })).toEqual({ reBar: true });
    expect(parseImportPrefs({ reBar: false })).toEqual({ reBar: false });
  });

  it('on (the default), Import lays the notes into full bars and lists the miss', async () => {
    renderAt();
    const dialog = importText(SHORT);
    expect(within(dialog).getByRole('checkbox', { name: 'Re-bar by time signature' })).toHaveAttribute('aria-checked', 'true');
    await screen.findByRole('heading', { name: 'Short' }, SLOW);
    expect(bars()).toBe('5.1.4 5.1.4 5.1.4 7.1.4 | 7.1.4 7.1.4 7.1.4 r.4 |');
    expect(notice()).toHaveTextContent('Source bar lines miss a downbeat at bar 2 (1 beat early).');
  });

  it('off, Import keeps the bars as written, and the checkbox saves Tab › Import', async () => {
    renderAt();
    importText(SHORT, false);
    await screen.findByRole('heading', { name: 'Short' }, SLOW);
    expect(JSON.parse(localStorage.getItem(IMPORT_KEY)!)).toEqual({ reBar: false });
    expect(bars()).toBe('5.1.4 5.1.4 5.1.4 | 7.1.4 7.1.4 7.1.4 7.1.4 |');
    expect(notice()).toHaveTextContent("doesn't add up");
  });

  it('a tuplet a bar line would cross keeps the dialog open with why', async () => {
    renderAt();
    const dialog = importText('\\ts (4 4)\n5.1.2 5.1.4 | 5.1.4{tu 3} 5.1.4{tu 3} 5.1.4{tu 3} 7.1.2 |');
    expect(await within(dialog).findByTestId('import-errors', {}, SLOW)).toHaveTextContent(
      "Can't re-bar: the tuplet in source bar 2 would cross a bar line. Turn off Re-bar by time signature to import it as written.");
    expect(dialog).toHaveAttribute('open');
  });

  it('a drop follows the Preference', async () => {
    localStorage.setItem(IMPORT_KEY, JSON.stringify({ reBar: false }));
    renderAt();
    const drop = new Event('drop', { bubbles: true, cancelable: true }) as Event & { dataTransfer: unknown };
    drop.dataTransfer = { files: [], getData: () => SHORT };
    await act(async () => { document.body.dispatchEvent(drop); });
    await screen.findByRole('heading', { name: 'Short' }, SLOW);
    expect(bars()).toBe('5.1.4 5.1.4 5.1.4 | 7.1.4 7.1.4 7.1.4 7.1.4 |');
  });

  it('a copy from beat 2 pasted into an empty clip lands on beat 2, with nothing listed', async () => {
    renderAt();
    await paste('\\ts (4 4)\n5.1.4 5.1.4 5.1.4 | 7.1.4 7.1.4 |');
    await waitFor(() => expect(bars()).toBe('r.4 5.1.4 5.1.4 5.1.4 | 7.1.4 7.1.4 r.2 |'), SLOW);
    expect(notice()).not.toHaveTextContent('miss a downbeat');
  });

  it('an uneven tab pasted into an empty clip keeps its section and lists its misses', async () => {
    renderAt();
    await paste('\\ts (4 4)\n5.1.1 | 5.1.4 5.1.4 5.1.4 5.1.8{d} | \\section "Chorus" 7.1.1 | 9.1.1 |');
    await waitFor(() => expect(pageClip().masterBars[2].section?.text).toBe('Chorus'), SLOW);
    expect(notice()).toHaveTextContent('Source bar lines miss a downbeat at bars 3–4 (a 16th early).');
  });
});
