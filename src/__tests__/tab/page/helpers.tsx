/*
 * What the Tab page's tests share: rendering the page, reading what it shows, and the clips they open.
 * Each test file calls `setUpPage()` once.
 */
import { vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import TabPage from '@/features/tab/TabPage';
import { LetGoAfterUse } from '@/components/LetGoAfterUse';
// Loaded before any test, as the original single file did: the page loads alphaTab lazily, and a first load
// in the middle of a test never finishes under jsdom.
import '@coderline/alphatab';
import { arrangementKey, DRAFT_KEY, LIBRARY_KEY, loadLibrary } from '@/features/tab/arrangements';
import { BUILTIN_URL, builtinsFrom } from '@/features/tab/builtins';
import { readBuiltinFiles } from '@/features/tab/builtinFiles';
import { type Clip } from '@/features/tab/clip';
import { tool } from '../tool';

export const RIFF = [
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

export const OTHER = [
  'e|--3---3---|',
  'B|--3---3---|',
  'G|--0---0---|',
  'D|--0---0---|',
  'A|--2---2---|',
  'E|--3---3---|',
].join('\n');

// The built-in arrangements, served as the route serves them.
export const BUILTIN_FILES = await readBuiltinFiles();
export const exampleById = (id: string) => builtinsFrom(BUILTIN_FILES).find(b => b.id === id);

/** Renders the page at /tab plus `hash`. */
export function renderAt(hash = '') {
  window.history.replaceState(null, '', `/tab${hash}`);
  // As in the app, where `AppShell` mounts it on every page.
  return render(<><LetGoAfterUse /><TabPage /></>);
}

export const heading = () => screen.getByRole('heading', { level: 1 });
/** The AlphaTex view's text box, and the text in it. */
export const alphaTexBox = () => screen.getByRole('textbox', { name: 'alphaTex' }) as HTMLTextAreaElement;
export const alphaTexText = () => alphaTexBox().value;
export const notice = () => screen.getByTestId('tab-notice');
export const paste = async (text: string) => {
  const event = new Event('paste', { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown };
  event.clipboardData = { getData: () => text };
  await act(async () => { document.body.dispatchEvent(event); });
};
/** How long an import may take; alphaTab's first load is slow on a busy test machine. */
export const SLOW = { timeout: 5000 };
/** Lets an import finish: reading is async, and alphaTex loads alphaTab first. */
export const settle = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });
export const TEX = '\\title "Tex riff"\n:8 5.5{h} 7.5 5.4{h} 7.4 |';
export const FX_LINE = '// frets:fx on; distortion on drive=0.9 tone=0.2; reverb on amount=0.6 decay=3';
export const undo = (shift = false) => fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true, shiftKey: shift });

/** Keeps `clip` as the open arrangement, as if it had been written on an earlier visit. */
export function keepOpen(clip: unknown) {
  localStorage.setItem(arrangementKey('kept'), JSON.stringify(clip));
  localStorage.setItem(LIBRARY_KEY, JSON.stringify({ open: 'kept', items: [{ id: 'kept', name: (clip as { name: string }).name, changed: 1 }] }));
}
/** The open clip as the page keeps it: the draft while it has unsaved changes or was never saved, else as saved. */
export const pageClip = () => {
  const draft = localStorage.getItem(DRAFT_KEY);
  return (draft ? JSON.parse(draft).clip : JSON.parse(localStorage.getItem(arrangementKey(loadLibrary().open!))!)) as Clip;
};
/** A double click, as a browser sends it: two clicks, the second counted as the second. */
export const doubleClick = (el: Element) => {
  fireEvent.click(el, { detail: 1 });
  fireEvent.click(el, { detail: 2 });
};



/** A press on the time signature drawn in front of the first line (jsdom places the drawing at 0, 0). */
export function pressFirstTimeSignature() {
  const svg = screen.getByRole('img', { name: /drawn as tab/ });
  // The numbers are centred 13 units in, round the middle of a staff that starts 30 down.
  fireEvent.pointerDown(svg, { clientX: 13, clientY: 65 });
}

/** The fret numbers drawn selected (in the selection colour): a selection lights its notes, with no band. */
export const litFrets = () => [...document.querySelectorAll('[data-testid="tab-system"] text[fill="var(--select)"]')];
/** Whether a drawn thing is in the selection's blue (issue #276): a picked word, bar line or mark. */
export const isLit = (el: Element) => el.getAttribute('stroke') === 'var(--select)' || el.getAttribute('fill') === 'var(--select)'
  || el.getAttribute('data-selected') === 'true';


/** Each test starts on an empty page, with nothing saved; built-ins are served as the route serves them. */
export function setUpPage() {
  // Nothing else is fetched.
  vi.stubGlobal('fetch', vi.fn(async (url: unknown) => {
    if (String(url) !== BUILTIN_URL) throw new Error(`Not fetched in tests: ${String(url)}`);
    return new Response(JSON.stringify(BUILTIN_FILES));
  }));
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });
}

/* — the editor — */
export const editor = () => screen.getByRole('textbox', { name: /Tab editor/ });
export const vibrato = () => tool(/^Vibrato/);
export const keys = (...list: (string | { key: string; shiftKey?: boolean; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; code?: string })[]) => {
  for (const k of list) fireEvent.keyDown(editor(), typeof k === 'string' ? { key: k } : k);
};
export const alphaTex = () => {
  fireEvent.click(screen.getByRole('button', { name: 'AlphaTex' }));
  const text = alphaTexText();
  fireEvent.click(screen.getByRole('button', { name: 'Notation' }));
  // The editor went away with the Tab view; back on it, the keys go to the tab again, the cursor where it was.
  act(() => editor().focus());
  // One bar per line, as the writer wraps several to a line: the header lines go, then each "|" ends a bar.
  const body = text.split('\n').filter(l => l.includes('|') || !/^\\(title|ts|tuning|capo) /.test(l)).join(' ');
  return (body.match(/[^|]*\|/g) ?? []).map(b => b.trim().replace(/\s+/g, ' ')).join('\n');
};
