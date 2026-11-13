'use client';

/**
 * The capo drawn on a small neck in the Tuning panel (issue #463,
 * `docs/specs/2026-11-13-tab-capo-in-tuning-design.md`): the nut to fret 15, frets narrowing as a
 * guitar's do, the tuning's strings, the inlays, and the capo as a bar across every string just behind
 * its fret wire. A press on the space of fret 1 to 12 moves the capo there; hovering one shows a faint
 * capo there. Frets 13 to 15 are drawn but can't be picked (Jeremy, 2026-11-13: "Whole neck
 * selectable to 12 but showing frets up to 15"). None is set from the dropdown, not here.
 */
import { useState } from 'react';
import { prettyNote } from '@/lib/theory/notes';
import { MAX_CAPO, STRING_COUNT } from './clip';
import { stringNote } from './tuning';

/** The frets drawn; only up to `MAX_CAPO` are picked. */
const SHOWN_FRETS = 15;
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
const INLAYS = [3, 5, 7, 9, 12, 15];

/** Where each fret wire goes, 0 the nut: each fret 2^(1/12) shorter than the one before, the last at the end. */
const WIRES = (() => {
  const scale = (END_X - NUT_X) / (1 - 2 ** (-SHOWN_FRETS / 12));
  return Array.from({ length: SHOWN_FRETS + 1 }, (_, n) => NUT_X + scale * (1 - 2 ** (-n / 12)));
})();
const FRETS = Array.from({ length: SHOWN_FRETS }, (_, k) => k + 1);
const PICKED = FRETS.filter(f => f <= MAX_CAPO);
const mid = (fret: number) => (WIRES[fret - 1] + WIRES[fret]) / 2;
const MIDDLE = (BOARD_TOP + BOARD_BOTTOM) / 2;

export function CapoNeck({ tuning, capo, onCapo }: {
  tuning: readonly string[];
  /** 1 to 12: the picture is drawn only with a capo on. */
  capo: number;
  onCapo: (capo: number) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const capoBar = (fret: number, faint: boolean) => (
    <rect
      key={faint ? 'hover' : 'capo'} data-testid={faint ? 'capo-hover' : 'capo-bar'}
      x={WIRES[fret] - 9} y={BOARD_TOP - 4} width={6} height={BOARD_BOTTOM - BOARD_TOP + 8} rx={3}
      fill="var(--primary)" opacity={faint ? 0.35 : 1}
    />
  );
  return (
    <div className="tab-capo-neck">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`Capo on fret ${capo}`}>
        <rect x={NUT_X} y={BOARD_TOP} width={END_X - NUT_X} height={BOARD_BOTTOM - BOARD_TOP} rx={2} fill="var(--fretboard)" />
        {FRETS.map(f => INLAYS.includes(f) && (f === 12
          ? [-1, 1].map(k => <circle key={`${f}${k}`} cx={mid(f)} cy={MIDDLE + k * STRING_GAP * 1.5} r={2.5} fill="var(--inlay)" />)
          : <circle key={f} cx={mid(f)} cy={MIDDLE} r={2.5} fill="var(--inlay)" />))}
        {WIRES.map((x, n) => (n === 0
          ? <rect key="nut" x={x - 3} y={BOARD_TOP} width={4} height={BOARD_BOTTOM - BOARD_TOP} fill="var(--nut)" />
          : <line key={n} x1={x} y1={BOARD_TOP} x2={x} y2={BOARD_BOTTOM} stroke="var(--fret-wire)" strokeWidth={1.5} />))}
        {Array.from({ length: STRING_COUNT }, (_, i) => {
          // High e on top, as tab has it.
          const s = STRING_COUNT - 1 - i;
          const y = STRING_TOP + i * STRING_GAP;
          return (
            <g key={s}>
              <line x1={NUT_X} y1={y} x2={END_X} y2={y} stroke="var(--string)" strokeWidth={0.6 + s * 0.2} />
              <text x={NUT_X - 8} y={y + 3} fontSize={8} textAnchor="end" fill="var(--ink-muted)">{prettyNote(stringNote(tuning, s))}</text>
            </g>
          );
        })}
        {hover !== null && hover !== capo && capoBar(hover, true)}
        {capoBar(capo, false)}
        {FRETS.map(f => (
          <text key={f} x={mid(f)} y={NUMBER_Y} fontSize={7.5} textAnchor="middle" fill={f === capo ? 'var(--ink)' : 'var(--ink-muted)'} fontWeight={f === capo ? 700 : 400}>{f}</text>
        ))}
      </svg>
      {/* A button over the space of each fret a capo goes on; the dropdown is the way in from the keyboard. */}
      {PICKED.map(f => (
        <button
          key={f} type="button" tabIndex={-1} className="tab-capo-spot" aria-label={`Capo on fret ${f}`} aria-pressed={f === capo}
          style={{ left: `${(WIRES[f - 1] / WIDTH) * 100}%`, width: `${((WIRES[f] - WIRES[f - 1]) / WIDTH) * 100}%` }}
          onMouseEnter={() => setHover(f)} onMouseLeave={() => setHover(h => (h === f ? null : h))}
          onClick={() => onCapo(f)}
        />
      ))}
    </div>
  );
}
