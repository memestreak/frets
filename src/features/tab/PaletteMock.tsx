'use client';

/**
 * MOCK, not for merging (issue #301): the Tab page's tools as one row over the clip and palettes on
 * its left, in four layouts behind `?palette=a|b|c|d` while Jeremy picks one. The row keeps note
 * input, Duration and Rhythm; Joins, Bends, Techniques, Accents, Bars and Text move to the left.
 * Nothing is stored: which section or panel is open is gone on reload.
 */
import { useState, type ReactNode } from 'react';
import { HoverTips } from '@/components/HoverTips';
import { useMock, type Mock } from '@/components/mocks/useMock';
import { ICONS } from './TabPalette';

export const PALETTE_MOCK: Mock = {
  param: 'palette',
  label: 'Palettes',
  options: [
    // The page as it ships: every group over the clip.
    { value: 'off', label: 'Today' },
    { value: 'a', label: 'a Column' },
    { value: 'b', label: 'b Sections' },
    { value: 'c', label: 'c Rail' },
    { value: 'd', label: 'd Strip' },
  ],
};

/** Whether the row of tools shares the file buttons' line (one row) or has its own under them (two). */
export const ROW_MOCK: Mock = {
  param: 'row',
  label: 'Top row',
  options: [
    { value: 'one', label: 'One row' },
    { value: 'two', label: 'Two rows' },
  ],
};

/** The palettes' layout, and whether the tools share the file buttons' line (never on Today). */
export function usePaletteMock(): { look: string; oneRow: boolean } {
  const look = useMock(PALETTE_MOCK);
  const row = useMock(ROW_MOCK);
  // c Rail holds every group (Jeremy, 2026-11-02, Q1), so there is no row over the clip.
  return { look, oneRow: look !== 'off' && look !== 'c' && row === 'one' };
}

/** The groups that stay in the row over the clip (with the note input pencil). */
export const TOP_GROUPS = ['Duration', 'Rhythm'] as const;
/** The groups that move to the left. */
const SIDE_GROUPS = ['Joins', 'Bends', 'Techniques', 'Accents', 'Bars', 'Text'] as const;

/** Draws the palette with only `groups`; `className` sets its look; the note input pencil first when `input`. */
export type DrawPalette = (groups: readonly string[], className?: string, input?: boolean) => ReactNode;

/** c Rail: every group, the note input pencil with Duration. */
const RAIL_GROUPS = ['Duration', 'Rhythm', ...SIDE_GROUPS] as const;

/** Each side group's mark on the rail: one of its own tools' icons. */
const RAIL_ICONS: Record<(typeof RAIL_GROUPS)[number], ReactNode> = {
  Duration: ICONS.quarter,
  Rhythm: ICONS.grace,
  Joins: ICONS.legato,
  Bends: ICONS.release,
  Techniques: ICONS.palmMute,
  Accents: ICONS.accent,
  Bars: ICONS.repeatStart,
  Text: ICONS.chordName,
};

/** The clip's card with the palettes on its left, as `look` lays them out; `off` is the card alone. */
export function PaletteSide({ look, palette, children }: { look: string; palette: DrawPalette; children: ReactNode }) {
  if (look === 'off') return children;
  return (
    <div className="tab-side-layout" data-look={look}>
      <HoverTips>
        <aside className="tab-side" aria-label="Palettes">
          {look === 'a' && palette(SIDE_GROUPS, 'tab-side-column')}
          {look === 'b' && <Sections palette={palette} />}
          {look === 'c' && <Rail palette={palette} />}
          {look === 'd' && palette(SIDE_GROUPS, 'tab-side-strip')}
        </aside>
      </HoverTips>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** b: MuseScore's palettes: a heading per group that folds it away. */
function Sections({ palette }: { palette: DrawPalette }) {
  const [open, setOpen] = useState<readonly string[]>(['Joins', 'Bends', 'Techniques']);
  return (
    <div className="tab-side-sections">
      {SIDE_GROUPS.map(group => {
        const isOpen = open.includes(group);
        return (
          <div key={group} className="tab-side-section">
            <button
              type="button" className="tab-side-heading" aria-expanded={isOpen}
              onMouseDown={e => e.preventDefault()}
              onClick={() => setOpen(isOpen ? open.filter(g => g !== group) : [...open, group])}
            >
              <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d={isOpen ? 'M3 4.5l3 3 3-3' : 'M4.5 3l3 3-3 3'} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {group}
            </button>
            {isOpen && palette([group], 'tab-side-section-tools')}
          </div>
        );
      })}
    </div>
  );
}

/** c: a thin rail of group buttons; the picked one opens its panel beside it, again closes it. */
function Rail({ palette }: { palette: DrawPalette }) {
  const [shown, setShown] = useState<string | null>('Duration');
  return (
    <div className="tab-side-rail-box" data-open={shown ? '' : undefined}>
      <div className="tab-side-rail" role="group" aria-label="Palettes">
        {RAIL_GROUPS.map(group => (
          <button
            key={group} type="button" className="tab-side-rail-button" aria-label={group} aria-pressed={shown === group}
            data-tip={group} onMouseDown={e => e.preventDefault()} onClick={() => setShown(shown === group ? null : group)}
          >
            <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5}>
              {RAIL_ICONS[group]}
            </svg>
          </button>
        ))}
        {/* Room for other panels: the chord library of PR #300 would be one more button here. */}
        <span className="tab-side-rail-rule" aria-hidden="true" />
        <button
          type="button" className="tab-side-rail-button" aria-label="Chords" aria-pressed={shown === 'Chords'}
          data-tip="Chords" onMouseDown={e => e.preventDefault()} onClick={() => setShown(shown === 'Chords' ? null : 'Chords')}
        >
          <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5}>
            {/* A chord box: four strings, three frets, two dots. */}
            <path d="M6 4h12M6 4v16M10 4v16M14 4v16M18 4v16M6 9h12M6 14h12" />
            <circle cx={10} cy={11.5} r={1.8} fill="currentColor" stroke="none" />
            <circle cx={14} cy={6.5} r={1.8} fill="currentColor" stroke="none" />
          </svg>
        </button>
      </div>
      {shown && (
        <div className="tab-side-rail-panel card">
          <span className="tab-side-panel-title">{shown}</span>
          {shown === 'Chords'
            ? <p className="tab-side-note">The chord library (PR #300) opens here.</p>
            : palette([shown], 'tab-side-panel-tools', shown === 'Duration')}
        </div>
      )}
    </div>
  );
}
