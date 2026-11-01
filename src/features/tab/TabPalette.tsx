'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BEND_QUARTERS, OTTAVAS, TUPLETS, tupletLabel, type BendQuarters, type Ottava } from './clip';
import { mordentSign } from './marks';
import { TOOL_GROUPS, type noteKinds, type Tool, type ToolId } from './tools';
import { GRID_NAMES, GRID_VALUES, type GridValue } from './grid';
import { WHAMMY_SHAPE_IDS, WHAMMY_SHAPE_NAMES, type WhammyShape } from './whammy';

/**
 * The symbol palette over the tab, as Guitar Pro's: one button per symbol
 * Frets reads, in named groups (a caption over each), each drawn as it
 * looks in tab. A button shows whether the cursor's column or note has its
 * symbol and toggles it; its
 * one-second tip (`HoverTips` round the page) names its key. Pressing a
 * button keeps the keyboard on the tab. Vibrato steps through normal, wide
 * and off; Bend and Tuplet open a panel of choices. Their icons show the
 * cursor's kind.
 */
export function TabPalette({ isOn, kinds, onTool, onBend, onTuplet, onOttava, onWhammy, disabled, inputMode = false, onInputMode, grid, onGrid }: {
  isOn: (id: ToolId) => boolean;
  /** What the cursor has of the things the Bend, Vibrato and Tuplet icons draw. */
  kinds: ReturnType<typeof noteKinds>;
  /** A bend amount picked in the Bend button's panel. */
  onBend: (quarters: BendQuarters | null) => void;
  /** A tuplet picked in the Tuplet button's panel. */
  onTuplet: (n: number | null) => void;
  /** An octave line picked in the Octave line button's panel. */
  onOttava: (ottava: Ottava | null) => void;
  /** A whammy bar shape picked in the Whammy bar button's panel. */
  onWhammy: (shape: WhammyShape | null) => void;
  onTool: (id: ToolId) => void;
  /** In the text views: shown, so nothing moves, but not pressable. */
  disabled: boolean;
  /** Note input is on (issue #238): the pencil, first, stays lit. */
  inputMode?: boolean;
  /** The pencil pressed: note input on or off, as N does. */
  onInputMode?: () => void;
  /** Note input's grid (issue #293), shown first in the Duration group; its panel picks another. */
  grid?: GridValue;
  onGrid?: (grid: GridValue) => void;
}) {
  return (
    <div className="tab-palette" role="toolbar" aria-label="Symbols">
      {onInputMode && (
        <div className="tab-palette-group" role="group" aria-label="Input">
          <span className="tab-palette-label" aria-hidden="true">Input</span>
          <div className="tab-palette-tools">
            <button
              type="button" className="btn btn-secondary btn-toggle tab-tool" aria-label="Note input"
              aria-pressed={!disabled && inputMode} disabled={disabled} data-tip="Note input (N)"
              // Keep the focus, and so the cursor, on the tab.
              onMouseDown={e => e.preventDefault()}
              onClick={onInputMode}
            >
              <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5}>
                {/* A pencil, as MuseScore's note input button. */}
                <path d="M5 19l1-4L16 5l3 3L9 18l-4 1zM14 7l3 3" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      )}
      {TOOL_GROUPS.map(group => (
        <div key={group.label} className="tab-palette-group" role="group" aria-label={group.label}>
          <span className="tab-palette-label" aria-hidden="true">{group.label}</span>
          <div className="tab-palette-tools">
            {group.label === 'Duration' && grid !== undefined && onGrid && (
              <PanelTool
                tool={GRID_TOOL} current={grid} choices={GRID_VALUES} label={g => GRID_NAMES[g]} toggle={false} none={false}
                icon={<GridGlyph grid={grid} />} onPick={g => { if (g !== null) onGrid(g); }} disabled={disabled}
              />
            )}
            {group.tools.map(tool => tool.id === 'bend' ? (
              <PanelTool
                key={tool.id} tool={tool} current={kinds.bend} choices={BEND_QUARTERS} label={q => BEND_AMOUNTS[q]}
                icon={<BendGlyph amount={kinds.bend ? BEND_AMOUNTS[kinds.bend] : ''} />} onPick={onBend} disabled={disabled}
              />
            ) : tool.id === 'tuplet' ? (
              <PanelTool
                key={tool.id} tool={tool}
                // A tuplet of an unusual span (3:4) is in no choice, so none is lit; the icon still names it.
                current={kinds.tuplet && !kinds.tuplet.tupletSpan ? kinds.tuplet.tuplet! : null} choices={TUPLETS} label={String}
                icon={<TupletGlyph n={kinds.tuplet ? tupletLabel(kinds.tuplet) : ''} />} onPick={onTuplet} disabled={disabled}
              />
            ) : tool.id === 'ottava' ? (
              <PanelTool
                key={tool.id} tool={tool} current={kinds.ottava} choices={OTTAVAS} label={String}
                icon={<OttavaGlyph label={kinds.ottava ?? '8va'} />} onPick={onOttava} disabled={disabled}
              />
            ) : tool.id === 'whammy' ? (
              <PanelTool
                key={tool.id} tool={tool} pressed={kinds.whammy !== null}
                current={kinds.whammy === 'other' ? null : kinds.whammy} choices={WHAMMY_SHAPE_IDS} label={s => WHAMMY_SHAPE_NAMES[s]}
                icon={<WhammyGlyph />} onPick={onWhammy} disabled={disabled}
              />
            ) : (
              <button
                key={tool.id} type="button" className="btn btn-secondary btn-toggle tab-tool"
                aria-label={tool.label} aria-pressed={!disabled && isOn(tool.id)} disabled={disabled}
                data-tip={tool.key ? `${tool.label} (${tool.key})` : tool.label}
                // Keep the focus, and so the cursor, on the tab.
                onMouseDown={e => e.preventDefault()}
                onClick={() => onTool(tool.id)}
              >
                <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  {tool.id === 'vibrato' ? <VibratoGlyph wide={kinds.vibrato === 'wide'} /> : tool.id === 'wah' ? <WahGlyph open={kinds.wah === 'open'} /> : ICONS[tool.id]}
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
function MordentIcon({ kind }: { kind: 'upper' | 'lower' }) {
  const { d, transform } = mordentSign(12, 7, kind);
  return <><path d={d} transform={`translate(-2.4 -1.4) scale(1.2) ${transform}`} fill="currentColor" stroke="none" /><Label y={20} size={10}>5</Label></>;
}

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

/** An octave line as printed: "8va" (or the cursor's kind) over a dashed line with a hook. */
function OttavaGlyph({ label }: { label: string }) {
  const number = label.startsWith('15') ? '15' : '8';
  return (
    <>
      <text x={2} y={11} fontSize={9} fontStyle="italic" fontWeight={700} fill="currentColor" stroke="none">
        {number}<tspan fontSize={6} dy={-3}>{label.slice(number.length)}</tspan>
      </text>
      <path d="M3 17 H20 V21" strokeDasharray="2.5 2" />
    </>
  );
}

/** A bend's amount as tab prints it, by quarter tones. */
const BEND_AMOUNTS: Record<BendQuarters, string> = { 1: '¼', 2: '½', 4: 'full', 6: '1½', 8: '2' };

/** A wavy line, taller and heavier when wide. */
/** The Wah button: the cursor column's sign, "o" when its wah is open, else "+". */
function WahGlyph({ open }: { open: boolean }) {
  return (
    <>
      {open ? <circle cx={12} cy={8} r={4} /> : <path d="M7 8 h10 M12 3 v10" />}
      <Label y={21} size={8}>wah</Label>
    </>
  );
}

function VibratoGlyph({ wide }: { wide: boolean }) {
  return wide
    ? <path d="M3 13 q3 -7 6 0 t6 0 t6 0" strokeWidth={2} />
    : <path d="M3 13 q2.25 -4 4.5 0 t4.5 0 t4.5 0 t4.5 0" />;
}

/**
 * A palette button that opens a panel of choices under it (Bend, Tuplet): its icon shows the cursor's
 * choice, and the panel lights it; picking one sets it, None takes it away. A press outside, or Esc,
 * closes the panel; focus never leaves the tab.
 */
function PanelTool<T extends number | string>({ tool, current, pressed = current !== null, choices, label, icon, onPick, disabled, toggle = true, none = true }: {
  tool: Pick<Tool, 'label' | 'key'>;
  /** The cursor's choice, or null for none (or for one the panel doesn't offer). */
  current: T | null;
  /** Whether the cursor has the tool's mark at all, offered or not; by default, when it has a choice. */
  pressed?: boolean;
  choices: readonly T[];
  /** A choice as the panel names it. */
  label: (choice: T) => string;
  icon: ReactNode;
  onPick: (choice: T | null) => void;
  disabled: boolean;
  /** Whether the button shows the cursor has the mark (pressed); false for a setting, as the Grid's. */
  toggle?: boolean;
  /** Whether the panel ends with None, to take the mark away; a setting always has a value. */
  none?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    // Caught before the tab's own keys, so Esc closes the panel and leaves the cursor where it is.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  return (
    <span ref={boxRef} className="tab-tool-box">
      <button
        type="button" className="btn btn-secondary btn-toggle tab-tool"
        aria-label={tool.label} aria-pressed={toggle ? !disabled && pressed : undefined} aria-expanded={open} aria-haspopup="dialog" disabled={disabled}
        data-tip={tool.key ? `${tool.label} (${tool.key})` : tool.label}
        onMouseDown={e => e.preventDefault()}
        onClick={() => setOpen(o => !o)}
      >
        <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5}>
          {icon}
        </svg>
      </button>
      {open && !disabled && (
        <span className="tab-tool-panel card" role="dialog" aria-label={tool.label}>
          <span className="tab-bar-time-title">{tool.label}</span>
          <span className="seg" role="group" aria-label={`${tool.label} choices`}>
            {(none ? [...choices, null] : choices).map(choice => (
              <button
                key={choice ?? 'none'} type="button" className="seg-opt tab-panel-choice" aria-pressed={choice === current}
                onMouseDown={e => e.preventDefault()}
                onClick={() => { onPick(choice); setOpen(false); }}
              >
                {choice === null ? 'None' : label(choice)}
              </button>
            ))}
          </span>
        </span>
      )}
    </span>
  );
}

/** The Grid button's name, tip and keys (issue #293); not a palette tool, so not in `TOOL_GROUPS`. */
const GRID_TOOL = { label: 'Note input grid', key: 'Alt+[ ]' };

/** The grid's note over a ruler: the note value ← → step by in a rest. */
function GridGlyph({ grid }: { grid: GridValue }) {
  const flags = { 4: 0, 8: 1, 16: 2, 32: 3 }[grid];
  return (
    <>
      <g transform="translate(0 -2.5)"><NoteGlyph open={false} flags={flags} /></g>
      <path d="M3 21.5 H21 M3 21.5 V19.5 M9 21.5 V19.5 M15 21.5 V19.5 M21 21.5 V19.5" strokeWidth={1} />
    </>
  );
}

/** A tuplet's bracket with its number under it. */
function TupletGlyph({ n }: { n: string }) {
  // Two digits or a ratio (12, 3:4) in smaller type, to fit.
  return <><path d="M4 9 V6 H20 V9" /><Label y={20} size={n.length > 1 ? 9 : 12}>{n}</Label></>;
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

/** The whammy bar: a number with its line diving away under it, as tab prints a dive. */
function WhammyGlyph() {
  return (
    <>
      <Label x={6} y={9} size={9}>5</Label>
      <path d="M9 7 L18 19" />
      <path d="M2 13 H22" strokeWidth={0.8} />
    </>
  );
}

const ICONS: Record<Exclude<ToolId, 'bend' | 'vibrato' | 'tuplet' | 'wah' | 'whammy'>, ReactNode> = {
  whole: <NoteGlyph open stem={false} />,
  half: <NoteGlyph open />,
  quarter: <NoteGlyph open={false} />,
  eighth: <NoteGlyph open={false} flags={1} />,
  sixteenth: <NoteGlyph open={false} flags={2} />,
  thirtySecond: <NoteGlyph open={false} flags={3} />,
  sixtyFourth: <NoteGlyph open={false} flags={4} />,
  // The dot sits where it would beside a note head, at the heads' height in the other duration icons.
  dot: <circle cx={12} cy={17} r={2.6} fill="currentColor" stroke="none" />,
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
  release: <><path d="M4 21 Q8 21 8 8 L8 6 Q8 4 10 4 Q16 4 16 18" /><path d="M13.5 15.5 L16 18.5 L18.5 15.5" /></>,
  preBend: <><line x1={8} y1={21} x2={8} y2={7} /><path d="M5.5 9.5 L8 6.5 L10.5 9.5" /><Label x={16} y={17} size={8}>PB</Label></>,
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
  // Drawn by its panel's button (OttavaGlyph).
  ottava: null,
  // The mordent's own sign over a note, as the staff and tab draw it.
  mordent: <MordentIcon kind="upper" />,
  lowerMordent: <MordentIcon kind="lower" />,
  staccato: <><circle cx={12} cy={6} r={2.4} fill="currentColor" stroke="none" /><Label y={20} size={10}>5</Label></>,
  // A plus before or after a bar line: where the new bar goes.
  insertBarBefore: <><line x1={8} y1={8} x2={8} y2={16} strokeWidth={2} /><line x1={4} y1={12} x2={12} y2={12} strokeWidth={2} /><line x1={17} y1={5} x2={17} y2={19} /></>,
  insertBar: <><line x1={7} y1={5} x2={7} y2={19} /><line x1={16} y1={8} x2={16} y2={16} strokeWidth={2} /><line x1={12} y1={12} x2={20} y2={12} strokeWidth={2} /></>,
  barTime: <><Label y={11} size={10}>4</Label><Label y={21} size={10}>4</Label></>,
  // A sharp and a flat, as a key signature has.
  barKey: <><Label x={8} y={15} size={12}>♯</Label><Label x={16} y={17} size={12}>♭</Label></>,
  repeatStart: <><line x1={6} y1={4} x2={6} y2={20} strokeWidth={3} /><line x1={10} y1={4} x2={10} y2={20} /><circle cx={15} cy={9.5} r={1.6} fill="currentColor" stroke="none" /><circle cx={15} cy={14.5} r={1.6} fill="currentColor" stroke="none" /></>,
  doubleBar: <><line x1={10} y1={4} x2={10} y2={20} /><line x1={15} y1={4} x2={15} y2={20} /></>,
  repeatEnd: <><line x1={18} y1={4} x2={18} y2={20} strokeWidth={3} /><line x1={14} y1={4} x2={14} y2={20} /><circle cx={9} cy={9.5} r={1.6} fill="currentColor" stroke="none" /><circle cx={9} cy={14.5} r={1.6} fill="currentColor" stroke="none" /></>,
  ending: <><path d="M4 20 V6 H20" /><Label x={10} y={16} size={10}>1.</Label></>,
  chordName: <Label y={16} size={10}>Am</Label>,
  // Words in italics, as free text is drawn over the tab.
  beatText: <text x={12} y={16} fontSize={10} fontStyle="italic" fill="currentColor" stroke="none" textAnchor="middle">abc</text>,
  section: <><rect x={3} y={7} width={18} height={11} rx={1.5} /><Label y={15.5} size={7.5}>Intro</Label></>,
  // A capo: a bar clamped across the strings.
  capo: <>{[7, 11, 15, 19].map(y => <line key={y} x1={3} y1={y} x2={21} y2={y} strokeWidth={1} />)}<rect x={10} y={4} width={4.5} height={18} rx={2} fill="currentColor" stroke="none" /></>,
  tempo: <><ellipse cx={7} cy={16} rx={2.8} ry={2} transform="rotate(-20 7 16)" fill="currentColor" stroke="none" /><line x1={9.5} y1={15.5} x2={9.5} y2={6} /><Label x={16.5} y={15} size={8}>=</Label></>,
};
