/*
 * Settings › Tab › MIDI output and the footer's ⚠ (issue #457; `docs/specs/2026-11-09-tab-midi-out-design.md`),
 * with Web MIDI stood in for: jsdom has none.
 */
import { vi } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { MIDI_KEY } from '@/features/tab/midiOut';
import { forgetMidiAccess } from '@/features/tab/useMidiOutput';
import { setUpPage, renderAt, SLOW } from './helpers';

setUpPage();

/** Web MIDI with these outputs, by name. */
function stubMidi(names: string[]) {
  const outputs = new Map(names.map((name, i) => [`id${i}`, { id: `id${i}`, name, state: 'connected', send: vi.fn() }]));
  const midi = { outputs, inputs: new Map(), addEventListener: vi.fn(), removeEventListener: vi.fn() };
  Object.defineProperty(navigator, 'requestMIDIAccess', { configurable: true, value: vi.fn(() => Promise.resolve(midi)) });
}

afterEach(() => {
  forgetMidiAccess();
  delete (navigator as { requestMIDIAccess?: unknown }).requestMIDIAccess;
});

const dialog = () => within(screen.getByRole('dialog', { name: 'Settings' }));
const openMidiSettings = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  fireEvent.click(dialog().getByRole('treeitem', { name: 'MIDI output' }));
  await act(async () => { await Promise.resolve(); });
};
const portList = () => dialog().getByRole('combobox', { name: 'Port' }) as HTMLSelectElement;
const builtIn = () => dialog().getByRole('checkbox', { name: 'Also play the built-in sound' });

describe('Settings › Tab › MIDI output', () => {
  it('lists None and the browser\'s outputs; the built-in sound is usable only with a port', async () => {
    stubMidi(['IAC Driver Bus 1', 'Network Session']);
    renderAt();
    await openMidiSettings();
    expect([...portList().options].map(o => o.text)).toEqual(['None', 'IAC Driver Bus 1', 'Network Session']);
    expect(portList().value).toBe('');
    expect(builtIn()).toBeDisabled();
    fireEvent.change(portList(), { target: { value: 'IAC Driver Bus 1' } });
    expect(builtIn()).toBeEnabled();
    fireEvent.click(dialog().getByRole('button', { name: 'OK' }));
    expect(JSON.parse(localStorage.getItem(MIDI_KEY)!)).toEqual({ port: 'IAC Driver Bus 1', builtIn: false, channels: [] });
  });

  it('keeps a saved port that is gone, marked not found', async () => {
    stubMidi(['Network Session']);
    localStorage.setItem(MIDI_KEY, JSON.stringify({ port: 'IAC Driver Bus 1' }));
    renderAt();
    await openMidiSettings();
    expect([...portList().options].map(o => o.text)).toEqual(['None', 'IAC Driver Bus 1 (not found)', 'Network Session']);
    expect(portList().value).toBe('IAC Driver Bus 1');
  });

  it('has a channel field for each of Tracks 1 to 4, Track N on channel N, whatever the arrangement', async () => {
    stubMidi([]);
    renderAt();
    await openMidiSettings();
    const table = within(dialog().getByRole('table'));
    expect(table.getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Track', 'Channel']);
    expect(table.getAllByRole('rowheader').map(h => h.textContent)).toEqual(['1', '2', '3', '4']);
    const fields = dialog().getAllByRole('spinbutton', { name: /^Track \d channel$/ });
    expect(fields.map(f => f.getAttribute('aria-label'))).toEqual(['Track 1 channel', 'Track 2 channel', 'Track 3 channel', 'Track 4 channel']);
    expect(fields.map(f => (f as HTMLInputElement).value)).toEqual(['1', '2', '3', '4']);
    expect(dialog().queryByRole('spinbutton', { name: 'Track 5 channel' })).toBeNull();
    fireEvent.keyDown(fields[1], { key: 'ArrowUp' });
    fireEvent.click(dialog().getByRole('button', { name: 'OK' }));
    expect(JSON.parse(localStorage.getItem(MIDI_KEY)!).channels).toEqual([1, 3]);
  });

  it('says so where the browser has no Web MIDI', async () => {
    renderAt();
    await openMidiSettings();
    expect(dialog().getByText('This browser has no Web MIDI.')).toBeInTheDocument();
  });
});

describe('the footer\'s MIDI ⚠', () => {
  const warning = () => screen.queryByRole('img', { name: /MIDI output/ });

  it('is not there with no port picked', async () => {
    stubMidi([]);
    renderAt();
    await act(async () => { await Promise.resolve(); });
    expect(warning()).toBeNull();
  });

  it('is not there when the picked port is found', async () => {
    stubMidi(['IAC Driver Bus 1']);
    localStorage.setItem(MIDI_KEY, JSON.stringify({ port: 'IAC Driver Bus 1' }));
    renderAt();
    await act(async () => { await Promise.resolve(); });
    expect(warning()).toBeNull();
  });

  it('shows when the picked port is gone, and its tip says the built-in sound plays', async () => {
    stubMidi(['Network Session']);
    localStorage.setItem(MIDI_KEY, JSON.stringify({ port: 'IAC Driver Bus 1' }));
    renderAt();
    await act(async () => { await Promise.resolve(); });
    expect(warning()).toHaveAttribute('data-tip', expect.stringMatching(/“IAC Driver Bus 1”.*isn’t connected.*built-in sound plays instead/));
  });

  it('shows on a track past Track 4, saying it plays the built-in sound', async () => {
    stubMidi(['IAC Driver Bus 1']);
    localStorage.setItem(MIDI_KEY, JSON.stringify({ port: 'IAC Driver Bus 1' }));
    const FIVE = '\\title "Five"\n\\ts (4 4)\n' + [1, 2, 3, 4, 5].map(n => `\\track "T${n}"\n0.6.1 |\n`).join('');
    renderAt(`#tab=${encodeURIComponent(FIVE)}`);
    await screen.findByRole('heading', { name: 'Five' }, SLOW);
    await act(async () => { await Promise.resolve(); });
    const overMidi = () => screen.queryByRole('img', { name: /over MIDI/ });
    expect(overMidi()).toBeNull();
    fireEvent.change(screen.getByRole('combobox', { name: 'Track' }), { target: { value: '4' } });
    expect(overMidi()).toHaveAttribute('data-tip', 'Only Tracks 1 to 4 go out over MIDI. Track 5 plays the built-in sound.');
  });
});
