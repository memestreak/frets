/**
 * `show_tab`, the Tab page's MCP tool and app (#340, `docs/specs/2026-11-04-show-tab-mcp-app-design.md`):
 * the JSON both ways, the checks, the server's answers, and the app in a stand-in host.
 */
import * as alphaTab from '@coderline/alphatab';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from '@modelcontextprotocol/ext-apps';
import { AppBridge } from '@modelcontextprotocol/ext-apps/app-bridge';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { readAlphaTexWith } from '@/features/tab/alphatexRead';
import { builtinsFrom, SAMPLES_FOLDER } from '@/features/tab/builtins';
import { readBuiltinFiles } from '@/features/tab/builtinFiles';
import { STANDARD_TUNING, partOf, type Bar, type Column, type Note, type Part } from '@/features/tab/clip';
import { APP_INFO, REPORT_DELAY_MS, TabApp } from '@/features/tab/mcp/TabApp';
import { describeLine, describeLoop, lineFromInput, lineOf, loopOf, noteMidi } from '@/features/tab/mcp/lineJson';
import { APP_URI, TOOL_NAME } from '@/features/tab/mcp/tool';
import { layoutClip, stringY } from '@/features/tab/layout';
import { readLink } from '@/features/tab/shareLink';
import { choosePlace } from '@/features/tab/staffEntry';
import { createFretsServer } from '@/mcp/server';

/** A column of eighths, quarters…, with these notes. */
const col = (value: number, notes: Record<string, unknown>[] = [], extra: Record<string, unknown> = {}) => ({ duration: { value }, notes, ...extra });
/** A 4/4 bar of four quarters, the first with these notes, the rest open high e. */
const bar = (notes: Record<string, unknown>[]) => ({ columns: [col(4, notes), col(4, [{ string: 1, fret: 0 }]), col(4, [{ string: 1, fret: 0 }]), col(4, [{ string: 1, fret: 0 }])] });

function made(raw: unknown) {
  const result = lineFromInput(raw);
  if (!result.ok) throw new Error(result.error);
  return result;
}
const error = (raw: unknown) => {
  const result = lineFromInput(raw);
  return result.ok ? null : result.error;
};

describe('the JSON as a clip', () => {
  it('numbers strings as guitarists do: 1 is the high e, the clip’s slot 0, and 6 the low E, slot 5', () => {
    const { part } = made({ bars: [{ columns: [col(1, [{ string: 1, fret: 3 }, { string: 6, fret: 5 }])] }] });
    const notes = part.bars[0].columns[0].notes;
    expect(notes[0]).toEqual({ fret: 3 });
    expect(notes[5]).toEqual({ fret: 5 });
    expect(notes.slice(1, 5)).toEqual([null, null, null, null]);
  });

  it('makes an empty notes a rest', () => {
    const { part } = made({ bars: [{ columns: [col(2), col(2, [{ string: 2, fret: 1 }])] }] });
    expect(part.bars[0].columns[0].notes.every(n => n === null)).toBe(true);
  });

  it('places a pitch as staff entry does, and gives it back on its string and fret', () => {
    const { part, line } = made({ bars: [{ columns: [col(2, [{ string: 5, fret: 0 }]), col(2, [{ pitch: 'A3' }])] }] });
    const before: Part = { ...part, bars: [{ ...part.bars[0], columns: [part.bars[0].columns[0], { ...part.bars[0].columns[1], notes: Array(6).fill(null) }] }] };
    const place = choosePlace(before, { bar: 0, column: 1 }, 57)!;
    expect(part.bars[0].columns[1].notes[place.string]).toEqual({ fret: place.fret });
    expect(line.bars[0].columns[1].notes).toEqual([{ string: place.string + 1, fret: place.fret }]);
    expect(JSON.stringify(line)).not.toContain('pitch');
  });

  it('reads note names with octaves and accidentals', () => {
    expect([noteMidi('E2'), noteMidi('F#3'), noteMidi('Bb2'), noteMidi('C♯4'), noteMidi('Cb4'), noteMidi('H2')]).toEqual([40, 54, 46, 61, 59, null]);
  });

  it('keeps the bpm, time, capo, chord names and the articulations it takes', () => {
    const { part } = made({
      bpm: 90, time: [3, 4], capo: 2,
      bars: [{ columns: [
        col(4, [{ string: 3, fret: 2 }], { chord: 'Am' }),
        col(4, [{ string: 3, fret: 4, legato: 'h' }]),
        col(4, [{ string: 3, fret: 4, tie: true, bend: { quarters: 4, release: true }, vibrato: 'wide' }]),
      ] }],
    });
    expect(part).toMatchObject({ time: { beats: 3, value: 4 }, capo: 2, tuning: STANDARD_TUNING });
    expect(part.bars[0].tempo).toEqual({ bpm: 90 });
    const [a, b, c] = part.bars[0].columns;
    expect(a.chord).toBe('Am');
    expect(b.notes[2]).toEqual({ fret: 4, legato: 'h' });
    expect(c.notes[2]).toEqual({ fret: 4, tie: true, bend: { quarters: 4, pre: false, release: true }, vibrato: 'wide' });
  });

  it('draws both when view is left out, else the one asked for', () => {
    const line = { bars: [bar([{ string: 1, fret: 0 }])] };
    expect(made(line).view).toBe('both');
    expect(made({ ...line, view: 'staff' }).view).toBe('staff');
    expect(made({ ...line, view: 'tab' }).view).toBe('tab');
  });

  it('describes the line in one line', () => {
    expect(describeLine(made({ bars: [bar([]), bar([])] }).part)).toBe('2 bars in 4/4 at 120 bpm');
    expect(describeLine(made({ bpm: 90, time: [3, 4], bars: [{ columns: [col(2), col(4)] }] }).part)).toBe('1 bar in 3/4 at 90 bpm');
  });
});

describe('the checks', () => {
  it('refuses a note given both ways, and one given neither way', () => {
    expect(error({ bars: [bar([{ string: 2, fret: 1, pitch: 'C4' }])] })).toBe('Bar 1, column 1: give a note string and fret, or pitch, not both.');
    expect(error({ bars: [bar([{ string: 2 }])] })).toBe('Bar 1, column 1: a note needs string and fret, or pitch.');
  });

  it('refuses a bar that doesn’t add up, naming it', () => {
    const full = bar([{ string: 1, fret: 0 }]);
    const over = { columns: [...full.columns, col(8, [{ string: 1, fret: 0 }])] };
    expect(error({ bars: [full, over] })).toBe('Bar 2 is an 8th over 4/4.');
    expect(error({ bars: [{ columns: [col(4, [{ string: 1, fret: 0 }])] }] })).toBe('Bar 1 is 3 beats short of 4/4.');
  });

  it('refuses frets and strings out of range, with where they are', () => {
    expect(error({ bars: [bar([{ string: 2, fret: 25 }])] })).toMatch(/^Bar 1, column 1, note 1, fret: /);
    expect(error({ bars: [bar([{ string: 0, fret: 1 }])] })).toMatch(/^Bar 1, column 1, note 1, string: /);
    expect(error({ bars: [bar([{ string: 7, fret: 1 }])] })).toMatch(/^Bar 1, column 1, note 1, string: /);
  });

  it('refuses two notes on one string', () => {
    expect(error({ bars: [bar([{ string: 2, fret: 1 }, { string: 2, fret: 3 }])] })).toBe('Bar 1, column 1: two notes on string 2.');
  });

  it('refuses a pitch no free string plays, below the low E or the capo', () => {
    expect(error({ bars: [bar([{ pitch: 'D2' }])] })).toMatch(/^Bar 1, column 1: no free string plays D2 in standard tuning/);
    expect(error({ capo: 3, bars: [bar([{ pitch: 'F2' }])] })).toMatch(/no free string plays F2 in standard tuning with the capo at fret 3/);
    expect(error({ bars: [bar([{ pitch: 'E2' }])] })).toBeNull();
    expect(error({ bars: [bar([{ pitch: 'Q4' }])] })).toBe('Bar 1, column 1: "Q4" isn\'t a note such as E4, F#3 or Bb2.');
  });

  it('refuses a hammer-on, pull-off, slide or tie with no earlier note on its string', () => {
    expect(error({ bars: [bar([{ string: 3, fret: 4, legato: 'h' }])] })).toBe('Bar 1, column 1: the hammer-on on string 3 has no earlier note on that string.');
    expect(error({ bars: [bar([{ string: 3, fret: 4, slide: 'legato' }])] })).toMatch(/the slide on string 3 has no earlier note/);
    expect(error({ bars: [bar([{ string: 3, fret: 4, slide: 'below' }])] })).toBeNull();
    const tied = { columns: [col(2, [{ string: 3, fret: 2 }]), col(2, [{ string: 3, fret: 4, tie: true }])] };
    expect(error({ bars: [tied] })).toBe('Bar 1, column 2: the tie on string 3 is at fret 4, but the note it holds on from is at fret 2.');
  });

  it('refuses a time signature Frets doesn’t draw', () => {
    expect(error({ time: [4, 3], bars: [bar([])] })).toMatch(/^4\/3 isn't a time signature Frets draws/);
  });
});

/** A part cut to what `show_tab` takes, in standard tuning: what the round trip should give back. */
function cut(part: Part): Part {
  const note = (n: Note): Note => {
    const out: Note = { fret: n.fret };
    if (n.legato) out.legato = n.legato;
    if (n.slide) out.slide = n.slide;
    if (n.bend) out.bend = { quarters: n.bend.quarters, pre: n.bend.pre, release: n.bend.release };
    if (n.vibrato) out.vibrato = n.vibrato;
    if (n.tie) out.tie = true;
    return out;
  };
  const column = (c: Column): Column => {
    const out: Column = { duration: { value: c.duration.value, dots: c.duration.dots }, notes: c.notes.map(n => (n ? note(n) : null)) };
    if (c.duration.tuplet) out.duration.tuplet = c.duration.tuplet;
    if (c.chord) out.chord = c.chord;
    return out;
  };
  const out: Part = { name: '', time: part.time, tuning: [...STANDARD_TUNING], bars: part.bars.map((b, i): Bar => {
    const bar: Bar = { columns: b.columns.map(column) };
    if (i === 0 && b.tempo) bar.tempo = { bpm: b.tempo.bpm };
    return bar;
  }) };
  if (part.capo) out.capo = part.capo;
  return out;
}

/** What show_tab can't carry: 64ths, tuplets but triplets, grace notes, time changes, bends it has no height for. */
function fitsShowTab(part: Part): boolean {
  return part.bars.every(b => (!b.time || (b.time.beats === part.time.beats && b.time.value === part.time.value))
    && b.columns.every(c => !c.grace && c.duration.value <= 32 && (!c.duration.tuplet || (c.duration.tuplet === 3 && !c.duration.tupletSpan))
      && c.notes.every(n => !n?.bend || [1, 2, 4, 6, 8].includes(n.bend.quarters))));
}

const builtins = builtinsFrom(await readBuiltinFiles()).filter(b => b.folder !== SAMPLES_FOLDER);

describe('the round trip', () => {
  const parts = builtins.flatMap(b => {
    const read = readAlphaTexWith(alphaTab, b.text);
    return read.ok ? [[`${b.folder}/${b.id}`, partOf(read.clip, 0)] as const] : [];
  });
  const fitting = parts.filter(([, p]) => fitsShowTab(p));

  it('has built-in arrangements to try', () => {
    expect(fitting.length).toBeGreaterThan(10);
  });

  it.each(fitting)('%s, cut to show_tab’s fields, goes clip to JSON to clip unchanged', (_, part) => {
    const want = cut(part);
    const back = lineFromInput(JSON.parse(JSON.stringify(lineOf(want))));
    if (!back.ok) throw new Error(back.error);
    expect(back.part).toEqual(want);
  });
});

async function connectedClient() {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createFretsServer({ metronome: '<p>metronome</p>', tab: '<p>tab</p>', tuner: '<p>tuner</p>' }).connect(serverSide);
  const client = new Client({ name: 'test', version: '1' });
  await client.connect(clientSide);
  return client;
}

describe('the loop points', () => {
  /** Three bars of four quarters: columns 0–3, 4–7 and 8–11 across the line. */
  const three = { bars: [bar([]), bar([]), bar([])] };
  const loopOn = (loop: unknown) => made({ ...three, loop }).loop;

  it('has none when the call sets none', () => {
    expect(made(three).loop).toBeNull();
  });

  it('counts bars and columns from 1, as the model does, and fills in what is left out', () => {
    expect(loopOn({})).toEqual([0, 11]);
    expect(loopOn({ start: { bar: 2 } })).toEqual([4, 11]);
    expect(loopOn({ end: { bar: 2 } })).toEqual([0, 7]);
    expect(loopOn({ start: { bar: 2, column: 3 }, end: { bar: 3, column: 1 } })).toEqual([6, 8]);
    expect(loopOn({ start: { bar: 2 }, end: { bar: 2 } })).toEqual([4, 7]);
  });

  it('refuses a bar or column the line hasn’t got, and a start after the end', () => {
    expect(error({ ...three, loop: { start: { bar: 4 } } })).toBe('Loop start: there is no bar 4; the line has 3.');
    expect(error({ ...three, loop: { end: { bar: 2, column: 5 } } })).toBe('Loop end: bar 2 has 4 columns.');
    expect(error({ ...three, loop: { start: { bar: 3 }, end: { bar: 1 } } })).toBe('Loop: the start comes after the end.');
    expect(error({ ...three, loop: { start: { bar: 0 } } })).toMatch(/^loop, start, bar: /);
  });

  it('gives the points back in the call’s shape, a column only where it isn’t the bar’s edge', () => {
    const { part } = made(three);
    expect(loopOf(part, [0, 11])).toEqual({ start: { bar: 1 }, end: { bar: 3 } });
    expect(loopOf(part, [6, 8])).toEqual({ start: { bar: 2, column: 3 }, end: { bar: 3, column: 1 } });
    expect(made({ ...three, loop: loopOf(part, [6, 8]) }).loop).toEqual([6, 8]);
  });

  it('says them in words', () => {
    const { part } = made(three);
    expect(describeLoop(part, [0, 11])).toBe('the whole line');
    expect(describeLoop(part, [4, 7])).toBe('bar 2');
    expect(describeLoop(part, [4, 11])).toBe('bars 2 to 3');
    expect(describeLoop(part, [4, 8])).toBe('bar 2 to bar 3, column 1');
  });
});

describe('the server', () => {
  it('lists show_tab with its app, its whole definition under 1,500 tokens', async () => {
    const { tools } = await (await connectedClient()).listTools();
    const tool = tools.find(t => t.name === TOOL_NAME)!;
    expect(tool._meta).toMatchObject({ ui: { resourceUri: APP_URI } });
    expect(tool.annotations).toMatchObject({ readOnlyHint: true });
    // Counted as characters / 3.5: past it, `bars` goes untyped and tab_format arrives (the spec's "What every chat pays").
    expect(JSON.stringify(tool).length / 3.5).toBeLessThan(1500);
  });

  it('serves the app as an MCP App resource', async () => {
    const { contents } = await (await connectedClient()).readResource({ uri: APP_URI });
    expect(contents[0]).toMatchObject({ uri: APP_URI, mimeType: 'text/html;profile=mcp-app', text: '<p>tab</p>' });
  });

  it('answers with a line and a link that opens the same clip on the Tab page', async () => {
    const args = { bpm: 90, view: 'tab', bars: [bar([{ string: 5, fret: 0 }]), bar([{ pitch: 'C4' }])] };
    const result = await (await connectedClient()).callTool({ name: TOOL_NAME, arguments: args });
    expect(result.isError).toBeFalsy();
    const text = (result.content as { text: string }[])[0].text;
    expect(text).toMatch(/^Shown: 2 bars in 4\/4 at 90 bpm, as tab only\. Open in Frets: https:\/\/frets\.eminor\.net\/tab\?show=tab#tabz=/);
    const link = text.slice(text.indexOf('https://'));
    const opened = await readLink(new URL(link).hash);
    if (typeof opened !== 'string') throw new Error('the link holds no tab');
    const read = readAlphaTexWith(alphaTab, opened);
    if (!read.ok) throw new Error(read.errors.join('\n'));
    const { part } = made(args);
    expect(cut(partOf(read.clip, 0))).toEqual(cut(part));
    expect(result.structuredContent).toEqual({ line: lineOf(part), view: 'tab' });
  });

  it('names the loop points in its answer, and hands them to the app', async () => {
    const args = { bars: [bar([]), bar([])], loop: { start: { bar: 2 } } };
    const result = await (await connectedClient()).callTool({ name: TOOL_NAME, arguments: args });
    expect((result.content as { text: string }[])[0].text).toMatch(/^Shown: 2 bars in 4\/4 at 120 bpm, as staff over tab, loop points on bar 2\. Open in Frets: /);
    expect(result.structuredContent).toMatchObject({ loop: { start: { bar: 2 }, end: { bar: 2 } } });
  });

  it('says what is wrong with a call it can’t make', async () => {
    const result = await (await connectedClient()).callTool({ name: TOOL_NAME, arguments: { bars: [{ columns: [col(4, [{ string: 1, fret: 0 }])] }] } });
    expect(result.isError).toBe(true);
    expect((result.content as { text: string }[])[0].text).toContain('Bar 1 is 3 beats short of 4/4.');
  });
});

/* The app in a stand-in host, joined by an in-memory pipe in place of postMessage. */

vi.mock('@/features/tab/playback', async importOriginal => {
  const real = await importOriginal<typeof import('@/features/tab/playback')>();
  /** A player that plays nothing (every method does nothing), counting how often it is let go and where each Play starts. */
  const FakePlayer = {
    destroyed: 0,
    from: [] as number[],
    async create() {
      const play = (_clip: unknown, from: number) => {
        FakePlayer.from.push(from);
        return Promise.resolve();
      };
      return new Proxy({ destroy: () => { FakePlayer.destroyed += 1; }, play } as Record<string, unknown>, {
        // Not a promise itself: `then` stays undefined.
        get: (target, key) => (key === 'then' ? undefined : target[key as string] ?? (() => Promise.resolve())),
      });
    },
  };
  return { ...real, TabPlayer: FakePlayer };
});

async function mountApp() {
  const [appSide, hostSide] = InMemoryTransport.createLinkedPair();
  const told: string[] = [];
  const context: unknown[] = [];
  const opened: string[] = [];
  const bridge = new AppBridge(null, { name: 'host', version: '1' }, { updateModelContext: { text: {} }, openLinks: {} }, {
    hostContext: { theme: 'dark' },
  });
  bridge.onupdatemodelcontext = async params => {
    told.push((params.content?.[0] as { text: string }).text);
    context.push(params.structuredContent);
    return {};
  };
  bridge.onopenlink = async ({ url }) => {
    opened.push(url);
    return {};
  };
  const initialized = new Promise<void>(resolve => {
    bridge.oninitialized = () => resolve();
  });
  await bridge.connect(hostSide);
  const app = new App(APP_INFO, {}, { autoResize: false });
  const realConnect = app.connect.bind(app);
  app.connect = () => realConnect(appSide);
  render(<TabApp app={app} />);
  await act(() => initialized);
  return { bridge, told, context, opened };
}

const LINE = { bpm: 90, bars: [bar([{ string: 5, fret: 0 }])] };

describe('the app', () => {
  it('shows the call’s line, in the view it asked for, and switches', async () => {
    const { bridge } = await mountApp();
    await act(() => bridge.sendToolInput({ arguments: { ...LINE, view: 'tab' } }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tab' })).toHaveAttribute('aria-pressed', 'true'));
    expect(screen.getByRole('spinbutton', { name: 'Tempo (bpm)' })).toHaveValue('90');
    act(() => screen.getByRole('button', { name: 'Staff' }).click());
    expect(screen.getByRole('button', { name: 'Staff' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Tab' })).toHaveAttribute('aria-pressed', 'false');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.length).toBe(0);
  });

  it('tells the model the bpm and loop the user changes, once they stop, and not what the call gave', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { bridge, told } = await mountApp();
      await act(() => bridge.sendToolInput({ arguments: LINE }));
      await act(async () => { await vi.advanceTimersByTimeAsync(REPORT_DELAY_MS * 2); });
      expect(told).toEqual([]);
      for (let i = 0; i < 2; i++) act(() => screen.getByRole('button', { name: 'Faster' }).click());
      act(() => screen.getByRole('button', { name: 'Loop' }).click());
      await act(async () => { await vi.advanceTimersByTimeAsync(REPORT_DELAY_MS * 2); });
      expect(told).toEqual(['The user is now playing the line at 100 bpm, looping the whole line.']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('starts with the call’s loop points without telling the model, and L takes them away and puts the bracket over the whole line', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { bridge, told, context } = await mountApp();
      await act(() => bridge.sendToolInput({ arguments: { ...LINE, bars: [...LINE.bars, bar([])], loop: { start: { bar: 2 } } } }));
      const loop = await screen.findByRole('button', { name: 'Loop' });
      await waitFor(() => expect(loop).toHaveAttribute('aria-pressed', 'true'));
      await act(async () => { await vi.advanceTimersByTimeAsync(REPORT_DELAY_MS * 2); });
      expect(told).toEqual([]);
      act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l' })); });
      expect(loop).toHaveAttribute('aria-pressed', 'false');
      await act(async () => { await vi.advanceTimersByTimeAsync(REPORT_DELAY_MS * 2); });
      expect(told).toEqual(['The user is now playing the line at 90 bpm, not looping.']);
      expect(context.at(-1)).toEqual({ bpm: 90, loop: null });
      act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l' })); });
      expect(loop).toHaveAttribute('aria-pressed', 'true');
      await act(async () => { await vi.advanceTimersByTimeAsync(REPORT_DELAY_MS * 2); });
      expect(told.at(-1)).toBe('The user is now playing the line at 90 bpm, looping the whole line.');
      expect(context.at(-1)).toEqual({ bpm: 90, loop: { start: { bar: 1 }, end: { bar: 2 } } });
    } finally {
      vi.useRealTimers();
    }
  });

  it('leaves L alone while the bpm is being typed', async () => {
    const { bridge } = await mountApp();
    await act(() => bridge.sendToolInput({ arguments: LINE }));
    const field = await screen.findByRole('spinbutton', { name: 'Tempo (bpm)' });
    act(() => { field.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', bubbles: true })); });
    expect(screen.getByRole('button', { name: 'Loop' })).toHaveAttribute('aria-pressed', 'false');
  });

  /** Taps at these times, in milliseconds, by `press` (one tap each). */
  function tapAt(times: number[], press: () => void) {
    const now = vi.spyOn(performance, 'now');
    try {
      for (const t of times) {
        now.mockReturnValue(t);
        act(press);
      }
    } finally {
      now.mockRestore();
    }
  }
  const tapButton = () => screen.getByRole('button', { name: 'Tap tempo' });
  const pressTap = () => { tapButton().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })); };
  const pressT = () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 't' })); };

  it('sets the bpm from two taps or more, and tells the model', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const { bridge, told } = await mountApp();
      await act(() => bridge.sendToolInput({ arguments: LINE }));
      const field = await screen.findByRole('spinbutton', { name: 'Tempo (bpm)' });
      tapAt([1000], pressTap);
      expect(field).toHaveValue('90');
      tapAt([1500, 2000], pressTap);
      expect(field).toHaveValue('120');
      await act(async () => { await vi.advanceTimersByTimeAsync(REPORT_DELAY_MS * 2); });
      expect(told).toEqual(['The user is now playing the line at 120 bpm, not looping.']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('flashes Tap on each press, as the Metronome’s Tap does', async () => {
    const { bridge } = await mountApp();
    await act(() => bridge.sendToolInput({ arguments: LINE }));
    await screen.findByRole('button', { name: 'Tap tempo' });
    expect(tapButton()).toHaveClass('tap-press');
    expect(tapButton().querySelector('.tap-pulse')).toBeNull();
    tapAt([1000], pressTap);
    const first = tapButton().querySelector('.tap-pulse');
    expect(first).not.toBeNull();
    tapAt([1500], pressTap);
    // A fresh flash each time, so its fade starts over.
    expect(tapButton().querySelector('.tap-pulse')).not.toBe(first);
  });

  it('has one Tap, the field\'s "bpm" (reading "Tap" on hover), and the percentage under the field', async () => {
    const { bridge } = await mountApp();
    await act(() => bridge.sendToolInput({ arguments: LINE }));
    const group = await screen.findByRole('group', { name: 'Tempo' });
    expect(screen.getAllByRole('button', { name: 'Tap tempo' })).toHaveLength(1);
    expect(within(group).getByRole('button', { name: 'Tap tempo' })).toHaveTextContent('bpmTap');
    expect(within(group).getByText(/^Speed ·/)).toHaveTextContent('Speed · 100%');
    tapAt([1000, 1500], pressTap);
    // 120 bpm on a line at 90.
    expect(within(group).getByText(/^Speed ·/)).toHaveTextContent('Speed · 133%');
    fireEvent.doubleClick(within(group).getByText(/^Speed ·/));
    expect(within(group).getByRole('spinbutton', { name: 'Tempo (bpm)' })).toHaveValue('90');
  });

  it('taps on T too, but not while the bpm is being typed', async () => {
    const { bridge } = await mountApp();
    await act(() => bridge.sendToolInput({ arguments: LINE }));
    const field = await screen.findByRole('spinbutton', { name: 'Tempo (bpm)' });
    tapAt([1000, 1600], pressT);
    expect(field).toHaveValue('100');
    tapAt([5000, 5500], () => { field.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true })); });
    expect(field).toHaveValue('100');
  });

  it('reaches every tempo Frets writes, 20 to 400 bpm, whatever the line’s own, from Tap and the field', async () => {
    const { bridge } = await mountApp();
    await act(() => bridge.sendToolInput({ arguments: LINE }));
    const field = await screen.findByRole('spinbutton', { name: 'Tempo (bpm)' });
    expect(field).toHaveAttribute('aria-valuemin', '20');
    expect(field).toHaveAttribute('aria-valuemax', '400');
    // 300 bpm tapped, well past 1.5 times the line's 90, is kept.
    tapAt([1000, 1200, 1400], pressTap);
    expect(field).toHaveValue('300');
    // 600 bpm tapped stops at 400.
    tapAt([6000, 6100, 6200], pressTap);
    expect(field).toHaveValue('400');
    // 21 bpm tapped, under a quarter of 90, is kept.
    tapAt([12000, 14857], pressTap);
    expect(field).toHaveValue('21');
  });

  it('opens the line on the Tab page through the host', async () => {
    const { bridge, opened } = await mountApp();
    await act(() => bridge.sendToolInput({ arguments: LINE }));
    const open = await screen.findByRole('button', { name: 'Open in Frets' });
    await waitFor(() => expect(open).toBeEnabled());
    await act(async () => open.click());
    await waitFor(() => expect(opened).toHaveLength(1));
    // In the view the app shows: both, as the call left it out.
    expect(opened[0]).toMatch(/^https:\/\/frets\.eminor\.net\/tab\?show=both#tabz=/);
    // Switched to the staff, the link opens the staff view.
    act(() => screen.getByRole('button', { name: 'Staff' }).click());
    await waitFor(async () => {
      await act(async () => open.click());
      expect(opened.at(-1)).toMatch(/^https:\/\/frets\.eminor\.net\/tab\?show=staff#tabz=/);
    });
  });

  it('lets the player go when the host takes it away', async () => {
    const { TabPlayer } = await import('@/features/tab/playback');
    const fake = TabPlayer as unknown as { destroyed: number };
    const { bridge } = await mountApp();
    await act(() => bridge.sendToolInput({ arguments: LINE }));
    await act(async () => screen.getByRole('button', { name: 'Play' }).click());
    const before = fake.destroyed;
    await act(() => bridge.teardownResource({}));
    expect(screen.queryByRole('button', { name: /Play|Stop/ })).toBeNull();
    await waitFor(() => expect(fake.destroyed).toBe(before + 1));
  });
});

/** Three bars of quarters on the high e, frets 1 to 12, so each column's fret names it (counted from 1). */
const TWELVE = { bpm: 90, bars: [0, 1, 2].map(b => ({ columns: [1, 2, 3, 4].map(k => col(4, [{ string: 1, fret: 4 * b + k }])) })) };

describe('selecting in the app, to loop', () => {
  /** Where column `index` (from 0, across the line) is drawn on the high e, as jsdom draws it: 800 wide at 0, 0. */
  function spot(index: number, string = 0) {
    for (const system of layoutClip(made(TWELVE).part, 800, 'tab').systems) {
      for (const b of system.bars) {
        const placed = b.columns.find(c => c.index === index);
        if (placed) return { clientX: placed.x, clientY: system.top + stringY(system.rows, string) };
      }
    }
    throw new Error(`No column ${index}`);
  }
  const svg = () => screen.getByRole('img', { name: /drawn as/ });
  function press(at: { clientX: number; clientY: number }, shiftKey = false) {
    fireEvent.pointerDown(svg(), { ...at, button: 0, shiftKey });
    fireEvent.pointerUp(svg(), { ...at, button: 0, shiftKey });
  }
  /** The selected frets, in order: each names its column. */
  const selected = () => [...document.querySelectorAll('[data-testid="tab-system"] text[fill="var(--select)"]')].map(t => Number(t.textContent));
  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, k) => from + k);
  const loop = () => screen.getByRole('button', { name: 'Loop' });
  const pressL = () => act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l' })); });

  async function open() {
    const mounted = await mountApp();
    await act(() => mounted.bridge.sendToolInput({ arguments: { ...TWELVE, view: 'tab' } }));
    await screen.findByRole('img', { name: /drawn as/ });
    return mounted;
  }

  it('selects the column pressed; Shift grows the selection to a press outside it, and trims the nearer end inside it', async () => {
    await open();
    press(spot(3));
    expect(selected()).toEqual([4]);
    press(spot(7), true);
    expect(selected()).toEqual(range(4, 8));
    press(spot(1), true);
    expect(selected()).toEqual(range(2, 8));
    // Inside, nearer the end: the end comes to the press.
    press(spot(5), true);
    expect(selected()).toEqual(range(2, 6));
    // Nearer the start: the start does.
    press(spot(2), true);
    expect(selected()).toEqual(range(3, 6));
    // A plain press starts over.
    press(spot(10));
    expect(selected()).toEqual([11]);
  });

  it('selects the whole bar for a press beside the notes, as the Tab page does; with Shift, grows to the column', async () => {
    await open();
    // A blank string in bar 2.
    press(spot(5, 3));
    expect(selected()).toEqual(range(5, 8));
    press(spot(1, 3), true);
    expect(selected()).toEqual(range(2, 8));
    // A note, then a blank string in another bar.
    press(spot(9));
    expect(selected()).toEqual([10]);
    press(spot(0, 4));
    expect(selected()).toEqual(range(1, 4));
  });

  it('lets the selection go on Esc, on a press off the notes, and for a new line', async () => {
    const { bridge } = await open();
    press(spot(3));
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(selected()).toEqual([]);
    press(spot(3));
    // Well below the tab: a press on nothing.
    press({ clientX: spot(3).clientX, clientY: 2000 });
    expect(selected()).toEqual([]);
    press(spot(3));
    fireEvent.pointerDown(document.body);
    expect(selected()).toEqual([]);
    press(spot(3));
    await act(() => bridge.sendToolInput({ arguments: { ...TWELVE, bpm: 100, view: 'tab' } }));
    await waitFor(() => expect(screen.getByRole('spinbutton', { name: 'Tempo (bpm)' })).toHaveValue('100'));
    expect(selected()).toEqual([]);
  });

  it('the Loop button with notes selected loops them, lets the selection go, and the model hears the points', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { told, context } = await open();
      press(spot(2));
      press(spot(5), true);
      expect(loop()).toHaveAttribute('data-tip', 'Loop the selected notes (L)');
      fireEvent.click(loop());
      expect(loop()).toHaveAttribute('aria-pressed', 'true');
      expect(selected()).toEqual([]);
      await act(async () => { await vi.advanceTimersByTimeAsync(REPORT_DELAY_MS * 2); });
      expect(told).toEqual(['The user is now playing the line at 90 bpm, looping bar 1, column 3 to bar 2, column 2.']);
      expect(context.at(-1)).toEqual({ bpm: 90, loop: { start: { bar: 1, column: 3 }, end: { bar: 2, column: 2 } } });
    } finally {
      vi.useRealTimers();
    }
  });

  it('L does the same; on the loop’s own columns, selected again, it clears them; with nothing selected, as before', async () => {
    await open();
    press(spot(4));
    press(spot(7), true);
    pressL();
    expect(loop()).toHaveAttribute('aria-pressed', 'true');
    expect(selected()).toEqual([]);
    press(spot(4));
    press(spot(7), true);
    expect(loop()).toHaveAttribute('data-tip', 'Clear the loop points (L)');
    pressL();
    expect(loop()).toHaveAttribute('aria-pressed', 'false');
    expect(selected()).toEqual([]);
    // Nothing selected: the bracket over the whole line, then off.
    pressL();
    expect(loop()).toHaveAttribute('aria-pressed', 'true');
    pressL();
    expect(loop()).toHaveAttribute('aria-pressed', 'false');
  });

  it('Play starts at the selection, else at the loop points’ start, else at the line’s', async () => {
    const { TabPlayer } = await import('@/features/tab/playback');
    const fake = TabPlayer as unknown as { from: number[] };
    await open();
    /** Presses Play (and Stop, if it plays) and gives the column the player was asked to start from. */
    const play = async () => {
      const before = fake.from.length;
      await act(async () => screen.getByRole('button', { name: /^(Play|Loading the sound…)$/ }).click());
      await waitFor(() => expect(fake.from.length).toBe(before + 1));
      const stop = screen.queryByRole('button', { name: 'Stop' });
      if (stop) await act(async () => stop.click());
      return fake.from.at(-1);
    };
    expect(await play()).toBe(0);
    press(spot(6));
    expect(await play()).toBe(6);
    press(spot(9), true);
    pressL();
    expect(await play()).toBe(6);
  });
});
