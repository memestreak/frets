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

/** The clip's card with the rail and its open panel on its left. */
export function TabRail({ palette, children }: { palette: DrawPalette; children: ReactNode }) {
  const [open, setOpen] = useOpenPanel();
  const panel = PANELS.find(p => p.id === open);
  return (
    <div className="tab-rail-layout" data-open={panel ? '' : undefined}>
      <HoverTips>
        <nav className="tab-rail" aria-label="Panels">
          {PANELS.map(p => (
            <button
              key={p.id} type="button" className="tab-rail-button" aria-label={p.name} aria-pressed={open === p.id}
              data-tip={p.name}
              // Keep the focus, and so the cursor, on the tab.
              onMouseDown={e => e.preventDefault()}
              onClick={() => setOpen(open === p.id ? null : p.id)}
            >
              <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5}>
                {p.icon}
              </svg>
            </button>
          ))}
        </nav>
      </HoverTips>
      {panel && (
        <HoverTips>
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
        </HoverTips>
      )}
      <div className="tab-rail-clip">{children}</div>
    </div>
  );
}
