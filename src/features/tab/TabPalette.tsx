'use client';

import type { ReactNode } from 'react';
import { TOOL_GROUPS, type ToolId } from './tools';

/**
 * The symbol palette over the tab, as Guitar Pro's: one button per symbol
 * Frets reads, in named groups (a caption over each), each drawn as it
 * looks in tab. A button shows whether the cursor's column or note has its
 * symbol and toggles it; its
 * one-second tip (`HoverTips` round the page) names its key. Pressing a
 * button keeps the keyboard on the tab.
 */
export function TabPalette({ isOn, onTool, disabled }: {
  isOn: (id: ToolId) => boolean;
  onTool: (id: ToolId) => void;
  /** In the text views: shown, so nothing moves, but not pressable. */
  disabled: boolean;
}) {
  return (
    <div className="tab-palette" role="toolbar" aria-label="Symbols">
      {TOOL_GROUPS.map(group => (
        <div key={group.label} className="tab-palette-group" role="group" aria-label={group.label}>
          <span className="tab-palette-label" aria-hidden="true">{group.label}</span>
          <div className="tab-palette-tools">
            {group.tools.map(tool => (
              <button
                key={tool.id} type="button" className="btn btn-secondary btn-toggle tab-tool"
                aria-label={tool.label} aria-pressed={!disabled && isOn(tool.id)} disabled={disabled}
                data-tip={tool.key ? `${tool.label} (${tool.key})` : tool.label}
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
      {/* Three or four flags sit closer, so the last still clears the head. */}
      {Array.from({ length: flags }, (_, f) => <path key={f} d={`M12.4 ${4 + f * (flags > 2 ? 3 : 4)} q5 2 4 7`} />)}
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

/** A tuplet's bracket with its number under it. */
function TupletGlyph({ n }: { n: number }) {
  return <><path d="M4 9 V6 H20 V9" /><Label y={20} size={12}>{n}</Label></>;
}

/** A quarter note's stem with tremolo slashes across it, one for eighths up to three for thirty-seconds. */
function TremoloGlyph({ slashes }: { slashes: number }) {
  return (
    <>
      <NoteGlyph open={false} />
      {Array.from({ length: slashes }, (_, k) => <line key={k} x1={9} y1={8 + k * 3.5} x2={16} y2={5 + k * 3.5} strokeWidth={1.8} />)}
    </>
  );
}

const ICONS: Record<ToolId, ReactNode> = {
  whole: <NoteGlyph open stem={false} />,
  half: <NoteGlyph open />,
  quarter: <NoteGlyph open={false} />,
  eighth: <NoteGlyph open={false} flags={1} />,
  sixteenth: <NoteGlyph open={false} flags={2} />,
  thirtySecond: <NoteGlyph open={false} flags={3} />,
  sixtyFourth: <NoteGlyph open={false} flags={4} />,
  // The dot sits where it would beside a note head, at the heads' height in the other duration icons.
  dot: <circle cx={12} cy={17} r={2.6} fill="currentColor" stroke="none" />,
  triplet: <TupletGlyph n={3} />,
  quintuplet: <TupletGlyph n={5} />,
  sextuplet: <TupletGlyph n={6} />,
  septuplet: <TupletGlyph n={7} />,
  // A small number before a full-size one, as a grace note is drawn.
  grace: <><Label x={7} y={17} size={7.5}>3</Label><Label x={15} y={18} size={12}>5</Label></>,
  tremolo8: <TremoloGlyph slashes={1} />,
  tremolo16: <TremoloGlyph slashes={2} />,
  tremolo32: <TremoloGlyph slashes={3} />,
  rest: <path d="M10 3 L14 8 L10 12 L14 16 Q9 15 11 20" />,
  tie: <><Label x={7} y={13} size={9}>5</Label><Label x={17} y={13} size={9}>(5)</Label><path d="M5 17 Q12 23 19 17" /></>,
  legato: <><path d="M4 14 Q12 4 20 14" /><Label y={20} size={9}>H</Label></>,
  slide: <><path d="M3 15 Q12 8 21 15" strokeWidth={1} /><line x1={7} y1={17} x2={17} y2={11} /></>,
  shiftSlide: <line x1={6} y1={18} x2={18} y2={8} />,
  slideBelow: <><line x1={4} y1={18} x2={13} y2={12} /><Label x={18} y={16} size={9}>5</Label></>,
  slideAbove: <><line x1={4} y1={10} x2={13} y2={16} /><Label x={18} y={18} size={9}>5</Label></>,
  slideOutDown: <><Label x={6} y={12} size={9}>5</Label><line x1={11} y1={9} x2={20} y2={16} /></>,
  slideOutUp: <><Label x={6} y={18} size={9}>5</Label><line x1={11} y1={15} x2={20} y2={8} /></>,
  bend1: <BendGlyph amount="¼" />,
  bend2: <BendGlyph amount="½" />,
  bend4: <BendGlyph amount="full" />,
  bend6: <BendGlyph amount="1½" />,
  bend8: <BendGlyph amount="2" />,
  release: <><path d="M4 21 Q8 21 8 8 L8 6 Q8 4 10 4 Q16 4 16 18" /><path d="M13.5 15.5 L16 18.5 L18.5 15.5" /></>,
  preBend: <><line x1={8} y1={21} x2={8} y2={7} /><path d="M5.5 9.5 L8 6.5 L10.5 9.5" /><Label x={16} y={17} size={8}>PB</Label></>,
  vibrato: <path d="M3 13 q2.25 -4 4.5 0 t4.5 0 t4.5 0 t4.5 0" />,
  wideVibrato: <path d="M3 13 q3 -7 6 0 t6 0 t6 0" strokeWidth={2} />,
  palmMute: <Label y={15} size={8.5}>P.M.</Label>,
  letRing: <><Label y={11} size={8}>let</Label><Label y={20} size={8}>ring</Label></>,
  dead: <Label y={17} size={14}>x</Label>,
  ghost: <Label y={16} size={11}>(5)</Label>,
  harmonic: <path d="M12 5 L18 12 L12 19 L6 12 Z" />,
  pinchHarmonic: <Label y={15} size={8.5}>P.H.</Label>,
  tap: <Label y={17} size={13}>T</Label>,
  strokeDown: <path d="M6 18 V7 H18 V18" strokeWidth={2} />,
  strokeUp: <path d="M6 6 L12 19 L18 6" strokeWidth={2} />,
  accent: <path d="M6 7 L18 12 L6 17" strokeWidth={2} />,
  heavyAccent: <path d="M6 18 L12 6 L18 18" strokeWidth={2} />,
  // A staccato dot over a note, so it can't pass for the duration dot.
  staccato: <><circle cx={12} cy={6} r={2.4} fill="currentColor" stroke="none" /><Label y={20} size={10}>5</Label></>,
  // A time signature in general: N beats over an M note.
  barTime: <><Label y={11} size={10}>N</Label><Label y={21} size={10}>M</Label></>,
  repeatStart: <><line x1={6} y1={4} x2={6} y2={20} strokeWidth={3} /><line x1={10} y1={4} x2={10} y2={20} /><circle cx={15} cy={9.5} r={1.6} fill="currentColor" stroke="none" /><circle cx={15} cy={14.5} r={1.6} fill="currentColor" stroke="none" /></>,
  repeatEnd: <><line x1={18} y1={4} x2={18} y2={20} strokeWidth={3} /><line x1={14} y1={4} x2={14} y2={20} /><circle cx={9} cy={9.5} r={1.6} fill="currentColor" stroke="none" /><circle cx={9} cy={14.5} r={1.6} fill="currentColor" stroke="none" /></>,
  ending: <><path d="M4 20 V6 H20" /><Label x={10} y={16} size={10}>1.</Label></>,
  chordName: <Label y={16} size={10}>Am</Label>,
  section: <><rect x={3} y={7} width={18} height={11} rx={1.5} /><Label y={15.5} size={7.5}>Intro</Label></>,
  // A capo: a bar clamped across the strings.
  capo: <>{[7, 11, 15, 19].map(y => <line key={y} x1={3} y1={y} x2={21} y2={y} strokeWidth={1} />)}<rect x={10} y={4} width={4.5} height={18} rx={2} fill="currentColor" stroke="none" /></>,
  tempo: <><ellipse cx={7} cy={16} rx={2.8} ry={2} transform="rotate(-20 7 16)" fill="currentColor" stroke="none" /><line x1={9.5} y1={15.5} x2={9.5} y2={6} /><Label x={16.5} y={15} size={8}>=</Label></>,
};
