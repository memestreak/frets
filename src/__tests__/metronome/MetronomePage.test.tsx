import { act, fireEvent, render, screen, within } from '@testing-library/react';
import MetronomePage from '@/features/metronome/MetronomePage';
import { DISPLAY_KEY, RHYTHM_KEY } from '@/features/metronome/storage';

/** Enough of Web Audio for the page: every click it schedules is counted. */
let started = 0;
class FakeAudioContext {
  currentTime = 0;
  sampleRate = 44100;
  destination = {};
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
  createGain() { return { gain: { value: 1 }, connect: (n: unknown) => n }; }
  createBuffer(_c: number, length: number) { return { length, copyToChannel() {} }; }
  createBufferSource() { return { buffer: null, connect: (n: unknown) => n, start: () => { started += 1; } }; }
}

beforeEach(() => {
  started = 0;
  vi.stubGlobal('AudioContext', FakeAudioContext);
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

const beats = () => screen.getAllByRole('spinbutton', { name: 'Beats' })[0] as HTMLInputElement;

describe('MetronomePage', () => {
  it('shows the Readout at first, with 4 pads', () => {
    const { container } = render(<MetronomePage />);
    expect(screen.getByRole('slider', { name: 'Tempo' })).toHaveTextContent('120');
    expect(container.querySelectorAll('.metronome-pad')).toHaveLength(4);
  });

  it('shows the view saved in Settings', () => {
    localStorage.setItem(DISPLAY_KEY, JSON.stringify({ view: 'bar' }));
    render(<MetronomePage />);
    expect(screen.getAllByRole('button', { name: /^Beat \d step 1/ })).toHaveLength(4);
  });

  it('changes the view from the switch in its head, and saves it', () => {
    const { container } = render(<MetronomePage />);
    expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();
    const views = within(screen.getByRole('group', { name: 'View' }));
    expect(views.getByRole('button', { name: 'Readout' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(views.getByRole('button', { name: 'Pendulum' }));
    expect(container.querySelector('.metronome-pyramid')).not.toBeNull();
    expect(within(screen.getByRole('group', { name: 'View' })).getByRole('button', { name: 'Pendulum' })).toHaveAttribute('aria-pressed', 'true');
    expect(JSON.parse(localStorage.getItem(DISPLAY_KEY)!)).toEqual({ view: 'pendulum' });
  });

  it('keeps the rhythm when the view changes', () => {
    render(<MetronomePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Faster' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'View' })).getByRole('button', { name: 'Bar' }));
    expect(screen.getByRole('spinbutton', { name: 'Tempo' })).toHaveValue('121');
  });

  it('Start turns into Stop, and Space does the same', () => {
    vi.useFakeTimers();
    render(<MetronomePage />);
    const start = screen.getByRole('button', { name: 'Start' });
    expect(start).toHaveAttribute('data-tip', 'Start (Space)');
    fireEvent.click(start);
    expect(screen.getByRole('button', { name: 'Stop' })).toHaveAttribute('data-tip', 'Stop (Space)');
    expect(started).toBeGreaterThan(0);
    // No bar count or time while running (Jeremy, 2026-10-31).
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.queryByText(/^Bar \d/)).toBeNull();
    act(() => { fireEvent.keyDown(window, { key: ' ' }); });
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('a double-click on Beats puts back 4', () => {
    render(<MetronomePage />);
    fireEvent.change(beats(), { target: { value: '12' } });
    fireEvent.keyDown(beats(), { key: 'Enter' });
    expect(beats().value).toBe('12');
    fireEvent.doubleClick(screen.getAllByText('Beats')[0]);
    expect(beats().value).toBe('4');
  });

  it('T taps the tempo, but not while typing', () => {
    const now = vi.spyOn(performance, 'now');
    render(<MetronomePage />);
    for (const t of [0, 600, 1200]) {
      now.mockReturnValue(t);
      fireEvent.keyDown(window, { key: 't' });
    }
    expect(screen.getByRole('slider', { name: 'Tempo' })).toHaveTextContent('100');
    now.mockReturnValue(1500);
    fireEvent.keyDown(beats(), { key: 't' });
    expect(screen.getByRole('slider', { name: 'Tempo' })).toHaveTextContent('100');
    now.mockRestore();
  });

  it('saves the rhythm, and opens with it', () => {
    const first = render(<MetronomePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Faster' }));
    fireEvent.change(beats(), { target: { value: '6' } });
    fireEvent.keyDown(beats(), { key: 'Enter' });
    first.unmount();
    expect(JSON.parse(localStorage.getItem(RHYTHM_KEY)!).bpm).toBe(121);
    render(<MetronomePage />);
    expect(screen.getByRole('slider', { name: 'Tempo' })).toHaveTextContent('121');
    expect(beats().value).toBe('6');
  });

  it('keeps Advanced closed until it is opened', () => {
    render(<MetronomePage />);
    expect(screen.queryByRole('combobox', { name: 'Preset' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Preset' }), { target: { value: '2:3' } });
    expect(beats().value).toBe('7');
    expect(screen.getByRole('textbox', { name: 'Groups' })).toHaveValue('2+2+3');
  });

  it('a drag up on the big tempo speeds it up', () => {
    Element.prototype.setPointerCapture ??= () => {};
    render(<MetronomePage />);
    const tempo = screen.getByRole('slider', { name: 'Tempo' });
    fireEvent.pointerDown(tempo, { button: 0, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(tempo, { clientY: 84, pointerId: 1 });
    fireEvent.pointerUp(tempo, { pointerId: 1 });
    expect(tempo).toHaveTextContent('130');
  });

  it('the pendulum’s weight stays under the pointer: down is faster', () => {
    Element.prototype.setPointerCapture ??= () => {};
    localStorage.setItem(DISPLAY_KEY, JSON.stringify({ view: 'pendulum' }));
    const { container } = render(<MetronomePage />);
    const svg = container.querySelector('.metronome-pyramid')!;
    // Drawn at its own size: a pixel is a unit of the drawing.
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 220, height: 300 }) as DOMRect;
    const weight = screen.getByRole('slider', { name: 'Tempo' });
    const at120 = 56 + ((120 - 20) / 380) * 170;
    // Pressed 4 units below its middle, then moved 40 bpm's worth down the scale.
    fireEvent.pointerDown(weight, { button: 0, clientX: 110, clientY: at120 + 4, pointerId: 1 });
    fireEvent.pointerMove(weight, { clientX: 110, clientY: at120 + 4 + (40 / 380) * 170, pointerId: 1 });
    expect(weight).toHaveAttribute('aria-valuenow', '160');
    // Shift: to the bpm.
    fireEvent.pointerMove(weight, { clientX: 110, clientY: at120 + 4 + (43 / 380) * 170, shiftKey: true, pointerId: 1 });
    fireEvent.pointerUp(weight, { pointerId: 1 });
    expect(weight).toHaveAttribute('aria-valuenow', '163');
    expect(screen.getByRole('spinbutton', { name: 'Tempo' })).toHaveValue('163');
  });

  it('has no subdivision switch, and Advanced no second Beats field', () => {
    render(<MetronomePage />);
    expect(screen.queryByRole('group', { name: 'Clicks per beat' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    expect(screen.getAllByRole('spinbutton', { name: 'Beats' })).toHaveLength(1);
  });

  it('swing on plain quarters splits the beats, so it is heard', () => {
    render(<MetronomePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    const swing = screen.getByRole('spinbutton', { name: 'Swing' });
    fireEvent.change(swing, { target: { value: '60' } });
    fireEvent.keyDown(swing, { key: 'Enter' });
    expect(screen.getAllByRole('spinbutton', { name: /^Steps in beat/ }).map(s => s.getAttribute('aria-valuenow'))).toEqual(['2', '2', '2', '2']);
  });

  it('names the voices’ columns, and a double-click on a volume knob puts back 100%', () => {
    render(<MetronomePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    for (const name of ['Sound', 'Pitch', 'Volume']) expect(screen.getAllByText(name, { selector: '.metronome-col-name' }).length).toBeGreaterThan(0);
    const b = screen.getAllByRole('slider', { name: 'Voice B volume' })[0];
    expect(b).toHaveAttribute('aria-valuenow', '85');
    fireEvent.doubleClick(b);
    expect(b).toHaveAttribute('aria-valuenow', '100');
  });

  it('the polyrhythm: off and greyed at first, a switch turns it on, double-clicks put back 3 and 100%', () => {
    const { container } = render(<MetronomePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    const power = screen.getByRole('switch', { name: 'Polyrhythm' });
    const clicks = () => screen.getByRole('spinbutton', { name: 'Clicks' });
    expect(power).toHaveAttribute('aria-checked', 'false');
    expect(container.querySelector('.metronome-poly-body')).toHaveAttribute('data-off');
    expect(clicks()).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Polyrhythm sound' })).toBeDisabled();
    // Off, a double-click changes nothing.
    fireEvent.doubleClick(clicks());
    expect(clicks()).toHaveValue('3');

    fireEvent.click(power);
    expect(power).toHaveAttribute('aria-checked', 'true');
    expect(container.querySelector('.metronome-poly-body')).not.toHaveAttribute('data-off');
    fireEvent.change(clicks(), { target: { value: '7' } });
    fireEvent.keyDown(clicks(), { key: 'Enter' });
    expect(screen.getByText('across the bar (7 over 4)')).toBeInTheDocument();
    fireEvent.doubleClick(clicks());
    expect(clicks()).toHaveValue('3');

    const level = screen.getByRole('slider', { name: 'Polyrhythm volume' });
    expect(level).toHaveAttribute('aria-valuenow', '100');
    fireEvent.keyDown(level, { key: 'ArrowDown' });
    expect(level).toHaveAttribute('aria-valuenow', '95');
    fireEvent.doubleClick(level);
    expect(level).toHaveAttribute('aria-valuenow', '100');
  });
});
