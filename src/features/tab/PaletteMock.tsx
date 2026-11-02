'use client';

/**
 * MOCK, not for merging (issue #301): the Tab page's tools in a rail of panels on the left, as Dorico
 * has them, behind `?rail=a|b` while Jeremy picks the look. His answers so far (2026-11-02): every tool
 * group is in the rail and nothing is over the clip; four panels, Notes, Articulations, Bars and
 * Chords; the open panel sits beside the clip, which narrows; the open panel is kept across visits
 * but not listed in Settings; no keys open the panels; under 900px the rail is a row over the clip.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { HoverTips } from '@/components/HoverTips';
import { useMock, type Mock } from '@/components/mocks/useMock';
import { ICONS } from './TabPalette';

export const RAIL_MOCK: Mock = {
  param: 'rail',
  label: 'Rail',
  options: [
    // The page as it ships: every group over the clip.
    { value: 'off', label: 'Today' },
    { value: 'a', label: 'a Card' },
    { value: 'b', label: 'b Sidebar' },
  ],
};

export function useRailMock(): string {
  return useMock(RAIL_MOCK);
}

/** Draws the palette with only `groups`; `className` sets its look; the note input pencil first when `input`. */
export type DrawPalette = (groups: readonly string[], className?: string, input?: boolean) => ReactNode;

type PanelId = 'notes' | 'articulations' | 'bars' | 'chords';

/** The rail's panels, in order, and the palette groups each holds (Q2). */
const PANELS: readonly { id: PanelId; name: string; icon: ReactNode; groups?: readonly string[]; input?: boolean }[] = [
  { id: 'notes', name: 'Notes', icon: ICONS.quarter, groups: ['Duration', 'Rhythm'], input: true },
  { id: 'articulations', name: 'Articulations', icon: ICONS.accent, groups: ['Joins', 'Bends', 'Techniques', 'Accents'] },
  { id: 'bars', name: 'Bars', icon: ICONS.repeatStart, groups: ['Bars', 'Text'] },
  { id: 'chords', name: 'Chords', icon: <ChordsMark /> },
];

/** Where the open panel is kept across visits (Q4: not a Settings preference). */
const KEY = 'frets.tab.layout';

function readPanel(): PanelId | null {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { panel?: unknown } | null;
    if (saved && (saved.panel === null || PANELS.some(p => p.id === saved.panel))) return saved.panel as PanelId | null;
  } catch {
    // Unreadable: the first visit's panel.
  }
  return 'notes';
}

/** The open panel, kept across visits; read after the first render, as the server has no storage. */
function useOpenPanel(): [PanelId | null, (id: PanelId | null) => void] {
  const [open, setOpen] = useState<PanelId | null>('notes');
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the saved panel exists only in the browser.
  useEffect(() => setOpen(readPanel()), []);
  const choose = (id: PanelId | null) => {
    setOpen(id);
    try {
      localStorage.setItem(KEY, JSON.stringify({ panel: id }));
    } catch {
      // Not kept: it still opens now.
    }
  };
  return [open, choose];
}

/** The clip's card with the rail and its open panel on its left; `off` is the card alone. */
export function TabRail({ look, palette, chords, children }: {
  look: string;
  palette: DrawPalette;
  /** The Chords panel's contents (the chord library of PR #300). */
  chords: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useOpenPanel();
  if (look === 'off') return children;
  const panel = PANELS.find(p => p.id === open);
  return (
    <div className="tab-rail-layout" data-look={look} data-open={panel ? '' : undefined}>
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
          <aside className={look === 'a' ? 'tab-rail-panel card' : 'tab-rail-panel'} aria-label={panel.name}>
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
            {panel.groups ? palette(panel.groups, 'tab-rail-tools', panel.input) : chords}
          </aside>
        </HoverTips>
      )}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** A chord box: four strings, three frets, two dots. */
function ChordsMark() {
  return (
    <>
      <path d="M6 4h12M6 4v16M10 4v16M14 4v16M18 4v16M6 9h12M6 14h12" />
      <circle cx={10} cy={11.5} r={1.8} fill="currentColor" stroke="none" />
      <circle cx={14} cy={6.5} r={1.8} fill="currentColor" stroke="none" />
    </>
  );
}
