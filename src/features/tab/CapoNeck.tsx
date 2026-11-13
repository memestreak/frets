'use client';

/**
 * The capo drawn on a small neck in the Tuning panel (issue #463,
 * `docs/specs/2026-11-13-tab-capo-in-tuning-design.md`): the tuning's strings, the inlays, and the capo
 * as a bar across every string just behind its fret wire. A press on a fret's space moves the capo
 * there; hovering one shows a faint capo there. None is set from the dropdown, not here.
 */
import { useState } from 'react';
import { prettyNote } from '@/lib/theory/notes';
import type { Mock } from '@/components/mocks/useMock';
import { MAX_CAPO, STRING_COUNT } from './clip';
import { stringNote } from './tuning';

/** Two looks while Jeremy picks (`?mock=a|b`): the whole neck to fret 12, or five frets round the capo. */
export const CAPO_LOOK_MOCK: Mock = {
  param: 'mock',
  label: 'Capo picture',
  options: [
    { value: 'a', label: 'a: nut to fret 12' },
    { value: 'b', label: 'b: five frets round the capo' },
  ],
};
export type CapoLook = 'a' | 'b';

const WIDTH = 320;
const HEIGHT = 86;
/** The strings' names, left of the nut. */
const NUT_X = 22;
const END_X = 314;
const STRING_TOP = 14;
const STRING_GAP = 10;
const BOARD_TOP = 7;
const BOARD_BOTTOM = STRING_TOP + (STRING_COUNT - 1) * STRING_GAP + 7;
const NUMBER_Y = HEIGHT - 4;
const INLAYS = [3, 5, 7, 9, 12];
/** Frets in look b's window. */
const WINDOW = 5;

/** Where each fret wire goes, 0 the nut: as on a guitar (each fret 2^(1/12) shorter), fret 12 at the end; or evenly, for a window. */
function wires(look: CapoLook, capo: number): { first: number; x: number[] } {
  if (look === 'b') {
    const first = Math.min(Math.max(1, capo - 2), MAX_CAPO - WINDOW + 1);
    const step = (END_X - NUT_X) / WINDOW;
    return { first, x: Array.from({ length: WINDOW + 1 }, (_, k) => NUT_X + k * step) };
  }
  const scale = (END_X - NUT_X) / (1 - 2 ** (-MAX_CAPO / 12));
  return { first: 1, x: Array.from({ length: MAX_CAPO + 1 }, (_, n) => NUT_X + scale * (1 - 2 ** (-n / 12))) };
}

export function CapoNeck({ tuning, capo, look, onCapo }: {
  tuning: readonly string[];
  /** 1 to 12: the picture is drawn only with a capo on. */
  capo: number;
  look: CapoLook;
  onCapo: (capo: number) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const { first, x } = wires(look, capo);
  const frets = Array.from({ length: x.length - 1 }, (_, k) => first + k);
  /** The left and right of a fret's space. */
  const space = (fret: number) => ({ x0: x[fret - first], x1: x[fret - first + 1] });
  const mid = (fret: number) => (space(fret).x0 + space(fret).x1) / 2;
  const capoBar = (fret: number, faint: boolean) => (
    <rect
      key={faint ? 'hover' : 'capo'} data-testid={faint ? undefined : 'capo-bar'}
      x={space(fret).x1 - 9} y={BOARD_TOP - 4} width={6} height={BOARD_BOTTOM - BOARD_TOP + 8} rx={3}
      fill="var(--primary)" opacity={faint ? 0.35 : 1}
    />
  );
  // The nut where the window starts at it; else the fret wire before the window, and the board runs on.
  const atNut = first === 1;
  return (
    <div className="tab-capo-neck">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`Capo on fret ${capo}`}>
        <rect x={NUT_X - (atNut ? 0 : 8)} y={BOARD_TOP} width={END_X - NUT_X + (atNut ? 0 : 8)} height={BOARD_BOTTOM - BOARD_TOP} rx={atNut ? 2 : 0} fill="var(--fretboard)" />
        {frets.map(f => INLAYS.includes(f) && (f === 12
          ? [-1, 1].map(k => <circle key={`${f}${k}`} cx={mid(f)} cy={(BOARD_TOP + BOARD_BOTTOM) / 2 + k * STRING_GAP * 1.5} r={3} fill="var(--inlay)" />)
          : <circle key={f} cx={mid(f)} cy={(BOARD_TOP + BOARD_BOTTOM) / 2} r={3} fill="var(--inlay)" />))}
        {x.map((wx, k) => (k === 0 && atNut
          ? <rect key="nut" x={wx - 3} y={BOARD_TOP} width={4} height={BOARD_BOTTOM - BOARD_TOP} fill="var(--nut)" />
          : <line key={k} x1={wx} y1={BOARD_TOP} x2={wx} y2={BOARD_BOTTOM} stroke="var(--fret-wire)" strokeWidth={1.5} />))}
        {Array.from({ length: STRING_COUNT }, (_, i) => {
          // High e on top, as tab has it.
          const s = STRING_COUNT - 1 - i;
          const y = STRING_TOP + i * STRING_GAP;
          return (
            <g key={s}>
              <line x1={NUT_X - (atNut ? 0 : 8)} y1={y} x2={END_X} y2={y} stroke="var(--string)" strokeWidth={0.6 + s * 0.2} />
              <text x={NUT_X - 8} y={y + 3} fontSize={8} textAnchor="end" fill="var(--ink-muted)">{prettyNote(stringNote(tuning, s))}</text>
            </g>
          );
        })}
        {hover !== null && hover !== capo && capoBar(hover, true)}
        {capoBar(capo, false)}
        {frets.map(f => (
          <text key={f} x={mid(f)} y={NUMBER_Y} fontSize={8} textAnchor="middle" fill={f === capo ? 'var(--ink)' : 'var(--ink-muted)'} fontWeight={f === capo ? 700 : 400}>{f}</text>
        ))}
      </svg>
      {/* A button over each fret's space; the dropdown is the way in from the keyboard. */}
      {frets.map(f => (
        <button
          key={f} type="button" tabIndex={-1} className="tab-capo-spot" aria-label={`Capo on fret ${f}`} aria-pressed={f === capo}
          style={{ left: `${(space(f).x0 / WIDTH) * 100}%`, width: `${((space(f).x1 - space(f).x0) / WIDTH) * 100}%` }}
          onMouseEnter={() => setHover(f)} onMouseLeave={() => setHover(h => (h === f ? null : h))}
          onClick={() => onCapo(f)}
        />
      ))}
    </div>
  );
}
