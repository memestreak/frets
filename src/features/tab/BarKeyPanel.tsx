'use client';

import { useEffect, useRef } from 'react';
import { KeyPicker } from '@/components/KeyPicker';
import { prettyNote } from '@/lib/notation';
import { changesKey, keyAt, keyTonic, MAJOR_NAMES, MAX_FIFTHS, MINOR_NAMES, type Clip, type Key } from './clip';
import { keySigns } from './notation';
import { GLYPHS } from './smufl';

/** The mocked ways to pick a key (`?mock=a`, `b` or `c` on the page), until Jeremy picks one. */
export type KeyPanelMock = 'a' | 'b' | 'c';

const PITCH: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function pitchClass(name: string): number {
  return (PITCH[name[0]] + (name[1] === '#' ? 1 : name[1] === 'b' ? -1 : 0) + 12) % 12;
}

/** The key with this tonic, spelled as the tile names it where a key signature can (D♯ major is written E♭). */
export function keyOfTonic(tonic: string, minor: boolean): Key {
  const names = minor ? MINOR_NAMES : MAJOR_NAMES;
  let at = names.indexOf(tonic);
  if (at < 0) at = names.findIndex(n => pitchClass(n) === pitchClass(tonic));
  const fifths = at - MAX_FIFTHS;
  return minor ? { fifths, minor: true } : { fifths };
}

/**
 * The panel over the tab that sets the key signature from one bar on (issue #122), opened by the
 * palette's key signature button or a press on a drawn key signature, as the time signature's panel
 * is. Major or Minor, and the key: three mocked pickers (Jeremy picks one).
 */
export function BarKeyPanel({ clip, bar, x, y, mock, onChange, onClose }: {
  clip: Clip;
  bar: number;
  x: number;
  y: number;
  mock: KeyPanelMock;
  /** The key from this bar on, or null to take a later bar's change away. */
  onChange: (key: Key | null) => void;
  onClose: (byKey: boolean) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const key = keyAt(clip, bar);
  const minor = !!key.minor;
  const changed = changesKey(clip, bar);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) onClose(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(true);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Major or Minor keeps the key signature: G major becomes E minor, its relative.
  const setMinor = (m: boolean) => onChange(m ? { fifths: key.fifths, minor: true } : { fifths: key.fifths });
  const caption = bar === 0 ? 'Key signature' : `Key signature from bar ${bar + 1}`;
  return (
    <div ref={boxRef} className="tab-bar-time card tab-bar-key" style={{ left: x, top: y }} role="dialog" aria-label={caption}>
      <span className="tab-bar-time-title">
        {caption}: {prettyNote(keyTonic(key))} {minor ? 'minor' : 'major'}
      </span>
      {mock !== 'b' && (
        <span className="seg" role="group" aria-label="Major or minor">
          {[false, true].map(m => (
            <button key={String(m)} type="button" className="seg-opt" aria-pressed={minor === m} onClick={() => setMinor(m)}>
              {m ? 'Minor' : 'Major'}
            </button>
          ))}
        </span>
      )}
      {mock === 'a' && (
        <KeyPicker
          label="Key" value={keyTonic(key)}
          resolve={note => keyTonic(keyOfTonic(note, minor))}
          onPick={note => onChange(keyOfTonic(note, minor))}
        />
      )}
      {mock === 'b' && <KeyWheel value={key} onPick={onChange} />}
      {mock === 'c' && <SignatureGrid value={key} minor={minor} onPick={onChange} />}
      {bar > 0 && (
        <button type="button" className="btn btn-secondary tab-bar-time-remove" disabled={!changed} onClick={() => onChange(null)}>
          Remove the change
        </button>
      )}
    </div>
  );
}

/* — mock b: a small circle of fifths, majors outside and their relative minors inside — */

const WHEEL = 220;
/** Clockwise from the top: C, G, D … F; the three at the bottom have two spellings. */
const WHEEL_FIFTHS = [0, 1, 2, 3, 4, 5, 6, -5, -4, -3, -2, -1];

function KeyWheel({ value, onPick }: { value: Key; onPick: (key: Key) => void }) {
  const c = WHEEL / 2;
  const rings = { outer: [c - 2, c - 38], inner: [c - 40, c - 70] } as const;
  const sector = (k: number, [r0, r1]: readonly [number, number]) => {
    const a0 = ((k - 0.5) / 12) * 2 * Math.PI - Math.PI / 2;
    const a1 = ((k + 0.5) / 12) * 2 * Math.PI - Math.PI / 2;
    const p = (r: number, a: number) => `${c + r * Math.cos(a)} ${c + r * Math.sin(a)}`;
    return `M${p(r0, a0)} A${r0} ${r0} 0 0 1 ${p(r0, a1)} L${p(r1, a1)} A${r1} ${r1} 0 0 0 ${p(r1, a0)} Z`;
  };
  const labelAt = (k: number, r: number) => {
    const a = (k / 12) * 2 * Math.PI - Math.PI / 2;
    return { x: c + r * Math.cos(a), y: c + r * Math.sin(a) };
  };
  const cells: React.ReactNode[] = [];
  WHEEL_FIFTHS.forEach((fifths, k) => {
    for (const minor of [false, true]) {
      // At the bottom a key has two spellings (B or C♭, F♯ or G♭, D♭ or C♯): the cell shows both, a second press swaps.
      const twin = Math.abs(fifths) >= 5 ? fifths - Math.sign(fifths) * 12 : null;
      const options = [fifths, ...(twin !== null && Math.abs(twin) <= MAX_FIFTHS ? [twin] : [])];
      const ring = minor ? rings.inner : rings.outer;
      const on = options.includes(value.fifths) && !!value.minor === minor;
      const mid = labelAt(k, (ring[0] + ring[1]) / 2);
      cells.push(
        <g key={`${k}-${minor}`}>
          <path
            d={sector(k, ring)} fill={on ? 'var(--primary)' : minor ? 'var(--surface-sunken)' : 'var(--surface-raised)'}
            stroke="var(--line)" className="tab-key-cell" role="radio" aria-checked={on}
            aria-label={options.map(f => `${keyTonic({ fifths: f, ...(minor ? { minor: true as const } : {}) })} ${minor ? 'minor' : 'major'}`).join(' or ')}
            onClick={() => {
              // A press on a twin cell takes the spelling it already shows, else the plainer one.
              const pick = on && options.length > 1 ? options[(options.indexOf(value.fifths) + 1) % options.length] : options[0];
              onPick(minor ? { fifths: pick, minor: true } : { fifths: pick });
            }}
          />
          {options.map((f, i) => (
            <text
              key={f} x={mid.x} y={mid.y + 4 + (options.length > 1 ? (i === 0 ? -6 : 7) : 0)}
              fontSize={options.length > 1 ? 9 : minor ? 10 : 12} fontWeight={600} textAnchor="middle" pointerEvents="none"
              fill={on ? 'var(--on-primary)' : 'var(--ink)'}
              opacity={on && options.length > 1 && f !== value.fifths ? 0.6 : 1}
            >
              {prettyNote(keyTonic({ fifths: f, ...(minor ? { minor: true as const } : {}) }))}{minor ? 'm' : ''}
            </text>
          ))}
        </g>,
      );
    }
  });
  return (
    <svg width={WHEEL} height={WHEEL} viewBox={`0 0 ${WHEEL} ${WHEEL}`} role="radiogroup" aria-label="Key" fontFamily="var(--font-sans), sans-serif">
      {cells}
      <text x={c} y={c - 4} fontSize={10} textAnchor="middle" fill="var(--ink-muted)">Major outside</text>
      <text x={c} y={c + 10} fontSize={10} textAnchor="middle" fill="var(--ink-muted)">minor inside</text>
    </svg>
  );
}

/* — mock c: every key signature drawn small, flats to sharps, named for the mode chosen — */

const MINI_SPACE = 4;

function SignatureGrid({ value, minor, onPick }: { value: Key; minor: boolean; onPick: (key: Key) => void }) {
  const all = Array.from({ length: 2 * MAX_FIFTHS + 1 }, (_, k) => k - MAX_FIFTHS);
  return (
    <div className="tab-key-grid" role="radiogroup" aria-label="Key">
      {all.map(fifths => {
        const key: Key = minor ? { fifths, minor: true } : { fifths };
        const on = value.fifths === fifths;
        const signs = keySigns({ fifths });
        const width = 52;
        const bottom = 30;
        return (
          <button
            key={fifths} type="button" role="radio" aria-checked={on} className="tab-key-chip"
            aria-label={`${keyTonic(key)} ${minor ? 'minor' : 'major'}`} onClick={() => onPick(key)}
          >
            <svg width={width} height={36} viewBox={`0 0 ${width} 36`} aria-hidden="true">
              {[0, 2, 4, 6, 8].map(step => (
                <line key={step} x1={2} x2={width - 2} y1={bottom - step * MINI_SPACE / 2} y2={bottom - step * MINI_SPACE / 2} stroke="currentColor" strokeWidth={0.6} opacity={0.6} />
              ))}
              {signs.map(({ step, sharp }, k) => (
                <path
                  key={k} d={GLYPHS[sharp ? 'accidentalSharp' : 'accidentalFlat'].d} fill="currentColor"
                  transform={`translate(${5 + k * 6} ${bottom - step * MINI_SPACE / 2}) scale(${MINI_SPACE})`}
                />
              ))}
            </svg>
            <span>{prettyNote(keyTonic(key))}{minor ? 'm' : ''}</span>
          </button>
        );
      })}
    </div>
  );
}
