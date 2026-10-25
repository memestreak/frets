'use client';

import type { ReactNode } from 'react';
import { TOOL_GROUPS, type ToolId } from './tools';

/**
 * The symbol palette over the tab, as Guitar Pro's: one button per symbol
 * Frets reads, in groups, each drawn as it looks in tab. A button shows
 * whether the cursor's column or note has its symbol and toggles it; its
 * one-second tip (`HoverTips` round the page) names its key. Pressing a
 * button keeps the keyboard on the tab.
 */
export function TabPalette({ isOn, onTool, disabled, mock }: {
  isOn: (id: ToolId) => boolean;
  onTool: (id: ToolId) => void;
  /** In the text views: shown, so nothing moves, but not pressable. */
  disabled: boolean;
  /** MOCK: which labelled layout to draw (a, b, c); none draws today's. */
  mock?: string;
}) {
  return (
    <div className={`tab-palette${mock ? ` tab-palette-${mock}` : ''}`} role="toolbar" aria-label="Symbols">
      {TOOL_GROUPS.map(group => (
        <div key={group.label} className="tab-palette-group" role="group" aria-label={group.label}>
          {mock && <span className="tab-palette-label" aria-hidden="true">{group.label}</span>}
          <div className="tab-palette-tools">
          {group.tools.map(tool => (
            <button
              key={tool.id} type="button" className="btn btn-secondary btn-toggle tab-tool"
              aria-label={tool.label} aria-pressed={!disabled && isOn(tool.id)} disabled={disabled}
              data-tip={`${tool.label} (${tool.key})`}
              // Keep the focus, and so the cursor, on the tab.
              onMouseDown={e => e.preventDefault()}
              onClick={() => onTool(tool.id)}
            >
              <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5}>
                {ICONS[tool.id]}
              </svg>
            </button>
          ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Small text inside an icon. */
function Label({ x = 12, y = 16, size = 10, children }: { x?: number; y?: number; size?: number; children: ReactNode }) {
  return <text x={x} y={y} fontSize={size} fontWeight={700} fill="currentColor" stroke="none" textAnchor="middle">{children}</text>;
}

/** A note head with a stem and `flags` flags, open (whole, half) or filled. */
function NoteGlyph({ open, stem = true, flags = 0 }: { open: boolean; stem?: boolean; flags?: number }) {
  return (
    <>
      <ellipse cx={9} cy={17} rx={3.6} ry={2.6} transform="rotate(-20 9 17)" fill={open ? 'none' : 'currentColor'} />
      {stem && <line x1={12.4} y1={16} x2={12.4} y2={4} />}
      {Array.from({ length: flags }, (_, f) => <path key={f} d={`M12.4 ${4 + f * 4} q5 2 4 7`} />)}
    </>
  );
}

/** A curved bend arrow with its amount above. */
function BendGlyph({ amount }: { amount: string }) {
  return (
    <>
      <path d="M5 21 Q13 21 13 10" />
      <path d="M10.5 12.5 L13 9.5 L15.5 12.5" />
      <Label x={17} y={8} size={7.5}>{amount}</Label>
    </>
  );
}

const ICONS: Record<ToolId, ReactNode> = {
  whole: <NoteGlyph open stem={false} />,
  half: <NoteGlyph open />,
  quarter: <NoteGlyph open={false} />,
  eighth: <NoteGlyph open={false} flags={1} />,
  sixteenth: <NoteGlyph open={false} flags={2} />,
  dot: <><NoteGlyph open={false} /><circle cx={18} cy={17} r={1.6} fill="currentColor" stroke="none" /></>,
  triplet: <><path d="M4 9 V6 H20 V9" /><Label y={20} size={12}>3</Label></>,
  rest: <path d="M10 3 L14 8 L10 12 L14 16 Q9 15 11 20" />,
  tie: <><Label x={7} y={13} size={9}>5</Label><Label x={17} y={13} size={9}>(5)</Label><path d="M5 17 Q12 23 19 17" /></>,
  legato: <><path d="M4 14 Q12 4 20 14" /><Label y={20} size={9}>H</Label></>,
  slide: <><path d="M3 15 Q12 8 21 15" strokeWidth={1} /><line x1={7} y1={17} x2={17} y2={11} /></>,
  shiftSlide: <line x1={6} y1={18} x2={18} y2={8} />,
  slideBelow: <><line x1={4} y1={18} x2={13} y2={12} /><Label x={18} y={16} size={9}>5</Label></>,
  slideAbove: <><line x1={4} y1={10} x2={13} y2={16} /><Label x={18} y={18} size={9}>5</Label></>,
  bend1: <BendGlyph amount="¼" />,
  bend2: <BendGlyph amount="½" />,
  bend4: <BendGlyph amount="full" />,
  bend6: <BendGlyph amount="1½" />,
  bend8: <BendGlyph amount="2" />,
  release: <><path d="M4 21 Q8 21 8 8 L8 6 Q8 4 10 4 Q16 4 16 18" /><path d="M13.5 15.5 L16 18.5 L18.5 15.5" /></>,
  preBend: <><line x1={8} y1={21} x2={8} y2={7} /><path d="M5.5 9.5 L8 6.5 L10.5 9.5" /><Label x={16} y={17} size={8}>PB</Label></>,
  vibrato: <path d="M3 13 q2.25 -4 4.5 0 t4.5 0 t4.5 0 t4.5 0" />,
  palmMute: <Label y={15} size={8.5}>P.M.</Label>,
  dead: <Label y={17} size={14}>x</Label>,
  harmonic: <path d="M12 5 L18 12 L12 19 L6 12 Z" />,
  tap: <Label y={17} size={13}>T</Label>,
  strokeDown: <path d="M6 18 V7 H18 V18" strokeWidth={2} />,
  strokeUp: <path d="M6 6 L12 19 L18 6" strokeWidth={2} />,
  repeatStart: <><line x1={6} y1={4} x2={6} y2={20} strokeWidth={3} /><line x1={10} y1={4} x2={10} y2={20} /><circle cx={15} cy={9.5} r={1.6} fill="currentColor" stroke="none" /><circle cx={15} cy={14.5} r={1.6} fill="currentColor" stroke="none" /></>,
  repeatEnd: <><line x1={18} y1={4} x2={18} y2={20} strokeWidth={3} /><line x1={14} y1={4} x2={14} y2={20} /><circle cx={9} cy={9.5} r={1.6} fill="currentColor" stroke="none" /><circle cx={9} cy={14.5} r={1.6} fill="currentColor" stroke="none" /></>,
  ending: <><path d="M4 20 V6 H20" /><Label x={10} y={16} size={10}>1.</Label></>,
};
