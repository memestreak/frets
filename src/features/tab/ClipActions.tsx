import { useRef, useState, type ReactNode } from 'react';
import { CheckIcon, CopyIcon, EyeIcon, LinkIcon, SaveIcon } from '@/components/icons';
import { ShapeMenu } from '@/components/chords/export/ShapeMenu';
import { copySvgAsPng, svgToPng } from '@/components/chords/export/exportImage';
import { writeAlphaTex } from './alphatex';
import { writeAscii } from './ascii';
import type { Clip } from './clip';
import { tabSvg, type TabExportStyle } from './exportTab';
import type { Parts } from './layout';
import type { Notice } from './notice';
import { SAVE_KINDS, saveFile, type SaveKind } from './saveFile';
import { shareLink } from './shareLink';
import type { TabView } from './viewOptions';
import type { View } from './views';
import { ViewOptions } from './ViewOptions';

/** How long after a press away closed a panel a click on its own button is that same press, not a new one. */
const PRESSED_AWAY_MS = 500;

/**
 * The buttons at the clip's top right, after the view switch: View options, copy, Copy link
 * (issue #206) and save (Jeremy, 2026-10-27/28). `buttons` go in the card's bar; `popups`, their panel and menu, go
 * outside the card, so the focus moving into them counts as leaving the tab.
 */
export function useClipActions({ clip, view, parts, shown, onShown, exportStyle, alphaTexText, shownText, onNotice }: {
  clip: Clip;
  view: View;
  parts: Parts;
  shown: TabView;
  onShown: (next: TabView) => void;
  exportStyle: TabExportStyle;
  /** The AlphaTex view's text, as typed. */
  alphaTexText: string;
  /** What the text view shown copies. */
  shownText: string;
  onNotice: (notice: Notice) => void;
}): { buttons: ReactNode; popups: ReactNode } {
  /** The View options panel, open under its button (its right edge at x). */
  const [viewPanelAt, setViewPanelAt] = useState<{ x: number; y: number } | null>(null);
  /** When a press away last closed it, so the press on its own button doesn't open it again. */
  const viewPanelPressedAway = useRef(0);
  /** The Notation view's save button's list of formats, open under it (its right edge at x). */
  const [saveMenu, setSaveMenu] = useState<{ x: number; y: number } | null>(null);
  /**
   * When a press outside last closed the list. A press on the save button while the list is open closes
   * it that way, before the button hears of it, and the click that follows must not open it again.
   */
  const saveMenuPressedAway = useRef(0);
  /** Whether the copy button shows its tick, briefly after a copy. */
  const [copied, setCopied] = useState(false);
  /** Whether the Copy link button shows its tick, briefly after a copy. */
  const [linked, setLinked] = useState(false);

  /** Shows a button's tick for a moment. */
  const tick = (set: (on: boolean) => void) => {
    set(true);
    window.setTimeout(() => set(false), 1500);
  };
  const showCopied = () => tick(setCopied);

  /** Copies a link that opens this clip, as a new arrangement played with this Sound and FX, for whoever follows it. */
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(await shareLink(window.location.origin, writeAlphaTex(clip)));
      onNotice({ tone: 'info', lines: ['Copied a link to this arrangement.'] });
      tick(setLinked);
    } catch {
      onNotice({ tone: 'error', lines: ['The browser didn\'t allow copying.'] });
    }
  };

  /** The picture as the Export dialog makes it, with its saved choices. */
  const picture = () => tabSvg(clip, exportStyle, clip.name, parts, shown);

  /** The ASCII and alphaTex views copy their text; the Notation view copies the picture as the Export dialog's PNG. */
  const copy = async () => {
    if (view === 'tab') {
      try {
        const line = await copySvgAsPng(picture());
        onNotice({ tone: 'info', lines: [`${line}.`] });
        showCopied();
      } catch (e) {
        onNotice({ tone: 'error', lines: [`Couldn't copy: ${e instanceof Error ? e.message : String(e)}`] });
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(shownText);
      onNotice({ tone: 'info', lines: ['Copied as text.'] });
      showCopied();
    } catch {
      onNotice({ tone: 'error', lines: ['The browser didn\'t allow copying.'] });
    }
  };
  const copyLabel = { tab: 'Copy as PNG', ascii: 'Copy as text', alphatex: 'Copy as text' }[view];

  /** Saves the clip in one format, through the browser's Save As dialog where it has one. */
  const save = (kind: SaveKind, make: () => Blob | Promise<Blob>) => {
    saveFile(clip.name.trim() || 'tab', kind, make).then(
      line => { if (line) onNotice({ tone: 'info', lines: [line] }); },
      (e: unknown) => onNotice({ tone: 'error', lines: [`Couldn't save: ${e instanceof Error ? e.message : String(e)}`] }),
    );
  };
  const asText = (text: string) => new Blob([text], { type: 'text/plain' });
  const saveFormats = [
    { label: 'PNG image…', onSelect: () => save(SAVE_KINDS.png, () => svgToPng(picture())) },
    { label: 'SVG image…', onSelect: () => save(SAVE_KINDS.svg, () => new Blob([picture()], { type: 'image/svg+xml' })) },
    { label: 'ASCII tab…', onSelect: () => save(SAVE_KINDS.ascii, () => asText(writeAscii(clip, { rhythm: shown.asciiRhythm }))) },
    { label: 'alphaTex…', onSelect: () => save(SAVE_KINDS.alphatex, () => asText(writeAlphaTex(clip))) },
  ];
  /** In Notation the save button lists the formats; the ASCII Tab view saves its text, and the AlphaTex view its text as typed. */
  const saveLabel = { tab: 'Save as…', ascii: 'Save as text file', alphatex: 'Save as alphaTex file' }[view];

  const buttons = (
    <>
      {/* Every view has the View options, each view's in its own group (Jeremy, 2026-10-28). */}
      <button
        type="button" className="btn btn-secondary btn-icon" aria-label="View options" title="View options"
        aria-haspopup="dialog" aria-expanded={viewPanelAt !== null}
        onMouseDown={e => e.preventDefault()}
        onClick={e => {
          if (Date.now() - viewPanelPressedAway.current < PRESSED_AWAY_MS) return;
          const r = e.currentTarget.getBoundingClientRect();
          setViewPanelAt({ x: r.right, y: r.bottom + 4 });
        }}
      >
        <EyeIcon />
      </button>
      <button
        type="button" className="btn btn-secondary btn-icon"
        aria-label={copyLabel} title={copyLabel} onClick={() => void copy()}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
      <button
        type="button" className="btn btn-secondary btn-icon"
        aria-label="Copy link" title="Copy link" onClick={() => void copyLink()}
      >
        {linked ? <CheckIcon /> : <LinkIcon />}
      </button>
      <button
        type="button" className="btn btn-secondary btn-icon" aria-label={saveLabel} title={saveLabel}
        aria-haspopup={view === 'tab' ? 'menu' : undefined} aria-expanded={view === 'tab' ? saveMenu !== null : undefined}
        // Pressed, it leaves the focus (and the cursor) on the tab.
        onMouseDown={e => e.preventDefault()}
        onClick={e => {
          if (view === 'ascii') return save(SAVE_KINDS.ascii, () => asText(writeAscii(clip, { rhythm: shown.asciiRhythm })));
          if (view === 'alphatex') return save(SAVE_KINDS.alphatex, () => asText(alphaTexText));
          const r = e.currentTarget.getBoundingClientRect();
          if (Date.now() - saveMenuPressedAway.current < PRESSED_AWAY_MS) return;
          setSaveMenu({ x: r.right, y: r.bottom + 4 });
        }}
      >
        <SaveIcon />
      </button>
    </>
  );

  const popups = (
    <>
      {saveMenu && (
        <ShapeMenu
          x={saveMenu.x} y={saveMenu.y} align="end" label="Save as"
          onClose={refocus => {
            if (!refocus) saveMenuPressedAway.current = Date.now();
            setSaveMenu(null);
          }}
          items={saveFormats}
        />
      )}
      {viewPanelAt && (
        <ViewOptions
          x={viewPanelAt.x} y={viewPanelAt.y} values={shown} onChange={onShown}
          onClose={pressedAway => {
            if (pressedAway) viewPanelPressedAway.current = Date.now();
            setViewPanelAt(null);
          }}
        />
      )}
    </>
  );

  return { buttons, popups };
}
