/**
 * The FX button (issue #199; Jeremy, 2026-10-28): FX opens the dialog of each effect's switch and
 * settings, and the light switch on its right turns every effect on or off together.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { DEFAULT_FX, type FxSettings } from '@/features/tab/effects';
import { FxButton } from '@/features/tab/FxButton';

/** The button with its settings held, as the page holds them; `seen` records each change. */
function Held({ start, seen }: { start: FxSettings; seen: FxSettings[] }) {
  const [fx, setFx] = useState(start);
  return <FxButton fx={fx} onFx={next => { seen.push(next); setFx(next); }} />;
}

const allSwitch = () => screen.getByRole('switch', { name: 'All effects' });

describe('the FX button', () => {
  it('turns every effect on and off from its light switch, without opening the dialog', () => {
    const seen: FxSettings[] = [];
    render(<Held start={DEFAULT_FX} seen={seen} />);
    expect(allSwitch().getAttribute('aria-checked')).toBe('false');
    fireEvent.click(allSwitch());
    expect(allSwitch().getAttribute('aria-checked')).toBe('true');
    expect(seen.at(-1)).toEqual({ ...DEFAULT_FX, on: true });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(allSwitch());
    expect(seen.at(-1)!.on).toBe(false);
  });

  it('opens the dialog from FX, with each effect switched on and off on its own', () => {
    const seen: FxSettings[] = [];
    render(<Held start={{ ...DEFAULT_FX, on: true }} seen={seen} />);
    fireEvent.click(screen.getByRole('button', { name: 'FX' }));
    const dialog = screen.getByRole('dialog', { name: 'Effects' });
    for (const name of ['Drive', 'Tone', 'Amount']) expect(screen.getByRole('slider', { name })).toBeTruthy();
    expect(screen.getByRole('spinbutton', { name: 'Decay (seconds)' })).toBeTruthy();
    fireEvent.click(screen.getByRole('switch', { name: 'Distortion' }));
    expect(seen.at(-1)).toMatchObject({ on: true, distortionOn: false, reverbOn: true });
    fireEvent.click(screen.getByRole('switch', { name: 'Reverb' }));
    expect(seen.at(-1)).toMatchObject({ on: true, distortionOn: false, reverbOn: false });
    expect(dialog.isConnected).toBe(true);
  });

  it('turns the light switch on when an effect is switched on while it is off', () => {
    const seen: FxSettings[] = [];
    render(<Held start={{ ...DEFAULT_FX, on: false, reverbOn: false }} seen={seen} />);
    fireEvent.click(screen.getByRole('button', { name: 'FX' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Reverb' }));
    expect(seen.at(-1)).toMatchObject({ on: true, reverbOn: true });
    expect(allSwitch().getAttribute('aria-checked')).toBe('true');
    // Switching one off leaves the light switch as it is.
    fireEvent.click(screen.getByRole('switch', { name: 'Distortion' }));
    expect(seen.at(-1)).toMatchObject({ on: true, distortionOn: false });
  });
});
