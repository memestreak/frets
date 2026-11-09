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

  it('has a channel field per track, Track N on channel N', async () => {
    stubMidi([]);
    const TWO = '\\title "Two"\n\\track "Gtr I"\n\\ts (4 4)\n5.3.1 |\n\\track "Gtr II"\n0.6.1 2.6.1 |\n';
    renderAt(`#tab=${encodeURIComponent(TWO)}`);
    await screen.findByRole('heading', { name: 'Two' }, SLOW);
    await openMidiSettings();
    const first = dialog().getByRole('spinbutton', { name: 'Track 1 channel' });
    const second = dialog().getByRole('spinbutton', { name: 'Track 2 channel' });
    expect(first).toHaveValue('1');
    expect(second).toHaveValue('2');
    fireEvent.keyDown(second, { key: 'ArrowUp' });
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
});
