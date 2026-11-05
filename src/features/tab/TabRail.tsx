'use client';

/**
 * The Tab page's tools in a rail of panels on the left, as Dorico has them
 * (`docs/specs/2026-11-02-tab-rail-design.md`, issue #301). Each rail button opens its panel beside the
 * clip, and pressing it again closes it. The rail and panel grow into the page's left margin, so the clip
 * keeps its right edge. Which panel is open is kept across visits (`frets.tab.layout`), but it is
 * not a preference, so Settings doesn't list it.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { HoverTips } from '@/components/HoverTips';
import { ICONS } from './TabPalette';

/** Draws the palette with only `groups`; `className` sets its look; the note input pencil first when `input`. */
export type DrawPalette = (groups: readonly string[], className?: string, input?: boolean) => ReactNode;

export type PanelId = 'notes' | 'articulations' | 'bars';

/** The rail's panels, in order, and the palette groups each holds. */
export const PANELS: readonly { id: PanelId; name: string; icon: ReactNode; groups: readonly string[]; input?: boolean }[] = [
  { id: 'notes', name: 'Notes', icon: ICONS.quarter, groups: ['Duration', 'Rhythm'], input: true },
  { id: 'articulations', name: 'Articulations', icon: ICONS.accent, groups: ['Joins', 'Bends', 'Techniques', 'Accents'] },
  { id: 'bars', name: 'Bars', icon: ICONS.repeatStart, groups: ['Bars', 'Text'] },
];

export const LAYOUT_KEY = 'frets.tab.layout';
/** A first visit opens Notes. */
const FIRST_PANEL: PanelId = 'notes';

/** The panel `frets.tab.layout` keeps open: one of the panels, or null when all are closed. */
export function parseLayout(text: string | null): PanelId | null {
  try {
    const saved: unknown = JSON.parse(text ?? 'null');
    if (saved && typeof saved === 'object' && 'panel' in saved) {
      const { panel } = saved;
      if (panel === null) return null;
      if (PANELS.some(p => p.id === panel)) return panel as PanelId;
    }
  } catch {
    // Unreadable: as on a first visit.
  }
  return FIRST_PANEL;
}

/** The open panel, kept across visits; read after the first render, since the server has no storage. */
function useOpenPanel(): [PanelId | null, (id: PanelId | null) => void] {
  const [open, setOpen] = useState<PanelId | null>(FIRST_PANEL);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the kept panel exists only in the browser.
  useEffect(() => setOpen(parseLayout(localStorage.getItem(LAYOUT_KEY))), []);
  const choose = (id: PanelId | null) => {
    setOpen(id);
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify({ panel: id }));
    } catch {
      // Not kept: it still opens now.
    }
  };
  return [open, choose];
}

/**
 * MOCK (issue #251, `?mock=a|b|c`): the Chords panel, opened from its own rail button or a chord name's
 * Edit. a: in the tools' place, one panel at a time; b: under the open tool panel; c: right of the clip.
 */
export interface RailChords {
  layout: 'a' | 'b' | 'c';
  icon: ReactNode;
  open: boolean;
  onOpen: (open: boolean) => void;
  panel: ReactNode;
}

/** The clip's card with the rail and its open panel on its left. */
export function TabRail({ palette, chords, children }: { palette: DrawPalette; chords?: RailChords; children: ReactNode }) {
  const [openTool, setOpen] = useOpenPanel();
  // In a, the Chords panel takes the tools' place while it is open.
  const chordsHere = chords?.open && chords.layout === 'a';
  const open = chordsHere ? null : openTool;
  const panel = PANELS.find(p => p.id === open);
  const chordsLeft = chords?.open && chords.layout !== 'c';
  const chordsAside = chords?.open && (
    <aside className="tab-rail-panel chord-panel-aside" aria-label="Chords">
      <div className="tab-rail-panel-head">
        <h2 className="tab-rail-panel-title">Chords</h2>
        <button
          type="button" className="tab-rail-close" aria-label="Close Chords" data-tip="Close"
          onMouseDown={e => e.preventDefault()} onClick={() => chords.onOpen(false)}
        >
          <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d={chords.layout === 'c' ? 'M6 3.5L10.5 8 6 12.5' : 'M10 3.5L5.5 8l4.5 4.5'} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {chords.panel}
    </aside>
  );
  return (
    <div
      className="tab-rail-layout" data-open={panel || chordsLeft ? '' : undefined}
      data-chords={chords?.open ? chords.layout : undefined}
    >
      <HoverTips className="tab-rail-column">
        <nav className="tab-rail" aria-label="Panels">
          {PANELS.map(p => (
            <button
              key={p.id} type="button" className="tab-rail-button" aria-label={p.name} aria-pressed={open === p.id}
              data-tip={p.name}
              // Keep the focus, and so the cursor, on the tab.
              onMouseDown={e => e.preventDefault()}
              onClick={() => {
                if (chordsHere) chords.onOpen(false);
                setOpen(open === p.id ? null : p.id);
              }}
            >
              <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5}>
                {p.icon}
              </svg>
            </button>
          ))}
          {chords && (
            <button
              type="button" className="tab-rail-button" aria-label="Chords" aria-pressed={chords.open} data-tip="Chords"
              onMouseDown={e => e.preventDefault()} onClick={() => chords.onOpen(!chords.open)}
            >
              <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5}>
                {chords.icon}
              </svg>
            </button>
          )}
        </nav>
      </HoverTips>
      {(panel || chordsLeft) && (
        <HoverTips className="tab-rail-column chord-rail-column">
          {panel && (
          <aside className="tab-rail-panel" aria-label={panel.name}>
            <div className="tab-rail-panel-head">
              <h2 className="tab-rail-panel-title">{panel.name}</h2>
              <button
                type="button" className="tab-rail-close" aria-label={`Close ${panel.name}`} data-tip="Close"
                onMouseDown={e => e.preventDefault()} onClick={() => setOpen(null)}
              >
                {/* A chevron pointing back to the rail. */}
                <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path d="M10 3.5L5.5 8l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            {palette(panel.groups, 'tab-rail-tools', panel.input)}
          </aside>
          )}
          {chordsLeft && chordsAside}
        </HoverTips>
      )}
      <div className="tab-rail-clip">{children}</div>
      {chords?.open && chords.layout === 'c' && <HoverTips className="tab-rail-column">{chordsAside}</HoverTips>}
    </div>
  );
}
