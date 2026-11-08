/**
 * The lead sheet on the Tab page (issue #295, `docs/specs/2026-11-08-tab-lead-sheet-design.md`): the switch,
 * the link, Settings, presses and keys. The layout itself is in `../leadSheet.test.tsx`.
 */
import * as alphaTab from '@coderline/alphatab';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { partOf } from '@/features/tab/clip';
import { boxX, layoutLeadSheet, nameBaseline } from '@/features/tab/leadSheet';
import { pageClip, renderAt, setUpPage, SLOW } from './helpers';

setUpPage();

const G = '(3.1 0.2 0.3 0.4 2.5 3.6)';
const C = '(0.1 1.2 0.3 2.4 3.5)';
const TEXT = `\\title "Song"\n\\ts (4 4)\n\\chord ("G" 3 0 0 0 2 3)\n\\section "Verse" ${G}.2{ch "G"} ${C}.4{ch "C"} ${C}.4 | ${G}.1 | r.1 |`;
const LINK = `#tab=${encodeURIComponent(TEXT)}`;
/** The lead sheet as the page lays it out: 800 wide, as jsdom measures the card. */
const layout = () => {
  const read = readAlphaTexWith(alphaTab, TEXT);
  if (!read.ok) throw new Error('unread');
  return { part: partOf(read.clip), at: layoutLeadSheet(partOf(read.clip), 800) };
};
const showButton = (name: string) => within(screen.getByRole('group', { name: 'Show' })).getByRole('button', { name });
const saved = () => JSON.parse(localStorage.getItem('frets.tab.notation') ?? 'null') as { show?: string } | null;
const sheet = () => screen.getByRole('img', { name: /drawn as a lead sheet/ });
const editor = () => screen.getByRole('textbox', { name: /^Lead sheet/ });
const chordNames = () => screen.getAllByTestId('lead-chord').map(t => t.textContent);
const press = (x: number, y: number) => fireEvent.pointerDown(sheet(), { clientX: x, clientY: y });
/** A press on a beat of a bar: its time from the bar's start, as a fraction of the bar. */
const pressBeat = (bar: number, at: number) => {
  const { at: lead } = layout();
  const row = lead.rows.find(r => r.boxes.some(b => b.bar === bar))!;
  const box = row.boxes.find(b => b.bar === bar)!;
  press(boxX(box, box.span * at) + 1, row.boxBottom - 4);
};
/** A press on bar 1's first chord name. */
const pressFirstName = () => {
  const { at: lead } = layout();
  const row = lead.rows[0];
  press(row.boxes[0].chords[0].x + 4, nameBaseline(row) - 4);
};

async function open(show = 'lead') {
  renderAt(`?show=${show}${LINK}`);
  await screen.findAllByTestId(show === 'lead' ? 'lead-box' : 'tab-system', {}, SLOW);
}

describe('the switch and the link', () => {
  it('?show=lead draws the lead sheet, and saves nothing', async () => {
    await open();
    expect(showButton('Lead sheet')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryAllByTestId('tab-system')).toHaveLength(0);
    expect(screen.getAllByTestId('lead-box')).toHaveLength(3);
    // Bar 2 names C again, the chord still sounding; bar 3 is an empty box.
    expect(chordNames()).toEqual(['G', 'C', 'C']);
    expect(screen.getAllByTestId('lead-box')[2]).toHaveAttribute('data-silent', 'true');
    expect(saved()?.show ?? 'tab').toBe('tab');
  });

  it('has four choices; Lead sheet is saved, and Staff brings the staff back', async () => {
    await open('tab');
    const choices = within(screen.getByRole('group', { name: 'Show' })).getAllByRole('button').map(b => b.textContent);
    expect(choices).toEqual(['Staff', 'Tab', 'Both', 'Lead sheet']);
    fireEvent.click(showButton('Lead sheet'));
    expect(screen.getAllByTestId('lead-box')).toHaveLength(3);
    expect(saved()?.show).toBe('lead');
    fireEvent.click(showButton('Staff'));
    expect(screen.queryAllByTestId('lead-box')).toHaveLength(0);
    expect(screen.getAllByTestId('staff').length).toBeGreaterThan(0);
  });

  it('Settings › Tab › Notation lists Lead sheet, and OK shows it', async () => {
    await open('tab');
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const settings = within(screen.getByRole('dialog', { name: 'Settings' }));
    fireEvent.click(settings.getByRole('treeitem', { name: 'Notation' }));
    fireEvent.click(within(settings.getByRole('group', { name: 'Show' })).getByRole('button', { name: 'Lead sheet' }));
    fireEvent.click(settings.getByRole('button', { name: 'OK' }));
    expect(showButton('Lead sheet')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByTestId('lead-box')).toHaveLength(3);
  });

  it('View options leave out the clip’s line breaks and the chord diagrams', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: /View options/ }));
    const toggles = within(screen.getByRole('dialog', { name: 'View options' })).getAllByRole('switch').map(t => t.textContent);
    expect(toggles).toEqual(['Arrangement header', 'Tuning details', 'Chord chart']);
  });
});

describe('editing in the lead sheet', () => {
  it('a press in a box puts the caret on the beat’s column; Right moves it a column', async () => {
    await open();
    pressBeat(0, 0.8);
    act(() => editor().focus());
    const caret = () => screen.getByTestId('lead-caret');
    const { at: lead } = layout();
    const b0 = lead.rows[0].boxes[0];
    // Beat 4 is the last quarter's, three quarters in.
    expect(Number(caret().getAttribute('x1'))).toBeCloseTo(boxX(b0, b0.span * 0.75) - 3);
    fireEvent.keyDown(editor(), { key: 'ArrowRight' });
    expect(Number(caret().getAttribute('x1'))).toBeCloseTo(lead.rows[0].boxes[1].from - 3);
  });

  it('a press on a chord name picks it, blue; Delete takes it away', async () => {
    await open();
    pressFirstName();
    const name = screen.getAllByTestId('lead-chord')[0];
    expect(name).toHaveAttribute('fill', 'var(--select)');
    fireEvent.keyDown(editor(), { key: 'Delete' });
    await waitFor(() => expect(pageClip().tracks[0].bars[0].voices[0][0].chord).toBeUndefined());
    // Bar 1 now starts with no name; C still at beat 3.
    expect(chordNames()[0]).toBe('C');
  });

  it('Enter on a picked chord name opens the Chords panel at it', async () => {
    await open();
    pressFirstName();
    fireEvent.keyDown(editor(), { key: 'Enter' });
    expect(screen.getByRole('button', { name: 'Chords', pressed: true })).toBeInTheDocument();
  });

  it('C opens the chord name field at the caret, and a name typed goes there', async () => {
    await open();
    pressBeat(1, 0.1);
    act(() => editor().focus());
    fireEvent.keyDown(editor(), { key: 'c' });
    const field = screen.getByRole('textbox', { name: 'Chord name' });
    fireEvent.change(field, { target: { value: 'Em' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    await waitFor(() => expect(pageClip().tracks[0].bars[1].voices[0][0].chord).toBe('Em'));
  });

  it('digits, N and the palette change no note', async () => {
    await open();
    pressBeat(1, 0.1);
    act(() => editor().focus());
    const before = JSON.stringify(pageClip());
    fireEvent.keyDown(editor(), { key: '5' });
    fireEvent.keyDown(editor(), { key: 'n' });
    fireEvent.keyDown(document.body, { key: 'n' });
    fireEvent.keyDown(editor(), { key: 'Delete' });
    expect(JSON.stringify(pageClip())).toBe(before);
    expect(screen.getByRole('textbox', { name: /^Lead sheet/ })).toBeInTheDocument();
  });

  it('a press on a section picks it, and a double-click opens its field', async () => {
    await open();
    const { at: lead } = layout();
    const row = lead.rows[0];
    press(row.boxes[0].x0 + 4, row.sectionY! + 10);
    expect(screen.getByTestId('lead-section')).toHaveAttribute('fill', 'var(--select)');
    fireEvent.doubleClick(sheet(), { clientX: row.boxes[0].x0 + 4, clientY: row.sectionY! + 10 });
    expect(screen.getByRole('textbox', { name: 'Section' })).toHaveValue('Verse');
  });

  it('a right-click with nothing picked opens no menu', async () => {
    await open();
    pressBeat(1, 0.1);
    fireEvent.contextMenu(editor(), { clientX: 20, clientY: 20 });
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
